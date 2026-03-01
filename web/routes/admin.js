/**
 * Rutas del panel de administración
 * GET  /admin                   → Dashboard
 * POST /admin/delete/:id        → Desactiva alerta (⚠️ acción destructiva → POST)
 * POST /admin/reactivate/:id    → Reactiva alerta
 * POST /admin/hard-delete/:id   → Borrado permanente (⚠️ acción destructiva → POST)
 * POST /admin/set-frequency     → Cambia frecuencia
 * POST /admin/edit/:id          → Edita alerta
 * POST /admin/set-limit         → Ajusta límite de alertas por email
 * POST /admin/set-webhook/:id   → Configura webhook URL
 */

const express = require('express');
const router = express.Router();

const { getThemeVars } = require('../theme');
const { escapeHtml, renderSimplePage } = require('../helpers');
const { buildLangSelector } = require('../i18n');
const { renderTemplate, renderPartial, renderPartialList } = require('../views/render');
const { CATEGORIES } = require('../../src/categories');
const {
  getAllSubscriptions, getStats, getEmailStats,
  deleteSubscription, reactivateSubscription, hardDeleteSubscription,
  updateFrequency, updateSubscription, updateWebhook, setAlertLimitForEmail,
} = require('../db');

// ─── Auth middleware ────────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const adminPass = process.env.ADMIN_PASSWORD;
  const t = req.t || (k => k);
  if (!adminPass) {
    return res.status(503).send(renderSimplePage(
      t('admin_disabled_title'),
      t('admin_disabled_msg'),
      '#f59e0b',
      req
    ));
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Wallapop Alertas Admin"');
    return res.status(401).send(t('admin_auth_required'));
  }
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  const [, pass] = decoded.split(':');
  if (pass !== adminPass) {
    res.set('WWW-Authenticate', 'Basic realm="Wallapop Alertas Admin"');
    return res.status(401).send(t('admin_wrong_password'));
  }
  next();
}

router.use(adminAuth);

// CSRF para todas las rutas POST del admin
// El admin ya tiene Basic Auth, pero añadimos CSRF como defensa en profundidad
function adminCsrf(req, res, next) {
  const protection = req.app.locals.doubleCsrfProtection;
  if (!protection) return next(); // no configurado (tests)
  return protection(req, res, next);
}

// ─── Helpers de formato ────────────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
}

function formatPrice(min, max) {
  if (!min && !max) return '—';
  if (min && max) return `${min}€ – ${max}€`;
  if (min) return `≥ ${min}€`;
  return `≤ ${max}€`;
}

const CATEGORY_NAMES = Object.fromEntries(
  Object.entries(CATEGORIES).filter(([id]) => id !== '')
);

// Genera los <option> del select de categorías para el formulario de edición
function buildCategoryOptions(selectedId) {
  return Object.entries(CATEGORIES)
    .filter(([id]) => id !== '')
    .map(([id, name]) =>
      `<option value="${id}" ${selectedId === id ? 'selected' : ''}>${name}</option>`
    ).join('\n');
}

// ─── Mappers: convierten un item de BD en variables de partial ─────────────

// ─── buildVerifiedBadge necesita acceso al t() del request ─────────────────
// Se genera como función que recibe tr (traducción) por parámetro
function buildVerifiedBadge(s, tr) {
  if (!s.verification_token && s.verified) {
    const lbl = tr ? tr('admin_badge_verified') : '✅ Verificada';
    return `<span style="background:#dbeafe;color:#1e40af;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;margin-left:4px;white-space:nowrap;">${lbl}</span>`;
  }
  if (s.verification_token && !s.verified) {
    const lbl = tr ? tr('admin_badge_pending') : '⏳ Pendiente';
    return `<span style="background:#fef9c3;color:#92400e;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;margin-left:4px;white-space:nowrap;">${lbl}</span>`;
  }
  return '';
}

