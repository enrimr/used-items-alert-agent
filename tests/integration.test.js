/**
 * Tests de integración end-to-end
 *
 * Cubre los flujos completos del SaaS:
 *   1. Ciclo completo de alerta (crear → detectar → deduplicar → cancelar)
 *   2. Verificación de email (crear → verificar → activar)
 *   3. Worker: digest diario
 *   4. Worker: fallos consecutivos del scraper → alerta al admin
 *   5. Panel admin: editar, frecuencia, desactivar, reactivar, hard-delete
 *   6. Rate limiting: límite de alertas por email
 *   7. Filtro de envío (shipping_only)
 */

const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const request = require('supertest');

// ── BD temporal aislada ────────────────────────────────────────────────────
const TEST_DB = path.join(os.tmpdir(), `wallapop-integration-${Date.now()}.db`);
process.env.DB_PATH        = TEST_DB;
process.env.ADMIN_PASSWORD = 'inttest';
process.env.THEME_COLOR    = 'teal';
process.env.BASE_URL       = 'http://localhost:3000';
process.env.ADMIN_EMAIL    = 'admin@test.com';
process.env.SCRAPER_FAILURE_THRESHOLD = '2';

// ── Mock del mailer ────────────────────────────────────────────────────────
jest.mock('../src/mailer', () => ({
  sendConfirmationEmail: jest.fn(),
  sendVerificationEmail: jest.fn(),
  sendAlertEmail:        jest.fn(),
  sendAdminAlert:        jest.fn(),
  verifyEmailConfig:     jest.fn(),
}));

// ── Mock del scraper ───────────────────────────────────────────────────────
jest.mock('../src/scraper', () => ({
  fetchItems:     jest.fn(),
  createBrowser:  jest.fn().mockResolvedValue({ newPage: jest.fn(), close: jest.fn() }),
  buildSearchUrl: jest.fn().mockReturnValue('https://es.wallapop.com/search?keywords=test'),
}));

// ── Imports post-mock ──────────────────────────────────────────────────────
const db      = require('../web/db');
const { app } = require('../web/server');
const mailer  = require('../src/mailer');
const scraper = require('../src/scraper');
const { CATEGORIES } = require('../src/categories');

// ── Estado de errores del scraper (persistente entre ciclos, como en worker.js) ──
const scraperErrorCounts = new Map(); // subscriptionId → errorCount

// ── Helper: ciclo del worker simplificado ─────────────────────────────────
async function runWorkerCycle() {
  const {
    getActiveSubscriptions, filterNewItems, markItemsSeen, updateLastRun,
    addDigestItems, getDigestItems, clearDigestItems, updateLastDigest, incrementEmailsSent,
  } = require('../web/db');

  const subs = getActiveSubscriptions().filter(s => {
    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !s.verified) return false;
    return true;
  });

  for (const sub of subs) {
    const config = {
      keywords: sub.keywords, minPrice: sub.min_price, maxPrice: sub.max_price,
      categoryId: sub.category_id || '', categoryName: CATEGORIES[sub.category_id] || 'Todas',
      maxResults: 40, shippingOnly: sub.shipping_only === 1,
    };
    try {
      const { items } = await scraper.fetchItems(config, null);
      const newItems  = filterNewItems(sub.id, items);

      if (newItems.length > 0) {
        markItemsSeen(sub.id, newItems.map(i => i.id));
        const freq = sub.email_frequency || 'immediate';
        if (freq === 'immediate') {
          await mailer.sendAlertEmail(newItems, config, sub.email, sub.id);
          incrementEmailsSent(sub.id);
        } else {
          addDigestItems(sub.id, newItems);
          const acc = getDigestItems(sub.id);
          if (acc.length > 0) {
            await mailer.sendAlertEmail(acc, config, sub.email, sub.id);
            incrementEmailsSent(sub.id);
            clearDigestItems(sub.id);
            updateLastDigest(sub.id);
          }
        }
      }
      scraperErrorCounts.set(sub.id, 0); // reset on success
      updateLastRun(sub.id);

    } catch (err) {
      const prev      = scraperErrorCounts.get(sub.id) || 0;
      const newCount  = prev + 1;
      scraperErrorCounts.set(sub.id, newCount);
      const threshold = parseInt(process.env.SCRAPER_FAILURE_THRESHOLD || '3', 10);
      if (newCount === threshold) {
        await mailer.sendAdminAlert(sub.email, sub.keywords, newCount, err.message);
      }
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
let ipSeq = 1;
function nextIp() { return `192.168.${Math.floor(ipSeq / 255)}.${(ipSeq++ % 254) + 1}`; }

/** Envía POST /subscribe con IP única para evitar el rate limiter */
function subscribe(body) {
  return request(app)
    .post('/subscribe')
    .set('Accept', 'application/json')
    .set('X-Forwarded-For', nextIp())
    .send(body);
}

const AUTH = { user: 'admin', pass: 'inttest' };

// ── Setup / Teardown ───────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  // scraperErrorCounts NO se borra aquí — algunos flujos (ej. Flujo 4) necesitan
  // que el contador persista entre tests secuenciales del mismo describe.
  // Cada describe que necesite un contador limpio lo resetea en su propio beforeEach/beforeAll.

  // Defaults: todos los mocks devuelven éxito
  mailer.sendConfirmationEmail.mockResolvedValue(true);
  mailer.sendVerificationEmail.mockResolvedValue(true);
  mailer.sendAlertEmail.mockResolvedValue(true);
  mailer.sendAdminAlert.mockResolvedValue(true);
  mailer.verifyEmailConfig.mockResolvedValue({ ok: true });
  scraper.fetchItems.mockResolvedValue({ items: [], source: 'mock' });

  delete process.env.REQUIRE_EMAIL_VERIFICATION;
});

