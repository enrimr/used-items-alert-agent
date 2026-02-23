/**
 * Servidor web Express para Wallapop Alertas
 * - GET  /           → Formulario para crear alerta
 * - POST /subscribe  → Crea nueva suscripción
 * - GET  /unsubscribe/:id → Elimina suscripción
 * - GET  /success    → Página de confirmación
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { createSubscription, getSubscription, deleteSubscription } = require('./db');
const { sendConfirmationEmail } = require('./mailer');
const { CATEGORIES } = require('../src/config');

const app = express();
// Railway injects PORT automatically; fallback to WEB_PORT or 3000
const PORT = process.env.PORT || process.env.WEB_PORT || 3000;

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting: máximo 5 suscripciones por IP cada 15 minutos
const subscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Demasiadas solicitudes. Espera unos minutos.',
});

// ────────────────────────────────────────────
// GET / → Página principal
// ────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ────────────────────────────────────────────
// POST /subscribe → Crear nueva alerta
// ────────────────────────────────────────────
app.post('/subscribe', subscribeLimiter, async (req, res) => {
  const { email, keywords, min_price, max_price, category_id } = req.body;

  // Validación básica
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

  try {
    const id = createSubscription({
      email,
      keywords: keywords.trim(),
      minPrice,
      maxPrice,
      categoryId: category_id || '',
    });

    const sub = getSubscription(id);

    // Enviar email de confirmación (no bloqueamos la respuesta)
    sendConfirmationEmail(email, sub).catch(err => {
      console.error('Error enviando confirmación:', err.message);
    });

    // Responder con JSON o redirigir según Accept header
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
// GET /unsubscribe/:id → Eliminar alerta
// ────────────────────────────────────────────
app.get('/unsubscribe/:id', (req, res) => {
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
      '#13c1ac'
    ));
  } else {
    return res.status(500).send(renderSimplePage(
      'Error',
      'No se pudo eliminar la alerta. Inténtalo de nuevo.',
      '#f87171'
    ));
  }
});

// ────────────────────────────────────────────
// GET /success → Página de éxito
// ────────────────────────────────────────────
app.get('/success', (req, res) => {
  const { keywords = '', email = '' } = req.query;
  res.send(renderSimplePage(
    '✅ ¡Alerta creada!',
    `Recibirás un email en <strong>${escapeHtml(email)}</strong> cuando aparezcan nuevos productos para "<strong>${escapeHtml(keywords)}</strong>".<br><br>
     <a href="/" style="display:inline-block;margin-top:8px;background:#13c1ac;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
       Crear otra alerta
     </a>`,
    '#13c1ac'
  ));
});

// ────────────────────────────────────────────
// GET /api/categories → Lista de categorías (para JS)
// ────────────────────────────────────────────
app.get('/api/categories', (req, res) => {
  const cats = Object.entries(CATEGORIES)
    .filter(([id]) => id !== '')
    .map(([id, name]) => ({ id, name }));
  res.json(cats);
});

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSimplePage(title, message, accentColor = '#13c1ac') {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — Wallapop Alertas</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f7fa;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:#fff;border-radius:16px;padding:40px 32px;max-width:480px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
    h1{font-size:24px;color:#1a1a2e;margin-bottom:16px}
    p{font-size:15px;color:#555;line-height:1.6}
    .bar{height:4px;background:${accentColor};border-radius:4px 4px 0 0;margin:-40px -32px 32px}
  </style>
</head>
<body>
  <div class="card">
    <div class="bar"></div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

// ────────────────────────────────────────────
// Arrancar servidor
// ────────────────────────────────────────────
function startServer() {
  return new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`🌐 Servidor web en http://localhost:${PORT}`);
      resolve();
    });
  });
}

module.exports = { startServer, app };
