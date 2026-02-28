/**
 * Tests de integración para web/routes/admin.js
 *
 * Usa supertest para hacer peticiones HTTP reales contra la app Express,
 * y una BD SQLite temporal para no contaminar los datos de desarrollo.
 *
 * Qué se prueba:
 *   - Autenticación Basic Auth (/admin)
 *   - GET /admin → renderiza el dashboard HTML
 *   - POST /admin/delete/:id → desactiva alerta
 *   - POST /admin/reactivate/:id → reactiva alerta
 *   - POST /admin/hard-delete/:id → borrado permanente
 *   - POST /admin/edit/:id → edita keywords/precio
 *   - POST /admin/set-frequency → cambia frecuencia
 *   - POST /admin/set-limit → ajusta límite por email
 */

const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ── BD temporal ────────────────────────────────────────────────────────────
const TEST_DB = path.join(os.tmpdir(), `wallapop-admin-test-${Date.now()}.db`);
process.env.DB_PATH       = TEST_DB;
process.env.ADMIN_PASSWORD = 'testpass';
process.env.THEME_COLOR   = 'neutral';
process.env.BASE_URL      = 'http://localhost:3000';

// Limpiar cache de módulos con estado
['web/db', 'web/server', 'web/routes/admin', 'web/routes/subscribe'].forEach(m => {
  Object.keys(require.cache).forEach(k => { if (k.includes(m)) delete require.cache[k]; });
});

const request = require('supertest');
const db      = require('../web/db');
const { app } = require('../web/server');

// Credenciales para Basic Auth
const AUTH = { user: 'admin', pass: 'testpass' };

afterAll(() => {
  try { fs.unlinkSync(TEST_DB); } catch (e) {}
});

// ── Helper: crear suscripción de prueba ────────────────────────────────────
function createSub(overrides = {}) {
  return db.createSubscription({
    email:      overrides.email      || 'test@example.com',
    keywords:   overrides.keywords   || 'ps5',
    minPrice:   overrides.minPrice   ?? null,
    maxPrice:   overrides.maxPrice   ?? null,
    categoryId: overrides.categoryId || '',
    frequency:  overrides.frequency  || 'immediate',
  });
}

// ── Autenticación ──────────────────────────────────────────────────────────

describe('GET /admin — autenticación', () => {
  test('devuelve 401 sin credenciales', async () => {
    const res = await request(app).get('/admin');
    expect(res.status).toBe(401);
  });

  test('devuelve 401 con contraseña incorrecta', async () => {
    const res = await request(app).get('/admin').auth('admin', 'wrong');
    expect(res.status).toBe(401);
  });

  test('devuelve 200 con credenciales correctas', async () => {
    const res = await request(app).get('/admin').auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Admin');
  });
});

// ── Dashboard ──────────────────────────────────────────────────────────────

describe('GET /admin — dashboard', () => {
  test('contiene las secciones esperadas', async () => {
    const res = await request(app).get('/admin').auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Alertas activas');
    expect(res.text).toContain('Emails enviados');
    expect(res.text).toContain('Usuarios y límites');
  });

  test('muestra las suscripciones existentes', async () => {
    createSub({ email: 'visible@example.com', keywords: 'nintendo-switch' });
    const res = await request(app).get('/admin').auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(200);
    expect(res.text).toContain('nintendo-switch');
  });
});

// ── POST /admin/delete/:id ─────────────────────────────────────────────────

describe('POST /admin/delete/:id', () => {
  test('desactiva una alerta activa y redirige a /admin', async () => {
    const id = createSub({ keywords: 'delete-test' });
    expect(db.getSubscription(id).active).toBe(1);

    const res = await request(app)
      .post(`/admin/delete/${id}`)
      .auth(AUTH.user, AUTH.pass);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/admin');
    expect(db.getSubscription(id).active).toBe(0);
  });

  test('no falla con un ID inexistente', async () => {
    const res = await request(app)
      .post('/admin/delete/id-fantasma')
      .auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(302);
  });

  test('GET /admin/delete/:id devuelve 404 (ruta solo acepta POST)', async () => {
    const id = createSub({ keywords: 'get-delete-test' });
    const res = await request(app)
      .get(`/admin/delete/${id}`)
      .auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(404);
    expect(db.getSubscription(id).active).toBe(1); // no modificado
  });
});

// ── POST /admin/reactivate/:id ─────────────────────────────────────────────

