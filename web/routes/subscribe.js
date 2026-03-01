/**
 * Subscribe routes:
 * GET  /           → Main page (with theme + AdSense injection)
 * POST /subscribe  → Create new alert
 * GET  /unsubscribe/:id → Deactivate alert
 * GET  /success    → Success page
 * GET  /api/categories → Category list
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const { injectTheme, getThemeVars } = require('../theme');
const { escapeHtml, renderSimplePage } = require('../helpers');
const { renderTemplate } = require('../views/render');
const { buildLangSelector } = require('../i18n');
const {
  createSubscription,
  getSubscription,
  verifySubscription,
  deleteSubscription,
  updateWebhook,
  countActiveAlertsByEmail,
  getAlertLimitForEmail,
} = require('../db');
const { sendConfirmationEmail, sendVerificationEmail } = require('../../src/mailer');
const { CATEGORIES } = require('../../src/categories');
const { validatePriceRange, isValidEmail } = require('../../src/utils');
const { v4: uuidv4 } = require('uuid');

// Rate limiting: max 5 subscribes per IP per 15 min
const subscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: (req) => {
    const t = req.t || (() => 'Too many requests');
    return t('api_rate_limit');
  },
});

// ── Categorías con clave i18n ─────────────────────────────────────────────
// Mapa de id de categoría → clave de traducción
const CATEGORY_I18N_KEY = {
  '12465': 'cat_tecnologia',
  '12579': 'cat_moviles',
  '15000': 'cat_informatica',
  '12545': 'cat_moda',
  '12543': 'cat_motor',
  '12463': 'cat_deporte',
  '12459': 'cat_hogar',
  '12467': 'cat_tv',
  '12461': 'cat_consolas',
  '12473': 'cat_camaras',
  '14000': 'cat_coleccionismo',
  '12449': 'cat_libros',
  '12469': 'cat_bebes',
  '12471': 'cat_otros',
};

/**
 * Genera los <option> del select de categorías con textos traducidos.
 */
function buildCategoryOptions(t) {
  const allOpt = `<option value="">${t('option_all_categories')}</option>`;
  const opts = Object.entries(CATEGORIES)
    .filter(([id]) => id !== '')
    .map(([id]) => {
      const key  = CATEGORY_I18N_KEY[id];
      const name = key ? t(key) : (CATEGORIES[id] || id);
      return `<option value="${id}">${escapeHtml(name)}</option>`;
    })
    .join('\n');
  return allOpt + '\n' + opts;
}

