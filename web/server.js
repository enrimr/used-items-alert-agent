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
const {
  createSubscription, getSubscription, deleteSubscription,
  getAllSubscriptions, getStats, getEmailStats,
  countActiveAlertsByEmail, getAlertLimitForEmail, setAlertLimitForEmail,
} = require('./db');
const { sendConfirmationEmail } = require('./mailer');
const { CATEGORIES } = require('../src/config');

const app = express();
// Railway injects PORT automatically; fallback to WEB_PORT or 3000
const PORT = process.env.PORT || process.env.WEB_PORT || 3000;

// Trust Railway/Render/proxy X-Forwarded-For header for rate limiting
app.set('trust proxy', 1);

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
// GET / → Página principal (con AdSense si está configurado)
// ────────────────────────────────────────────
app.get('/', (req, res) => {
  const adsenseId = process.env.ADSENSE_CLIENT_ID;

  // If no AdSense ID configured, serve static file directly (faster)
  if (!adsenseId) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  // Inject AdSense script + replace client ID placeholder in ad slots
  const fs = require('fs');
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // 1. Inject the AdSense loader script in <head>
  const adsenseScript = `\n  <!-- Google AdSense -->\n  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}" crossorigin="anonymous"></script>`;
  html = html.replace('</head>', `${adsenseScript}\n</head>`);

  // 2. Replace placeholder in ad slot ins tags
  html = html.replace(/__ADSENSE_CLIENT_ID__/g, adsenseId);

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
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

  // Check alert limit per email
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
  const emailStats = getEmailStats();

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

  const subsRows = subs.map(s => `
    <tr class="${s.active ? '' : 'inactive'}">
      <td><span class="badge ${s.active ? 'badge-active' : 'badge-inactive'}">${s.active ? 'Activa' : 'Inactiva'}</span></td>
      <td><strong>${escapeHtml(s.keywords)}</strong></td>
      <td style="font-size:12px">${escapeHtml(s.email)}</td>
      <td>${formatPrice(s.min_price, s.max_price)}</td>
      <td>${s.category_id ? (CATEGORY_NAMES[s.category_id] || s.category_id) : '—'}</td>
      <td style="font-size:12px">${formatDate(s.created_at)}</td>
      <td style="font-size:12px">${formatDate(s.last_run_at)}</td>
      <td>${s.emails_sent || 0}</td>
      <td>
        ${s.active ? `<a href="/admin/delete/${s.id}" class="btn-delete" onclick="return confirm('¿Eliminar esta alerta?')">Eliminar</a>` : '—'}
      </td>
    </tr>
  `).join('');

  const emailRows = emailStats.map(e => `
    <tr>
      <td style="font-size:12px">${escapeHtml(e.email)}</td>
      <td>
        <span style="font-weight:700;color:#13c1ac">${e.active_alerts}</span>
        <span style="color:#9ca3af;font-size:11px"> activas de ${e.total_alerts} creadas</span>
      </td>
      <td>${e.total_emails_sent || 0}</td>
      <td>
        <form method="POST" action="/admin/set-limit" style="display:flex;gap:6px;align-items:center;">
          <input type="hidden" name="email" value="${escapeHtml(e.email)}" />
          <span style="font-size:12px;color:#6b7280;">Máx:</span>
          <input type="number" name="max_alerts" value="${e.max_alerts}" min="0" max="100"
            title="Número máximo de alertas activas permitidas para este email"
            style="width:60px;padding:4px 8px;border:1px solid #d1fae5;border-radius:6px;font-size:13px;text-align:center;" />
          <button type="submit" class="btn-save">Guardar</button>
        </form>
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
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0fdf9; color: #1a1a2e; }

    /* Header */
    header { background: linear-gradient(135deg, #13c1ac, #0ea897); padding: 16px 20px; }
    header h1 { color: #fff; font-size: 17px; font-weight: 800; }

    /* Nav */
    .nav { display: flex; gap: 12px; padding: 12px 16px; background: #fff; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
    .nav a { color: #13c1ac; font-size: 13px; text-decoration: none; font-weight: 600; }
    .nav a:hover { text-decoration: underline; }

    /* Stats */
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 16px; }
    .stat { background: #fff; border-radius: 10px; padding: 14px 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-align: center; }
    .stat .num { font-size: 24px; font-weight: 800; color: #13c1ac; }
    .stat .lbl { font-size: 11px; color: #6b7280; margin-top: 2px; }

    /* Sections */
    .section { padding: 8px 16px 24px; }
    .section h2 { font-size: 13px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }

    /* Cards layout for mobile (replaces horizontal table) */
    .card-list { display: flex; flex-direction: column; gap: 10px; }
    .card { background: #fff; border-radius: 10px; padding: 14px 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
    .card-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
    .card-row:last-child { margin-bottom: 0; }
    .card-label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.4px; min-width: 80px; }
    .card-value { font-size: 13px; color: #1a1a2e; text-align: right; flex: 1; word-break: break-word; }

    /* Desktop: show as table */
    .desktop-table { display: none; }

    /* Badges */
    .badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; white-space: nowrap; }
    .badge-active { background: #d1fae5; color: #065f46; }
    .badge-inactive { background: #f3f4f6; color: #9ca3af; }

    /* Buttons */
    .btn-delete { color: #ef4444; text-decoration: none; font-size: 12px; font-weight: 600; padding: 5px 12px; border: 1px solid #fecaca; border-radius: 6px; display: inline-block; }
    .btn-delete:hover { background: #fef2f2; }
    .btn-save { background: #13c1ac; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-save:hover { background: #0ea897; }

    /* Limit form */
    .limit-form { display: flex; gap: 6px; align-items: center; justify-content: flex-end; }
    .limit-form input { width: 60px; padding: 5px 8px; border: 1px solid #d1fae5; border-radius: 6px; font-size: 13px; text-align: center; }
    .limit-form .lbl-max { font-size: 12px; color: #6b7280; }

    /* Desktop breakpoint */
    @media (min-width: 768px) {
      header { padding: 20px 32px; }
      header h1 { font-size: 20px; }
      .nav { padding: 12px 32px; }
      .stats { grid-template-columns: repeat(3, auto); justify-content: start; padding: 20px 32px 8px; gap: 16px; }
      .stat { padding: 16px 28px; }
      .stat .num { font-size: 28px; }
      .section { padding: 8px 32px 32px; }

      .card-list { display: none; }
      .desktop-table { display: table; width: 100%; border-collapse: collapse; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
      .desktop-table th { background: #f8fffe; padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb; }
      .desktop-table td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
      .desktop-table tr.inactive td { opacity: 0.45; }
      .desktop-table tr:last-child td { border-bottom: none; }
      .desktop-table tr:hover td { background: #f0fdf9; }
    }
  </style>
</head>
<body>
  <header><h1>🔧 Admin — Wallapop Alertas</h1></header>

  <nav class="nav">
    <a href="/">← Volver a la web</a>
  </nav>

  <div class="stats">
    <div class="stat"><div class="num">${stats.totalActive}</div><div class="lbl">Activas</div></div>
    <div class="stat"><div class="num">${stats.totalAll}</div><div class="lbl">Total</div></div>
    <div class="stat"><div class="num">${stats.totalSeen}</div><div class="lbl">Procesados</div></div>
  </div>

  <!-- USUARIOS (mobile cards + desktop table) -->
  <div class="section">
    <h2>📧 Usuarios y límites</h2>

    <!-- Mobile cards -->
    <div class="card-list">
      ${emailStats.length === 0 ? '<p style="color:#9ca3af;font-size:13px;padding:8px 0">Sin usuarios todavía</p>' : emailStats.map(e => `
        <div class="card">
          <div class="card-row">
            <span class="card-label">Email</span>
            <span class="card-value" style="font-size:12px">${escapeHtml(e.email)}</span>
          </div>
          <div class="card-row">
            <span class="card-label">Alertas</span>
            <span class="card-value"><strong style="color:#13c1ac">${e.active_alerts}</strong> activas de ${e.total_alerts}</span>
          </div>
          <div class="card-row">
            <span class="card-label">Emails env.</span>
            <span class="card-value">${e.total_emails_sent || 0}</span>
          </div>
          <div class="card-row">
            <span class="card-label">Límite máx.</span>
            <span class="card-value">
              <form method="POST" action="/admin/set-limit" class="limit-form">
                <input type="hidden" name="email" value="${escapeHtml(e.email)}" />
                <input type="number" name="max_alerts" value="${e.max_alerts}" min="0" max="100" />
                <button type="submit" class="btn-save">Guardar</button>
              </form>
            </span>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Desktop table -->
    <table class="desktop-table">
      <thead><tr>
        <th>Email</th><th>Alertas activas / total</th><th>Emails enviados</th><th>Límite</th>
      </tr></thead>
      <tbody>
        ${emailRows || '<tr><td colspan="4" style="text-align:center;padding:24px;color:#9ca3af">Sin usuarios todavía</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- ALERTAS (mobile cards + desktop table) -->
  <div class="section">
    <h2>🔔 Alertas</h2>

    <!-- Mobile cards -->
    <div class="card-list">
      ${subs.length === 0 ? '<p style="color:#9ca3af;font-size:13px;padding:8px 0">No hay alertas todavía</p>' : subs.map(s => `
        <div class="card" style="${s.active ? '' : 'opacity:0.5'}">
          <div class="card-row">
            <span class="card-label">Estado</span>
            <span class="card-value"><span class="badge ${s.active ? 'badge-active' : 'badge-inactive'}">${s.active ? 'Activa' : 'Inactiva'}</span></span>
          </div>
          <div class="card-row">
            <span class="card-label">Búsqueda</span>
            <span class="card-value"><strong>${escapeHtml(s.keywords)}</strong></span>
          </div>
          <div class="card-row">
            <span class="card-label">Email</span>
            <span class="card-value" style="font-size:12px">${escapeHtml(s.email)}</span>
          </div>
          <div class="card-row">
            <span class="card-label">Precio</span>
            <span class="card-value">${formatPrice(s.min_price, s.max_price)}</span>
          </div>
          <div class="card-row">
            <span class="card-label">Emails</span>
            <span class="card-value">${s.emails_sent || 0}</span>
          </div>
          ${s.active ? `
          <div class="card-row" style="margin-top:6px">
            <a href="/admin/delete/${s.id}" class="btn-delete" onclick="return confirm('¿Eliminar esta alerta?')" style="width:100%;text-align:center;">Eliminar alerta</a>
          </div>` : ''}
        </div>
      `).join('')}
    </div>

    <!-- Desktop table -->
    <table class="desktop-table">
      <thead><tr>
        <th>Estado</th><th>Búsqueda</th><th>Email</th><th>Precio</th>
        <th>Categoría</th><th>Creada</th><th>Último run</th><th>Emails</th><th>Acción</th>
      </tr></thead>
      <tbody>
        ${subsRows || '<tr><td colspan="9" style="text-align:center;padding:24px;color:#9ca3af">No hay alertas todavía</td></tr>'}
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

app.post('/admin/set-limit', adminAuth, (req, res) => {
  const { email, max_alerts } = req.body;
  if (email && max_alerts !== undefined) {
    setAlertLimitForEmail(email, Math.max(0, parseInt(max_alerts, 10) || 0));
  }
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
