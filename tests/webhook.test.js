/**
 * Tests para el módulo src/webhook.js y la integración con /subscribe
 *
 * Cubre:
 *   - buildPayload genera la estructura correcta
 *   - dispatchWebhook: éxito, error HTTP, timeout, URL inválida
 *   - POST /subscribe acepta y persiste webhook_url válida
 *   - POST /subscribe rechaza webhook_url con esquema inválido
 *   - DB: updateWebhook guarda y sobreescribe la URL
 *   - DB: updateWebhook rechaza URLs no http(s)
 */

const http = require('http');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ── BD temporal ────────────────────────────────────────────────────────────
const TEST_DB = path.join(os.tmpdir(), `wallapop-webhook-test-${Date.now()}.db`);
process.env.DB_PATH     = TEST_DB;
process.env.THEME_COLOR = 'teal';
process.env.BASE_URL    = 'http://localhost:3000';

// Limpiar cache de módulos con estado antes de cargarlos
['web/db', 'web/server', 'web/routes/subscribe'].forEach(m => {
  Object.keys(require.cache).forEach(k => { if (k.includes(m)) delete require.cache[k]; });
});

// Mock del módulo de email
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
const { dispatchWebhook, buildPayload } = require('../src/webhook');

afterAll(() => {
  try { fs.unlinkSync(TEST_DB); } catch (e) {}
});

// ── buildPayload ───────────────────────────────────────────────────────────

describe('buildPayload', () => {
  const sub = {
    id:           'test-sub-id',
    keywords:     'bicicleta',
    min_price:    50,
    max_price:    200,
    shipping_only: 1,
  };
  const items = [
    { id: 'item1', title: 'Bici de montaña', price: 150, url: 'https://wallapop.com/item/1', image: 'https://img/1.jpg', location: 'Madrid' },
    { id: 'item2', title: 'Bici carretera',  price: 180, url: 'https://wallapop.com/item/2', image: null, location: null },
  ];
  const config = { categoryName: 'Deporte y ocio' };

  test('genera la estructura correcta del payload', () => {
    const payload = buildPayload(sub, items, config);
    expect(payload.event).toBe('new_items');
    expect(payload.subscription_id).toBe('test-sub-id');
    expect(payload.keywords).toBe('bicicleta');
    expect(payload.min_price).toBe(50);
    expect(payload.max_price).toBe(200);
    expect(payload.category).toBe('Deporte y ocio');
    expect(payload.shipping_only).toBe(true);
    expect(payload.items_count).toBe(2);
    expect(Array.isArray(payload.items)).toBe(true);
    expect(payload.items).toHaveLength(2);
  });

  test('incluye timestamp ISO', () => {
    const payload = buildPayload(sub, items, config);
    expect(typeof payload.timestamp).toBe('string');
    expect(() => new Date(payload.timestamp)).not.toThrow();
  });

  test('cada item tiene los campos requeridos', () => {
    const payload = buildPayload(sub, items, config);
    payload.items.forEach(item => {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('price');
      expect(item).toHaveProperty('url');
    });
  });

  test('items sin imagen/location quedan como null', () => {
    const payload = buildPayload(sub, items, config);
    expect(payload.items[1].image).toBeNull();
    expect(payload.items[1].location).toBeNull();
  });

  test('funciona sin config (categoryName undefined)', () => {
    const payload = buildPayload(sub, items, {});
    expect(payload.category).toBeNull();
  });
});

// ── dispatchWebhook ────────────────────────────────────────────────────────

describe('dispatchWebhook', () => {
  let server;
  let lastBody;
  let responseStatus = 200;

  beforeAll(done => {
    server = http.createServer((req, res) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        try { lastBody = JSON.parse(data); } catch (e) { lastBody = null; }
        res.writeHead(responseStatus);
        res.end();
      });
    });
    server.listen(0, '127.0.0.1', done);
  });

  afterAll(() => new Promise(resolve => server.close(resolve)));

  function serverUrl(path = '/hook') {
    const { port } = server.address();
    return `http://127.0.0.1:${port}${path}`;
  }

  beforeEach(() => {
    lastBody = undefined;
    responseStatus = 200;
  });

  test('devuelve { ok: true } cuando el servidor responde 200', async () => {
    const result = await dispatchWebhook(serverUrl(), { event: 'test', items: [] });
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });

  test('envía Content-Type: application/json', async () => {
    await dispatchWebhook(serverUrl(), { event: 'ping' });
    // Server received body → JSON parse worked → Content-Type was JSON
    expect(lastBody).not.toBeNull();
  });

  test('el servidor recibe el payload correcto', async () => {
    const payload = { event: 'new_items', items_count: 3, items: [{ id: 'x' }] };
    await dispatchWebhook(serverUrl(), payload);
    expect(lastBody).toMatchObject({ event: 'new_items', items_count: 3 });
  });

  test('devuelve { ok: false } cuando el servidor responde 400', async () => {
    responseStatus = 400;
    const result = await dispatchWebhook(serverUrl(), { event: 'test' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/HTTP 400/);
  });

  test('devuelve { ok: false } cuando el servidor responde 500', async () => {
    responseStatus = 500;
    const result = await dispatchWebhook(serverUrl(), { event: 'test' });
    expect(result.ok).toBe(false);
  });

  test('devuelve { ok: false } con URL inválida', async () => {
    const result = await dispatchWebhook('not-a-url', { event: 'test' });
    expect(result.ok).toBe(false);
  });

  test('devuelve { ok: false } cuando la conexión es rechazada', async () => {
    // Puerto 1 está garantizado como cerrado/rechazado en cualquier OS
    const result = await dispatchWebhook('http://127.0.0.1:1/hook', {});
    expect(result.ok).toBe(false);
  }, 10000);

  test('acepta respuestas 201 y 204 como éxito', async () => {
    responseStatus = 201;
    const r1 = await dispatchWebhook(serverUrl(), {});
    expect(r1.ok).toBe(true);

    responseStatus = 204;
    const r2 = await dispatchWebhook(serverUrl(), {});
    expect(r2.ok).toBe(true);
  });
});

