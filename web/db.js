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
      id              TEXT PRIMARY KEY,
      email           TEXT NOT NULL,
      keywords        TEXT NOT NULL,
      min_price       REAL,
      max_price       REAL,
      category_id     TEXT DEFAULT '',
      created_at      INTEGER NOT NULL,
      last_run_at     INTEGER,
      active          INTEGER NOT NULL DEFAULT 1,
      emails_sent     INTEGER NOT NULL DEFAULT 0,
      email_frequency TEXT NOT NULL DEFAULT 'immediate',
      last_digest_at  INTEGER
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

    CREATE TABLE IF NOT EXISTS email_limits (
      email      TEXT PRIMARY KEY,
      max_alerts INTEGER NOT NULL DEFAULT 10
    );
  `);

  // Migrations for existing DBs
  const migrations = [
    'ALTER TABLE subscriptions ADD COLUMN emails_sent INTEGER NOT NULL DEFAULT 0',
    "ALTER TABLE subscriptions ADD COLUMN email_frequency TEXT NOT NULL DEFAULT 'immediate'",
    'ALTER TABLE subscriptions ADD COLUMN last_digest_at INTEGER',
  ];
  for (const sql of migrations) {
    try { getDb().exec(sql); } catch (e) { /* column already exists */ }
  }
}

/**
 * Crea una nueva suscripción
 * @param {string} frequency - 'immediate' | 'daily' | 'weekly'
 */
function createSubscription({ email, keywords, minPrice, maxPrice, categoryId, frequency = 'immediate' }) {
  const id = uuidv4();
  const validFrequencies = ['immediate', 'daily', 'weekly'];
  const freq = validFrequencies.includes(frequency) ? frequency : 'immediate';
  getDb().prepare(`
    INSERT INTO subscriptions (id, email, keywords, min_price, max_price, category_id, created_at, email_frequency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, email.toLowerCase().trim(), keywords.trim(), minPrice || null, maxPrice || null, categoryId || '', Date.now(), freq);
  return id;
}

/**
 * Actualiza el timestamp del último digest enviado
 */
function updateLastDigest(subscriptionId) {
  getDb().prepare('UPDATE subscriptions SET last_digest_at = ? WHERE id = ?').run(Date.now(), subscriptionId);
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
 * Reactiva una suscripción previamente eliminada
 */
function reactivateSubscription(id) {
  const result = getDb().prepare('UPDATE subscriptions SET active = 1 WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Actualiza la frecuencia de emails de una suscripción
 */
function updateFrequency(id, frequency) {
  const valid = ['immediate', 'daily', 'weekly'];
  const freq = valid.includes(frequency) ? frequency : 'immediate';
  getDb().prepare('UPDATE subscriptions SET email_frequency = ? WHERE id = ?').run(freq, id);
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

/**
 * Obtiene estadísticas globales
 */
function getStats() {
  const db = getDb();
  const totalActive = db.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE active = 1').get().count;
  const totalAll = db.prepare('SELECT COUNT(*) as count FROM subscriptions').get().count;
  const totalSeen = db.prepare('SELECT COUNT(*) as count FROM seen_items').get().count;
  return { totalActive, totalAll, totalSeen };
}

/**
 * Obtiene todas las suscripciones (activas e inactivas) para el admin
 */
function getAllSubscriptions() {
  return getDb().prepare('SELECT * FROM subscriptions ORDER BY created_at DESC').all();
}

/**
 * Incrementa el contador de emails enviados para una suscripción
 */
function incrementEmailsSent(subscriptionId) {
  getDb().prepare('UPDATE subscriptions SET emails_sent = emails_sent + 1 WHERE id = ?').run(subscriptionId);
}

/**
 * Cuenta las alertas activas de un email
 */
function countActiveAlertsByEmail(email) {
  return getDb().prepare(
    'SELECT COUNT(*) as count FROM subscriptions WHERE email = ? AND active = 1'
  ).get(email.toLowerCase().trim()).count;
}

/**
 * Obtiene el límite de alertas para un email (por defecto: MAX_ALERTS_PER_EMAIL o 10)
 */
function getAlertLimitForEmail(email) {
  const row = getDb().prepare('SELECT max_alerts FROM email_limits WHERE email = ?').get(email.toLowerCase().trim());
  if (row) return row.max_alerts;
  return parseInt(process.env.MAX_ALERTS_PER_EMAIL || '10', 10);
}

/**
 * Establece el límite de alertas para un email específico
 */
function setAlertLimitForEmail(email, maxAlerts) {
  getDb().prepare(`
    INSERT INTO email_limits (email, max_alerts) VALUES (?, ?)
    ON CONFLICT(email) DO UPDATE SET max_alerts = excluded.max_alerts
  `).run(email.toLowerCase().trim(), maxAlerts);
}

/**
 * Obtiene todos los emails únicos con sus stats para el admin
 */
function getEmailStats() {
  return getDb().prepare(`
    SELECT
      s.email,
      COUNT(*) as total_alerts,
      SUM(CASE WHEN s.active = 1 THEN 1 ELSE 0 END) as active_alerts,
      SUM(s.emails_sent) as total_emails_sent,
      COALESCE(el.max_alerts, ?) as max_alerts
    FROM subscriptions s
    LEFT JOIN email_limits el ON el.email = s.email
    GROUP BY s.email
    ORDER BY total_alerts DESC
  `).all(parseInt(process.env.MAX_ALERTS_PER_EMAIL || '10', 10));
}

module.exports = {
  createSubscription,
  getActiveSubscriptions,
  getAllSubscriptions,
  getSubscription,
  deleteSubscription,
  reactivateSubscription,
  updateFrequency,
  markItemsSeen,
  filterNewItems,
  updateLastRun,
  updateLastDigest,
  cleanupOldSeenItems,
  getStats,
  incrementEmailsSent,
  countActiveAlertsByEmail,
  getAlertLimitForEmail,
  setAlertLimitForEmail,
  getEmailStats,
};
