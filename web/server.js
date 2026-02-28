/**
 * Servidor web Express para Wallapop Alertas
 *
 * Monta los routers:
 *   web/routes/subscribe.js → rutas públicas (/, /subscribe, /unsubscribe, /success, /api/*)
 *   web/routes/admin.js     → panel /admin (autenticado)
 */

require('dotenv').config();

const express  = require('express');
const path     = require('path');
const rateLimit = require('express-rate-limit');
const app = express();

// Railway injects PORT automatically; fallback to WEB_PORT or 3000
const PORT = process.env.PORT || process.env.WEB_PORT || 3000;

// Trust Railway/Render/proxy X-Forwarded-For header for rate limiting
app.set('trust proxy', 1);

// ─── Middlewares globales ──────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.json({ limit: '16kb' }));

// Rate limit global: 300 req / 15 min por IP (protege todas las rutas)
// Las rutas sensibles tienen limitadores propios más estrictos (p.ej. /subscribe: 5/15min)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutos
  max:      parseInt(process.env.GLOBAL_RATE_LIMIT || '300', 10),
  standardHeaders: true,        // devuelve RateLimit-* headers estándar
  legacyHeaders:   false,
  message: 'Demasiadas solicitudes. Inténtalo más tarde.',
  skip: (req) => req.path.startsWith('/admin'), // admin tiene su propia auth
}));
// Static files (CSS, JS, imágenes). index: false para que GET / pase por el router
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ─── Routers ──────────────────────────────────────────────────────────────
app.use('/', require('./routes/subscribe'));
app.use('/admin', require('./routes/admin'));

// ─── Arrancar servidor ─────────────────────────────────────────────────────
function startServer() {
  return new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`🌐 Servidor web en http://localhost:${PORT}`);
      resolve();
    });
  });
}

module.exports = { startServer, app };