// ────────────────────────────────────────────
// GET / → Main page
// ────────────────────────────────────────────
router.get('/', (req, res) => {
  const t        = req.t;
  const lang     = req.lang;
  const adsenseId = process.env.ADSENSE_CLIENT_ID;
  const htmlPath = path.join(__dirname, '../public', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Apply i18n tokens
  const keys = [
    'page_title', 'page_description', 'lang',
    'header_title', 'header_subtitle',
    'feature_email', 'feature_no_reg', 'feature_cancel',
    'form_title',
    'label_keywords', 'hint_required', 'placeholder_keywords',
    'label_email', 'placeholder_email',
    'label_min_price', 'hint_currency', 'label_max_price', 'placeholder_max_price',
    'label_category', 'hint_optional',
    'label_frequency', 'option_immediate', 'option_daily', 'option_weekly',
    'label_shipping',
    'webhook_label', 'webhook_subtitle', 'webhook_url_label', 'webhook_url_hint',
    'webhook_placeholder', 'webhook_description',
    'btn_submit', 'note_no_spam',
    'success_title', 'back_link',
    'how_step1_title', 'how_step1_desc',
    'how_step2_title', 'how_step2_desc',
    'how_step3_title', 'how_step3_desc',
    'footer_text',
  ];
  keys.forEach(key => {
    const val = key === 'lang' ? lang : t(key);
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
  });

  // Category options (server-rendered with translations)
  html = html.replace('{{categoryOptions}}', buildCategoryOptions(t));

  // Language selector
  html = html.replace('{{langSelector}}', buildLangSelector(lang, '/'));

  // JS i18n strings (JSON-encoded for safe embedding)
  const jsKeys = [
    'btn_submit', 'btn_creating', 'success_title', 'success_msg', 'back_link',
    'error_keywords_short', 'error_email_invalid', 'error_price_range',
    'error_generic', 'error_connection',
  ];
  jsKeys.forEach(key => {
    const encoded = JSON.stringify(t(key));
    html = html.replace(new RegExp(`\\{\\{js_${key}\\}\\}`, 'g'), encoded);
  });

  // Inject theme colors
  html = injectTheme(html);

  // Inject CSRF token
  const csrfToken = req.app.locals.generateCsrfToken
    ? req.app.locals.generateCsrfToken(req, res)
    : '';
  html = html.replace('</head>', `  <script>window.__CSRF_TOKEN__ = ${JSON.stringify(csrfToken)};</script>\n</head>`);

  // Inject AdSense if configured
  if (adsenseId) {
    const adsenseScript = `\n  <!-- Google AdSense -->\n  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}" crossorigin="anonymous"></script>`;
    html = html.replace('</head>', `${adsenseScript}\n</head>`);
    html = html.replace(/__ADSENSE_CLIENT_ID__/g, adsenseId);
  }

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Middleware CSRF: solo aplica a formularios HTML (no a JSON API)
function csrfForHtmlForms(req, res, next) {
  const isJsonApi = req.headers.accept && req.headers.accept.includes('application/json');
  if (isJsonApi) return next(); // JSON API no necesita CSRF
  const protection = req.app.locals.doubleCsrfProtection;
  if (!protection) return next(); // CSRF no configurado (tests)
  return protection(req, res, next);
}

// ────────────────────────────────────────────
// POST /subscribe → Create new alert
// ────────────────────────────────────────────
router.post('/subscribe', subscribeLimiter, csrfForHtmlForms, async (req, res) => {
  const t = req.t;
  const {
    email, keywords, min_price, max_price,
    category_id, email_frequency, shipping_only, webhook_url,
  } = req.body;

  if (!email || !keywords) {
    return res.status(400).json({ error: t('api_email_required') });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: t('api_email_invalid') });
  }

  if (keywords.trim().length < 2) {
    return res.status(400).json({ error: t('api_keywords_short') });
  }

  const minPrice = min_price ? parseFloat(min_price) : null;
  const maxPrice = max_price ? parseFloat(max_price) : null;

  if (min_price && isNaN(minPrice)) {
    return res.status(400).json({ error: t('api_price_min_not_valid') });
  }
  if (max_price && isNaN(maxPrice)) {
    return res.status(400).json({ error: t('api_price_max_not_valid') });
  }

  const priceValidation = validatePriceRange(minPrice, maxPrice);
  if (!priceValidation.ok) {
    return res.status(400).json({ error: t('api_price_min_max') });
  }

  const activeCount = countActiveAlertsByEmail(email);
  const limit = getAlertLimitForEmail(email);
  if (activeCount >= limit) {
    return res.status(429).json({
      error: t('api_limit_reached', {
        limit,
        plural: limit !== 1 ? 's' : '',
      }),
    });
  }

  // Validate webhook URL if provided
  if (webhook_url && webhook_url.trim()) {
    if (!/^https?:\/\/.+/.test(webhook_url.trim())) {
      return res.status(400).json({ error: t('api_webhook_invalid') });
    }
  }

  // ¿Requiere verificación de email?
  const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
  const verificationToken    = requireVerification ? uuidv4() : null;
  const shippingOnly         = shipping_only === 'true' || shipping_only === true || shipping_only === '1';

  try {
    const id = createSubscription({
      email,
      keywords:          keywords.trim(),
      minPrice,
      maxPrice,
      categoryId:        category_id || '',
      frequency:         email_frequency || 'immediate',
      shippingOnly,
      verified:          !requireVerification,
      verificationToken,
    });

    // Persist webhook URL if provided
    if (webhook_url && webhook_url.trim()) {
      try { updateWebhook(id, webhook_url.trim()); } catch (e) { /* invalid url — ignore */ }
    }

    const sub = getSubscription(id);
    // Store the lang of the user in the sub object for email sending
    sub._lang = req.lang;

    if (requireVerification) {
      sendVerificationEmail(email, sub, req.lang).catch(err => {
        console.error('Error enviando verificación:', err.message);
      });
    } else {
      sendConfirmationEmail(email, sub, req.lang).catch(err => {
        console.error('Error enviando confirmación:', err.message);
      });
    }

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        success: true,
        id,
        pendingVerification: requireVerification,
      });
    }

    const successQuery = requireVerification
      ? `?keywords=${encodeURIComponent(keywords)}&email=${encodeURIComponent(email)}&verify=1`
      : `?keywords=${encodeURIComponent(keywords)}&email=${encodeURIComponent(email)}`;
    return res.redirect(`/success${successQuery}`);

  } catch (err) {
    console.error('Error creando suscripción:', err.message);
    return res.status(500).json({ error: t('api_internal_error') });
  }
});

