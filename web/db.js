/**
 * Base de datos SQLite para las suscripciones de alertas
 */

const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Railway: set DB_PATH env var to /data/alerts.db and mount a volume on /data
// Local: defaults to ./data/alerts.db
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/alerts.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id          TEXT PRIMARY KEY,
      email       TEXT NOT NULL,
      keywords    TEXT NOT NULL,
      min_price   REAL,
      max_price   REAL,
      category_id TEXT DEFAULT '',
      created_at  INTEGER NOT NULL,
      last_run_at INTEGER,
      active      INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(email);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(active);

    CREATE TABLE IF NOT EXISTS seen_items (
      subscription_id TEXT NOT NULL,
      item_id         TEXT NOT NULL,
      seen_at         INTEGER NOT NULL,
      PRIMARY KEY (subscription_id, item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_seen_items_sub ON seen_items(subscription_id);
  `);
}

/**
 * Crea una nueva suscripción
 */
function createSubscription({ email, keywords, minPrice, maxPrice, categoryId }) {
  const id = uuidv4();
  getDb().prepare(`
    INSERT INTO subscriptions (id, email, keywords, min_price, max_price, category_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, email.toLowerCase().trim(), keywords.trim(), minPrice || null, maxPrice || null, categoryId || '', Date.now());
  return id;
}

/**
 * Obtiene todas las suscripciones activas
 */
function getActiveSubscriptions() {
  return getDb().prepare('SELECT * FROM subscriptions WHERE active = 1').all();
}

/**
 * Obtiene una suscripción por ID
 */
function getSubscription(id) {
  return getDb().prepare('SELECT * FROM subscriptions WHERE id = ?').get(id);
}

/**
 * Desactiva (elimina) una suscripción por ID
 */
function deleteSubscription(id) {
  const result = getDb().prepare('UPDATE subscriptions SET active = 0 WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Marca items como vistos para una suscripción
 */
function markItemsSeen(subscriptionId, itemIds) {
  const now = Date.now();
  const insert = getDb().prepare(`
    INSERT OR IGNORE INTO seen_items (subscription_id, item_id, seen_at) VALUES (?, ?, ?)
  `);
  const insertMany = getDb().transaction((ids) => {
    for (const id of ids) {
      insert.run(subscriptionId, id, now);
    }
  });
  insertMany(itemIds);
}

/**
 * Filtra los items que ya han sido vistos para una suscripción
 * @returns {Array} - Solo los items nuevos
 */
function filterNewItems(subscriptionId, items) {
  if (!items.length) return [];
  const seenIds = new Set(
    getDb().prepare(`
      SELECT item_id FROM seen_items WHERE subscription_id = ?
    `).all(subscriptionId).map(r => r.item_id)
  );
  return items.filter(item => !seenIds.has(item.id));
}

/**
 * Actualiza la marca de tiempo de última ejecución
 */
function updateLastRun(subscriptionId) {
  getDb().prepare('UPDATE subscriptions SET last_run_at = ? WHERE id = ?').run(Date.now(), subscriptionId);
}

/**
 * Limpia items vistos antiguos (> 30 días)
 */
function cleanupOldSeenItems() {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  getDb().prepare('DELETE FROM seen_items WHERE seen_at < ?').run(cutoff);
}

module.exports = {
  createSubscription,
  getActiveSubscriptions,
  getSubscription,
  deleteSubscription,
  markItemsSeen,
  filterNewItems,
  updateLastRun,
  cleanupOldSeenItems,
};
