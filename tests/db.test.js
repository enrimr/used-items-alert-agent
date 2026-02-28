/**
 * Tests de integración para web/db.js
 *
 * Usa SQLite en memoria redirigiendo DB_PATH a :memory: no es posible con
 * better-sqlite3 directamente, así que usamos un fichero temporal en /tmp.
 */

const path = require('path');
const fs   = require('fs');
const os   = require('os');

// Usar una DB temporal para tests (no contaminar la BD de desarrollo)
const TEST_DB = path.join(os.tmpdir(), `wallapop-test-${Date.now()}.db`);
process.env.DB_PATH = TEST_DB;

// Limpiar require cache para que db.js use el DB_PATH actualizado
Object.keys(require.cache).forEach(k => {
  if (k.includes('web/db') || k.includes('web\\db')) delete require.cache[k];
});

const db = require('../web/db');

afterAll(() => {
  // Eliminar la BD temporal al terminar
  try { fs.unlinkSync(TEST_DB); } catch (e) {}
});

// ── createSubscription ─────────────────────────────────────────────────────

describe('createSubscription', () => {
  test('crea una suscripción y devuelve un ID', () => {
    const id = db.createSubscription({
      email:    'test@example.com',
      keywords: 'ps5',
      minPrice: null,
      maxPrice: null,
      categoryId: '',
      frequency: 'immediate',
    });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('la suscripción creada es recuperable por ID', () => {
    const id = db.createSubscription({
      email: 'test2@example.com', keywords: 'iphone', minPrice: 100, maxPrice: 500,
      categoryId: '12579', frequency: 'daily',
    });
    const sub = db.getSubscription(id);
    expect(sub).not.toBeNull();
    expect(sub.email).toBe('test2@example.com');
    expect(sub.keywords).toBe('iphone');
    expect(sub.min_price).toBe(100);
    expect(sub.max_price).toBe(500);
    expect(sub.category_id).toBe('12579');
    expect(sub.email_frequency).toBe('daily');
    expect(sub.active).toBe(1);
  });

  test('normaliza el email a minúsculas', () => {
    const id = db.createSubscription({
      email: 'TEST@EXAMPLE.COM', keywords: 'macbook', minPrice: null, maxPrice: null,
      categoryId: '', frequency: 'immediate',
    });
    const sub = db.getSubscription(id);
    expect(sub.email).toBe('test@example.com');
  });
});

// ── getActiveSubscriptions ─────────────────────────────────────────────────

describe('getActiveSubscriptions', () => {
  test('devuelve solo suscripciones activas', () => {
    const id = db.createSubscription({
      email: 'active@example.com', keywords: 'nintendo', minPrice: null, maxPrice: null,
      categoryId: '', frequency: 'immediate',
    });
    db.deleteSubscription(id); // desactivar

    const active = db.getActiveSubscriptions();
    const found = active.find(s => s.id === id);
    expect(found).toBeUndefined();
  });
});

// ── filterNewItems ─────────────────────────────────────────────────────────

describe('filterNewItems', () => {
  let subId;

  beforeEach(() => {
    subId = db.createSubscription({
      email: `filter-${Date.now()}@example.com`, keywords: 'test',
      minPrice: null, maxPrice: null, categoryId: '', frequency: 'immediate',
    });
  });

  test('devuelve todos los items cuando ninguno ha sido visto', () => {
    const items = [
      { id: 'item-1', title: 'Producto 1', price: 10 },
      { id: 'item-2', title: 'Producto 2', price: 20 },
    ];
    const newItems = db.filterNewItems(subId, items);
    expect(newItems).toHaveLength(2);
  });

  test('filtra los items ya marcados como vistos', () => {
    const items = [
      { id: 'seen-1', title: 'Ya visto', price: 10 },
      { id: 'new-1',  title: 'Nuevo',    price: 20 },
    ];
    db.markItemsSeen(subId, ['seen-1']);
    const newItems = db.filterNewItems(subId, items);
    expect(newItems).toHaveLength(1);
    expect(newItems[0].id).toBe('new-1');
  });

  test('devuelve array vacío si todos los items ya fueron vistos', () => {
    const items = [{ id: 'all-seen', title: 'Visto', price: 10 }];
    db.markItemsSeen(subId, ['all-seen']);
    const newItems = db.filterNewItems(subId, items);
    expect(newItems).toHaveLength(0);
  });

  test('devuelve array vacío si items está vacío', () => {
    expect(db.filterNewItems(subId, [])).toHaveLength(0);
  });
});

// ── deleteSubscription / reactivateSubscription ────────────────────────────

describe('deleteSubscription / reactivateSubscription', () => {
  test('desactiva una suscripción existente', () => {
    const id = db.createSubscription({
      email: 'del@example.com', keywords: 'test', minPrice: null, maxPrice: null,
      categoryId: '', frequency: 'immediate',
    });
    const result = db.deleteSubscription(id);
    expect(result).toBe(true);
    expect(db.getSubscription(id).active).toBe(0);
  });

  test('reactiva una suscripción desactivada', () => {
    const id = db.createSubscription({
      email: 'react@example.com', keywords: 'test', minPrice: null, maxPrice: null,
      categoryId: '', frequency: 'immediate',
    });
    db.deleteSubscription(id);
    db.reactivateSubscription(id);
    expect(db.getSubscription(id).active).toBe(1);
  });

  test('devuelve false para un ID inexistente', () => {
    expect(db.deleteSubscription('id-que-no-existe')).toBe(false);
  });
});

// ── countActiveAlertsByEmail ───────────────────────────────────────────────

describe('countActiveAlertsByEmail', () => {
  test('cuenta correctamente las alertas activas de un email', () => {
    const email = `count-${Date.now()}@example.com`;
    db.createSubscription({ email, keywords: 'a', minPrice: null, maxPrice: null, categoryId: '', frequency: 'immediate' });
    db.createSubscription({ email, keywords: 'b', minPrice: null, maxPrice: null, categoryId: '', frequency: 'immediate' });
    expect(db.countActiveAlertsByEmail(email)).toBe(2);
  });

  test('devuelve 0 para un email sin alertas', () => {
    expect(db.countActiveAlertsByEmail('noalertas@example.com')).toBe(0);
  });
});

// ── getStats ───────────────────────────────────────────────────────────────

describe('getStats', () => {
  test('devuelve un objeto con las claves esperadas', () => {
    const stats = db.getStats();
    expect(stats).toHaveProperty('totalActive');
    expect(stats).toHaveProperty('totalAll');
    expect(stats).toHaveProperty('totalUsers');
    expect(stats).toHaveProperty('totalEmailsSent');
    expect(stats).toHaveProperty('successRate');
    expect(stats).toHaveProperty('totalSeen');
  });

  test('totalActive y totalAll son números no negativos', () => {
    const stats = db.getStats();
    expect(stats.totalActive).toBeGreaterThanOrEqual(0);
    expect(stats.totalAll).toBeGreaterThanOrEqual(stats.totalActive);
  });

  test('successRate está entre 0 y 100', () => {
    const { successRate } = db.getStats();
    expect(successRate).toBeGreaterThanOrEqual(0);
    expect(successRate).toBeLessThanOrEqual(100);
  });
});
