/**
 * Módulo de email unificado — Wallapop Agent
 *
 * Soporta dos transportes (se elige automáticamente):
 *   1. Resend HTTP API  — preferido en Railway/producción (RESEND_API_KEY)
 *   2. SMTP/Nodemailer  — para uso local (EMAIL_SMTP_*)
 *
 * Variables de entorno:
 *   RESEND_API_KEY         API key de Resend (activa el modo Resend)
 *   RESEND_EMAIL_FROM      Remitente verificado en Resend
 *   EMAIL_FROM             Remitente genérico (fallback)
 *   EMAIL_SMTP_HOST        Servidor SMTP
 *   EMAIL_SMTP_PORT        Puerto SMTP (defecto 587)
 *   EMAIL_SMTP_SECURE      true para puerto 465
 *   EMAIL_SMTP_USER        Usuario SMTP
 *   EMAIL_SMTP_PASS        Contraseña SMTP
 *   EMAIL_TO               Destinatario para el modo CLI (agente personal)
 *   BASE_URL               URL base para links de cancelación en emails web
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// ── Motor de plantillas ────────────────────────────────────────────────────

const EMAILS_DIR = path.join(__dirname, '../web/views/emails');

/**
 * Renderiza una plantilla de email sustituyendo tokens {{key}}.
 * Se lee de disco (sin caché) para que funcione en CLI sin servidor web.
 */
function renderEmailTemplate(name, vars) {
  const filePath = path.join(EMAILS_DIR, `${name}.html`);
  const tpl = fs.readFileSync(filePath, 'utf8');
  return tpl.replace(/\{\{([\w.]+)\}\}/g, (match, key) =>
    vars[key] !== undefined ? vars[key] : match
  );
}

// ── Detección del remitente ────────────────────────────────────────────────

function getSenderAddress() {
  if (process.env.RESEND_API_KEY) {
    return process.env.RESEND_EMAIL_FROM
      || process.env.EMAIL_FROM
      || process.env.EMAIL_SMTP_USER
      || null;
  }
  return process.env.EMAIL_FROM
    || process.env.EMAIL_SMTP_USER
    || null;
}

// ── Transporte SMTP ────────────────────────────────────────────────────────

