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

// ── Builders de HTML y texto ───────────────────────────────────────────────

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

/**
 * HTML de alerta de productos.
 * @param {Array}  items
 * @param {Object} config        — { keywords, minPrice, maxPrice, categoryId, categoryName }
 * @param {string|null} unsubUrl — URL de cancelación (null en modo CLI)
 */
function buildAlertHtml(items, config, unsubUrl = null) {
  const t          = getTheme();
  const itemsHtml  = buildItemsHtml(items, t.primary);
  const badges     = buildSearchBadges(config, t);

  const footerContent = unsubUrl
    ? `<div style="font-size:12px;color:#bbb;margin-bottom:8px;">
         Recibes este email porque creaste una alerta en Wallapop Alertas.
       </div>
       <a href="${unsubUrl}"
          style="font-size:12px;color:#f87171;text-decoration:none;border:1px solid #fecaca;padding:6px 16px;border-radius:20px;">
         ❌ Eliminar esta alerta
       </a>`
    : `<div style="font-size:12px;color:#bbb;">
         Wallapop Agent • Solo productos sin reserva<br>
         <a href="https://es.wallapop.com" style="color:${t.primary};">ir a Wallapop</a>
       </div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,${t.primary},${t.primaryDark});padding:24px 20px;">
      <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">🔔 Alertas de Segunda Mano</div>
      <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px;">
        ${items.length} nuevo${items.length > 1 ? 's' : ''} producto${items.length > 1 ? 's' : ''} sin reserva
      </div>
    </div>
    <div style="padding:12px 20px;background:#fafafa;border-bottom:1px solid #f0f0f0;">${badges}</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tbody>${itemsHtml}</tbody>
    </table>
    <div style="padding:20px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
      ${footerContent}
    </div>
  </div>
</body>
</html>`;
}

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

  // En modo CLI sin toEmail explícito, usar EMAIL_TO del .env
  const recipient = toEmail || process.env.EMAIL_TO;
  if (!recipient) return false;

  const unsubUrl = subscriptionId ? buildUnsubscribeUrl(subscriptionId) : null;
  const subject  = `🆕 ${items.length} nuevo${items.length > 1 ? 's' : ''} en Wallapop: "${config.keywords}"${config.maxPrice ? ` (hasta ${config.maxPrice}€)` : ''}`;
  const senderName = subscriptionId ? 'Wallapop Alertas' : 'Wallapop Agent';

  return send({
    to:          recipient,
    fromAddress: `"${senderName}" <${fromAddr}>`,
    subject,
    html:        buildAlertHtml(items, config, unsubUrl),
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

  const subject = `✅ Alerta creada: "${sub.keywords}" en Wallapop`;
  const html    = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,sans-serif;">
  <div style="max-width:480px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,${t.primary},${t.primaryDark});padding:24px 20px;">
      <div style="font-size:22px;font-weight:800;color:#fff;">✅ Alerta creada</div>
      <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px;">Te avisaremos cuando aparezcan nuevos productos</div>
    </div>
    <div style="padding:24px 20px;">
      <p style="font-size:15px;color:#444;margin:0 0 16px;">Tu alerta de Wallapop está activa:</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#888;font-size:13px;">Búsqueda</td>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:13px;">${sub.keywords}</td>
        </tr>
        ${priceInfo ? `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#888;font-size:13px;">Precio</td>
          <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:13px;">${priceInfo}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:8px 0;color:#888;font-size:13px;">Email</td>
          <td style="padding:8px 0;font-weight:600;font-size:13px;">${toEmail}</td>
        </tr>
      </table>
    </div>
    <div style="padding:16px 20px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
      <a href="${unsubUrl}" style="font-size:12px;color:#f87171;text-decoration:none;border:1px solid #fecaca;padding:6px 16px;border-radius:20px;">
        ❌ Eliminar esta alerta
      </a>
    </div>
  </div>
</body>
</html>`;

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

  const t           = getTheme();
  const verifyUrl   = `${process.env.BASE_URL || 'http://localhost:3000'}/verify/${sub.verification_token}`;
  const unsubUrl    = buildUnsubscribeUrl(sub.id);
  const subject     = `✅ Confirma tu alerta: "${sub.keywords}"`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,sans-serif;">
  <div style="max-width:480px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,${t.primary},${t.primaryDark});padding:24px 20px;">
      <div style="font-size:22px;font-weight:800;color:#fff;">📧 Confirma tu alerta</div>
      <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px;">Un clic para activarla</div>
    </div>
    <div style="padding:24px 20px;">
      <p style="font-size:15px;color:#444;margin:0 0 16px;">
        Has creado una alerta para <strong>"${sub.keywords}"</strong>.<br>
        Haz clic en el botón para confirmar tu email y activar la alerta:
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${verifyUrl}"
           style="display:inline-block;background:${t.primary};color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">
          ✅ Confirmar y activar alerta
        </a>
      </div>
      <p style="font-size:12px;color:#9ca3af;margin:0;text-align:center;">
        Si no creaste esta alerta, ignora este email.<br>
        El enlace caduca en 48 horas.
      </p>
    </div>
    <div style="padding:16px 20px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
      <a href="${unsubUrl}" style="font-size:12px;color:#f87171;text-decoration:none;border:1px solid #fecaca;padding:6px 16px;border-radius:20px;">
        ❌ Cancelar esta alerta
      </a>
    </div>
  </div>
</body>
</html>`;

  const text = `Confirma tu alerta de Wallapop\n\nAlerta: "${sub.keywords}"\n\nHaz clic aquí para confirmar:\n${verifyUrl}\n\nSi no creaste esta alerta, ignora este email.\n`;

  return send({
    to:          toEmail,
    fromAddress: `"Wallapop Alertas" <${fromAddr}>`,
    subject,
    html,
    text,
  });
}

module.exports = { send, sendAlertEmail, sendConfirmationEmail, sendVerificationEmail, verifyEmailConfig };