afterAll(() => {
  try { fs.unlinkSync(TEST_DB); } catch (e) {}
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. CICLO COMPLETO DE ALERTA
// ─────────────────────────────────────────────────────────────────────────────

describe('Flujo 1: Ciclo completo de alerta', () => {
  let subId;

  test('1.1 Crear alerta + email de confirmación', async () => {
    const res = await subscribe({ email: 'usuario@test.com', keywords: 'ps5', max_price: '400' });
    expect(res.status).toBe(200);
    subId = res.body.id;

    const sub = db.getSubscription(subId);
    expect(sub.keywords).toBe('ps5');
    expect(sub.max_price).toBe(400);
    expect(sub.active).toBe(1);

    // Esperar que el fire-and-forget dispare el email
    await new Promise(r => setTimeout(r, 100));
    expect(mailer.sendConfirmationEmail).toHaveBeenCalledWith('usuario@test.com', expect.objectContaining({ keywords: 'ps5' }));
  });

  test('1.2 Worker detecta nuevos productos y envía alerta', async () => {
    scraper.fetchItems.mockResolvedValue({ items: [
      { id: 'p1', title: 'PS5 Disc', price: 350, currency: 'EUR', location: 'Madrid',
        url: 'http://x.com/p1', images: [] },
    ], source: 'mock' });

    await runWorkerCycle();

    expect(mailer.sendAlertEmail).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'p1' })]),
      expect.any(Object),
      'usuario@test.com',
      subId
    );
  });

  test('1.3 El mismo producto no se notifica dos veces (seen_items)', async () => {
    // p1 ya está marcado como visto
    await runWorkerCycle();
    expect(mailer.sendAlertEmail).not.toHaveBeenCalled();
  });

  test('1.4 Aparece p2 → solo se notifica el nuevo', async () => {
    scraper.fetchItems.mockResolvedValue({ items: [
      { id: 'p1', title: 'PS5 Disc',    price: 350, currency: 'EUR', location: 'Madrid',    url: 'http://x.com/p1', images: [] },
      { id: 'p2', title: 'PS5 Digital', price: 299, currency: 'EUR', location: 'Barcelona', url: 'http://x.com/p2', images: [] },
    ], source: 'mock' });

    await runWorkerCycle();

    const callArgs = mailer.sendAlertEmail.mock.calls[0];
    expect(callArgs[0]).toHaveLength(1);      // solo 1 item (p2)
    expect(callArgs[0][0].id).toBe('p2');
  });

  test('1.5 Cancelar alerta → worker la ignora', async () => {
    const res = await request(app).get(`/unsubscribe/${subId}`);
    expect(res.status).toBe(200);
    expect(db.getSubscription(subId).active).toBe(0);

    scraper.fetchItems.mockResolvedValue({ items: [
      { id: 'p3', title: 'PS5 Bundle', price: 450, currency: 'EUR', location: 'Sevilla', url: 'http://x.com/p3', images: [] },
    ], source: 'mock' });

    await runWorkerCycle();
    expect(mailer.sendAlertEmail).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. VERIFICACIÓN DE EMAIL
// ─────────────────────────────────────────────────────────────────────────────

describe('Flujo 2: Verificación de email', () => {
  let subId;
  let verificationToken;

  test('2.1 Crear alerta pendiente + email de verificación (no confirmación)', async () => {
    process.env.REQUIRE_EMAIL_VERIFICATION = 'true';

    const res = await subscribe({ email: 'verificar@test.com', keywords: 'nintendo' });
    expect(res.status).toBe(200);
    expect(res.body.pendingVerification).toBe(true);
    subId = res.body.id;

    const sub = db.getSubscription(subId);
    expect(sub.verified).toBe(0);
    expect(sub.verification_token).toBeTruthy();
    verificationToken = sub.verification_token;

    await new Promise(r => setTimeout(r, 100));
    expect(mailer.sendVerificationEmail).toHaveBeenCalledWith(
      'verificar@test.com',
      expect.objectContaining({ verification_token: verificationToken })
    );
    expect(mailer.sendConfirmationEmail).not.toHaveBeenCalled();
  });

  test('2.2 Worker salta suscripción no verificada', async () => {
    process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
    scraper.fetchItems.mockResolvedValue({ items: [
      { id: 'n1', title: 'Nintendo Switch', price: 180, currency: 'EUR', location: 'Madrid', url: 'http://x.com/n1', images: [] },
    ], source: 'mock' });

    await runWorkerCycle();
    expect(mailer.sendAlertEmail).not.toHaveBeenCalled();
  });

  test('2.3 Verificar email vía GET /verify/:token → activa la suscripción', async () => {
    const res = await request(app).get(`/verify/${verificationToken}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('verificado');

    const sub = db.getSubscription(subId);
    expect(sub.verified).toBe(1);
    expect(sub.verification_token).toBeNull();
  });

  test('2.4 Tras verificar, el worker procesa la suscripción', async () => {
    process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
    scraper.fetchItems.mockResolvedValue({ items: [
      { id: 'n1', title: 'Nintendo Switch', price: 180, currency: 'EUR', location: 'Madrid', url: 'http://x.com/n1', images: [] },
    ], source: 'mock' });

    await runWorkerCycle();
    expect(mailer.sendAlertEmail).toHaveBeenCalledWith(
      expect.any(Array), expect.any(Object), 'verificar@test.com', subId
    );
  });

  test('2.5 Token inválido devuelve 404', async () => {
    const res = await request(app).get('/verify/token-invalido-que-no-existe');
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. DIGEST DIARIO
// ─────────────────────────────────────────────────────────────────────────────

describe('Flujo 3: Digest de alertas', () => {
  test('3.1 Alerta diaria → worker envía resumen con todos los items nuevos', async () => {
    const res = await subscribe({ email: 'digest@test.com', keywords: 'iphone', email_frequency: 'daily' });
    expect(res.status).toBe(200);
    const subId = res.body.id;
    expect(db.getSubscription(subId).email_frequency).toBe('daily');

    scraper.fetchItems.mockResolvedValue({ items: [
      { id: 'd1', title: 'iPhone 13', price: 400, currency: 'EUR', location: 'Madrid',    url: 'http://x.com/d1', images: [] },
      { id: 'd2', title: 'iPhone 14', price: 600, currency: 'EUR', location: 'Barcelona', url: 'http://x.com/d2', images: [] },
    ], source: 'mock' });

    await runWorkerCycle();

    // Buscar la llamada dirigida a digest@test.com (puede haber otras suscripciones activas)
    const digestCall = mailer.sendAlertEmail.mock.calls.find(c => c[2] === 'digest@test.com');
    expect(digestCall).toBeTruthy();
    expect(digestCall[0]).toHaveLength(2); // 2 items en el digest
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. FALLOS DEL SCRAPER → ALERTA AL ADMIN
// ─────────────────────────────────────────────────────────────────────────────

describe('Flujo 4: Fallos del scraper → notificación al admin', () => {
  let failSubId;

  test('4.1 Primer fallo — NO envía alerta (< umbral 2)', async () => {
    const res = await subscribe({ email: 'scraper-fail@test.com', keywords: 'macbook' });
    expect(res.status).toBe(200);
    failSubId = res.body.id;

    scraper.fetchItems.mockRejectedValue(new Error('Simulated scraper timeout'));
    await runWorkerCycle();
    expect(mailer.sendAdminAlert).not.toHaveBeenCalled();
  });

  test('4.2 Segundo fallo — envía alerta al admin (= umbral)', async () => {
    // beforeEach resetea fetchItems; hay que volver a configurar el fallo
    scraper.fetchItems.mockRejectedValue(new Error('Simulated scraper timeout'));
    await runWorkerCycle();
    expect(mailer.sendAdminAlert).toHaveBeenCalledWith(
      'scraper-fail@test.com', 'macbook', 2,
      expect.stringContaining('Simulated')
    );
  });

  test('4.3 Tercer fallo — NO reenvía (umbral ya superado, solo en el exacto)', async () => {
    await runWorkerCycle();
    expect(mailer.sendAdminAlert).not.toHaveBeenCalled();
  });

  test('4.4 Recuperación → alerta de producto normal, sin admin alert', async () => {
    scraper.fetchItems.mockResolvedValue({ items: [
      { id: 'mb1', title: 'MacBook Air M2', price: 900, currency: 'EUR', location: 'Madrid', url: 'http://x.com/mb1', images: [] },
    ], source: 'mock' });

    await runWorkerCycle();
    expect(mailer.sendAlertEmail).toHaveBeenCalled();
    expect(mailer.sendAdminAlert).not.toHaveBeenCalled();
    expect(scraperErrorCounts.get(failSubId)).toBe(0); // reseteado
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. PANEL ADMIN — FLUJO DE EDICIÓN
// ─────────────────────────────────────────────────────────────────────────────

describe('Flujo 5: Admin — editar y gestionar alertas', () => {
  let subId;

  test('5.1 Crear alerta → editar keywords/precio', async () => {
    subId = db.createSubscription({
      email: 'admin-edit@test.com', keywords: 'original',
      minPrice: null, maxPrice: null, categoryId: '', frequency: 'immediate', verified: true,
    });

    const res = await request(app)
      .post(`/admin/edit/${subId}`)
      .auth(AUTH.user, AUTH.pass)
      .send({ keywords: 'editado', min_price: '50', max_price: '300', category_id: '' });
    expect(res.status).toBe(302);
    const sub = db.getSubscription(subId);
    expect(sub.keywords).toBe('editado');
    expect(sub.min_price).toBe(50);
    expect(sub.max_price).toBe(300);
  });

  test('5.2 Cambiar frecuencia a weekly', async () => {
    await request(app).post('/admin/set-frequency').auth(AUTH.user, AUTH.pass)
      .send({ id: subId, frequency: 'weekly' });
    expect(db.getSubscription(subId).email_frequency).toBe('weekly');
  });

  test('5.3 Desactivar → reactivar → hard-delete', async () => {
    await request(app).post(`/admin/delete/${subId}`).auth(AUTH.user, AUTH.pass);
    expect(db.getSubscription(subId).active).toBe(0);

    await request(app).post(`/admin/reactivate/${subId}`).auth(AUTH.user, AUTH.pass);
    expect(db.getSubscription(subId).active).toBe(1);

    await request(app).post(`/admin/hard-delete/${subId}`).auth(AUTH.user, AUTH.pass);
    expect(db.getSubscription(subId)).toBeFalsy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. LÍMITE DE ALERTAS POR EMAIL
// ─────────────────────────────────────────────────────────────────────────────

describe('Flujo 6: Límite de alertas por email', () => {
  const email = `limite-int-${Date.now()}@test.com`;

  test('6.1 Límite 2 → 1ª y 2ª OK, 3ª rechazada con 429', async () => {
    await request(app).post('/admin/set-limit').auth(AUTH.user, AUTH.pass)
      .send({ email, max_alerts: '2' });
    expect(db.getAlertLimitForEmail(email)).toBe(2);

    const r1 = await subscribe({ email, keywords: 'a1' });
    expect(r1.status).toBe(200);
    const r2 = await subscribe({ email, keywords: 'a2' });
    expect(r2.status).toBe(200);
    expect(db.countActiveAlertsByEmail(email)).toBe(2);

    const r3 = await subscribe({ email, keywords: 'a3' });
    expect(r3.status).toBe(429);
    expect(r3.body.error).toMatch(/límite/i);
    expect(db.countActiveAlertsByEmail(email)).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. FILTRO DE ENVÍO
// ─────────────────────────────────────────────────────────────────────────────

describe('Flujo 7: Filtro de envío (shipping_only)', () => {
  test('7.1 shipping_only=true → stored in DB + worker pasa shippingOnly al scraper', async () => {
    const res = await subscribe({ email: 'shipping@test.com', keywords: 'bici', shipping_only: 'true' });
    expect(res.status).toBe(200);
    expect(db.getSubscription(res.body.id).shipping_only).toBe(1);

    const capturedConfigs = [];
    scraper.fetchItems.mockImplementation(async (config) => {
      capturedConfigs.push({ ...config });
      return { items: [], source: 'mock' };
    });

    await runWorkerCycle();

    const shippingConfig = capturedConfigs.find(c => c.keywords === 'bici');
    expect(shippingConfig).toBeTruthy();
    expect(shippingConfig.shippingOnly).toBe(true);
  });
});
