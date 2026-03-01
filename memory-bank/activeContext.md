# Active Context — Used Items Alert Agent

## Estado actual del proyecto
El proyecto está en estado **funcional y estable**. Todas las funcionalidades
principales están implementadas y testeadas.

## Funcionalidades implementadas
- ✅ Scraper Puppeteer con intercepción de API de Wallapop
- ✅ Modo CLI (bucle continuo + búsqueda única)
- ✅ Servidor web Express (suscripción, verificación, baja)
- ✅ Worker con concurrencia configurable
- ✅ Motor de email unificado (Resend + SMTP)
- ✅ Webhooks con retry y back-off exponencial
- ✅ Panel admin con KPIs, gestión y edición inline
- ✅ Resúmenes diarios y semanales (digest)
- ✅ Verificación opcional de email
- ✅ Multiidioma (es, en, it, ca)
- ✅ Temas de color (5 paletas)
- ✅ Rate limiting y protección CSRF
- ✅ Migraciones de BD idempotentes
- ✅ Docker + Railway/Render deployment
- ✅ Suite de tests completa (10 ficheros, cobertura ≥ 80%)

## Archivos de configuración críticos
- `.env` — variables de entorno (NO en git)
- `.env.example` — plantilla de referencia (SÍ en git)
- `package.json` — scripts y configuración Jest
- `Dockerfile` — imagen de producción
- `nixpacks.toml` — configuración de build para Railway
- `railway.json` — configuración de despliegue Railway

## Convenciones activas
- CommonJS (`require`/`module.exports`) en todos los módulos
- Tests en `tests/*.test.js`, BD en memoria, mocks con `jest.mock()`
- Commits Conventional Commits tras cada cambio funcional
- Documentación Markdown actualizada en `docs/` con cada cambio
- Strings de UI siempre en `web/i18n/*.js`, nunca hardcodeadas

## Deuda técnica conocida
- `src/scraper.js` y `src/agent.js` están excluidos de cobertura de tests
  (requieren Chromium real — candidatos para tests de integración con
  mock de Puppeteer más completo en el futuro).
- Sin linter ESLint configurado — se puede añadir sin romper nada.
- `web/routes/admin.js` y `web/routes/subscribe.js` están cerca del límite
  de 300 líneas — vigilar al añadir funcionalidades.

## Próximas decisiones que requieren consenso
- Añadir un nuevo idioma (requiere actualizar `web/i18n/index.js` y los 4 ficheros existentes).
- Cambiar motor de plantillas (actualmente propio; no introducir EJS/Handlebars sin consenso).
- Añadir nueva tabla en BD (requiere migración idempotente en `connection.js`).
- Cambiar el transporte de BD (SQLite → PostgreSQL requeriría refactorizar `web/db/`).
