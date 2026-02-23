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

const args = process.argv.slice(2);
const webOnly = args.includes('--web');

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         🔍 WALLAPOP ALERTAS — SERVIDOR          ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  // Verificar configuración de email
  const emailOk = !!(
    process.env.EMAIL_SMTP_HOST &&
    process.env.EMAIL_SMTP_USER &&
    process.env.EMAIL_SMTP_PASS
  );

  if (!emailOk) {
    console.warn('⚠️  Aviso: EMAIL_SMTP_* no configurado — los emails no se enviarán');
    console.warn('   Variables necesarias: EMAIL_SMTP_HOST, EMAIL_SMTP_USER, EMAIL_SMTP_PASS, EMAIL_FROM');
    console.log('');
  } else {
    console.log(`📧 Email configurado: ${process.env.EMAIL_SMTP_USER} → ${process.env.EMAIL_SMTP_HOST}:${process.env.EMAIL_SMTP_PORT || 587}`);
    // Verify SMTP connection on startup
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SMTP_HOST,
        port: parseInt(process.env.EMAIL_SMTP_PORT || '587', 10),
        secure: process.env.EMAIL_SMTP_SECURE === 'true',
        auth: { user: process.env.EMAIL_SMTP_USER, pass: process.env.EMAIL_SMTP_PASS },
        tls: { rejectUnauthorized: false },
      });
      await transporter.verify();
      console.log('✅ Conexión SMTP verificada correctamente');
    } catch (err) {
      console.error(`❌ Error SMTP: ${err.message}`);
      console.error('   Revisa EMAIL_SMTP_HOST, EMAIL_SMTP_USER, EMAIL_SMTP_PASS');
    }
    console.log('');
  }

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
