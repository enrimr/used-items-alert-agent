/**
 * Worker que ejecuta búsquedas en Wallapop para cada suscripción activa
 * Se ejecuta en un bucle periódico enviando emails con los nuevos productos
 */

const { fetchItems, createBrowser } = require('../src/scraper');
const { sendAlertEmail } = require('./mailer');
const {
  getActiveSubscriptions,
  filterNewItems,
  markItemsSeen,
  updateLastRun,
  cleanupOldSeenItems,
} = require('./db');

const CATEGORIES = require('../src/config').CATEGORIES;
const POLL_INTERVAL_MS = parseInt(process.env.WORKER_INTERVAL_SECONDS || '120', 10) * 1000;

let browser = null;
let cycleCount = 0;
let running = false;

async function ensureBrowser() {
  if (!browser) {
    browser = await createBrowser(process.env.HEADLESS !== 'false');
  }
  return browser;
}

async function closeBrowser() {
  if (browser) {
    try { await browser.close(); } catch (e) {}
    browser = null;
  }
}

/**
 * Procesa una suscripción: busca, filtra nuevos y envía email
 */
async function processSubscription(sub) {
  const config = {
    keywords: sub.keywords,
    minPrice: sub.min_price,
    maxPrice: sub.max_price,
    categoryId: sub.category_id || '',
    categoryName: CATEGORIES[sub.category_id] || 'Todas',
    maxResults: 40,
  };

  try {
    const b = await ensureBrowser();
    const { items } = await fetchItems(config, b);

    const newItems = filterNewItems(sub.id, items);

    if (newItems.length > 0) {
      console.log(`  🆕 [${sub.email}] "${sub.keywords}" → ${newItems.length} nuevos productos, enviando email...`);
      // Enviar email con los nuevos productos
      const sent = await sendAlertEmail(newItems, config, sub.email, sub.id);
      if (sent) {
        console.log(`  📧 [${sub.email}] "${sub.keywords}" → email enviado OK`);
      } else {
        console.error(`  ❌ [${sub.email}] "${sub.keywords}" → email FALLÓ (revisa EMAIL_SMTP_* en las variables de entorno)`);
      }
      // Marcar como vistos
      markItemsSeen(sub.id, newItems.map(i => i.id));
    } else {
      console.log(`  ✓ [${sub.email}] "${sub.keywords}" → sin novedades`);
    }

    updateLastRun(sub.id);
  } catch (err) {
    console.error(`  ✗ [${sub.email}] "${sub.keywords}" → error: ${err.message}`);
    // Reiniciar navegador si hay error
    await closeBrowser();
  }
}

/**
 * Ejecuta un ciclo completo para todas las suscripciones activas
 */
async function runCycle() {
  cycleCount++;
  const subscriptions = getActiveSubscriptions();

  if (subscriptions.length === 0) {
    console.log(`[Worker #${cycleCount}] Sin suscripciones activas`);
    return;
  }

  console.log(`\n[Worker #${cycleCount}] Procesando ${subscriptions.length} suscripción(es)...`);

  // Reiniciar navegador cada 10 ciclos
  if (cycleCount % 10 === 1) {
    await closeBrowser();
  }

  for (const sub of subscriptions) {
    await processSubscription(sub);
    // Pequeña pausa entre suscripciones para no sobrecargar
    await new Promise(r => setTimeout(r, 2000));
  }

  // Limpiar items viejos cada 50 ciclos
  if (cycleCount % 50 === 0) {
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