// Los mappers ahora reciben tr (función de traducción) como segundo parámetro
function mapSubRow(s, tr) {
  const theme = getThemeVars();
  const freq = s.email_frequency || 'immediate';
  const webhookUrl = s.webhook_url || '';
  const webhookOnLabel  = tr ? tr('admin_webhook_on')  : '🔗 ON';
  const webhookOffLabel = tr ? tr('admin_webhook_off') : '— OFF';
  return {
    id:             s.id,
    rowClass:       s.active ? '' : 'inactive',
    badgeClass:     s.active ? 'badge-active' : 'badge-inactive',
    statusLabel:    s.active ? (tr ? tr('admin_status_active') : 'Activa') : (tr ? tr('admin_status_inactive') : 'Inactiva'),
    verifiedBadge:  buildVerifiedBadge(s, tr),
    keywords:       escapeHtml(s.keywords),
    email:          escapeHtml(s.email),
    priceRange:     formatPrice(s.min_price, s.max_price),
    categoryName:   s.category_id ? (CATEGORY_NAMES[s.category_id] || s.category_id) : '—',
    categoryOptions: buildCategoryOptions(s.category_id),
    allCategoriesLabel: tr ? tr('option_all_categories') : '— Todas las categorías —',
    minPrice:       s.min_price || '',
    maxPrice:       s.max_price || '',
    selImmediate:   freq === 'immediate' ? 'selected' : '',
    selDaily:       freq === 'daily'     ? 'selected' : '',
    selWeekly:      freq === 'weekly'    ? 'selected' : '',
    freqImmediate:  tr ? tr('admin_alerts_freq_imm')    : '⚡ Inmediato',
    freqDaily:      tr ? tr('admin_alerts_freq_daily')  : '📅 Diario',
    freqWeekly:     tr ? tr('admin_alerts_freq_weekly') : '📆 Semanal',
    editLabel:      tr ? tr('admin_edit_label')         : 'editar',
    saveLabel:      tr ? tr('admin_save_label')         : 'Guardar',
    confirmDeleteWebhook: tr ? tr('admin_confirm_delete_webhook') : '¿Eliminar webhook?',
    createdAt:      formatDate(s.created_at),
    lastRunAt:      formatDate(s.last_run_at),
    emailsSent:     s.emails_sent || 0,
    webhookUrl:     escapeHtml(webhookUrl),
    webhookBadge:   webhookUrl
      ? `<span style="background:#d1fae5;color:#065f46;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;">${webhookOnLabel}</span>`
      : `<span style="background:#f3f4f6;color:#9ca3af;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;">${webhookOffLabel}</span>`,
    webhookViewBtn: webhookUrl
      ? `<a href="${escapeHtml(webhookUrl)}" target="_blank" rel="noopener noreferrer"
           class="btn-webhook-link"
           title="${escapeHtml(webhookUrl)}">
           🔗 ${escapeHtml(webhookUrl)}
         </a>`
      : '',
    actionButton:   s.active
      ? renderPartial('post-btn', {
          action:     `/admin/delete/${s.id}`,
          cssClass:   'btn-delete',
          confirmMsg: `return confirm('${tr ? tr('admin_confirm_deactivate') : '¿Desactivar esta alerta?'}')`,
          label:      tr ? tr('admin_btn_deactivate') : 'Desactivar',
        })
      : renderPartial('post-btn', {
          action:     `/admin/reactivate/${s.id}`,
          cssClass:   'btn-reactivate',
          confirmMsg: '',
          label:      tr ? tr('admin_btn_reactivate') : 'Reactivar',
        }),
    hardDeleteBtn: renderPartial('post-btn', {
      action:     `/admin/hard-delete/${s.id}`,
      cssClass:   'btn-hard-delete',
      confirmMsg: `return confirm('${tr ? tr('admin_confirm_hard_delete') : '⚠️ BORRADO DEFINITIVO'}')`,
      label:      tr ? tr('admin_btn_delete') : '🗑️ Borrar',
    }),
    primary:        theme.primary,
    shadowRgb:      theme.shadowRgb,
  };
}

function mapEmailRow(e, tr) {
  const theme = getThemeVars();
  return {
    email:           escapeHtml(e.email),
    activeAlerts:    e.active_alerts,
    totalAlerts:     e.total_alerts,
    totalEmailsSent: e.total_emails_sent || 0,
    maxAlerts:       e.max_alerts,
    primary:         theme.primary,
    activeOfLabel:   tr ? tr('admin_active_of')   : 'activas de',
    createdLabel:    tr ? tr('admin_created_label'): 'creadas',
    maxLabel:        tr ? tr('admin_max_label')    : 'Máx:',
    saveLabel:       tr ? tr('admin_save_label')   : 'Guardar',
  };
}

function mapUsersCard(e, tr) {
  const theme = getThemeVars();
  return {
    email:           escapeHtml(e.email),
    activeAlerts:    e.active_alerts,
    totalAlerts:     e.total_alerts,
    totalEmailsSent: e.total_emails_sent || 0,
    maxAlerts:       e.max_alerts,
    primary:         theme.primary,
    cardLabelAlerts:     tr ? tr('admin_users_col_alerts')   : 'Alertas',
    activeOfLabel:       tr ? tr('admin_active_of')          : 'activas de',
    cardLabelEmailsSent: tr ? tr('admin_users_col_sent')     : 'Emails env.',
    cardLabelLimit:      tr ? tr('admin_users_col_limit')    : 'Límite máx.',
    saveLabel:           tr ? tr('admin_save_label')         : 'Guardar',
  };
}

