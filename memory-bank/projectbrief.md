# Project Brief — Used Items Alert Agent

## Propósito
Agente Node.js que monitoriza Wallapop España en busca de nuevas publicaciones
y envía alertas por email, webhook o consola. Funciona en dos modos:

1. **CLI** — búsqueda personal con palabras clave / precio / categoría
2. **Servidor web** — SaaS público donde cualquier usuario se puede suscribir
   sin cuenta; confirmación por email, baja con un clic.

## Objetivos de producto
- Notificar en tiempo real (polling configurable) sin duplicados.
- Sin registro: el email es el único identificador.
- Soporte multiidioma (es, en, it, ca) en UI y emails.
- Integraciones externas: webhooks compatibles con Zapier, n8n, Make, Slack.
- Panel admin protegido con KPIs, gestión de alertas y límites por email.

## Alcance actual
- Scraper Puppeteer que intercepta `/api/v3/search/section` de Wallapop.
- Motor de email unificado (Resend API o SMTP/nodemailer).
- Base de datos SQLite (better-sqlite3, síncrono).
- Worker con concurrencia configurable (`WORKER_CONCURRENCY`).
- Resúmenes de alertas: inmediato, diario, semanal.
- Verificación opcional de email (`REQUIRE_EMAIL_VERIFICATION`).
- Tema de color configurable (orange, teal, purple, blue, neutral).
- Despliegue en Railway, Render o Docker self-hosted.

## Fuera de alcance
- Autenticación de usuarios (no hay cuentas, solo email).
- Base de datos distinta a SQLite (no hay ORM).
- Motor de plantillas externo (EJS, Handlebars, Pug).
- Módulos ES (solo CommonJS).
