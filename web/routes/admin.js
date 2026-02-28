/**
 * Rutas del panel de administración
 * GET  /admin                → Dashboard
 * POST /admin/delete/:id     → Desactiva alerta (⚠️ acción destructiva → POST)
 * POST /admin/reactivate/:id → Reactiva alerta
 * POST /admin/hard-delete/:id→ Borrado permanente (⚠️ acción destructiva → POST)
 * POST /admin/set-frequency  → Cambia frecuencia
 * POST /admin/edit/:id       → Edita alerta
 * POST /admin/set-limit      → Ajusta límite de alertas por email
 */

const express = require('express');
const router = express.Router();

const { getThemeVars } = require('../theme');
const { escapeHtml, renderSimplePage } = require('../helpers');
const { renderTemplate, renderPartial, renderPartialList } = require('../views/render');
const { CATEGORIES } = require('../../src/categories');
const {
  getAllSubscriptions, getStats, getEmailStats,
  deleteSubscription, reactivateSubscription, hardDeleteSubscription,
  updateFrequency, updateSubscription, setAlertLimitForEmail,
} = require('../db');

// ─── Auth middleware ────────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass) {
    return res.status(503).send(renderSimplePage(
      'Admin desactivado',
      'Configura ADMIN_PASSWORD en .env para activar el panel de administración.',
      '#f59e0b'
    ));
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Wallapop Alertas Admin"');
    return res.status(401).send('Autenticación requerida');
  }
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
  const [, pass] = decoded.split(':');
  if (pass !== adminPass) {
    res.set('WWW-Authenticate', 'Basic realm="Wallapop Alertas Admin"');
    return res.status(401).send('Contraseña incorrecta');
  }
  next();
}

router.use(adminAuth);

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

function buildVerifiedBadge(s) {
  // Solo mostrar el badge de verificación si la feature está activa
  if (!s.verification_token && s.verified) {
    // Verificada (o feature desactivada → verified=1 por defecto)
    return `<span style="background:#dbeafe;color:#1e40af;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;margin-left:4px;white-space:nowrap;">✅ Verificada</span>`;
  }
  if (s.verification_token && !s.verified) {
    return `<span style="background:#fef9c3;color:#92400e;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;margin-left:4px;white-space:nowrap;">⏳ Pendiente</span>`;
  }
  return '';
}

function mapSubRow(s) {
  const t = getThemeVars();
  const freq = s.email_frequency || 'immediate';
  return {
    id:             s.id,
    rowClass:       s.active ? '' : 'inactive',
    badgeClass:     s.active ? 'badge-active' : 'badge-inactive',
    statusLabel:    s.active ? 'Activa' : 'Inactiva',
    verifiedBadge:  buildVerifiedBadge(s),
    keywords:       escapeHtml(s.keywords),
    email:          escapeHtml(s.email),
    priceRange:     formatPrice(s.min_price, s.max_price),
    categoryName:   s.category_id ? (CATEGORY_NAMES[s.category_id] || s.category_id) : '—',
    categoryOptions: buildCategoryOptions(s.category_id),
    minPrice:       s.min_price || '',
    maxPrice:       s.max_price || '',
    selImmediate:   freq === 'immediate' ? 'selected' : '',
    selDaily:       freq === 'daily'     ? 'selected' : '',
    selWeekly:      freq === 'weekly'    ? 'selected' : '',
    createdAt:      formatDate(s.created_at),
    lastRunAt:      formatDate(s.last_run_at),
    emailsSent:     s.emails_sent || 0,
    actionButton:   s.active
      ? renderPartial('post-btn', {
          action:     `/admin/delete/${s.id}`,
          cssClass:   'btn-delete',
          confirmMsg: `return confirm('¿Desactivar esta alerta?')`,
          label:      'Desactivar',
        })
      : renderPartial('post-btn', {
          action:     `/admin/reactivate/${s.id}`,
          cssClass:   'btn-reactivate',
          confirmMsg: '',
          label:      'Reactivar',
        }),
    hardDeleteBtn: renderPartial('post-btn', {
      action:     `/admin/hard-delete/${s.id}`,
      cssClass:   'btn-hard-delete',
      confirmMsg: `return confirm('⚠️ BORRADO DEFINITIVO: esta alerta y su historial se eliminarán permanentemente de la base de datos. ¿Continuar?')`,
      label:      '🗑️ Borrar',
    }),
    primary:        t.primary,
    shadowRgb:      t.shadowRgb,
  };
}

