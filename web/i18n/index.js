/**
 * Módulo de internacionalización (i18n) — Wallapop Alertas
 *
 * Idiomas soportados: es (defecto), en, it, ca
 *
 * Detección de idioma (por orden de prioridad):
 *   1. Query param ?lang=xx
 *   2. Cookie "lang"
 *   3. Cabecera Accept-Language
 *   4. Español (defecto)
 *
 * Uso en rutas Express:
 *   const { i18nMiddleware, getT } = require('../i18n');
 *   app.use(i18nMiddleware);
 *   // En un handler:
 *   const t = req.t;                  // función de traducción
 *   t('btn_submit')                   // → texto traducido
 *   t('api_limit_reached', { limit: 5, plural: 's' })
 *
 * Uso standalone (sin req):
 *   const { getT } = require('../i18n');
 *   const t = getT('en');
 */

const LOCALES = {
  es: require('./es'),
  en: require('./en'),
  it: require('./it'),
  ca: require('./ca'),
};

// DEFAULT_LANG se puede configurar vía variable de entorno DEFAULT_LANG
// Valores válidos: 'es' | 'en' | 'it' | 'ca'  (por defecto: 'es')
const SUPPORTED    = Object.keys(LOCALES);
const DEFAULT_LANG = (
  process.env.DEFAULT_LANG &&
  SUPPORTED.includes(process.env.DEFAULT_LANG.toLowerCase())
    ? process.env.DEFAULT_LANG.toLowerCase()
    : 'es'
);

// ── Resolución de idioma ───────────────────────────────────────────────────

/**
 * Devuelve el código de idioma normalizado ('es', 'en', 'it', 'ca').
 * Acepta variantes como 'es-ES', 'en-US', 'ca-ES', etc.
 */
function resolveLocale(raw) {
  if (!raw) return null;
  const code = String(raw).toLowerCase().split(/[-_]/)[0];
  return SUPPORTED.includes(code) ? code : null;
}

/**
 * Parsea el header Accept-Language y devuelve el mejor locale soportado.
 * Ejemplo: "ca-ES,ca;q=0.9,es;q=0.8,en;q=0.7" → "ca"
 */
function parseAcceptLanguage(header) {
  if (!header) return null;
  const parts = header.split(',').map(p => {
    const [lang, q] = p.trim().split(';q=');
    return { lang: lang.trim(), q: q ? parseFloat(q) : 1.0 };
  });
  parts.sort((a, b) => b.q - a.q);
  for (const { lang } of parts) {
    const resolved = resolveLocale(lang);
    if (resolved) return resolved;
  }
  return null;
}

/**
 * Detecta el idioma para una petición Express.
 */
function detectLang(req) {
  // 1. Query param
  const qLang = resolveLocale(req.query && req.query.lang);
  if (qLang) return qLang;

  // 2. Cookie
  const cookieLang = resolveLocale(req.cookies && req.cookies.lang);
  if (cookieLang) return cookieLang;

  // 3. Accept-Language header
  const acceptLang = parseAcceptLanguage(req.headers && req.headers['accept-language']);
  if (acceptLang) return acceptLang;

  return DEFAULT_LANG;
}

// ── Función de traducción ──────────────────────────────────────────────────

/**
 * Crea una función de traducción para un locale dado.
 *
 * @param {string} lang  - Código de idioma
 * @returns {function}   - t(key, vars?) → string
 */
function getT(lang) {
  const locale = LOCALES[lang] || LOCALES[DEFAULT_LANG];

  /**
   * @param {string} key   - Clave de traducción
   * @param {Object} [vars] - Variables a interpolar ({key: value})
   * @returns {string}
   */
  return function t(key, vars) {
    let str = locale[key];
    if (str === undefined) {
      // Fallback al idioma por defecto
      str = LOCALES[DEFAULT_LANG][key];
    }
    if (str === undefined) return key; // Devuelve la clave si no se encuentra

    if (vars && typeof vars === 'object') {
      str = str.replace(/\{(\w+)\}/g, (match, k) =>
        vars[k] !== undefined ? vars[k] : match
      );
    }
    return str;
  };
}

