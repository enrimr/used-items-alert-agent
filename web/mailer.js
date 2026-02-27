/**
 * Módulo de email para el servidor web
 * Envía alertas con enlace de cancelación incluido
 *
 * Soporta dos modos:
 * 1. Resend (RESEND_API_KEY) — recomendado en Railway (HTTP API, no SMTP)
 * 2. SMTP/Nodemailer (EMAIL_SMTP_*) — para uso local
 */

const nodemailer = require('nodemailer');

function getThemeColors() {
  const theme = (process.env.THEME_COLOR || 'orange').toLowerCase();
  if (theme === 'teal' || theme === 'green') {
    return { primary: '#13c1ac', primaryDark: '#0ea897' };
  }
  return { primary: '#f97316', primaryDark: '#ea6a0a' };
}

/**
 * Envía email usando la API HTTP de Resend directamente (compatible con Node 16)
 */
async function sendViaResend(to, from, subject, html, text) {
  const https = require('https');
  const payload = JSON.stringify({ from, to, subject, html, text });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(true);
          } else {
            reject(new Error(parsed.message || parsed.name || `HTTP ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(true);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function createTransporter() {
  const host = process.env.EMAIL_SMTP_HOST;
  const port = parseInt(process.env.EMAIL_SMTP_PORT || '587', 10);
  const user = process.env.EMAIL_SMTP_USER;
  const pass = process.env.EMAIL_SMTP_PASS;
  const secure = process.env.EMAIL_SMTP_SECURE === 'true';

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host, port, secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

function buildUnsubscribeUrl(subscriptionId) {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  return `${base}/unsubscribe/${subscriptionId}`;
}

function buildAlertHtml(items, config, subscriptionId) {
  const unsubUrl = buildUnsubscribeUrl(subscriptionId);

  const itemsHtml = items.map((item) => {
    const price = `${Number(item.price).toFixed(2)} €`;
    const desc = item.description
      ? item.description.substring(0, 180).replace(/\n/g, ' ') + (item.description.length > 180 ? '...' : '')
      : '';
    const img = item.images && item.images[0]
      ? `<img src="${item.images[0]}" width="180" style="border-radius:6px;display:block;margin-bottom:10px;" />`
      : '';

    return `
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #f0f0f0;vertical-align:top;">
          ${img}
          <div style="font-size:16px;font-weight:700;margin-bottom:4px;">
            <a href="${item.url}" style="color:${getThemeColors().primary};text-decoration:none;">${item.title}</a>
          </div>
          <div style="font-size:22px;font-weight:700;color:${getThemeColors().primary};margin-bottom:6px;">${price}</div>
          <div style="font-size:13px;color:#888;margin-bottom:6px;">📍 ${item.location}</div>
          ${desc ? `<div style="font-size:13px;color:#999;margin-bottom:10px;">${desc}</div>` : ''}
          <a href="${item.url}"
             style="display:inline-block;background:${getThemeColors().primary};color:#fff;padding:9px 18px;border-radius:5px;text-decoration:none;font-size:13px;font-weight:600;">
            Ver →
          </a>
        </td>
      </tr>
    `;
  }).join('');

  const searchBadges = [
    `<span style="background:#e8fdf8;color:#13c1ac;padding:3px 10px;border-radius:20px;font-size:12px;margin-right:6px;">🔎 ${config.keywords}</span>`,
    config.minPrice != null ? `<span style="background:#fff8e1;color:#f59e0b;padding:3px 10px;border-radius:20px;font-size:12px;margin-right:6px;">desde ${config.minPrice}€</span>` : '',
    config.maxPrice != null ? `<span style="background:#fff8e1;color:#f59e0b;padding:3px 10px;border-radius:20px;font-size:12px;margin-right:6px;">hasta ${config.maxPrice}€</span>` : '',
    config.categoryId ? `<span style="background:#f3f0ff;color:#7c3aed;padding:3px 10px;border-radius:20px;font-size:12px;">🏷️ ${config.categoryName}</span>` : '',
  ].filter(Boolean).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,${getThemeColors().primary},${getThemeColors().primaryDark});padding:24px 20px;">
      <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
        🔔 Alertas de Segunda Mano
      </div>
      <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px;">
        ${items.length} nuevo${items.length > 1 ? 's' : ''} producto${items.length > 1 ? 's' : ''} sin reserva
      </div>
    </div>

    <!-- Search badges -->
    <div style="padding:12px 20px;background:#fafafa;border-bottom:1px solid #f0f0f0;">
      ${searchBadges}
    </div>

    <!-- Items -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tbody>${itemsHtml}</tbody>
    </table>

    <!-- Footer -->
    <div style="padding:20px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
      <div style="font-size:12px;color:#bbb;margin-bottom:8px;">
        Recibes este email porque creaste una alerta en Wallapop Alertas.
      </div>
      <a href="${unsubUrl}"
         style="font-size:12px;color:#f87171;text-decoration:none;border:1px solid #fecaca;padding:6px 16px;border-radius:20px;">
        ❌ Eliminar esta alerta
      </a>
    </div>
  </div>
</body>
</html>`;
}

function buildAlertText(items, config, subscriptionId) {
  const unsubUrl = buildUnsubscribeUrl(subscriptionId);
  const lines = [
    `Wallapop Alertas — ${items.length} nuevo(s) producto(s)`,
    `Búsqueda: ${config.keywords}`,
    config.minPrice != null ? `Precio mín: ${config.minPrice}€` : '',
    config.maxPrice != null ? `Precio máx: ${config.maxPrice}€` : '',
    '',
  ].filter(s => s !== null);

  items.forEach((item, i) => {
    lines.push(`[${i + 1}] ${item.title} — ${Number(item.price).toFixed(2)}€`);
    lines.push(`    📍 ${item.location}`);
    lines.push(`    🔗 ${item.url}`);
    lines.push('');
  });

  lines.push(`\nEliminar esta alerta: ${unsubUrl}`);
  return lines.join('\n');
}

async function sendAlertEmail(items, config, toEmail, subscriptionId) {
  const from = (process.env.RESEND_API_KEY ? process.env.RESEND_EMAIL_FROM : null)
    || process.env.EMAIL_FROM
    || process.env.EMAIL_SMTP_USER;
  if (!from) return false;

  const subject = `🆕 ${items.length} nuevo${items.length > 1 ? 's' : ''} en Wallapop: "${config.keywords}"${config.maxPrice ? ` (hasta ${config.maxPrice}€)` : ''}`;
  const html = buildAlertHtml(items, config, subscriptionId);
  const text = buildAlertText(items, config, subscriptionId);

  try {
    // Prefer Resend (works on Railway, no SMTP needed)
    if (process.env.RESEND_API_KEY) {
      return await sendViaResend(toEmail, `Wallapop Alertas <${from}>`, subject, html, text);
    }
    // Fallback: SMTP
    const transporter = createTransporter();
    if (!transporter) return false;
    await transporter.sendMail({ from: `"Wallapop Alertas" <${from}>`, to: toEmail, subject, text, html });
    return true;
  } catch (err) {
    console.error(`Error enviando email a ${toEmail}:`, err.message);
    return false;
  }
}

async function sendConfirmationEmail(toEmail, sub) {
  const from = (process.env.RESEND_API_KEY ? process.env.RESEND_EMAIL_FROM : null)
    || process.env.EMAIL_FROM
    || process.env.EMAIL_SMTP_USER;
  if (!from) return false;

  const unsubUrl = buildUnsubscribeUrl(sub.id);
  const priceInfo = [
    sub.min_price != null ? `desde ${sub.min_price}€` : '',
    sub.max_price != null ? `hasta ${sub.max_price}€` : '',
  ].filter(Boolean).join(' ');

  const subject = `✅ Alerta creada: "${sub.keywords}" en Wallapop`;
  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:-apple-system,sans-serif;">
  <div style="max-width:480px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,${getThemeColors().primary},${getThemeColors().primaryDark});padding:24px 20px;">
      <div style="font-size:22px;font-weight:800;color:#fff;">✅ Alerta creada</div>
      <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px;">Te avisaremos cuando aparezcan nuevos productos</div>
    </div>
    <div style="padding:24px 20px;">
      <p style="font-size:15px;color:#444;margin:0 0 16px;">Tu alerta de Wallapop está activa:</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#888;font-size:13px;">Búsqueda</td><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:13px;">${sub.keywords}</td></tr>
        ${priceInfo ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#888;font-size:13px;">Precio</td><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-weight:600;font-size:13px;">${priceInfo}</td></tr>` : ''}
        <tr><td style="padding:8px 0;color:#888;font-size:13px;">Email</td><td style="padding:8px 0;font-weight:600;font-size:13px;">${toEmail}</td></tr>
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

  try {
    if (process.env.RESEND_API_KEY) {
      return await sendViaResend(toEmail, `Wallapop Alertas <${from}>`, subject, html);
    }
    const transporter = createTransporter();
    if (!transporter) return false;
    await transporter.sendMail({ from: `"Wallapop Alertas" <${from}>`, to: toEmail, subject, html });
    return true;
  } catch (err) {
    console.error(`Error enviando confirmación a ${toEmail}:`, err.message);
    return false;
  }
}

module.exports = { sendAlertEmail, sendConfirmationEmail };
