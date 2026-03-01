/**
 * Servidor web Express para Wallapop Alertas
 *
 * Monta los routers:
 *   web/routes/subscribe.js → rutas públicas (/, /subscribe, /unsubscribe, /success, /api/*)
 *   web/routes/admin.js     → panel /admin (autenticado)
 */

require('dotenv').config();

const express    = require('express');
const path       = require('path');
const rateLimit  = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { doubleCsrf } = require('csrf-csrf');
const app = express();

// Railway injects PORT automatically; fallback to WEB_PORT or 3000
const PORT = process.env.PORT || process.env.WEB_PORT || 3000;

// Trust Railway/Render/proxy X-Forwarded-For header for rate limiting
app.set('trust proxy', 1);

// ─── Middlewares globales ──────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());

// Rate limit global: 300 req / 15 min por IP (protege todas las rutas)
// Las rutas sensibles tienen limitadores propios más estrictos (p.ej. /subscribe: 5/15min)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.GLOBAL_RATE_LIMIT || '300', 10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: 'Demasiadas solicitudes. Inténtalo más tarde.',
  skip: (req) => req.path.startsWith('/admin'),
}));

// ─── CSRF protection ──────────────────────────────────────────────────────
// Activar con CSRF_ENABLED=true en .env (por defecto: false en local).
// En producción se recomienda activarlo siempre.
// Desactivado automáticamente en NODE_ENV=test.
const csrfEnabled = process.env.CSRF_ENABLED === 'true' && process.env.NODE_ENV !== 'test';
if (csrfEnabled) {
  const csrfSecret = process.env.CSRF_SECRET || 'wallapop-csrf-secret-dev-change-in-prod';

  const isProd = process.env.NODE_ENV === 'production';
  const { generateToken, doubleCsrfProtection } = doubleCsrf({
    getSecret:    () => csrfSecret,
    // Sin prefijo __Host- en desarrollo (requiere HTTPS)
    cookieName:   isProd ? '__Host-csrf-token' : 'csrf-token',
    cookieOptions: {
      httpOnly: true,
      sameSite: 'strict',
      secure:   isProd,
      path:     '/',
    },
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getTokenFromRequest: (req) => {
      return req.body?._csrf || req.headers['x-csrf-token'];
    },
  });

  app.locals.generateCsrfToken    = generateToken;
  app.locals.doubleCsrfProtection = doubleCsrfProtection;
}

// Static files (CSS, JS, imágenes). index: false para que GET / pase por el router
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ─── i18n ─────────────────────────────────────────────────────────────────
const { i18nMiddleware } = require('./i18n');
app.use(i18nMiddleware);

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
