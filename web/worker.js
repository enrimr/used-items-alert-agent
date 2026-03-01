/**
 * Worker que ejecuta búsquedas en Wallapop para cada suscripción activa
 * Se ejecuta en un bucle periódico enviando emails con los nuevos productos
 */

const { fetchItems } = require('../src/scraper');
const { ensureBrowser, closeBrowser } = require('../src/browser');
const { sendAlertEmail, sendAdminAlert } = require('../src/mailer');
const { dispatchWebhook, buildPayload } = require('../src/webhook');
const {
  getActiveSubscriptions,
  filterNewItems,
  markItemsSeen,
  updateLastRun,
  updateLastDigest,
  cleanupOldSeenItems,
  incrementEmailsSent,
  recordEmailFailure,
  resetConsecutiveFailures,
  addDigestItems,
  getDigestItems,
  clearDigestItems,
} = require('./db');

/**
 * Checks if a digest subscription should send email now
 */
function shouldSendDigest(sub) {
  const now = Date.now();
  const last = sub.last_digest_at || sub.created_at || 0;
  const elapsed = now - last;

  if (sub.email_frequency === 'daily') {
    return elapsed >= 24 * 60 * 60 * 1000; // 24h
  }
  if (sub.email_frequency === 'weekly') {
    return elapsed >= 7 * 24 * 60 * 60 * 1000; // 7 days
  }
  return true; // immediate
}

const { CATEGORIES } = require('../src/categories');
const {
  WORKER_BROWSER_RESTART_CYCLES,
  WORKER_CLEANUP_CYCLES,
  WORKER_MAX_RESULTS,
} = require('../src/constants');
const POLL_INTERVAL_MS       = parseInt(process.env.WORKER_INTERVAL_SECONDS || '120', 10) * 1000;
const CONCURRENCY            = Math.max(1, parseInt(process.env.WORKER_CONCURRENCY || '2', 10));
const SCRAPER_FAIL_THRESHOLD = Math.max(1, parseInt(process.env.SCRAPER_FAILURE_THRESHOLD || '3', 10));

// Contador de fallos consecutivos del scraper por suscripción (en memoria)
// Se resetea cuando la suscripción procesa correctamente
const scraperErrors = new Map(); // subscriptionId → count

let cycleCount = 0;
let running    = false;

/**
 * Runs an async task with a semaphore to limit concurrency.
 * Returns a runner that accepts an array of tasks and resolves when all done.
 */
async function runWithConcurrency(items, fn, concurrency) {
  const results = [];
  let i = 0;

  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = await fn(items[idx]);
      } catch (err) {
        results[idx] = null;
        console.error(`[Worker] Error en suscripción ${idx}:`, err.message);
      }
    }
  }

  // Spawn `concurrency` workers in parallel
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

/**
 * Procesa una suscripción: busca, filtra nuevos y envía según frecuencia
 * - immediate: envía email en cuanto hay nuevos productos
 * - daily/weekly: acumula y envía resumen cuando toca
 */
