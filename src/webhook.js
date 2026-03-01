/**
 * Webhook dispatcher
 *
 * Sends a POST request to a subscription's webhook URL when new items are found.
 * Compatible with Zapier, n8n, Make (Integromat), Slack incoming webhooks, etc.
 *
 * Payload format:
 * {
 *   "event": "new_items",
 *   "subscription_id": "...",
 *   "keywords": "...",
 *   "timestamp": "2026-01-03T12:00:00.000Z",
 *   "items_count": 3,
 *   "items": [ { id, title, price, url, image, location, ... }, ... ]
 * }
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const WEBHOOK_TIMEOUT_MS = parseInt(process.env.WEBHOOK_TIMEOUT_MS || '8000', 10);
const WEBHOOK_MAX_RETRIES = parseInt(process.env.WEBHOOK_MAX_RETRIES || '2', 10);

/**
 * Sends the webhook POST with a JSON payload.
 * Returns { ok: true } on success, { ok: false, error: string } on failure.
 */
async function dispatchWebhook(webhookUrl, payload) {
  const body = JSON.stringify(payload);
  let lastError;

  for (let attempt = 1; attempt <= WEBHOOK_MAX_RETRIES + 1; attempt++) {
    try {
      const result = await postJson(webhookUrl, body);
      if (result.status >= 200 && result.status < 300) {
        return { ok: true, status: result.status };
      }
      lastError = `HTTP ${result.status}`;
      // Don't retry 4xx (client errors — bad URL config, wrong secret, etc.)
      if (result.status >= 400 && result.status < 500) break;
    } catch (err) {
      lastError = err.message;
    }

    if (attempt <= WEBHOOK_MAX_RETRIES) {
      // Exponential back-off: 1s, 2s
      await sleep(1000 * attempt);
    }
  }

  return { ok: false, error: lastError };
}

/**
 * Build the standard payload sent to every webhook.
 */
function buildPayload(sub, items, config) {
  return {
    event:           'new_items',
    subscription_id: sub.id,
    keywords:        sub.keywords,
    min_price:       sub.min_price  || null,
    max_price:       sub.max_price  || null,
    category:        config.categoryName || null,
    shipping_only:   !!(sub.shipping_only),
    timestamp:       new Date().toISOString(),
    items_count:     items.length,
    items: items.map(item => ({
      id:          item.id,
      title:       item.title,
      price:       item.price,
      currency:    item.currency || 'EUR',
      url:         item.url,
      image:       item.image || null,
      location:    item.location || null,
      description: item.description || null,
    })),
  };
}

// ── Internals ────────────────────────────────────────────────────────────────

function postJson(rawUrl, body) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch (e) {
      return reject(new Error(`URL inválida: ${rawUrl}`));
    }

    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent':     'WallapopAlertas-Webhook/1.0',
      },
      timeout: WEBHOOK_TIMEOUT_MS,
    };

    const req = lib.request(options, (res) => {
      // Consume response body to free the socket
      res.resume();
      resolve({ status: res.statusCode });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Webhook timeout (${WEBHOOK_TIMEOUT_MS}ms)`));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

module.exports = { dispatchWebhook, buildPayload };