function mapEmailRow(e) {
  const t = getThemeVars();
  return {
    email:          escapeHtml(e.email),
    activeAlerts:   e.active_alerts,
    totalAlerts:    e.total_alerts,
    totalEmailsSent: e.total_emails_sent || 0,
    maxAlerts:      e.max_alerts,
    primary:        t.primary,
  };
}

function mapUsersCard(e) {
  const t = getThemeVars();
  return {
    email:          escapeHtml(e.email),
    activeAlerts:   e.active_alerts,
    totalAlerts:    e.total_alerts,
    totalEmailsSent: e.total_emails_sent || 0,
    maxAlerts:      e.max_alerts,
    primary:        t.primary,
  };
}

function mapAlertCard(s) {
  return {
    dataActive:    s.active ? '1' : '0',
    keywordsLower: escapeHtml(s.keywords.toLowerCase()),
    emailLower:    escapeHtml(s.email.toLowerCase()),
    frequency:     s.email_frequency || 'immediate',
    cardOpacity:   s.active ? '' : 'opacity:0.5',
    badgeClass:    s.active ? 'badge-active' : 'badge-inactive',
    statusLabel:   s.active ? 'Activa' : 'Inactiva',
    verifiedBadge: buildVerifiedBadge(s),
    keywords:     escapeHtml(s.keywords),
    email:        escapeHtml(s.email),
    priceRange:   formatPrice(s.min_price, s.max_price),
    emailsSent:   s.emails_sent || 0,
    deleteButton: s.active
      ? `<div class="card-row" style="margin-top:6px;width:100%">${
          renderPartial('post-btn', {
            action:     `/admin/delete/${s.id}`,
            cssClass:   'btn-delete',
            confirmMsg: `return confirm('¿Eliminar esta alerta?')`,
            label:      'Eliminar alerta',
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

  const EMPTY_SUB_ROW   = renderPartial('empty-row', { colspan: 10, message: 'No hay alertas todavía' });
  const EMPTY_EMAIL_ROW = renderPartial('empty-row', { colspan:  4, message: 'Sin usuarios todavía'  });
  const EMPTY_CARD      = '<p style="color:#9ca3af;font-size:13px;padding:8px 0">Sin datos todavía</p>';

  const vars = {
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
    'stats.failedBorder':      stats.totalEmailsFailed > 0 ? 'border:2px solid #fecaca' : '',
    'stats.failedColor':       stats.totalEmailsFailed > 0 ? '#ef4444' : t.primary,
    'stats.successRateColor':  stats.successRate >= 90 ? '#13c1ac'
                             : stats.successRate >= 70 ? '#f59e0b' : '#ef4444',

    // Partials renderizados
    subsRows:    renderPartialList('sub-row',    subs,       mapSubRow,    EMPTY_SUB_ROW),
    usersRows:   renderPartialList('email-row',  emailStats, mapEmailRow,  EMPTY_EMAIL_ROW),
    usersCards:  renderPartialList('users-card', emailStats, mapUsersCard, EMPTY_CARD),
    alertsCards: renderPartialList('alert-card', subs,       mapAlertCard, EMPTY_CARD),
  };

  res.send(renderTemplate('admin', vars));
});

// ─── Rutas de acción ───────────────────────────────────────────────────────
// POST (no GET) para evitar que navegadores/proxies precarguen URLs destructivas
router.post('/delete/:id', (req, res) => {
  deleteSubscription(req.params.id);
  res.redirect('/admin');
});

router.post('/reactivate/:id', (req, res) => {
  reactivateSubscription(req.params.id);
  res.redirect('/admin');
});

router.post('/hard-delete/:id', (req, res) => {
  hardDeleteSubscription(req.params.id);
  res.redirect('/admin');
});

router.post('/set-frequency', (req, res) => {
  const { id, frequency } = req.body;
  if (id && frequency) updateFrequency(id, frequency);
  res.redirect('/admin');
});

router.post('/edit/:id', (req, res) => {
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

router.post('/set-limit', (req, res) => {
  const { email, max_alerts } = req.body;
  if (email && max_alerts !== undefined) {
    setAlertLimitForEmail(email, Math.max(0, parseInt(max_alerts, 10) || 0));
  }
  res.redirect('/admin');
});

module.exports = router;