// ── Middleware Express ─────────────────────────────────────────────────────

/**
 * Middleware que inyecta req.lang y req.t en cada petición.
 * Si se pasa ?lang=xx, guarda la preferencia en una cookie de 1 año.
 */
function i18nMiddleware(req, res, next) {
  const lang = detectLang(req);

  // Persistir preferencia de idioma si se seleccionó via query param
  if (req.query && req.query.lang && resolveLocale(req.query.lang)) {
    res.cookie('lang', lang, {
      maxAge:   365 * 24 * 60 * 60 * 1000, // 1 año
      httpOnly: false,  // accesible desde JS para el selector
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
    });
    // Redirigir sin el query param para URLs limpias
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    url.searchParams.delete('lang');
    const clean = url.pathname + (url.search ? url.search : '') + (url.hash ? url.hash : '');
    return res.redirect(302, clean);
  }

  req.lang = lang;
  req.t    = getT(lang);

  // Exponer datos de idioma a las vistas (útil para el selector)
  res.locals.lang      = lang;
  res.locals.t         = req.t;
  res.locals.languages = SUPPORTED.map(code => ({
    code,
    label: LOCALES[code].lang_select_label || code.toUpperCase(),
    native: getNativeName(code),
    active: code === lang,
  }));

  next();
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getNativeName(code) {
  const names = { es: 'Español', en: 'English', it: 'Italiano', ca: 'Català' };
  return names[code] || code;
}

/**
 * Genera el HTML del selector de idioma (dropdown compacto).
 * Al cambiar el valor navega a ?lang=xx para guardar la preferencia.
 *
 * @param {string} currentLang  - Idioma activo
 * @param {string} [currentUrl] - URL actual (para construir los links)
 * @returns {string}
 */
function buildLangSelector(currentLang, currentUrl = '/') {
  const flags = { es: '🇪🇸', en: '🇬🇧', it: '🇮🇹', ca: '🏴󠁥󠁳󠁣󠁴󠁿' };
  const options = SUPPORTED.map(code => {
    const native   = getNativeName(code);
    const flag     = flags[code] || '';
    const selected = code === currentLang ? ' selected' : '';
    return `<option value="${code}"${selected}>${flag} ${native}</option>`;
  }).join('');

  // base URL sin ?lang para construir los href en el onchange
  const baseUrl = (() => {
    try {
      const u = new URL(currentUrl, 'http://x');
      u.searchParams.delete('lang');
      return u.pathname + (u.search ? u.search : '');
    } catch {
      return currentUrl.replace(/[?&]lang=[^&]*/g, '').replace(/[?&]$/, '');
    }
  })();
  const sep = baseUrl.includes('?') ? '&' : '?';

  return `<div class="lang-selector">
  <select class="lang-select" aria-label="Language" onchange="location.href='${baseUrl}${sep}lang='+this.value">
    ${options}
  </select>
</div>`;
}

function addLangParam(url, lang) {
  try {
    const u = new URL(url, 'http://x');
    u.searchParams.set('lang', lang);
    return u.pathname + u.search;
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}lang=${lang}`;
  }
}

// ── Utilidades para emails ─────────────────────────────────────────────────

/**
 * Obtiene el locale de una suscripción (guardado en BD) o el defecto.
 * Útil para enviar emails en el idioma del usuario.
 *
 * @param {Object} sub  - Suscripción (puede tener sub.lang)
 * @returns {string}    - Código de idioma
 */
function getLangForSub(sub) {
  if (sub && sub.lang) return resolveLocale(sub.lang) || DEFAULT_LANG;
  return DEFAULT_LANG;
}

module.exports = {
  SUPPORTED,
  DEFAULT_LANG,
  LOCALES,
  resolveLocale,
  detectLang,
  getT,
  i18nMiddleware,
  buildLangSelector,
  getLangForSub,
};
