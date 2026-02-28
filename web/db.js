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
      id                  TEXT PRIMARY KEY,
      email               TEXT NOT NULL,
      keywords            TEXT NOT NULL,
      min_price           REAL,
      max_price           REAL,
      category_id         TEXT DEFAULT '',
      created_at          INTEGER NOT NULL,
      last_run_at         INTEGER,
      active              INTEGER NOT NULL DEFAULT 1,
      emails_sent         INTEGER NOT NULL DEFAULT 0,
      email_frequency     TEXT NOT NULL DEFAULT 'immediate',
      last_digest_at      INTEGER,
      shipping_only       INTEGER NOT NULL DEFAULT 0,
      verified            INTEGER NOT NULL DEFAULT 0,
      verification_token  TEXT
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

    CREATE TABLE IF NOT EXISTS digest_store (
      subscription_id TEXT NOT NULL,
      item_id         TEXT NOT NULL,
      item_json       TEXT NOT NULL,
      added_at        INTEGER NOT NULL,
      PRIMARY KEY (subscription_id, item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_digest_sub ON digest_store(subscription_id);
  `);

  // Migrations for existing DBs
  const migrations = [
    'ALTER TABLE subscriptions ADD COLUMN emails_sent INTEGER NOT NULL DEFAULT 0',
    "ALTER TABLE subscriptions ADD COLUMN email_frequency TEXT NOT NULL DEFAULT 'immediate'",
    'ALTER TABLE subscriptions ADD COLUMN last_digest_at INTEGER',
    'ALTER TABLE subscriptions ADD COLUMN emails_failed INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE subscriptions ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE subscriptions ADD COLUMN shipping_only INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE subscriptions ADD COLUMN verified INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE subscriptions ADD COLUMN verification_token TEXT',
  ];
  for (const sql of migrations) {
    try { getDb().exec(sql); } catch (e) { /* column already exists */ }
  }
}

/**
 * Crea una nueva suscripción
 * @param {string}  frequency    - 'immediate' | 'daily' | 'weekly'
 * @param {boolean} shippingOnly - true para filtrar solo productos con envío
 * @param {boolean} verified     - true si no se requiere verificación de email
 * @param {string}  verificationToken - token UUID para verificar el email
 */
function createSubscription({
  email, keywords, minPrice, maxPrice, categoryId,
  frequency = 'immediate', shippingOnly = false,
  verified = false, verificationToken = null,
}) {
  const id = uuidv4();
  const validFrequencies = ['immediate', 'daily', 'weekly'];
  const freq = validFrequencies.includes(frequency) ? frequency : 'immediate';
  getDb().prepare(`
    INSERT INTO subscriptions
      (id, email, keywords, min_price, max_price, category_id, created_at,
       email_frequency, shipping_only, verified, verification_token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    email.toLowerCase().trim(),
    keywords.trim(),
    minPrice || null,
    maxPrice || null,
    categoryId || '',
    Date.now(),
    freq,
    shippingOnly ? 1 : 0,
    verified ? 1 : 0,
    verificationToken || null,
  );
  return id;
}

/**
 * Verifica una suscripción por su token.
 * @returns {Object|null} la suscripción si el token es válido, null si no existe
 */
function verifySubscription(token) {
  const db = getDb();
  const sub = db.prepare('SELECT * FROM subscriptions WHERE verification_token = ?').get(token);
  if (!sub) return null;
  db.prepare('UPDATE subscriptions SET verified = 1, verification_token = NULL WHERE id = ?').run(sub.id);
  return sub;
}

/**
 * Obtiene una suscripción por su token de verificación (sin verificarla)
 */
function getSubscriptionByToken(token) {
  return getDb().prepare('SELECT * FROM subscriptions WHERE verification_token = ?').get(token);
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
 * Elimina permanentemente una suscripción y sus seen_items de la BD
 */
function hardDeleteSubscription(id) {
  const db = getDb();
  db.prepare('DELETE FROM seen_items WHERE subscription_id = ?').run(id);
  const result = db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id);
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
 * Actualiza los campos editables de una suscripción (keywords, precio, categoría)
 */
function updateSubscription(id, { keywords, minPrice, maxPrice, categoryId }) {
  getDb().prepare(`
    UPDATE subscriptions
    SET keywords = ?, min_price = ?, max_price = ?, category_id = ?
    WHERE id = ?
  `).run(
    (keywords || '').trim(),
    minPrice !== '' && minPrice != null ? parseFloat(minPrice) : null,
    maxPrice !== '' && maxPrice != null ? parseFloat(maxPrice) : null,
    categoryId || '',
    id
  );
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
 * Obtiene estadísticas globales enriquecidas para el dashboard
 */
function getStats() {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COUNT(*) as totalAll,
      SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as totalActive,
      SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) as totalDeleted,
      SUM(emails_sent) as totalEmailsSent,
      SUM(COALESCE(emails_failed, 0)) as totalEmailsFailed,
      COUNT(DISTINCT email) as totalUsers
    FROM subscriptions
  `).get();
  const totalSeen = db.prepare('SELECT COUNT(*) as count FROM seen_items').get().count;

  const sent = row.totalEmailsSent || 0;
  const failed = row.totalEmailsFailed || 0;
  const totalAttempts = sent + failed;
  const successRate = totalAttempts > 0 ? Math.round((sent / totalAttempts) * 100) : 100;
  const deletedPct = row.totalAll > 0 ? Math.round((row.totalDeleted / row.totalAll) * 100) : 0;

  return {
    totalActive: row.totalActive || 0,
    totalAll: row.totalAll || 0,
    totalDeleted: row.totalDeleted || 0,
    totalUsers: row.totalUsers || 0,
    totalEmailsSent: sent,
    totalEmailsFailed: failed,
    successRate,
    deletedPct,
    totalSeen,
  };
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
 * Incrementa el contador de emails fallidos para una suscripción
 */
function incrementEmailsFailed(subscriptionId) {
  getDb().prepare('UPDATE subscriptions SET emails_failed = emails_failed + 1 WHERE id = ?').run(subscriptionId);
}

/**
 * Incrementa el contador de fallos consecutivos.
 * Si supera el umbral (EMAIL_FAILURE_THRESHOLD, por defecto 5),
 * desactiva automáticamente TODAS las alertas activas de ese email.
 * @returns {boolean} true si se desactivó
 */
function recordEmailFailure(subscriptionId) {
  const db = getDb();
  db.prepare('UPDATE subscriptions SET emails_failed = emails_failed + 1, consecutive_failures = consecutive_failures + 1 WHERE id = ?').run(subscriptionId);

  const threshold = parseInt(process.env.EMAIL_FAILURE_THRESHOLD || '5', 10);
  const sub = db.prepare('SELECT email, consecutive_failures FROM subscriptions WHERE id = ?').get(subscriptionId);
  if (!sub) return false;

  if (sub.consecutive_failures >= threshold) {
    // Deactivate all active subscriptions for this email
    const result = db.prepare('UPDATE subscriptions SET active = 0 WHERE email = ? AND active = 1').run(sub.email);
    console.warn(`⚠️ Auto-desactivadas ${result.changes} alerta(s) de ${sub.email} tras ${sub.consecutive_failures} fallos consecutivos`);
    return true;
  }
  return false;
}

/**
 * Resetea el contador de fallos consecutivos tras un envío exitoso
 */
function resetConsecutiveFailures(subscriptionId) {
  getDb().prepare('UPDATE subscriptions SET consecutive_failures = 0 WHERE id = ?').run(subscriptionId);
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

// ── Digest store (persistent accumulation for daily/weekly emails) ────────────

const DIGEST_MAX_ITEMS = 100; // max items per subscription in digest store

/**
 * Adds new items to the digest store for a subscription (upsert, max 100)
 */
function addDigestItems(subscriptionId, items) {
  const db = getDb();
  const now = Date.now();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO digest_store (subscription_id, item_id, item_json, added_at)
    VALUES (?, ?, ?, ?)
  `);
  const insertMany = db.transaction((itemList) => {
    for (const item of itemList) {
      insert.run(subscriptionId, item.id, JSON.stringify(item), now);
    }
  });
  insertMany(items);

  // Trim to keep only the most recent DIGEST_MAX_ITEMS
  db.prepare(`
    DELETE FROM digest_store WHERE subscription_id = ? AND item_id NOT IN (
      SELECT item_id FROM digest_store WHERE subscription_id = ?
      ORDER BY added_at DESC LIMIT ?
    )
  `).run(subscriptionId, subscriptionId, DIGEST_MAX_ITEMS);
}

/**
 * Gets all accumulated items for a subscription
 */
function getDigestItems(subscriptionId) {
  return getDb()
    .prepare('SELECT item_json FROM digest_store WHERE subscription_id = ? ORDER BY added_at ASC')
    .all(subscriptionId)
    .map(r => JSON.parse(r.item_json));
}

/**
 * Removes all digest items for a subscription (after sending)
 */
function clearDigestItems(subscriptionId) {
  getDb().prepare('DELETE FROM digest_store WHERE subscription_id = ?').run(subscriptionId);
}

/**
 * Returns the count of accumulated digest items for a subscription
 */
function getDigestCount(subscriptionId) {
  return getDb()
    .prepare('SELECT COUNT(*) as count FROM digest_store WHERE subscription_id = ?')
    .get(subscriptionId).count;
}

module.exports = {
  createSubscription,
  getActiveSubscriptions,
  getAllSubscriptions,
  getSubscription,
  getSubscriptionByToken,
  verifySubscription,
  deleteSubscription,
  reactivateSubscription,
  hardDeleteSubscription,
  updateFrequency,
  updateSubscription,
  markItemsSeen,
  filterNewItems,
  updateLastRun,
  updateLastDigest,
  cleanupOldSeenItems,
  getStats,
  incrementEmailsSent,
  incrementEmailsFailed,
  recordEmailFailure,
  resetConsecutiveFailures,
  countActiveAlertsByEmail,
  getAlertLimitForEmail,
  setAlertLimitForEmail,
  getEmailStats,
  addDigestItems,
  getDigestItems,
  clearDigestItems,
  getDigestCount,
};
