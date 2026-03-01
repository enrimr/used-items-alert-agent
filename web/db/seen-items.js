/**
 * Gestión de items vistos por suscripción
 */

const { getDb } = require('./connection');

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
 * Limpia items vistos antiguos (> 30 días)
 */
function cleanupOldSeenItems() {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  getDb().prepare('DELETE FROM seen_items WHERE seen_at < ?').run(cutoff);
}

module.exports = { markItemsSeen, filterNewItems, cleanupOldSeenItems };