function mapAlertCard(s, tr) {
  return {
    dataActive:      s.active ? '1' : '0',
    keywordsLower:   escapeHtml(s.keywords.toLowerCase()),
    emailLower:      escapeHtml(s.email.toLowerCase()),
    frequency:       s.email_frequency || 'immediate',
    cardOpacity:     s.active ? '' : 'opacity:0.5',
    badgeClass:      s.active ? 'badge-active' : 'badge-inactive',
    statusLabel:     s.active ? (tr ? tr('admin_status_active') : 'Activa') : (tr ? tr('admin_status_inactive') : 'Inactiva'),
    verifiedBadge:   buildVerifiedBadge(s, tr),
    keywords:        escapeHtml(s.keywords),
    email:           escapeHtml(s.email),
    priceRange:      formatPrice(s.min_price, s.max_price),
    emailsSent:      s.emails_sent || 0,
    cardLabelStatus: tr ? tr('admin_col_status')  : 'Estado',
    cardLabelSearch: tr ? tr('admin_col_search')  : 'Búsqueda',
    cardLabelEmail:  tr ? tr('admin_col_email')   : 'Email',
    cardLabelPrice:  tr ? tr('admin_col_price')   : 'Precio',
    cardLabelEmails: tr ? tr('admin_col_emails')  : 'Emails',
    deleteButton: s.active
      ? `<div class="card-row" style="margin-top:6px;width:100%">${
          renderPartial('post-btn', {
            action:     `/admin/delete/${s.id}`,
            cssClass:   'btn-delete',
            confirmMsg: `return confirm('${tr ? tr('admin_confirm_delete') : '¿Eliminar esta alerta?'}')`,
            label:      tr ? tr('admin_btn_deactivate') : 'Desactivar',
          })
        }</div>`
      : '',
  };
}

