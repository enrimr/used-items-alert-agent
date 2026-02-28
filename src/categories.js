/**
 * Categorías de Wallapop España
 *
 * Fichero independiente para que pueda ser importado tanto desde el modo CLI
 * (src/config.js) como desde el servidor web (web/routes/, web/worker.js)
 * sin arrastrar la lógica de loadConfig() ni sus process.exit().
 */

const CATEGORIES = {
  '':      'Todas las categorías',
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

module.exports = { CATEGORIES };
