/**
 * Punto de entrada unificado para la capa de datos.
 * Re-exporta todas las funciones de los módulos por dominio.
 *
 * Estructura:
 *   web/db/connection.js   — conexión SQLite y schema
 *   web/db/subscriptions.js — CRUD de suscripciones
 *   web/db/seen-items.js   — items vistos por suscripción
 *   web/db/digest.js       — acumulación de digests diarios/semanales
 *   web/db/stats.js        — estadísticas globales y email limits
 */

module.exports = {
  ...require('./subscriptions'),
  ...require('./seen-items'),
  ...require('./digest'),
  ...require('./stats'),
};
