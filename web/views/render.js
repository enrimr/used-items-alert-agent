/**
 * Motor de plantillas minimalista.
 *
 * API pública:
 *   renderTemplate(name, vars)            → renderiza web/views/<name>.html
 *   renderPartial(name, vars)             → renderiza web/views/partials/<name>.html
 *   renderPartialList(name, items, mapFn) → renderiza el partial una vez por item
 *
 * Reglas de sustitución:
 *   - Los tokens {{key}} se sustituyen por el valor de vars[key].
 *   - Los valores se insertan sin escape adicional; el llamador es responsable
 *     de aplicar escapeHtml() antes de pasar datos de usuario.
 *   - Tokens no encontrados en vars se dejan sin cambio (facilita debug).
 *
 * Caché:
 *   - Por defecto se lee de disco en cada llamada (útil en desarrollo).
 *   - Activar con TEMPLATE_CACHE=true en producción para mayor rendimiento.
 */

const fs = require('fs');
const path = require('path');

const VIEWS_DIR    = path.join(__dirname);
const PARTIALS_DIR = path.join(__dirname, 'partials');

const cache = new Map();
const USE_CACHE = process.env.TEMPLATE_CACHE === 'true';

// ── Lectura de ficheros ────────────────────────────────────────────────────

function readTemplate(filePath) {
  if (USE_CACHE && cache.has(filePath)) return cache.get(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  if (USE_CACHE) cache.set(filePath, content);
  return content;
}

// ── Sustitución de tokens ──────────────────────────────────────────────────

function applyVars(tpl, vars) {
  return tpl.replace(/\{\{([\w.]+)\}\}/g, (match, key) => {
    const value = vars[key];
    return value !== undefined ? value : match;
  });
}

// ── API pública ────────────────────────────────────────────────────────────

/**
 * Renderiza la plantilla `name` (sin extensión) con las variables `vars`.
 * @param {string} name  - Nombre del fichero en web/views/, p.ej. 'admin'
 * @param {Object} vars  - Mapa plano de clave → valor (string/number)
 * @returns {string}
 */
function renderTemplate(name, vars) {
  const tpl = readTemplate(path.join(VIEWS_DIR, `${name}.html`));
  return applyVars(tpl, vars);
}

/**
 * Renderiza el partial `name` (sin extensión) con las variables `vars`.
 * @param {string} name  - Nombre del fichero en web/views/partials/
 * @param {Object} vars  - Variables para este partial
 * @returns {string}
 */
function renderPartial(name, vars) {
  const tpl = readTemplate(path.join(PARTIALS_DIR, `${name}.html`));
  return applyVars(tpl, vars);
}

/**
 * Renderiza el partial `name` una vez por cada elemento de `items`,
 * usando `mapFn(item)` para obtener el objeto de variables de cada uno.
 *
 * @param {string}   name    - Nombre del partial (sin extensión)
 * @param {Array}    items   - Lista de items a renderizar
 * @param {Function} mapFn   - item → { key: value, ... }
 * @param {string}   [empty] - HTML a devolver si items está vacío
 * @returns {string}         - Fragmentos concatenados
 */
function renderPartialList(name, items, mapFn, empty = '') {
  if (!items || items.length === 0) return empty;
  const tpl = readTemplate(path.join(PARTIALS_DIR, `${name}.html`));
  return items.map(item => applyVars(tpl, mapFn(item))).join('\n');
}

module.exports = { renderTemplate, renderPartial, renderPartialList };
