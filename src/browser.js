/**
 * Gestión del ciclo de vida del navegador Puppeteer.
 *
 * Centraliza la lógica de crear, reusar y cerrar el browser,
 * compartida entre el agente CLI (src/agent.js) y el worker web (web/worker.js).
 *
 * Características:
 *  - Singleton: una sola instancia activa a la vez
 *  - Mutex basado en Promise: evita creaciones concurrentes sin timers ni busy-wait
 *  - Cierre seguro: pone browser a null antes de cerrarlo para evitar race conditions
 */

const { createBrowser } = require('./scraper');

let browser = null;
let browserReady = Promise.resolve(); // mutex: bloquea a quienes llegan mientras se crea

/**
 * Devuelve el browser compartido, creándolo si no existe.
 * Usa una Promise como mutex real: las coroutines que llegan mientras
 * el browser se está creando esperan en `await browserReady` sin timers.
 *
 * @param {boolean} headless
 * @returns {Promise<import('puppeteer').Browser>}
 */
async function ensureBrowser(headless = true) {
  await browserReady; // espera a que cualquier creación en curso termine

  if (!browser) {
    let resolve;
    browserReady = new Promise(r => { resolve = r; });
    try {
      browser = await createBrowser(headless);
    } finally {
      resolve(); // desbloquea a todos los waiters de golpe
    }
  }
  return browser;
}

/**
 * Cierra el browser activo de forma segura.
 * Pone la referencia a null antes de cerrar para que nadie más lo use.
 */
async function closeBrowser() {
  if (browser) {
    const b = browser;
    browser = null;
    try { await b.close(); } catch (e) {}
  }
}

/**
 * Indica si hay un browser activo en este momento.
 * @returns {boolean}
 */
function hasBrowser() {
  return browser !== null;
}

module.exports = { ensureBrowser, closeBrowser, hasBrowser };
