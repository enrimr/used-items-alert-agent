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
const { createSubscription, getSubscription, deleteSubscription, getAllSubscriptions, getStats } = require('./db');
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
// GET /admin → Dashboard de alertas (protegido)
// ────────────────────────────────────────────
function adminAuth(req, res, next) {
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) {
    return res.status(503).send(renderSimplePage('Admin desactivado', 'Configura ADMIN_PASSWORD en .env para activar el panel de administración.', '#f59e0b'));
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Wallapop Alertas Admin"');
    return res.status(401).send('Autenticación requerida');
  }
  const b64 = authHeader.slice(6);
  const decoded = Buffer.from(b64, 'base64').toString('utf8');
  const [, pass] = decoded.split(':');
  if (pass !== adminPass) {
    res.set('WWW-Authenticate', 'Basic realm="Wallapop Alertas Admin"');
    return res.status(401).send('Contraseña incorrecta');
  }
  next();
}

app.get('/admin', adminAuth, (req, res) => {
  const subs = getAllSubscriptions();
  const stats = getStats();

  const CATEGORY_NAMES = Object.fromEntries(
    Object.entries(CATEGORIES).filter(([id]) => id !== '')
  );

  function formatDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  }

  function formatPrice(min, max) {
    if (!min && !max) return '—';
    if (min && max) return `${min}€ – ${max}€`;
    if (min) return `≥ ${min}€`;
    return `≤ ${max}€`;
  }

  const rows = subs.map(s => `
    <tr class="${s.active ? '' : 'inactive'}">
      <td><span class="badge ${s.active ? 'badge-active' : 'badge-inactive'}">${s.active ? 'Activa' : 'Inactiva'}</span></td>
      <td><strong>${escapeHtml(s.keywords)}</strong></td>
      <td>${escapeHtml(s.email)}</td>
      <td>${formatPrice(s.min_price, s.max_price)}</td>
      <td>${s.category_id ? (CATEGORY_NAMES[s.category_id] || s.category_id) : '—'}</td>
      <td>${formatDate(s.created_at)}</td>
      <td>${formatDate(s.last_run_at)}</td>
      <td>
        ${s.active ? `<a href="/admin/delete/${s.id}" class="btn-delete" onclick="return confirm('¿Eliminar esta alerta?')">Eliminar</a>` : '—'}
      </td>
    </tr>
  `).join('');

  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Admin — Wallapop Alertas</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0fdf9;color:#1a1a2e}
    header{background:linear-gradient(135deg,#13c1ac,#0ea897);padding:20px 32px;display:flex;align-items:center;gap:12px}
    header h1{color:#fff;font-size:20px;font-weight:800}
    header .sub{color:rgba(255,255,255,0.8);font-size:13px;margin-left:auto}
    .stats{display:flex;gap:16px;padding:24px 32px 8px;flex-wrap:wrap}
    .stat{background:#fff;border-radius:10px;padding:16px 24px;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-align:center}
    .stat .num{font-size:28px;font-weight:800;color:#13c1ac}
    .stat .lbl{font-size:12px;color:#6b7280;margin-top:2px}
    .table-wrap{padding:8px 32px 40px;overflow-x:auto}
    table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
    th{background:#f8fffe;padding:11px 14px;text-align:left;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb}
    td{padding:11px 14px;font-size:13px;border-bottom:1px solid #f3f4f6;vertical-align:middle}
    tr.inactive td{opacity:0.45}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#f0fdf9}
    .badge{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
    .badge-active{background:#d1fae5;color:#065f46}
    .badge-inactive{background:#f3f4f6;color:#9ca3af}
    .btn-delete{color:#ef4444;text-decoration:none;font-size:12px;font-weight:600;padding:4px 10px;border:1px solid #fecaca;border-radius:6px}
    .btn-delete:hover{background:#fef2f2}
    .back{display:inline-block;margin:0 32px 16px;color:#13c1ac;font-size:13px;text-decoration:none}
    .back:hover{text-decoration:underline}
    @media(max-width:600px){.stats{padding:16px};.table-wrap{padding:8px 12px 32px}}
  </style>
</head>
<body>
  <header>
    <div>
      <h1>🔧 Panel de Administración</h1>
      <div class="sub">Wallapop Alertas</div>
    </div>
  </header>

  <div class="stats">
    <div class="stat"><div class="num">${stats.totalActive}</div><div class="lbl">Alertas activas</div></div>
    <div class="stat"><div class="num">${stats.totalAll}</div><div class="lbl">Total creadas</div></div>
    <div class="stat"><div class="num">${stats.totalSeen}</div><div class="lbl">Productos procesados</div></div>
  </div>

  <a href="/" class="back">← Volver a la web</a>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Estado</th>
          <th>Búsqueda</th>
          <th>Email</th>
          <th>Precio</th>
          <th>Categoría</th>
          <th>Creada</th>
          <th>Último run</th>
          <th>Acción</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="8" style="text-align:center;padding:32px;color:#9ca3af">No hay alertas creadas todavía</td></tr>'}
      </tbody>
    </table>
  </div>
</body>
</html>`);
});

app.get('/admin/delete/:id', adminAuth, (req, res) => {
  const { id } = req.params;
  deleteSubscription(id);
  res.redirect('/admin');
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
