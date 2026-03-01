/**
 * Conexión SQLite compartida e inicialización del esquema
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Railway: set DB_PATH env var to /data/alerts.db and mount a volume on /data
// Local: defaults to ./data/alerts.db
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/alerts.db');

// Ensure data directory exists
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
      verification_token  TEXT,
      webhook_url         TEXT
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
    'ALTER TABLE subscriptions ADD COLUMN webhook_url TEXT',
  ];
  for (const sql of migrations) {
    try { getDb().exec(sql); } catch (e) { /* column already exists */ }
  }
}

module.exports = { getDb };