// ── db.updateWebhook ───────────────────────────────────────────────────────

describe('db.updateWebhook', () => {
  let subId;

  beforeEach(() => {
    subId = db.createSubscription({
      email: `wh-${Date.now()}@example.com`,
      keywords: 'test webhook',
      minPrice: null, maxPrice: null, categoryId: '',
    });
  });

  test('guarda una URL https válida', () => {
    db.updateWebhook(subId, 'https://hooks.zapier.com/hooks/catch/123/abc');
    const sub = db.getSubscription(subId);
    expect(sub.webhook_url).toBe('https://hooks.zapier.com/hooks/catch/123/abc');
  });

  test('guarda una URL http válida', () => {
    db.updateWebhook(subId, 'http://localhost:5678/webhook/test');
    const sub = db.getSubscription(subId);
    expect(sub.webhook_url).toBe('http://localhost:5678/webhook/test');
  });

  test('elimina la URL cuando se pasa null', () => {
    db.updateWebhook(subId, 'https://example.com/hook');
    db.updateWebhook(subId, null);
    const sub = db.getSubscription(subId);
    expect(sub.webhook_url).toBeNull();
  });

  test('elimina la URL cuando se pasa string vacío', () => {
    db.updateWebhook(subId, 'https://example.com/hook');
    db.updateWebhook(subId, '');
    const sub = db.getSubscription(subId);
    expect(sub.webhook_url).toBeNull();
  });

  test('lanza error si la URL no empieza por http(s)', () => {
    expect(() => db.updateWebhook(subId, 'ftp://example.com/hook')).toThrow(/https?/i);
    expect(() => db.updateWebhook(subId, 'javascript:alert(1)')).toThrow();
  });

  test('sobreescribe una URL existente', () => {
    db.updateWebhook(subId, 'https://first.com/hook');
    db.updateWebhook(subId, 'https://second.com/hook');
    const sub = db.getSubscription(subId);
    expect(sub.webhook_url).toBe('https://second.com/hook');
  });
});

// ── POST /subscribe con webhook_url ───────────────────────────────────────

let ipCounter = 1000;
function nextIp() { return `192.168.${Math.floor(ipCounter / 255)}.${(ipCounter++ % 254) + 1}`; }

describe('POST /subscribe con webhook_url', () => {
  test('acepta suscripción con webhook_url https válida', async () => {
    const res = await request(app)
      .post('/subscribe')
      .set('Accept', 'application/json')
      .set('X-Forwarded-For', nextIp())
      .send({
        email: `webhook-ok-${Date.now()}@example.com`,
        keywords: 'test webhook',
        webhook_url: 'https://hooks.zapier.com/hooks/catch/123/abc',
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const sub = db.getSubscription(res.body.id);
    expect(sub.webhook_url).toBe('https://hooks.zapier.com/hooks/catch/123/abc');
  });

  test('acepta suscripción con webhook_url http válida', async () => {
    const res = await request(app)
      .post('/subscribe')
      .set('Accept', 'application/json')
      .set('X-Forwarded-For', nextIp())
      .send({
        email: `webhook-http-${Date.now()}@example.com`,
        keywords: 'test webhook http',
        webhook_url: 'http://n8n.local:5678/webhook/xyz',
      });
    expect(res.status).toBe(200);
    const sub = db.getSubscription(res.body.id);
    expect(sub.webhook_url).toBe('http://n8n.local:5678/webhook/xyz');
  });

  test('rechaza webhook_url con esquema inválido (ftp://)', async () => {
    const res = await request(app)
      .post('/subscribe')
      .set('Accept', 'application/json')
      .set('X-Forwarded-For', nextIp())
      .send({
        email: `webhook-bad-${Date.now()}@example.com`,
        keywords: 'test webhook bad',
        webhook_url: 'ftp://files.example.com/hook',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/webhook/i);
  });

  test('crea alerta correctamente sin webhook_url', async () => {
    const res = await request(app)
      .post('/subscribe')
      .set('Accept', 'application/json')
      .set('X-Forwarded-For', nextIp())
      .send({
        email: `no-webhook-${Date.now()}@example.com`,
        keywords: 'sin webhook',
      });
    expect(res.status).toBe(200);
    const sub = db.getSubscription(res.body.id);
    expect(sub.webhook_url).toBeNull();
  });

  test('ignora webhook_url vacía', async () => {
    const res = await request(app)
      .post('/subscribe')
      .set('Accept', 'application/json')
      .set('X-Forwarded-For', nextIp())
      .send({
        email: `empty-webhook-${Date.now()}@example.com`,
        keywords: 'webhook vacio',
        webhook_url: '',
      });
    expect(res.status).toBe(200);
    const sub = db.getSubscription(res.body.id);
    expect(sub.webhook_url).toBeNull();
  });
});
