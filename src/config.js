/**
 * Configuración del agente Wallapop
 * Carga y valida las variables de entorno
 */

require('dotenv').config();

const CATEGORIES = {
  '': 'Todas las categorías',
  '12465': 'Tecnología',
  '12579': 'Móviles y telefonía',
  '15000': 'Informática',
  '12545': 'Moda y accesorios',
  '12543': 'Motor',
  '12463': 'Deporte y ocio',
  '12459': 'Hogar y jardín',
  '12467': 'Televisión y audio',
  '12461': 'Consolas y videojuegos',
  '12473': 'Cámaras y fotografía',
  '14000': 'Coleccionismo',
  '12449': 'Libros y música',
  '12469': 'Bebés y niños',
  '12471': 'Otros',
};

function loadConfig() {
  const keywords = process.env.KEYWORDS || '';

  if (!keywords.trim()) {
    console.error('❌ Error: KEYWORDS es requerido. Configura el archivo .env');
    process.exit(1);
  }

  const minPrice = process.env.MIN_PRICE ? parseFloat(process.env.MIN_PRICE) : null;
  const maxPrice = process.env.MAX_PRICE ? parseFloat(process.env.MAX_PRICE) : null;

  if (minPrice !== null && isNaN(minPrice)) {
    console.error('❌ Error: MIN_PRICE debe ser un número válido');
    process.exit(1);
  }

  if (maxPrice !== null && isNaN(maxPrice)) {
    console.error('❌ Error: MAX_PRICE debe ser un número válido');
    process.exit(1);
  }

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    console.error('❌ Error: MIN_PRICE no puede ser mayor que MAX_PRICE');
    process.exit(1);
  }

  const categoryId = process.env.CATEGORY_ID || '';
  const pollInterval = parseInt(process.env.POLL_INTERVAL_SECONDS || '90', 10);
  const maxResults = parseInt(process.env.MAX_RESULTS || '40', 10);
  const headless = process.env.HEADLESS !== 'false';
  const desktopNotifications = process.env.DESKTOP_NOTIFICATIONS !== 'false';
  const saveToFile = process.env.SAVE_TO_FILE !== 'false';
  const outputFile = process.env.OUTPUT_FILE || './encontrados.json';

  // Email
  const emailEnabled = !!(
    process.env.EMAIL_TO &&
    process.env.EMAIL_SMTP_HOST &&
    process.env.EMAIL_SMTP_USER &&
    process.env.EMAIL_SMTP_PASS
  );

  return {
    keywords: keywords.trim(),
    minPrice,
    maxPrice,
    categoryId,
    categoryName: CATEGORIES[categoryId] || `Categoría ${categoryId}`,
    pollInterval: Math.max(30, pollInterval) * 1000, // mínimo 30s, en milisegundos
    maxResults: Math.min(100, Math.max(1, maxResults)),
    headless,
    desktopNotifications,
    saveToFile,
    outputFile,
    emailEnabled,
    emailTo: process.env.EMAIL_TO || '',
  };
}

module.exports = { loadConfig, CATEGORIES };
