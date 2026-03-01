/**
 * Tests de integración para web/routes/subscribe.js
 *
 * Cubre:
 *   GET  /              → página principal
 *   POST /subscribe     → validaciones + creación de alerta
 *   GET  /unsubscribe/:id → cancelación de alerta
 *   GET  /success       → página de confirmación
 *   GET  /api/categories → lista de categorías
 */

const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ── BD temporal ────────────────────────────────────────────────────────────
const TEST_DB = path.join(os.tmpdir(), `wallapop-sub-test-${Date.now()}.db`);
process.env.DB_PATH    = TEST_DB;
process.env.THEME_COLOR = 'teal';
process.env.BASE_URL   = 'http://localhost:3000';

// Limpiar cache de módulos con estado antes de cargarlos
['web/db', 'web/server', 'web/routes/subscribe'].forEach(m => {
  Object.keys(require.cache).forEach(k => { if (k.includes(m)) delete require.cache[k]; });
});

// Mock del módulo de email para no hacer peticiones reales
jest.mock('../src/mailer', () => ({
  sendConfirmationEmail:  jest.fn().mockResolvedValue(true),
  sendVerificationEmail:  jest.fn().mockResolvedValue(true),
  sendAlertEmail:         jest.fn().mockResolvedValue(true),
  sendAdminAlert:         jest.fn().mockResolvedValue(true),
  verifyEmailConfig:      jest.fn().mockResolvedValue({ ok: true }),
}));

const request = require('supertest');
const db      = require('../web/db');
const { app } = require('../web/server');

afterAll(() => {
  try { fs.unlinkSync(TEST_DB); } catch (e) {}
});

// ── GET / ──────────────────────────────────────────────────────────────────

