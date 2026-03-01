/**
 * Digest store — acumulación persistente de items para emails diarios/semanales
 */

const { getDb } = require('./connection');
const { DIGEST_MAX_ITEMS } = require('../../src/constants');

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

module.exports = { addDigestItems, getDigestItems, clearDigestItems, getDigestCount };
