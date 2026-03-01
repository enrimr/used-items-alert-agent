# Progress — Used Items Alert Agent

## Historial de decisiones arquitectónicas

### ADR-001: SQLite síncrono con better-sqlite3
**Decisión**: usar `better-sqlite3` (síncrono) en vez de `sqlite3` (callbacks/promises).
**Razón**: el worker ya es async/await por el scraper; la BD síncrona simplifica
el código y evita Promise chains innecesarias en operaciones de lectura/escritura.
**Consecuencia**: No usar `await` ni `.then()` en llamadas a la BD.

### ADR-002: Motor de plantillas propio (no EJS/Handlebars)
**Decisión**: implementar un motor mínimo de sustitución de tokens `{{var}}`.
**Razón**: evitar dependencias pesadas para una necesidad sencilla; control total
sobre el comportamiento y sin magia implícita.
**Consecuencia**: No introducir Handlebars/EJS/Pug sin consenso.

### ADR-003: Email unificado Resend + SMTP
**Decisión**: mismo módulo `src/mailer.js` con detección automática del transporte.
**Razón**: Railway y Render bloquean puertos SMTP; Resend es más fiable en PaaS.
**Consecuencia**: Resend es el transporte recomendado en producción.

### ADR-004: Sin autenticación de usuarios
**Decisión**: el email es el único identificador; no hay cuentas ni contraseñas.
**Razón**: reducir fricción de onboarding; la verificación de email es suficiente.
**Consecuencia**: el link de baja en cada email es la única forma de control del usuario.

### ADR-005: CommonJS sobre ES Modules
**Decisión**: todo el proyecto usa `require`/`module.exports`.
**Razón**: Node.js 16/18 tiene soporte completo de CJS sin configuración adicional;
Jest (v29) tiene mejor soporte para CJS que para ESM en este contexto.
**Consecuencia**: No usar `import`/`export`. Si se migra a ESM, hay que actualizar
Jest config y todos los ficheros.

### ADR-006: Worker en mismo proceso que Express
**Decisión**: el worker y el servidor HTTP comparten el mismo proceso Node.js.
**Razón**: simplifica el despliegue (un solo dyno/contenedor); SQLite síncrono
no tiene problemas de concurrencia en un solo proceso.
**Consecuencia**: si el worker se cuelga, el servidor también. Vigilar con el semáforo
de concurrencia y los reintentos del navegador.

### ADR-007: CSRF desactivado en NODE_ENV=test
**Decisión**: la protección CSRF se salta automáticamente cuando `NODE_ENV=test`.
**Razón**: permite usar `supertest` sin tener que obtener y enviar tokens CSRF en cada test.
**Consecuencia**: los tests deben ejecutarse siempre con `NODE_ENV=test` (configurado en los scripts npm).

---

## Changelog de funcionalidades

| Versión | Cambio |
|---------|--------|
| 1.0.0 | Release inicial: CLI + scraper Puppeteer |
| 1.1.0 | Servidor web: suscripción, worker, email |
| 1.2.0 | Panel admin con KPIs |
| 1.3.0 | Multiidioma (es/en/it/ca) |
| 1.4.0 | Webhooks (Zapier, n8n, Make, Slack) |
| 1.5.0 | Resúmenes diarios/semanales (digest) |
| 1.6.0 | Verificación de email opcional |
| 1.7.0 | Temas de color configurables |
| 1.8.0 | Filtro de envío (shipping_only) |
| 1.9.0 | Edición inline en panel admin |
| 1.10.0 | Límites de alertas por email |
| 1.11.0 | Suite de tests completa (BDD, cobertura ≥ 80%) |
| 1.12.0 | Docker multi-stage + soporte Railway/Render |

---

## Tests — estado de cobertura

| Fichero test | Módulo cubierto | Estado |
|---|---|---|
| config.test.js | src/config.js | ✅ |
| categories.test.js | src/categories.js | ✅ |
| scraper.test.js | src/scraper.js (buildSearchUrl, parseItems) | ✅ |
| mailer.test.js | src/mailer.js | ✅ |
| webhook.test.js | src/webhook.js | ✅ |
| db.test.js | web/db/ (CRUD completo) | ✅ |
| subscribe.test.js | web/routes/subscribe.js | ✅ |
| admin.test.js | web/routes/admin.js | ✅ |
| theme.test.js | web/theme.js + src/theme-web.js | ✅ |
| integration.test.js | Flujo end-to-end (7 flujos BDD) | ✅ |

Excluidos de cobertura (Puppeteer/entry-points):
`src/scraper.js`, `src/agent.js`, `src/notifier.js`, `src/store.js`,
`server.js`, `index.js`