function createSmtpTransporter() {
  const host   = process.env.EMAIL_SMTP_HOST;
  const port   = parseInt(process.env.EMAIL_SMTP_PORT || '587', 10);
  const user   = process.env.EMAIL_SMTP_USER;
  const pass   = process.env.EMAIL_SMTP_PASS;
  const secure = process.env.EMAIL_SMTP_SECURE === 'true';

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

// ── Transporte Resend (HTTP nativo, compatible con Node 16) ────────────────

async function sendViaResend(to, fromAddress, subject, html, text) {
  const https   = require('https');
  const payload = JSON.stringify({ from: fromAddress, to, subject, html, text });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path:     '/emails',
      method:   'POST',
      headers: {
        'Authorization':  `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(true);
        try {
          const parsed = JSON.parse(data);
          reject(new Error(parsed.message || parsed.name || `HTTP ${res.statusCode}: ${data}`));
        } catch {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Función base ───────────────────────────────────────────────────────────

/**
 * Envía un email usando Resend o SMTP según configuración.
 * @param {{ to, fromAddress, subject, html, text }} opts
 * @returns {Promise<boolean>}
 */
async function send({ to, fromAddress, subject, html, text = '' }) {
  try {
    if (process.env.RESEND_API_KEY) {
      return await sendViaResend(to, fromAddress, subject, html, text);
    }
    const transporter = createSmtpTransporter();
    if (!transporter) return false;
    await transporter.sendMail({ from: fromAddress, to, subject, text, html });
    return true;
  } catch (err) {
    console.error(`[mailer] Error enviando a ${to}: ${err.message}`);
    return false;
  }
}

// ── Helpers de tema y URLs ─────────────────────────────────────────────────

/**
 * Devuelve las variables de tema. Se importa de forma lazy para no
 * crear dependencias circulares cuando se usa desde el modo CLI.
 */
function getTheme() {
  try {
    return require('./theme-web').getThemeVars();
  } catch {
    // En modo CLI no existe web/theme; usamos valores por defecto
    return { primary: '#13c1ac', primaryDark: '#0ea897', shadowRgb: '19,193,172' };
  }
}

function buildUnsubscribeUrl(subscriptionId) {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  return `${base}/unsubscribe/${subscriptionId}`;
}

// ── Builders de contenido dinámico ────────────────────────────────────────

function buildItemsHtml(items, primaryColor) {
  return items.map((item) => {
    const price = `${Number(item.price).toFixed(2)} ${item.currency || '€'}`;
    const desc  = item.description
      ? item.description.substring(0, 180).replace(/\n/g, ' ') + (item.description.length > 180 ? '...' : '')
      : '';
    const img   = item.images && item.images[0]
      ? `<img src="${item.images[0]}" width="180" style="border-radius:6px;display:block;margin-bottom:10px;" />`
      : '';

    return `
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #f0f0f0;vertical-align:top;">
          ${img}
          <div style="font-size:16px;font-weight:700;margin-bottom:4px;">
            <a href="${item.url}" style="color:${primaryColor};text-decoration:none;">${item.title}</a>
          </div>
          <div style="font-size:22px;font-weight:700;color:${primaryColor};margin-bottom:6px;">${price}</div>
          <div style="font-size:13px;color:#888;margin-bottom:6px;">📍 ${item.location}</div>
          ${desc ? `<div style="font-size:13px;color:#999;margin-bottom:10px;">${desc}</div>` : ''}
          <a href="${item.url}"
             style="display:inline-block;background:${primaryColor};color:#fff;padding:9px 18px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:600;">
            Ver →
          </a>
        </td>
      </tr>`;
  }).join('');
}

function buildSearchBadges(config, t) {
  const hexToRgb = h => h.replace('#', '').match(/.{2}/g).map(x => parseInt(x, 16)).join(',');
  return [
    `<span style="background:rgba(${hexToRgb(t.primary)},0.08);color:${t.primary};padding:3px 10px;border-radius:20px;font-size:12px;margin-right:6px;">🔎 ${config.keywords}</span>`,
    config.minPrice != null ? `<span style="background:#fff8e1;color:#f59e0b;padding:3px 10px;border-radius:20px;font-size:12px;margin-right:6px;">desde ${config.minPrice}€</span>` : '',
    config.maxPrice != null ? `<span style="background:#fff8e1;color:#f59e0b;padding:3px 10px;border-radius:20px;font-size:12px;margin-right:6px;">hasta ${config.maxPrice}€</span>` : '',
    config.categoryId ? `<span style="background:#f3f0ff;color:#7c3aed;padding:3px 10px;border-radius:20px;font-size:12px;">🏷️ ${config.categoryName}</span>` : '',
  ].filter(Boolean).join('');
}

function buildAlertFooter(unsubUrl, primaryColor) {
  if (unsubUrl) {
    return `<div style="font-size:12px;color:#bbb;margin-bottom:8px;">
         Recibes este email porque creaste una alerta en Wallapop Alertas.
       </div>
       <a href="${unsubUrl}"
          style="font-size:12px;color:#f87171;text-decoration:none;border:1px solid #fecaca;padding:6px 16px;border-radius:20px;">
         ❌ Eliminar esta alerta
       </a>`;
  }
  return `<div style="font-size:12px;color:#bbb;">
         Wallapop Agent • Solo productos sin reserva<br>
         <a href="https://es.wallapop.com" style="color:${primaryColor};">ir a Wallapop</a>
       </div>`;
}

// ── Builders de texto plano ────────────────────────────────────────────────

function buildAlertText(items, config, unsubUrl = null) {
  const lines = [
    `Wallapop Alertas — ${items.length} nuevo(s) producto(s)`,
    `Búsqueda: ${config.keywords}`,
    config.minPrice != null ? `Precio mín: ${config.minPrice}€` : '',
    config.maxPrice != null ? `Precio máx: ${config.maxPrice}€` : '',
    '',
  ].filter(s => s !== '');

  items.forEach((item, i) => {
    lines.push(`[${i + 1}] ${item.title} — ${Number(item.price).toFixed(2)}€`);
    lines.push(`    📍 ${item.location}`);
    lines.push(`    🔗 ${item.url}`);
    lines.push('');
  });

  if (unsubUrl) lines.push(`Eliminar esta alerta: ${unsubUrl}`);
  return lines.join('\n');
}

// ── API pública ────────────────────────────────────────────────────────────

/**
 * Envía una alerta de nuevos productos.
 *
 * @param {Array}       items          — Productos encontrados
 * @param {Object}      config         — { keywords, minPrice, maxPrice, categoryId, categoryName }
 * @param {string}      toEmail        — Destinatario
 * @param {string|null} subscriptionId — ID de suscripción web (para link de cancelación).
 *                                       null en modo CLI (sin link de cancelación).
 * @returns {Promise<boolean>}
 */
async function sendAlertEmail(items, config, toEmail, subscriptionId = null) {
  if (!items || items.length === 0) return false;

  const fromAddr = getSenderAddress();
  if (!fromAddr) return false;

  const recipient = toEmail || process.env.EMAIL_TO;
  if (!recipient) return false;

  const t        = getTheme();
  const unsubUrl = subscriptionId ? buildUnsubscribeUrl(subscriptionId) : null;
  const plural   = items.length > 1 ? 's' : '';
  const subject  = `🆕 ${items.length} nuevo${plural} en Wallapop: "${config.keywords}"${config.maxPrice ? ` (hasta ${config.maxPrice}€)` : ''}`;
  const senderName = subscriptionId ? 'Wallapop Alertas' : 'Wallapop Agent';

  const html = renderEmailTemplate('alert', {
    primary:          t.primary,
    primaryDark:      t.primaryDark,
    itemsCount:       items.length,
    itemsCountPlural: plural,
    badges:           buildSearchBadges(config, t),
    itemsHtml:        buildItemsHtml(items, t.primary),
    footerContent:    buildAlertFooter(unsubUrl, t.primary),
  });

  return send({
    to:          recipient,
    fromAddress: `"${senderName}" <${fromAddr}>`,
    subject,
    html,
    text:        buildAlertText(items, config, unsubUrl),
  });
}

/**
 * Envía email de confirmación cuando se crea una suscripción web.
 *
 * @param {string} toEmail
 * @param {Object} sub — { id, keywords, min_price, max_price }
 * @returns {Promise<boolean>}
 */
async function sendConfirmationEmail(toEmail, sub) {
  const fromAddr = getSenderAddress();
  if (!fromAddr) return false;

  const t        = getTheme();
  const unsubUrl = buildUnsubscribeUrl(sub.id);

  const priceInfo = [
    sub.min_price != null ? `desde ${sub.min_price}€` : '',
    sub.max_price != null ? `hasta ${sub.max_price}€` : '',
  ].filter(Boolean).join(' ');

  const priceRow = priceInfo
    ? `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#888;font-size:13px;">Precio</td>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:13px;">${priceInfo}</td>
        </tr>`
    : '';

  const subject = `✅ Alerta creada: "${sub.keywords}" en Wallapop`;
  const html    = renderEmailTemplate('confirmation', {
    primary:     t.primary,
    primaryDark: t.primaryDark,
    keywords:    sub.keywords,
    priceRow,
    email:       toEmail,
    unsubUrl,
  });

  return send({
    to:          toEmail,
    fromAddress: `"Wallapop Alertas" <${fromAddr}>`,
    subject,
    html,
  });
}

/**
 * Verifica la conexión SMTP (modo CLI / arranque del servidor).
 * Solo aplica si no se usa Resend.
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
async function verifyEmailConfig() {
  if (process.env.RESEND_API_KEY) {
    return { ok: true, transport: 'resend' };
  }

  const transporter = createSmtpTransporter();
  if (!transporter) {
    return { ok: false, reason: 'Configuración SMTP incompleta (EMAIL_SMTP_HOST, EMAIL_SMTP_USER, EMAIL_SMTP_PASS)' };
  }

  try {
    await transporter.verify();
    return { ok: true, transport: 'smtp' };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

/**
 * Envía email de verificación cuando se crea una suscripción y
 * REQUIRE_EMAIL_VERIFICATION=true está activo.
 *
 * @param {string} toEmail
 * @param {Object} sub — { id, keywords, verification_token }
 * @returns {Promise<boolean>}
 */
async function sendVerificationEmail(toEmail, sub) {
  const fromAddr = getSenderAddress();
  if (!fromAddr) return false;

  const t          = getTheme();
  const verifyUrl  = `${process.env.BASE_URL || 'http://localhost:3000'}/verify/${sub.verification_token}`;
  const unsubUrl   = buildUnsubscribeUrl(sub.id);
  const subject    = `✅ Confirma tu alerta: "${sub.keywords}"`;

  const html = renderEmailTemplate('verification', {
    primary:     t.primary,
    primaryDark: t.primaryDark,
    keywords:    sub.keywords,
    verifyUrl,
    unsubUrl,
  });

  const text = `Confirma tu alerta de Wallapop\n\nAlerta: "${sub.keywords}"\n\nHaz clic aquí para confirmar:\n${verifyUrl}\n\nSi no creaste esta alerta, ignora este email.\n`;

  return send({
    to:          toEmail,
    fromAddress: `"Wallapop Alertas" <${fromAddr}>`,
    subject,
    html,
    text,
  });
}

/**
 * Envía un email de alerta al administrador del sitio cuando el scraper
 * falla N veces consecutivas para una suscripción.
 *
 * @param {string} subscriptionEmail  — email del usuario cuya alerta falla
 * @param {string} keywords           — keywords de la suscripción afectada
 * @param {number} failCount          — número de fallos consecutivos
 * @param {string} errorMessage       — mensaje del último error
 * @returns {Promise<boolean>}
 */
async function sendAdminAlert(subscriptionEmail, keywords, failCount, errorMessage) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;

  const fromAddr = getSenderAddress();
  if (!fromAddr) return false;

  const t       = getTheme();
  const subject = `🚨 Worker: ${failCount} fallos consecutivos — "${keywords}"`;

  const html = renderEmailTemplate('admin-alert', {
    primary:           t.primary,
    failCount,
    subscriptionEmail,
    keywords,
    errorMessage,
    adminUrl:          `${process.env.BASE_URL || 'http://localhost:3000'}/admin`,
  });

  const text = `🚨 ALERTA DEL SCRAPER\n\nSuscripción: ${subscriptionEmail}\nBúsqueda: "${keywords}"\nFallos consecutivos: ${failCount}\nÚltimo error: ${errorMessage}\n\nEl worker ha reiniciado el navegador automáticamente.\n`;

  return send({
    to:          adminEmail,
    fromAddress: `"Wallapop Alertas" <${fromAddr}>`,
    subject,
    html,
    text,
  });
}

module.exports = { send, sendAlertEmail, sendConfirmationEmail, sendVerificationEmail, sendAdminAlert, verifyEmailConfig };
