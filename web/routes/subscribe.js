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

const { injectTheme, getThemeVars } = require('../theme');
const { escapeHtml, renderSimplePage } = require('../helpers');
const { renderTemplate } = require('../views/render');
const {
  createSubscription,
  getSubscription,
  verifySubscription,
  deleteSubscription,
  countActiveAlertsByEmail,
  getAlertLimitForEmail,
} = require('../db');
const { sendConfirmationEmail, sendVerificationEmail } = require('../../src/mailer');
const { CATEGORIES } = require('../../src/categories');
const { v4: uuidv4 } = require('uuid');

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
  const {
    email, keywords, min_price, max_price,
    category_id, email_frequency, shipping_only,
  } = req.body;

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

  // ¿Requiere verificación de email?
  const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
  const verificationToken    = requireVerification ? uuidv4() : null;
  const shippingOnly         = shipping_only === 'true' || shipping_only === true || shipping_only === '1';

  try {
    const id = createSubscription({
      email,
      keywords:          keywords.trim(),
      minPrice,
      maxPrice,
      categoryId:        category_id || '',
      frequency:         email_frequency || 'immediate',
      shippingOnly,
      verified:          !requireVerification,   // verificado automáticamente si no se exige
      verificationToken,
    });

    const sub = getSubscription(id);

    if (requireVerification) {
      // Enviar email de verificación en lugar de confirmación
      sendVerificationEmail(email, sub).catch(err => {
        console.error('Error enviando verificación:', err.message);
      });
    } else {
      sendConfirmationEmail(email, sub).catch(err => {
        console.error('Error enviando confirmación:', err.message);
      });
    }

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        success: true,
        id,
        pendingVerification: requireVerification,
      });
    }

    const successQuery = requireVerification
      ? `?keywords=${encodeURIComponent(keywords)}&email=${encodeURIComponent(email)}&verify=1`
      : `?keywords=${encodeURIComponent(keywords)}&email=${encodeURIComponent(email)}`;
    return res.redirect(`/success${successQuery}`);

  } catch (err) {
    console.error('Error creando suscripción:', err.message);
    return res.status(500).json({ error: 'Error interno. Inténtalo de nuevo.' });
  }
});

// ────────────────────────────────────────────
// GET /verify/:token → Verify email and activate alert
// ────────────────────────────────────────────
router.get('/verify/:token', (req, res) => {
  const { token } = req.params;
  const sub = verifySubscription(token);

  if (!sub) {
    return res.status(404).send(renderSimplePage(
      '❌ Enlace no válido',
      'Este enlace de verificación no existe o ya fue utilizado.',
      '#f87171'
    ));
  }

  const t = getThemeVars();
  return res.send(renderSimplePage(
    '✅ ¡Email verificado!',
    `Tu alerta para "<strong>${escapeHtml(sub.keywords)}</strong>" está activa.<br><br>
     Te avisaremos en <strong>${escapeHtml(sub.email)}</strong> cuando aparezcan nuevos productos.<br><br>
     <a href="/" style="display:inline-block;margin-top:8px;background:${t.primary};color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
       Crear otra alerta
     </a>`,
    t.primary
  ));
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
  const t = getThemeVars();
  res.send(renderTemplate('success', {
    primary:  t.primary,
    email:    escapeHtml(email),
    keywords: escapeHtml(keywords),
  }));
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
