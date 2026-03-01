/**
 * Estadísticas globales y límites de alertas por email
 */

const { getDb } = require('./connection');

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
  const totalSeen    = db.prepare('SELECT COUNT(*) as count FROM seen_items').get().count;
  const totalPending = db.prepare(
    'SELECT COUNT(*) as count FROM subscriptions WHERE verified = 0 AND verification_token IS NOT NULL'
  ).get().count;

  const sent = row.totalEmailsSent || 0;
  const failed = row.totalEmailsFailed || 0;
  const totalAttempts = sent + failed;
  const successRate = totalAttempts > 0 ? Math.round((sent / totalAttempts) * 100) : 100;
  const deletedPct = row.totalAll > 0 ? Math.round((row.totalDeleted / row.totalAll) * 100) : 0;

  return {
    totalActive:    row.totalActive || 0,
    totalAll:       row.totalAll || 0,
    totalDeleted:   row.totalDeleted || 0,
    totalUsers:     row.totalUsers || 0,
    totalEmailsSent:   sent,
    totalEmailsFailed: failed,
    successRate,
    deletedPct,
    totalSeen,
    totalPending,
  };
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

module.exports = { getStats, getEmailStats };
