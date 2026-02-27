/**
 * Shared helper utilities for the web server
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSimplePage(title, message, accentColor = '#f97316') {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — Alertas</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f7fa;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:#fff;border-radius:16px;padding:40px 32px;max-width:480px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
    h1{font-size:24px;color:#1a1a2e;margin-bottom:16px}
    p{font-size:15px;color:#555;line-height:1.6}
    .bar{height:4px;background:${accentColor};border-radius:4px 4px 0 0;margin:-40px -32px 32px}
  </style>
</head>
<body>
  <div class="card">
    <div class="bar"></div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

module.exports = { escapeHtml, renderSimplePage };