describe('POST /admin/reactivate/:id', () => {
  test('reactiva una alerta desactivada', async () => {
    const id = createSub({ keywords: 'reactivate-test' });
    db.deleteSubscription(id);
    expect(db.getSubscription(id).active).toBe(0);

    const res = await request(app)
      .post(`/admin/reactivate/${id}`)
      .auth(AUTH.user, AUTH.pass);

    expect(res.status).toBe(302);
    expect(db.getSubscription(id).active).toBe(1);
  });
});

// ── POST /admin/hard-delete/:id ────────────────────────────────────────────

describe('POST /admin/hard-delete/:id', () => {
  test('elimina permanentemente la suscripción', async () => {
    const id = createSub({ keywords: 'hard-delete-test' });
    expect(db.getSubscription(id)).toBeTruthy(); // existe antes de borrar

    const res = await request(app)
      .post(`/admin/hard-delete/${id}`)
      .auth(AUTH.user, AUTH.pass);

    expect(res.status).toBe(302);
    // better-sqlite3 .get() devuelve undefined (no null) cuando no existe
    expect(db.getSubscription(id)).toBeFalsy();
  });

  test('GET /admin/hard-delete/:id devuelve 404', async () => {
    const id = createSub({ keywords: 'hard-delete-get-test' });
    const res = await request(app)
      .get(`/admin/hard-delete/${id}`)
      .auth(AUTH.user, AUTH.pass);
    expect(res.status).toBe(404);
    expect(db.getSubscription(id)).toBeTruthy(); // no eliminado
  });
});

// ── POST /admin/edit/:id ───────────────────────────────────────────────────

describe('POST /admin/edit/:id', () => {
  test('actualiza keywords, precio y categoría', async () => {
    const id = createSub({ keywords: 'original', minPrice: null, maxPrice: null });

    const res = await request(app)
      .post(`/admin/edit/${id}`)
      .auth(AUTH.user, AUTH.pass)
      .send({ keywords: 'actualizado', min_price: '50', max_price: '200', category_id: '12461' });

    expect(res.status).toBe(302);
    const sub = db.getSubscription(id);
    expect(sub.keywords).toBe('actualizado');
    expect(sub.min_price).toBe(50);
    expect(sub.max_price).toBe(200);
    expect(sub.category_id).toBe('12461');
  });

  test('ignora la edición si keywords tiene menos de 2 caracteres', async () => {
    const id = createSub({ keywords: 'intacto' });
    await request(app)
      .post(`/admin/edit/${id}`)
      .auth(AUTH.user, AUTH.pass)
      .send({ keywords: 'x', min_price: '', max_price: '', category_id: '' });
    expect(db.getSubscription(id).keywords).toBe('intacto');
  });
});

// ── POST /admin/set-frequency ──────────────────────────────────────────────

describe('POST /admin/set-frequency', () => {
  test('cambia la frecuencia a daily', async () => {
    const id = createSub({ keywords: 'freq-test', frequency: 'immediate' });

    const res = await request(app)
      .post('/admin/set-frequency')
      .auth(AUTH.user, AUTH.pass)
      .send({ id, frequency: 'daily' });

    expect(res.status).toBe(302);
    expect(db.getSubscription(id).email_frequency).toBe('daily');
  });

  test('cambia la frecuencia a weekly', async () => {
    const id = createSub({ keywords: 'freq-weekly-test' });
    await request(app)
      .post('/admin/set-frequency')
      .auth(AUTH.user, AUTH.pass)
      .send({ id, frequency: 'weekly' });
    expect(db.getSubscription(id).email_frequency).toBe('weekly');
  });
});

// ── POST /admin/set-limit ──────────────────────────────────────────────────

describe('POST /admin/set-limit', () => {
  test('establece el límite de alertas para un email', async () => {
    const email = `limit-test-${Date.now()}@example.com`;

    const res = await request(app)
      .post('/admin/set-limit')
      .auth(AUTH.user, AUTH.pass)
      .send({ email, max_alerts: '5' });

    expect(res.status).toBe(302);
    expect(db.getAlertLimitForEmail(email)).toBe(5);
  });

  test('no permite límites negativos (los convierte a 0)', async () => {
    const email = `limit-neg-${Date.now()}@example.com`;
    await request(app)
      .post('/admin/set-limit')
      .auth(AUTH.user, AUTH.pass)
      .send({ email, max_alerts: '-3' });
    expect(db.getAlertLimitForEmail(email)).toBe(0);
  });
});