async function processSubscription(sub) {
  // Saltar suscripciones pendientes de verificación de email
  const requireVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';
  if (requireVerification && !sub.verified) {
    console.log(`  ⏸ [${sub.email}] "${sub.keywords}" → pendiente de verificación, omitida`);
    return;
  }

  const config = {
    keywords:       sub.keywords,
    minPrice:       sub.min_price,
    maxPrice:       sub.max_price,
    categoryId:     sub.category_id || '',
    categoryName:   CATEGORIES[sub.category_id] || 'Todas',
    maxResults:     WORKER_MAX_RESULTS,
    emailFrequency: sub.email_frequency || 'immediate',
    shippingOnly:   sub.shipping_only === 1 || sub.shipping_only === true,
  };

  const freq = sub.email_frequency || 'immediate';

  try {
    const b = await ensureBrowser(process.env.HEADLESS !== 'false');
    const { items } = await fetchItems(config, b);
    const newItems = filterNewItems(sub.id, items);

    if (newItems.length > 0) {
      // Always mark as seen so we don't re-accumulate
      markItemsSeen(sub.id, newItems.map(i => i.id));

      // ── Webhook dispatch (independent of email frequency) ──────────────
      if (sub.webhook_url) {
        const payload = buildPayload(sub, newItems, config);
        dispatchWebhook(sub.webhook_url, payload).then(result => {
          if (result.ok) {
            console.log(`  🔗 [${sub.email}] "${sub.keywords}" → webhook OK (${result.status})`);
          } else {
            console.warn(`  ⚠️ [${sub.email}] "${sub.keywords}" → webhook FALLÓ: ${result.error}`);
          }
        }).catch(err => {
          console.error(`  ⚠️ [${sub.email}] "${sub.keywords}" → webhook error: ${err.message}`);
        });
      }

      if (freq === 'immediate') {
        // Send right away
        console.log(`  🆕 [${sub.email}] "${sub.keywords}" → ${newItems.length} nuevos, enviando email inmediato...`);
        const sent = await sendAlertEmail(newItems, config, sub.email, sub.id);
        if (sent) {
          console.log(`  📧 [${sub.email}] "${sub.keywords}" → email enviado OK`);
          incrementEmailsSent(sub.id);
          resetConsecutiveFailures(sub.id);
        } else {
          console.error(`  ❌ [${sub.email}] "${sub.keywords}" → email FALLÓ`);
          const autoDeactivated = recordEmailFailure(sub.id);
          if (autoDeactivated) {
            const threshold = parseInt(process.env.EMAIL_FAILURE_THRESHOLD || '5', 10);
            console.warn(`  🚫 [${sub.email}] alertas auto-desactivadas tras ${threshold} fallos consecutivos`);
          }
        }
      } else {
        // Accumulate for digest in SQLite (persists across restarts)
        addDigestItems(sub.id, newItems);
        const total = getDigestItems(sub.id).length;
        console.log(`  📥 [${sub.email}] "${sub.keywords}" → ${newItems.length} guardados para resumen ${freq} (total acumulado: ${total})`);
      }
    } else {
      console.log(`  ✓ [${sub.email}] "${sub.keywords}" → sin novedades`);
    }

    // For digest subscriptions: send if enough time has passed
    if (freq !== 'immediate' && shouldSendDigest(sub)) {
      const accumulated = getDigestItems(sub.id);
      if (accumulated.length > 0) {
        const label = freq === 'daily' ? 'diario' : 'semanal';
        console.log(`  📬 [${sub.email}] "${sub.keywords}" → enviando resumen ${label} (${accumulated.length} productos)...`);
        const sent = await sendAlertEmail(accumulated, config, sub.email, sub.id);
        if (sent) {
          console.log(`  📧 [${sub.email}] "${sub.keywords}" → resumen ${label} enviado OK`);
          incrementEmailsSent(sub.id);
          clearDigestItems(sub.id);
          updateLastDigest(sub.id);
        }
      } else {
        // No new items to send, just reset the digest timer
        updateLastDigest(sub.id);
      }
    }

    // Éxito: resetear contador de errores del scraper
    scraperErrors.delete(sub.id);
    updateLastRun(sub.id);

  } catch (err) {
    console.error(`  ✗ [${sub.email}] "${sub.keywords}" → error: ${err.message}`);
    await closeBrowser();

    // Incrementar contador de fallos del scraper para esta suscripción
    const prevErrors = scraperErrors.get(sub.id) || 0;
    const newErrors  = prevErrors + 1;
    scraperErrors.set(sub.id, newErrors);

    console.warn(`  ⚠️ [${sub.email}] "${sub.keywords}" → fallo scraper ${newErrors}/${SCRAPER_FAIL_THRESHOLD}`);

    // Notificar al admin si se supera el umbral (solo en el ciclo exacto, no en todos los siguientes)
    if (newErrors === SCRAPER_FAIL_THRESHOLD && process.env.ADMIN_EMAIL) {
      console.warn(`  🚨 [${sub.email}] "${sub.keywords}" → enviando alerta al admin (${process.env.ADMIN_EMAIL})...`);
      sendAdminAlert(sub.email, sub.keywords, newErrors, err.message).catch(e => {
        console.error(`  [Worker] Error enviando alerta al admin: ${e.message}`);
      });
    }
  }
}

/**
 * Ejecuta un ciclo completo para todas las suscripciones activas
 * Procesa CONCURRENCY suscripciones en paralelo
 */
async function runCycle() {
  cycleCount++;
  const subscriptions = getActiveSubscriptions();

  if (subscriptions.length === 0) {
    console.log(`[Worker #${cycleCount}] Sin suscripciones activas`);
    return;
  }

  console.log(`\n[Worker #${cycleCount}] Procesando ${subscriptions.length} suscripción(es) [concurrencia: ${CONCURRENCY}]...`);

  // Reiniciar navegador cada N ciclos
  if (cycleCount % WORKER_BROWSER_RESTART_CYCLES === 1) {
    await closeBrowser();
  }

  const start = Date.now();
  await runWithConcurrency(subscriptions, processSubscription, CONCURRENCY);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`[Worker #${cycleCount}] Ciclo completado en ${elapsed}s`);

  // Limpiar items viejos cada N ciclos
  if (cycleCount % WORKER_CLEANUP_CYCLES === 0) {
    cleanupOldSeenItems();
  }
}

/**
 * Inicia el worker en modo bucle
 */
async function startWorker() {
  if (running) return;
  running = true;

  console.log(`🔄 Worker iniciado (intervalo: ${POLL_INTERVAL_MS / 1000}s)`);

  while (running) {
    try {
      await runCycle();
    } catch (err) {
      console.error('[Worker] Error en ciclo:', err.message);
      await closeBrowser();
    }

    // Esperar hasta el próximo ciclo
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

function stopWorker() {
  running = false;
  return closeBrowser();
}

module.exports = { startWorker, stopWorker };
