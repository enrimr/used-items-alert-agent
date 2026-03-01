/**
 * CRUD de suscripciones
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./connection');

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
 * Obtiene todas las suscripciones (activas e inactivas) para el admin
 */
function getAllSubscriptions() {
  return getDb().prepare('SELECT * FROM subscriptions ORDER BY created_at DESC').all();
}

/**
 * Desactiva (soft-delete) una suscripción por ID
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
 * Actualiza la URL de webhook de una suscripción
 */
function updateWebhook(id, webhookUrl) {
  const url = webhookUrl ? webhookUrl.trim() : null;
  if (url && !/^https?:\/\/.+/.test(url)) {
    throw new Error('La URL del webhook debe comenzar con http:// o https://');
  }
  getDb().prepare('UPDATE subscriptions SET webhook_url = ? WHERE id = ?').run(url || null, id);
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
 * Actualiza la marca de tiempo de última ejecución
 */
function updateLastRun(subscriptionId) {
  getDb().prepare('UPDATE subscriptions SET last_run_at = ? WHERE id = ?').run(Date.now(), subscriptionId);
}

/**
 * Actualiza el timestamp del último digest enviado
 */
function updateLastDigest(subscriptionId) {
  getDb().prepare('UPDATE subscriptions SET last_digest_at = ? WHERE id = ?').run(Date.now(), subscriptionId);
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

module.exports = {
  createSubscription,
  verifySubscription,
  getSubscriptionByToken,
  getActiveSubscriptions,
  getSubscription,
  getAllSubscriptions,
  deleteSubscription,
  reactivateSubscription,
  hardDeleteSubscription,
  updateFrequency,
  updateWebhook,
  updateSubscription,
  updateLastRun,
  updateLastDigest,
  incrementEmailsSent,
  incrementEmailsFailed,
  recordEmailFailure,
  resetConsecutiveFailures,
  countActiveAlertsByEmail,
  getAlertLimitForEmail,
  setAlertLimitForEmail,
};
