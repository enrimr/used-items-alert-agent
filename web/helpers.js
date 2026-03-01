/**
 * Shared helper utilities for the web server
 */

const { renderTemplate } = require('./views/render');
const { buildLangSelector } = require('./i18n');
const { getThemeVars } = require('./theme');

/**
 * Escapa caracteres HTML especiales para evitar XSS.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renderiza una página sencilla (mensaje de éxito, error, confirmación)
 * usando la plantilla web/views/simple-page.html.
 *
 * @param {string} title       - Título de la página (se escapa automáticamente)
 * @param {string} message     - Cuerpo del mensaje (admite HTML inline seguro)
 * @param {string} accentColor - Color de la barra superior (hex, p.ej. '#f97316')
 * @param {Object} [req]       - Request de Express (para i18n y selector de idioma)
 * @returns {string}           - HTML completo listo para enviar con res.send()
 */
function renderSimplePage(title, message, accentColor = '#f97316', req = null) {
  const lang     = (req && req.lang)  || 'es';
  const selector = buildLangSelector(lang, (req && req.url) || '/');

  return renderTemplate('simple-page', {
    lang,
    title:       escapeHtml(title),
    message,                          // el llamador controla si hay HTML inline
    accentColor,
    langSelector: selector,
  });
}

module.exports = { escapeHtml, renderSimplePage };
