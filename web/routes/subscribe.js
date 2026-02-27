/**
 * Subscribe routes:
 * GET  /           → Main page (with theme + AdSense injection)
 * POST /subscribe  → Create new alert
 * GET  /unsubscribe/:id → Deactivate alert
 * GET  /success    → Success page
 * GET  /api/categories → Category list
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const { injectTheme } = require('../theme');
const { escapeHtml, renderSimplePage } = require('../helpers');
const {
  createSubscription,
  getSubscription,
  deleteSubscription,
  countActiveAlertsByEmail,
  getAlertLimitForEmail,
} = require('../db');
const { sendConfirmationEmail } = require('../mailer');
const { CATEGORIES } = require('../../src/config');

// Rate limiting: max 5 subscribes per IP per 15 min
const subscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Demasiadas solicitudes. Espera unos minutos.',
});

// ────────────────────────────────────────────
// GET / → Main page
// ────────────────────────────────────────────
router.get('/', (req, res) => {
  const adsenseId = process.env.ADSENSE_CLIENT_ID;
  const htmlPath = path.join(__dirname, '../public', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Inject theme colors
  html = injectTheme(html);

  // Inject AdSense if configured
  if (adsenseId) {
    const adsenseScript = `\n  <!-- Google AdSense -->\n  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}" crossorigin="anonymous"></script>`;
    html = html.replace('</head>', `${adsenseScript}\n</head>`);
    html = html.replace(/__ADSENSE_CLIENT_ID__/g, adsenseId);
  }

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// ────────────────────────────────────────────
// POST /subscribe → Create new alert
// ────────────────────────────────────────────
router.post('/subscribe', subscribeLimiter, async (req, res) => {
  const { email, keywords, min_price, max_price, category_id, email_frequency } = req.body;

  if (!email || !keywords) {
    return res.status(400).json({ error: 'Email y palabras clave son requeridos' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email no válido' });
  }

  if (keywords.trim().length < 2) {
    return res.status(400).json({ error: 'Las palabras clave son demasiado cortas' });
  }

  const minPrice = min_price ? parseFloat(min_price) : null;
  const maxPrice = max_price ? parseFloat(max_price) : null;

  if (minPrice !== null && isNaN(minPrice)) {
    return res.status(400).json({ error: 'Precio mínimo no válido' });
  }
  if (maxPrice !== null && isNaN(maxPrice)) {
    return res.status(400).json({ error: 'Precio máximo no válido' });
  }
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    return res.status(400).json({ error: 'El precio mínimo no puede ser mayor que el máximo' });
  }

  const activeCount = countActiveAlertsByEmail(email);
  const limit = getAlertLimitForEmail(email);
  if (activeCount >= limit) {
    return res.status(429).json({
      error: `Has alcanzado el límite de ${limit} alerta${limit !== 1 ? 's' : ''} activa${limit !== 1 ? 's' : ''} para este email.`
    });
  }

  try {
    const id = createSubscription({
      email,
      keywords: keywords.trim(),
      minPrice,
      maxPrice,
      categoryId: category_id || '',
      frequency: email_frequency || 'immediate',
    });

    const sub = getSubscription(id);

    sendConfirmationEmail(email, sub).catch(err => {
      console.error('Error enviando confirmación:', err.message);
    });

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ success: true, id });
    }
    return res.redirect(`/success?keywords=${encodeURIComponent(keywords)}&email=${encodeURIComponent(email)}`);

  } catch (err) {
    console.error('Error creando suscripción:', err.message);
    return res.status(500).json({ error: 'Error interno. Inténtalo de nuevo.' });
  }
});

// ────────────────────────────────────────────
// GET /unsubscribe/:id → Deactivate alert
// ────────────────────────────────────────────
router.get('/unsubscribe/:id', (req, res) => {
  const { id } = req.params;
  const sub = getSubscription(id);

  if (!sub) {
    return res.status(404).send(renderSimplePage(
      '❌ Alerta no encontrada',
      'Esta alerta no existe o ya fue eliminada.',
      '#f87171'
    ));
  }

  const deleted = deleteSubscription(id);

  if (deleted) {
    return res.send(renderSimplePage(
      '✅ Alerta eliminada',
      `Tu alerta para "<strong>${escapeHtml(sub.keywords)}</strong>" ha sido eliminada correctamente.<br><br>Ya no recibirás más emails sobre esta búsqueda.`,
      '#f97316'
    ));
  }

  return res.status(500).send(renderSimplePage(
    'Error',
    'No se pudo eliminar la alerta. Inténtalo de nuevo.',
    '#f87171'
  ));
});

// ────────────────────────────────────────────
// GET /success → Success page
// ────────────────────────────────────────────
router.get('/success', (req, res) => {
  const { keywords = '', email = '' } = req.query;
  const { getThemeVars } = require('../theme');
  const t = getThemeVars();
  res.send(renderSimplePage(
    '✅ ¡Alerta creada!',
    `Recibirás un email en <strong>${escapeHtml(email)}</strong> cuando aparezcan nuevos productos para "<strong>${escapeHtml(keywords)}</strong>".<br><br>
     <a href="/" style="display:inline-block;margin-top:8px;background:${t.primary};color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
       Crear otra alerta
     </a>`,
    t.primary
  ));
});

// ────────────────────────────────────────────
// GET /api/categories → Category list
// ────────────────────────────────────────────
router.get('/api/categories', (req, res) => {
  const cats = Object.entries(CATEGORIES)
    .filter(([id]) => id !== '')
    .map(([id, name]) => ({ id, name }));
  res.json(cats);
});

module.exports = router;