// ────────────────────────────────────────────
// GET /verify/:token → Verify email and activate alert
// ────────────────────────────────────────────
router.get('/verify/:token', (req, res) => {
  const { token } = req.params;
  const t   = req.t;
  const sub = verifySubscription(token);

  if (!sub) {
    return res.status(404).send(renderSimplePage(
      t('verify_invalid_title'),
      t('verify_invalid_msg'),
      '#f87171',
      req
    ));
  }

  const themeVars = getThemeVars();
  const msg = t('verify_success_msg', {
    keywords: escapeHtml(sub.keywords),
    email:    escapeHtml(sub.email),
  }) + `<br><br>
    <a href="/" style="display:inline-block;margin-top:8px;background:${themeVars.primary};color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
      ${t('verify_cta')}
    </a>`;

  return res.send(renderSimplePage(
    t('verify_success_title'),
    msg,
    themeVars.primary,
    req
  ));
});

// ────────────────────────────────────────────
// GET /unsubscribe/:id → Deactivate alert
// ────────────────────────────────────────────
router.get('/unsubscribe/:id', (req, res) => {
  const { id } = req.params;
  const t   = req.t;
  const sub = getSubscription(id);

  if (!sub) {
    return res.status(404).send(renderSimplePage(
      t('unsub_not_found_title'),
      t('unsub_not_found_msg'),
      '#f87171',
      req
    ));
  }

  const deleted = deleteSubscription(id);

  if (deleted) {
    return res.send(renderSimplePage(
      t('unsub_success_title'),
      t('unsub_success_msg', { keywords: escapeHtml(sub.keywords) }),
      '#f97316',
      req
    ));
  }

  return res.status(500).send(renderSimplePage(
    t('unsub_error_title'),
    t('unsub_error_msg'),
    '#f87171',
    req
  ));
});

// ────────────────────────────────────────────
// GET /success → Success page
// ────────────────────────────────────────────
router.get('/success', (req, res) => {
  const { keywords = '', email = '' } = req.query;
  const t    = req.t;
  const lang = req.lang;
  const themeVars = getThemeVars();

  const msg = t('success_page_msg', {
    email:    escapeHtml(email),
    keywords: escapeHtml(keywords),
  });

  res.send(renderTemplate('success', {
    lang,
    primary:  themeVars.primary,
    title:    t('success_page_heading'),
    message:  msg,
    cta:      t('success_page_cta'),
    langSelector: buildLangSelector(lang, '/success'),
  }));
});

// ────────────────────────────────────────────
// GET /api/categories → Category list
// ────────────────────────────────────────────
router.get('/api/categories', (req, res) => {
  const t    = req.t;
  const cats = Object.entries(CATEGORIES)
    .filter(([id]) => id !== '')
    .map(([id]) => {
      const key  = CATEGORY_I18N_KEY[id];
      const name = key ? t(key) : (CATEGORIES[id] || id);
      return { id, name };
    });
  res.json(cats);
});

module.exports = router;