describe('GET /', () => {
  test('devuelve 200 con HTML de la página principal', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});

// ── GET /api/categories ────────────────────────────────────────────────────

describe('GET /api/categories', () => {
  test('devuelve JSON con lista de categorías', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('cada categoría tiene id y name', async () => {
    const res = await request(app).get('/api/categories');
    res.body.forEach(cat => {
      expect(cat).toHaveProperty('id');
      expect(cat).toHaveProperty('name');
      expect(typeof cat.name).toBe('string');
    });
  });

  test('no incluye la entrada de "todas las categorías" (id vacío)', async () => {
    const res = await request(app).get('/api/categories');
    const emptyId = res.body.find(c => c.id === '');
    expect(emptyId).toBeUndefined();
  });
});

// ── GET /success ───────────────────────────────────────────────────────────

describe('GET /success', () => {
  test('renderiza la página de éxito con keywords y email', async () => {
    const res = await request(app)
      .get('/success')
      .query({ keywords: 'ps5', email: 'test@example.com' });
    expect(res.status).toBe(200);
    expect(res.text).toContain('ps5');
    expect(res.text).toContain('test@example.com');
  });

  test('funciona sin query params', async () => {
    const res = await request(app).get('/success');
    expect(res.status).toBe(200);
  });

  test('escapa HTML en keywords para prevenir XSS', async () => {
    const res = await request(app)
      .get('/success')
      .query({ keywords: '<script>alert(1)</script>', email: 'x@x.com' });
    expect(res.text).not.toContain('<script>alert(1)</script>');
    expect(res.text).toContain('&lt;script&gt;');
  });
});

// ── POST /subscribe — validaciones ────────────────────────────────────────
// Nota: cada test usa una IP diferente (X-Forwarded-For) para evitar que el
// rate limiter de /subscribe (5 req/15min por IP) interfiera entre tests.
let ipCounter = 1;
function nextIp() { return `10.0.${Math.floor(ipCounter / 255)}.${(ipCounter++ % 254) + 1}`; }

describe('POST /subscribe — validaciones', () => {
  test('400 si falta email', async () => {
    const res = await request(app)
      .post('/subscribe')
      .set('Accept', 'application/json')
      .set('X-Forwarded-For', nextIp())
      .send({ keywords: 'ps5' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  test('400 si falta keywords', async () => {
    const res = await request(app)
      .post('/subscribe')
      .set('Accept', 'application/json')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'test@example.com' });
    expect(res.status).toBe(400);
  });

  test('400 si el email no tiene formato válido', async () => {
    const res = await request(app)
      .post('/subscribe')
      .set('Accept', 'application/json')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'no-es-un-email', keywords: 'ps5' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email no válido/i);
  });

  test('400 si keywords tiene menos de 2 caracteres', async () => {
    const res = await request(app)
      .post('/subscribe')
      .set('Accept', 'application/json')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'test@example.com', keywords: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cortas/i);
  });

  test('400 si min_price no es un número', async () => {
    const res = await request(app)
      .post('/subscribe')
      .set('Accept', 'application/json')
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'test@example.com', keywords: 'ps5', min_price: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mínimo no válido/i);
  });

  test('400 si max_price no es un número', async () => {
    const res = await request(app)
      .post('/subscribe')
      .set('Accept', 'application/json')
      .set('X-Forwarded-For', nextIp())
      .send({ email: `maxprice-${Date.now()}@example.com`, keywords: 'ps5', max_price: 'xyz' });
    expect(res.status).toBe(400);
  });

  test('400 si min_price > max_price', async () => {
    const res = await request(app)
      .post('/subscribe')
      .set('Accept', 'application/json')
      .set('X-Forwarded-For', nextIp())
      .send({ email: `minmax-${Date.now()}@example.com`, keywords: 'ps5', min_price: '500', max_price: '100' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mínimo no puede ser mayor/i);
  });
});

// ── POST /subscribe — creación exitosa ────────────────────────────────────

describe('POST /subscribe — creación', () => {
  test('crea alerta y devuelve JSON con id (Accept: application/json)', async () => {
    const res = await request(app)
      .post('/subscribe')
      .set('Accept', 'application/json')
      .send({ email: 'nuevo@example.com', keywords: 'nintendo switch' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.id).toBe('string');
  });

  test('la alerta creada existe en la BD', async () => {
    const res = await request(app)
      .post('/subscribe')
      .set('Accept', 'application/json')
      .send({ email: 'check@example.com', keywords: 'game boy', min_price: '20', max_price: '80' });
    const sub = db.getSubscription(res.body.id);
    expect(sub).toBeTruthy();
    expect(sub.keywords).toBe('game boy');
    expect(sub.min_price).toBe(20);
    expect(sub.max_price).toBe(80);
  });

  test('redirige a /success si no es JSON (formulario HTML)', async () => {
    const res = await request(app)
      .post('/subscribe')
      .send({ email: 'form@example.com', keywords: 'ps5' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/success');
  });

  test('429 cuando se supera el límite de alertas por email', async () => {
    const email = `limit-sub-${Date.now()}@example.com`;
    db.setAlertLimitForEmail(email, 1);
    // Crear la primera alerta (que llena el límite)
    await request(app)
      .post('/subscribe')
      .set('Accept', 'application/json')
      .send({ email, keywords: 'primera' });
    // Intentar crear la segunda
    const res = await request(app)
      .post('/subscribe')
      .set('Accept', 'application/json')
      .send({ email, keywords: 'segunda' });
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/límite/i);
  });
});

// ── GET /unsubscribe/:id ───────────────────────────────────────────────────

describe('GET /unsubscribe/:id', () => {
  test('404 si el ID no existe', async () => {
    const res = await request(app).get('/unsubscribe/id-que-no-existe');
    expect(res.status).toBe(404);
    expect(res.text).toContain('no encontrada');
  });

  test('desactiva la alerta y muestra página de confirmación', async () => {
    const id = db.createSubscription({
      email: 'unsub@example.com', keywords: 'cancelar',
      minPrice: null, maxPrice: null, categoryId: '', frequency: 'immediate',
    });
    const res = await request(app).get(`/unsubscribe/${id}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('eliminada');
    expect(db.getSubscription(id).active).toBe(0);
  });
});
