/**
 * Módulo de notificaciones por email
 * Usa nodemailer para enviar alertas de nuevos productos
 *
 * Configuración en .env:
 *   EMAIL_TO=destinatario@gmail.com
 *   EMAIL_FROM=turemitente@gmail.com
 *   EMAIL_SMTP_HOST=smtp.gmail.com       (o smtp.outlook.com, etc.)
 *   EMAIL_SMTP_PORT=587
 *   EMAIL_SMTP_USER=turemitente@gmail.com
 *   EMAIL_SMTP_PASS=tucontraseñaoapppassword
 *   EMAIL_SMTP_SECURE=false              (true para puerto 465)
 */

const nodemailer = require('nodemailer');

/**
 * Crea el transporter de nodemailer según configuración
 */
function createTransporter() {
  const host = process.env.EMAIL_SMTP_HOST;
  const port = parseInt(process.env.EMAIL_SMTP_PORT || '587', 10);
  const user = process.env.EMAIL_SMTP_USER;
  const pass = process.env.EMAIL_SMTP_PASS;
  const secure = process.env.EMAIL_SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

/**
 * Genera el HTML del email con los nuevos productos
 */
function buildEmailHtml(items, config) {
  const itemsHtml = items.map((item) => {
    const price = `${Number(item.price).toFixed(2)} ${item.currency || '€'}`;
    const desc = item.description
      ? item.description.substring(0, 200).replace(/\n/g, ' ') + (item.description.length > 200 ? '...' : '')
      : '';
    const img = item.images && item.images[0]
      ? `<img src="${item.images[0]}" style="max-width:200px;max-height:150px;object-fit:cover;border-radius:6px;" />`
      : '';

    return `
      <tr>
        <td style="padding:16px;border-bottom:1px solid #eee;vertical-align:top;">
          ${img ? `<div style="margin-bottom:8px;">${img}</div>` : ''}
          <div style="font-size:16px;font-weight:bold;color:#333;margin-bottom:4px;">
            <a href="${item.url}" style="color:#13c1ac;text-decoration:none;">${item.title}</a>
          </div>
          <div style="font-size:20px;font-weight:bold;color:#e95f26;margin-bottom:4px;">${price}</div>
          <div style="font-size:13px;color:#666;margin-bottom:4px;">📍 ${item.location}</div>
          ${desc ? `<div style="font-size:13px;color:#888;margin-bottom:8px;">${desc}</div>` : ''}
          <a href="${item.url}" style="display:inline-block;background:#13c1ac;color:white;padding:8px 16px;border-radius:4px;text-decoration:none;font-size:13px;">
            Ver en Wallapop →
          </a>
        </td>
      </tr>
    `;
  }).join('');

  const searchInfo = [
    `🔎 Búsqueda: <strong>${config.keywords}</strong>`,
    config.minPrice !== null || config.maxPrice !== null
      ? `💶 Precio: <strong>${config.minPrice ?? 0}€ – ${config.maxPrice ?? '∞'}€</strong>`
      : null,
    config.categoryId
      ? `🏷️ Categoría: <strong>${config.categoryName}</strong>`
      : null,
  ].filter(Boolean).join(' &nbsp;|&nbsp; ');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;">
      <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="background:#13c1ac;padding:20px 24px;">
          <h1 style="margin:0;color:white;font-size:22px;">
            🔍 Wallapop Agent
          </h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">
            ${items.length} nuevo${items.length > 1 ? 's' : ''} producto${items.length > 1 ? 's' : ''} encontrado${items.length > 1 ? 's' : ''}
          </p>
        </div>

        <!-- Search info -->
        <div style="background:#f0fdf9;padding:12px 24px;border-bottom:1px solid #d1faf4;font-size:13px;color:#555;">
          ${searchInfo}
        </div>

        <!-- Items -->
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- Footer -->
        <div style="padding:16px 24px;background:#f9f9f9;border-top:1px solid #eee;text-align:center;font-size:12px;color:#aaa;">
          Wallapop Agent • Solo productos sin reserva<br>
          <a href="https://es.wallapop.com" style="color:#13c1ac;">ir a Wallapop</a>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Genera el texto plano del email (fallback)
 */
function buildEmailText(items, config) {
  const lines = [
    `🔍 WALLAPOP AGENT - ${items.length} nuevo(s) producto(s)`,
    `Búsqueda: ${config.keywords}`,
    config.minPrice !== null ? `Precio mínimo: ${config.minPrice}€` : '',
    config.maxPrice !== null ? `Precio máximo: ${config.maxPrice}€` : '',
    config.categoryId ? `Categoría: ${config.categoryName}` : '',
    '',
    '─'.repeat(50),
    '',
  ].filter(s => s !== null);

  items.forEach((item, i) => {
    lines.push(`[${i + 1}] ${item.title}`);
    lines.push(`    💰 ${Number(item.price).toFixed(2)} ${item.currency || '€'}`);
    lines.push(`    📍 ${item.location}`);
    if (item.description) {
      lines.push(`    ${item.description.substring(0, 100).replace(/\n/g, ' ')}...`);
    }
    lines.push(`    🔗 ${item.url}`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Envía email con los nuevos productos encontrados
 * @returns {Promise<boolean>} true si se envió correctamente
 */
async function sendEmailNotification(items, config) {
  if (!items || items.length === 0) return false;

  const to = process.env.EMAIL_TO;
  const from = process.env.EMAIL_FROM || process.env.EMAIL_SMTP_USER;

  if (!to || !from) return false;

  const transporter = createTransporter();
  if (!transporter) return false;

  const subject = `🆕 Wallapop: ${items.length} nuevo${items.length > 1 ? 's' : ''} "${config.keywords}"` +
    (config.maxPrice ? ` (hasta ${config.maxPrice}€)` : '');

  try {
    await transporter.sendMail({
      from: `"Wallapop Agent" <${from}>`,
      to,
      subject,
      text: buildEmailText(items, config),
      html: buildEmailHtml(items, config),
    });
    return true;
  } catch (err) {
    console.error(`  ⚠️  Error enviando email: ${err.message}`);
    return false;
  }
}

/**
 * Verifica que la configuración de email es correcta
 */
async function verifyEmailConfig() {
  const to = process.env.EMAIL_TO;
  const from = process.env.EMAIL_FROM || process.env.EMAIL_SMTP_USER;

  if (!to) return { ok: false, reason: 'EMAIL_TO no configurado' };
  if (!from) return { ok: false, reason: 'EMAIL_FROM o EMAIL_SMTP_USER no configurado' };

  const transporter = createTransporter();
  if (!transporter) return { ok: false, reason: 'Configuración SMTP incompleta (EMAIL_SMTP_HOST, EMAIL_SMTP_USER, EMAIL_SMTP_PASS)' };

  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = { sendEmailNotification, verifyEmailConfig };
