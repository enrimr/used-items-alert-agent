#!/usr/bin/env node
/**
 * 🔍 Wallapop Agent
 * Monitoriza nuevos productos en Wallapop España sin reserva
 *
 * Uso:
 *   node index.js            → modo continuo (polling)
 *   node index.js --once     → búsqueda única
 *   node index.js --help     → ayuda
 */

const { loadConfig } = require('./src/config');
const { WallapopAgent } = require('./src/agent');

async function main() {
  const args = process.argv.slice(2);

  // Mostrar ayuda
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  // Cargar configuración desde .env
  const config = loadConfig();

  // Crear agente
  const agent = new WallapopAgent(config);

  // Modo one-shot o continuo
  if (args.includes('--once') || args.includes('-o')) {
    await agent.runOnce();
  } else {
    await agent.start();
  }
}

function printHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║              🔍 WALLAPOP AGENT - AYUDA                  ║
╚══════════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Monitoriza Wallapop España y notifica cuando aparecen
  nuevos productos que cumplan tus criterios de búsqueda.
  Filtra automáticamente productos con reserva o vendidos.

USO:
  node index.js            Modo continuo (recomendado)
  node index.js --once     Ejecuta una sola búsqueda
  node index.js --help     Muestra esta ayuda

CONFIGURACIÓN (.env):
  KEYWORDS=iphone 13         Palabras clave (requerido)
  MIN_PRICE=100              Precio mínimo en € (opcional)
  MAX_PRICE=500              Precio máximo en € (opcional)
  CATEGORY_ID=12579          ID de categoría (opcional)
  POLL_INTERVAL_SECONDS=90   Segundos entre búsquedas
  MAX_RESULTS=40             Máximo de resultados
  HEADLESS=true              Sin ventana de navegador
  DESKTOP_NOTIFICATIONS=true Notificaciones de escritorio
  SAVE_TO_FILE=true          Guardar resultados en JSON
  OUTPUT_FILE=./encontrados.json  Archivo de salida

CATEGORÍAS DISPONIBLES:
  12465 = Tecnología         12579 = Móviles y telefonía
  15000 = Informática        12545 = Moda y accesorios
  12543 = Motor              12463 = Deporte y ocio
  12459 = Hogar y jardín     12467 = Televisión y audio
  12461 = Consolas           12473 = Cámaras
  14000 = Coleccionismo      12449 = Libros y música
  12469 = Bebés y niños      12471 = Otros

EJEMPLOS:
  # Buscar iPhone 13 entre 100€ y 500€
  KEYWORDS="iphone 13" MIN_PRICE=100 MAX_PRICE=500 node index.js

  # Buscar en categoría Móviles cada 2 minutos
  KEYWORDS="samsung s23" CATEGORY_ID=12579 POLL_INTERVAL_SECONDS=120 node index.js
`);
}

main().catch((err) => {
  console.error('❌ Error fatal:', err.message);
  console.error(err.stack);
  process.exit(1);
});