// ─── GET /admin → Dashboard ────────────────────────────────────────────────
router.get('/', (req, res) => {
  const subs       = getAllSubscriptions();
  const stats      = getStats();
  const emailStats = getEmailStats();
  const t          = getThemeVars();
  const tr         = req.t;
  const lang       = req.lang;

  const EMPTY_SUB_ROW   = renderPartial('empty-row', { colspan: 10, message: tr('admin_empty_alerts') });
  const EMPTY_EMAIL_ROW = renderPartial('empty-row', { colspan:  4, message: tr('admin_empty_users')  });
  const EMPTY_CARD      = `<p style="color:#9ca3af;font-size:13px;padding:8px 0">${tr('admin_empty_data')}</p>`;

  const vars = {
    // Idioma
    lang,
    langSelector: buildLangSelector(lang, '/admin'),

    // i18n — admin panel
    adminTitle:         tr('admin_title'),
    adminBackLink:      tr('admin_back_link'),
    statActive:         tr('admin_stat_active'),
    statTotal:          tr('admin_stat_total'),
    statUsers:          tr('admin_stat_users'),
    statEmailsSent:     tr('admin_stat_emails_sent'),
    statEmailsFailed:   tr('admin_stat_emails_failed'),
    statSuccessRate:    tr('admin_stat_success_rate'),
    statDeleted:        tr('admin_stat_deleted'),
    statSeen:           tr('admin_stat_seen'),
    statPending:        tr('admin_stat_pending'),
    usersTitle:         tr('admin_users_title'),
    usersActiveToggle:  tr('admin_users_active_toggle'),
    colEmail:           tr('admin_col_email'),
    usersColAlerts:     tr('admin_users_col_alerts'),
    usersColSent:       tr('admin_users_col_sent'),
    usersColLimit:      tr('admin_users_col_limit'),
    alertsTitle:        tr('admin_alerts_title'),
    alertsActiveToggle: tr('admin_alerts_active_toggle'),
    alertsSearchPh:     tr('admin_alerts_search_ph'),
    alertsFreqAny:      tr('admin_alerts_freq_any'),
    alertsFreqImm:      tr('admin_alerts_freq_imm'),
    alertsFreqDaily:    tr('admin_alerts_freq_daily'),
    alertsFreqWeekly:   tr('admin_alerts_freq_weekly'),
    alertsClear:        tr('admin_alerts_clear'),
    colStatus:          tr('admin_col_status'),
    colSearch:          tr('admin_col_search'),
    colPrice:           tr('admin_col_price'),
    colCategory:        tr('admin_col_category'),
    colFrequency:       tr('admin_col_frequency'),
    colWebhook:         tr('admin_col_webhook'),
    colCreated:         tr('admin_col_created'),
    colLastRun:         tr('admin_col_last_run'),
    colEmails:          tr('admin_col_emails'),
    colAction:          tr('admin_col_action'),

    // Tema
    primary:     t.primary,
    primaryDark: t.primaryDark,
    shadowRgb:   t.shadowRgb,

    // Estadísticas
    'stats.totalActive':       stats.totalActive,
    'stats.totalAll':          stats.totalAll,
    'stats.totalUsers':        stats.totalUsers,
    'stats.totalEmailsSent':   stats.totalEmailsSent,
    'stats.totalEmailsFailed': stats.totalEmailsFailed,
    'stats.successRate':       stats.successRate,
    'stats.totalDeleted':      stats.totalDeleted,
    'stats.deletedPct':        stats.deletedPct,
    'stats.totalSeen':         stats.totalSeen,
    'stats.totalPending':      stats.totalPending,
    'stats.pendingBorder':     stats.totalPending > 0 ? 'border:2px solid #fef9c3' : '',
    'stats.pendingColor':      stats.totalPending > 0 ? '#92400e' : '#6b7280',
    'stats.failedBorder':      stats.totalEmailsFailed > 0 ? 'border:2px solid #fecaca' : '',
    'stats.failedColor':       stats.totalEmailsFailed > 0 ? '#ef4444' : t.primary,
    'stats.successRateColor':  stats.successRate >= 90 ? '#13c1ac'
                             : stats.successRate >= 70 ? '#f59e0b' : '#ef4444',

    // Partials renderizados (currying para pasar tr a los mappers)
    subsRows:    renderPartialList('sub-row',    subs,       s => mapSubRow(s, tr),    EMPTY_SUB_ROW),
    usersRows:   renderPartialList('email-row',  emailStats, e => mapEmailRow(e, tr),  EMPTY_EMAIL_ROW),
    usersCards:  renderPartialList('users-card', emailStats, e => mapUsersCard(e, tr), EMPTY_CARD),
    alertsCards: renderPartialList('alert-card', subs,       s => mapAlertCard(s, tr), EMPTY_CARD),
  };

  // Generar token CSRF para los formularios del panel admin
  const csrfToken = req.app.locals.generateCsrfToken
    ? req.app.locals.generateCsrfToken(req, res)
    : '';
  vars.csrfToken = csrfToken;

  res.send(renderTemplate('admin', vars));
});

// ─── Rutas de acción ───────────────────────────────────────────────────────
// POST (no GET) para evitar que navegadores/proxies precarguen URLs destructivas
// + CSRF como defensa en profundidad
router.post('/delete/:id', adminCsrf, (req, res) => {
  deleteSubscription(req.params.id);
  res.redirect('/admin');
});

router.post('/reactivate/:id', adminCsrf, (req, res) => {
  reactivateSubscription(req.params.id);
  res.redirect('/admin');
});

router.post('/hard-delete/:id', adminCsrf, (req, res) => {
  hardDeleteSubscription(req.params.id);
  res.redirect('/admin');
});

router.post('/set-frequency', adminCsrf, (req, res) => {
  const { id, frequency } = req.body;
  if (id && frequency) updateFrequency(id, frequency);
  res.redirect('/admin');
});

router.post('/edit/:id', adminCsrf, (req, res) => {
  const { id } = req.params;
  const { keywords, min_price, max_price, category_id } = req.body;
  if (id && keywords && keywords.trim().length >= 2) {
    updateSubscription(id, {
      keywords,
      minPrice:   min_price   || null,
      maxPrice:   max_price   || null,
      categoryId: category_id || '',
    });
  }
  res.redirect('/admin');
});

router.post('/set-limit', adminCsrf, (req, res) => {
  const { email, max_alerts } = req.body;
  if (email && max_alerts !== undefined) {
    setAlertLimitForEmail(email, Math.max(0, parseInt(max_alerts, 10) || 0));
  }
  res.redirect('/admin');
});

router.post('/set-webhook/:id', adminCsrf, (req, res) => {
  const { id } = req.params;
  const { webhook_url } = req.body;
  try {
    updateWebhook(id, webhook_url || null);
  } catch (e) {
    // Invalid URL — just ignore silently (UI validates too)
  }
  res.redirect('/admin');
});

module.exports = router;
