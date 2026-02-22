/**
 * Sistema de notificaciones para nuevos productos
 * - Notificaciones de escritorio (node-notifier)
 * - Salida en consola con colores
 */

const chalk = require('chalk');

let notifier = null;
try {
  notifier = require('node-notifier');
} catch (e) {
  // node-notifier no disponible
}

/**
 * Formatea un precio con moneda
 */
function formatPrice(price, currency = 'EUR') {
  const symbol = currency === 'EUR' ? '€' : currency;
  return `${Number(price).toFixed(2)} ${symbol}`;
}

/**
 * Formatea una fecha relativa
 */
function formatDate(isoString) {
  if (!isoString) return 'Fecha desconocida';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-ES');
  } catch (e) {
    return isoString;
  }
}

/**
 * Imprime en consola la información de un nuevo item
 */
function printItem(item, index) {
  const separator = chalk.gray('─'.repeat(60));

  console.log(separator);
  console.log(
    chalk.green.bold(`  🆕 NUEVO [${index}]`) +
    chalk.white.bold(` ${item.title}`)
  );
  console.log(
    chalk.yellow.bold(`  💰 ${formatPrice(item.price, item.currency)}`) +
    chalk.gray(`  📍 ${item.location}`) +
    chalk.gray(`  👤 ${item.seller}`)
  );

  if (item.description) {
    const shortDesc = item.description.substring(0, 100).replace(/\n/g, ' ');
    console.log(chalk.gray(`  📝 ${shortDesc}${item.description.length > 100 ? '...' : ''}`));
  }

  console.log(chalk.cyan(`  🔗 ${item.url}`));

  if (item.detectedAt) {
    console.log(chalk.gray(`  🕐 Detectado: ${formatDate(item.detectedAt)}`));
  }
}

/**
 * Muestra el encabezado del agente
 */
function printHeader(config) {
  console.clear();
  console.log(chalk.bgBlue.white.bold('\n  🔍 WALLAPOP AGENT  '));
  console.log(chalk.blue('═'.repeat(60)));
  console.log(chalk.white(`  🔎 Búsqueda:  `) + chalk.yellow.bold(config.keywords));

  if (config.minPrice !== null || config.maxPrice !== null) {
    const min = config.minPrice !== null ? `${config.minPrice}€` : '0€';
    const max = config.maxPrice !== null ? `${config.maxPrice}€` : '∞';
    console.log(chalk.white(`  💶 Precio:    `) + chalk.yellow(`${min} - ${max}`));
  }

  if (config.categoryId) {
    console.log(chalk.white(`  🏷️  Categoría: `) + chalk.yellow(config.categoryName));
  } else {
    console.log(chalk.white(`  🏷️  Categoría: `) + chalk.gray('Todas'));
  }

  console.log(chalk.white(`  ⏱️  Intervalo: `) + chalk.gray(`${config.pollInterval / 1000}s`));
  console.log(chalk.white(`  🚫 Filtro:    `) + chalk.green('Sin reserva · Sin vendidos'));

  if (config.emailEnabled) {
    console.log(chalk.white(`  📧 Email:     `) + chalk.green(config.emailTo));
  }

  console.log(chalk.blue('═'.repeat(60)) + '\n');
}

/**
 * Muestra el estado de polling
 */
function printStatus(message, type = 'info') {
  const now = new Date().toLocaleTimeString('es-ES');
  const icons = {
    info: chalk.blue('ℹ'),
    success: chalk.green('✓'),
    warning: chalk.yellow('⚠'),
    error: chalk.red('✗'),
    searching: chalk.cyan('🔄'),
  };
  const icon = icons[type] || icons.info;
  console.log(`${chalk.gray(`[${now}]`)} ${icon} ${message}`);
}

/**
 * Muestra los items nuevos encontrados
 */
function printNewItems(items, config) {
  if (items.length === 0) {
    printStatus(`Sin novedades (visto ${config._stats?.totalSeen || 0} productos en total)`, 'info');
    return;
  }

  console.log('');
  console.log(
    chalk.green.bold(`\n  ✨ ¡${items.length} NUEVO${items.length > 1 ? 'S' : ''} PRODUCTO${items.length > 1 ? 'S' : ''} ENCONTRADO${items.length > 1 ? 'S' : ''}!`)
  );

  items.forEach((item, i) => printItem(item, i + 1));

  console.log(chalk.gray('─'.repeat(60)) + '\n');
}

/**
 * Envía notificación de escritorio
 */
function sendDesktopNotification(items, config) {
  if (!notifier || !items.length) return;

  try {
    const title = `🆕 ${items.length} nuevo${items.length > 1 ? 's' : ''} en Wallapop`;
    const first = items[0];
    const message = items.length === 1
      ? `${first.title} - ${formatPrice(first.price, first.currency)}`
      : `${first.title} y ${items.length - 1} más...`;

    notifier.notify({
      title,
      message,
      sound: true,
      timeout: 10,
      open: first.url,
    });
  } catch (e) {
    // Silently fail if desktop notifications don't work
  }
}

/**
 * Muestra cuenta regresiva hasta la próxima búsqueda
 */
async function printCountdown(seconds) {
  const interval = Math.min(30, Math.floor(seconds / 4));
  const checkpoints = [];

  for (let s = interval; s < seconds; s += interval) {
    checkpoints.push(s);
  }

  // We'll just print a simple waiting message
  printStatus(
    `Próxima búsqueda en ${seconds}s... ${chalk.gray('(Ctrl+C para detener)')}`,
    'info'
  );
}

module.exports = {
  printHeader,
  printStatus,
  printNewItems,
  sendDesktopNotification,
  printCountdown,
  formatPrice,
};
