/**
 * Constantes compartidas entre el agente CLI y el worker web.
 * Centraliza los "magic numbers" para facilitar su ajuste y documentación.
 */

// ── Scraper ────────────────────────────────────────────────────────────────

/** Tiempo máximo (ms) esperando la respuesta de la API de Wallapop */
const SCRAPER_API_TIMEOUT_MS = 40000;

/** Tiempo máximo (ms) para la navegación de Puppeteer */
const SCRAPER_NAV_TIMEOUT_MS = 50000;

/** Número máximo de imágenes por producto que se extraen */
const SCRAPER_MAX_IMAGES = 3;

// ── Agente CLI ─────────────────────────────────────────────────────────────

/** Cada cuántos ciclos se reinicia el navegador (evita memory leaks) */
const AGENT_BROWSER_RESTART_CYCLES = 5;

/** Cuántos errores consecutivos disparan el reinicio forzado del navegador */
const AGENT_MAX_CONSECUTIVE_ERRORS = 5;

/** Cada cuántos ciclos se limpia el store de items antiguos */
const AGENT_CLEANUP_CYCLES = 100;

/** Antigüedad máxima en días de los items guardados en el store */
const AGENT_STORE_MAX_DAYS = 30;

// ── Worker web ─────────────────────────────────────────────────────────────

/** Cada cuántos ciclos del worker se reinicia el navegador */
const WORKER_BROWSER_RESTART_CYCLES = 10;

/** Cada cuántos ciclos del worker se limpian los seen_items antiguos */
const WORKER_CLEANUP_CYCLES = 50;

/** Número máximo de resultados solicitados al scraper por suscripción */
const WORKER_MAX_RESULTS = 40;

// ── Digest store ───────────────────────────────────────────────────────────

/** Máximo de items acumulados por suscripción en el digest store */
const DIGEST_MAX_ITEMS = 100;

module.exports = {
  SCRAPER_API_TIMEOUT_MS,
  SCRAPER_NAV_TIMEOUT_MS,
  SCRAPER_MAX_IMAGES,
  AGENT_BROWSER_RESTART_CYCLES,
  AGENT_MAX_CONSECUTIVE_ERRORS,
  AGENT_CLEANUP_CYCLES,
  AGENT_STORE_MAX_DAYS,
  WORKER_BROWSER_RESTART_CYCLES,
  WORKER_CLEANUP_CYCLES,
  WORKER_MAX_RESULTS,
  DIGEST_MAX_ITEMS,
};
