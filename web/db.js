/**
 * Punto de entrada de la capa de datos — compatibilidad hacia atrás.
 *
 * La lógica ha sido dividida en módulos por dominio dentro de web/db/:
 *   web/db/connection.js    — conexión SQLite y schema
 *   web/db/subscriptions.js — CRUD de suscripciones
 *   web/db/seen-items.js    — items vistos por suscripción
 *   web/db/digest.js        — acumulación para digests diarios/semanales
 *   web/db/stats.js         — estadísticas globales y email limits
 *
 * Todos los require('../db') o require('./db') existentes siguen funcionando sin cambios.
 */
module.exports = require('./db/index');
