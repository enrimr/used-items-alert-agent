/**
 * Agente principal de Wallapop
 * Orquesta el scraper, store y notificaciones en un bucle de polling
 */

const { fetchItems } = require('./scraper');
const { ensureBrowser, closeBrowser } = require('./browser');
const { ItemStore } = require('./store');
const {
  AGENT_BROWSER_RESTART_CYCLES,
  AGENT_MAX_CONSECUTIVE_ERRORS,
  AGENT_CLEANUP_CYCLES,
  AGENT_STORE_MAX_DAYS,
} = require('./constants');
const {
  printHeader,
  printStatus,
  printNewItems,
  sendDesktopNotification,
  printCountdown,
} = require('./notifier');
const { sendAlertEmail, verifyEmailConfig } = require('./mailer');

class WallapopAgent {
  constructor(config) {
    this.config = config;
    this.store = new ItemStore(config.saveToFile ? config.outputFile : null);
    this.running = false;
    this.cycleCount = 0;
    this.errorCount = 0;
    this.MAX_CONSECUTIVE_ERRORS = AGENT_MAX_CONSECUTIVE_ERRORS;
  }

  /**
   * Reinicia el navegador (cierra el actual y crea uno nuevo)
   */
  async _initBrowser() {
    await closeBrowser();
    printStatus('Iniciando navegador...', 'info');
    await ensureBrowser(this.config.headless);
    printStatus('Navegador listo', 'success');
  }

  /**
   * Ejecuta un ciclo de búsqueda
   */
  async _runCycle() {
    this.cycleCount++;
    printStatus(`Búsqueda #${this.cycleCount} en Wallapop...`, 'searching');

    try {
      // Reiniciar navegador cada N ciclos para evitar memory leaks y timeouts
      if (this.cycleCount % AGENT_BROWSER_RESTART_CYCLES === 1) {
        await this._initBrowser();
      }

      const browser = await ensureBrowser(this.config.headless);
      const { items, source } = await fetchItems(this.config, browser);

      printStatus(
        `Obtenidos ${items.length} productos (fuente: ${source})`,
        'success'
      );

      // Detectar nuevos items
      const newItems = this.store.getNewItems(items);
      const stats = this.store.getStats();

      // Enriquecer config con estadísticas para el notifier
      this.config._stats = stats;

      // Mostrar resultados
      printNewItems(newItems, this.config);

      // Notificación de escritorio
      if (this.config.desktopNotifications && newItems.length > 0) {
        sendDesktopNotification(newItems, this.config);
      }

      // Notificación por email (modo CLI: sin subscriptionId → sin link de cancelación)
      if (this.config.emailEnabled && newItems.length > 0) {
        const sent = await sendAlertEmail(newItems, this.config, process.env.EMAIL_TO, null);
        if (sent) {
          printStatus(`📧 Email enviado a ${process.env.EMAIL_TO}`, 'success');
        }
      }

      // Guardar si hay nuevos
      if (newItems.length > 0) {
        this.store.save(this.config.saveToFile);
        printStatus(
          `Guardados ${stats.totalSaved} productos en ${this.config.outputFile}`,
          'success'
        );
      }

      // Limpiar items muy antiguos cada N ciclos
      if (this.cycleCount % AGENT_CLEANUP_CYCLES === 0) {
        this.store.cleanup(AGENT_STORE_MAX_DAYS);
        this.store.save(this.config.saveToFile);
      }

      this.errorCount = 0; // Reset error counter on success
      return true;

    } catch (err) {
      this.errorCount++;
      printStatus(
        `Error en ciclo #${this.cycleCount}: ${err.message} (error ${this.errorCount}/${this.MAX_CONSECUTIVE_ERRORS})`,
        'error'
      );

      // Si hay demasiados errores consecutivos, reiniciar el navegador
      if (this.errorCount >= this.MAX_CONSECUTIVE_ERRORS) {
        printStatus('Demasiados errores consecutivos. Reiniciando navegador...', 'warning');
        try {
          await this._initBrowser();
          this.errorCount = 0;
        } catch (e) {
          printStatus(`Error reiniciando navegador: ${e.message}`, 'error');
        }
      }

      return false;
    }
  }

  /**
   * Espera N milisegundos
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Inicia el agente en modo bucle continuo
   */
  async start() {
    this.running = true;

    // Mostrar header
    printHeader(this.config);

    printStatus('Iniciando agente Wallapop...', 'info');
    printStatus(`Monitorizando: "${this.config.keywords}"`, 'info');

    // Manejar señales de salida
    const shutdown = async (signal) => {
      if (!this.running) return;
      this.running = false;
      console.log('\n');
      printStatus(`Señal ${signal} recibida. Deteniendo agente...`, 'warning');

      // Guardar estado final
      this.store.save(this.config.saveToFile);
      await closeBrowser();

      const stats = this.store.getStats();
      printStatus(
        `Agente detenido. Total procesados: ${stats.totalSeen} | Guardados: ${stats.totalSaved}`,
        'info'
      );
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Bucle principal
    while (this.running) {
      await this._runCycle();

      if (!this.running) break;

      // Esperar hasta la próxima búsqueda
      const waitSeconds = Math.floor(this.config.pollInterval / 1000);
      await printCountdown(waitSeconds);
      await this._sleep(this.config.pollInterval);
    }
  }

  /**
   * Ejecuta una sola búsqueda (modo one-shot)
   */
  async runOnce() {
    printHeader(this.config);
    printStatus('Ejecutando búsqueda única...', 'info');

    await this._initBrowser();
    await this._runCycle();
    await closeBrowser();

    const stats = this.store.getStats();
    printStatus(`Completado. Total vistos: ${stats.totalSeen}`, 'success');
  }
}

module.exports = { WallapopAgent };
