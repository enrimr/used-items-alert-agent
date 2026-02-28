/**
 * Puente para que src/mailer.js pueda acceder al tema web
 * sin depender directamente de la ruta web/theme.js.
 * Si web/theme.js no existe (entorno CLI puro) el require fallará
 * y src/mailer.js usará los colores por defecto.
 */
module.exports = require('../web/theme');
