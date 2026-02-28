#!/usr/bin/env node
/**
 * 🌐 Wallapop Alertas — Servidor Web
 *
 * Arranca el servidor web Express + el worker de búsqueda
 *
 * Uso:
 *   node server.js          → arranca web + worker
 *   node server.js --web    → solo el servidor web (sin worker)
 *
 * Variables .env necesarias:
 *   WEB_PORT=3000
 *   BASE_URL=http://localhost:3000  (o tu dominio en producción)
 *   EMAIL_SMTP_HOST, EMAIL_SMTP_USER, EMAIL_SMTP_PASS, EMAIL_FROM
 *   WORKER_INTERVAL_SECONDS=120
 */

require('dotenv').config();

const { startServer } = require('./web/server');
const { startWorker } = require('./web/worker');
const { verifyEmailConfig } = require('./src/mailer');

const args = process.argv.slice(2);
const webOnly = args.includes('--web');

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         🔍 WALLAPOP ALERTAS — SERVIDOR          ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  // Verificar configuración de email usando el módulo unificado
  if (process.env.RESEND_API_KEY) {
    console.log(`📧 Email via Resend (HTTP API) — recomendado en Railway`);
  } else if (process.env.EMAIL_SMTP_HOST && process.env.EMAIL_SMTP_USER && process.env.EMAIL_SMTP_PASS) {
    console.log(`📧 Email via SMTP: ${process.env.EMAIL_SMTP_USER} → ${process.env.EMAIL_SMTP_HOST}:${process.env.EMAIL_SMTP_PORT || 587}`);
    const check = await verifyEmailConfig();
    if (check.ok) {
      console.log('✅ Conexión SMTP verificada correctamente');
    } else {
      console.error(`❌ Error SMTP: ${check.reason}`);
      console.error('   En Railway usa RESEND_API_KEY en lugar de SMTP (Railway bloquea puertos SMTP)');
    }
  } else {
    console.warn('⚠️  Sin config de email — los emails no se enviarán');
    console.warn('   Opción 1 (Railway): RESEND_API_KEY=re_xxxx + EMAIL_FROM=noreply@tudominio.com');
    console.warn('   Opción 2 (local):   EMAIL_SMTP_HOST + EMAIL_SMTP_USER + EMAIL_SMTP_PASS + EMAIL_FROM');
  }
  console.log('');

  // Arrancar servidor web
  await startServer();

  // Arrancar worker (a menos que se pase --web)
  if (!webOnly) {
    const interval = parseInt(process.env.WORKER_INTERVAL_SECONDS || '120', 10);
    console.log(`🔄 Worker arrancando (cada ${interval}s)...`);
    startWorker(); // No awaiting — corre en background
  } else {
    console.log('ℹ️  Worker desactivado (--web flag)');
  }

  console.log('');
  console.log(`🌍 BASE_URL: ${process.env.BASE_URL || 'http://localhost:' + (process.env.WEB_PORT || 3000)}`);
  console.log('');

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n⚠️  ${signal} recibido. Cerrando...`);
    const { stopWorker } = require('./web/worker');
    await stopWorker();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
