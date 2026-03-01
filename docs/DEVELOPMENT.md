# 🛠️ Guía de desarrollo

Esta guía describe la arquitectura interna del proyecto, cómo ejecutar los tests, cómo añadir nuevas funcionalidades y las convenciones de código.

---

## Índice

- [Configuración del entorno de desarrollo](#configuración-del-entorno-de-desarrollo)
- [Scripts disponibles](#scripts-disponibles)
- [Arquitectura del sistema](#arquitectura-del-sistema)
  - [Modo CLI](#modo-cli)
  - [Modo web](#modo-web)
  - [Módulos compartidos](#módulos-compartidos)
- [Base de datos](#base-de-datos)
- [Sistema de email](#sistema-de-email)
- [Internacionalización (i18n)](#internacionalización-i18n)
- [Motor de plantillas](#motor-de-plantillas)
- [Tests](#tests)
- [Convenciones de código](#convenciones-de-código)
- [Cómo añadir nuevas funcionalidades](#cómo-añadir-nuevas-funcionalidades)

---

## Configuración del entorno de desarrollo

### Requisitos

- **Node.js** ≥ 16 (recomendado 18 LTS)
- **npm** ≥ 8
- **Google Chrome** o **Chromium** instalado (para Puppeteer)

### Primer arranque

```bash
# 1. Clonar el repositorio
git clone https://github.com/enrimr/used-items-alert-agent.git
cd used-items-alert-agent

# 2. Instalar dependencias (incluyendo devDependencies)
npm install

# 3. Copiar y configurar el entorno
cp .env.example .env
# Edita .env con tus valores mínimos para desarrollo:
#   KEYWORDS, EMAIL_SMTP_* o RESEND_API_KEY
```

### `.env` mínimo para desarrollo web

```env
BASE_URL=http://localhost:3000
ADMIN_PASSWORD=admin
# Email: elige uno o deja vacío para no enviar emails
RESEND_API_KEY=re_xxxx
RESEND_EMAIL_FROM=test@tudominio.com
```

---

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm start` | CLI en modo bucle continuo (`node index.js`) |
| `npm run once` | CLI en modo búsqueda única (`node index.js --once`) |
| `npm run help` | Muestra la ayuda del CLI |
| `npm run web` | Servidor web + worker en background (`node server.js`) |
| `npm run web:only` | Solo servidor web, sin worker (`node server.js --web`) |
| `npm test` | Ejecuta todos los tests Jest en serie |
| `npm run test:watch` | Tests en modo watch (re-ejecuta al guardar) |
| `npm run test:coverage` | Tests con reporte de cobertura de código |

---

## Arquitectura del sistema

### Modo CLI

```
index.js
  └── src/config.js          ← Carga y valida .env
  └── src/agent.js           ← Bucle de polling con autorrecuperación
        ├── src/browser.js   ← Singleton del navegador Puppeteer (mutex)
        ├── src/scraper.js   ← Intercepta la API de Wallapop con Puppeteer
        ├── src/store.js     ← Historial de items vistos (JSON)
        ├── src/notifier.js  ← Salida en consola + notificaciones de escritorio
        └── src/mailer.js    ← Envío de emails (Resend o SMTP)
```

**Flujo de un ciclo CLI:**

```
1. ensureBrowser()           → crea/reutiliza instancia de Chromium
2. fetchItems(config)        → navega a Wallapop e intercepta /api/v3/search/section
3. store.getNewItems(items)  → filtra los ya vistos
4. printNewItems()           → muestra en consola
5. sendDesktopNotification() → notificación del SO (si hay nuevos)
6. sendAlertEmail()          → email al destinatario CLI (si configurado)
7. store.save()              → persiste en JSON
8. sleep(pollInterval)       → espera hasta el próximo ciclo
```

Cada 5 ciclos (`AGENT_BROWSER_RESTART_CYCLES`) se reinicia el navegador para evitar memory leaks. Tras 5 errores consecutivos (`AGENT_MAX_CONSECUTIVE_ERRORS`), se fuerza también el reinicio.

---

### Modo web

```
server.js
  ├── web/server.js          ← Express: middlewares globales + rutas
  │     ├── web/routes/subscribe.js  ← Rutas públicas
  │     └── web/routes/admin.js      ← Panel /admin (Basic Auth)
  └── web/worker.js          ← Loop de polling para todas las suscripciones
        ├── src/browser.js   ← Mismo singleton que el CLI
        ├── src/scraper.js   ← Mismo scraper
        ├── web/db/          ← Capa de acceso a SQLite
        ├── src/mailer.js    ← Mismo mailer
        └── src/webhook.js   ← Dispatcher de webhooks
```

**Flujo del worker (cada ciclo):**

```
1. getActiveSubscriptions()         → lee la BD SQLite
2. runWithConcurrency(subs, fn, 3)  → procesa N subs en paralelo
   Para cada suscripción:
   a. fetchItems(config)            → scraper Puppeteer
   b. filterNewItems(subId, items)  → elimina ya vistos (SQLite seen_items)
   c. markItemsSeen()               → registra los nuevos como vistos
   d. [si webhook] dispatchWebhook() → POST al webhook URL (async, no bloquea)
   e. [si email inmediato] sendAlertEmail()
      [si daily/weekly] addDigestItems() + shouldSendDigest()
3. Limpiar seen_items antiguos cada 50 ciclos
4. Reiniciar navegador cada 10 ciclos
```

**Concurrencia del worker:**

El worker usa un semáforo manual (`runWithConcurrency`) para limitar cuántas suscripciones se procesan en paralelo. Todas comparten el mismo proceso de Node.js y la misma instancia de Chromium, pero cada suscripción usa su propia `page` de Puppeteer.

```
Ciclo del worker con CONCURRENCY=3 y 7 suscripciones:

  [sub1] [sub2] [sub3]  ← procesando en paralelo
  [sub4] [sub5] [sub6]  ← cuando termina alguna del grupo anterior
  [sub7]                ← última
```

---

### Módulos compartidos

Estos módulos son usados tanto por el CLI como por el servidor web:

| Módulo | Descripción |
|--------|-------------|
| `src/scraper.js` | Scraper Puppeteer. Construye la URL de búsqueda e intercepta la API |
| `src/browser.js` | Singleton del navegador con mutex Promise (evita creaciones concurrentes) |
| `src/mailer.js` | Motor de email unificado. Detecta automáticamente si usar Resend o SMTP |
| `src/categories.js` | Mapa `id → nombre` de categorías de Wallapop |
| `src/constants.js` | Todos los "magic numbers" del sistema |
| `src/utils.js` | `validatePriceRange()` e `isValidEmail()` |
| `src/webhook.js` | `dispatchWebhook()` y `buildPayload()` |

---

## Base de datos

Se usa **SQLite** vía `better-sqlite3` (síncrono). La BD se inicializa automáticamente al arrancar el servidor con migraciones `CREATE TABLE IF NOT EXISTS`.

### Esquema de tablas

```sql
-- Suscripciones de alertas
CREATE TABLE subscriptions (
  id                  TEXT PRIMARY KEY,     -- UUID v4
  email               TEXT NOT NULL,
  keywords            TEXT NOT NULL,
  min_price           REAL,
  max_price           REAL,
  category_id         TEXT DEFAULT '',
  active              INTEGER DEFAULT 1,    -- 0 = soft-deleted
  created_at          INTEGER,              -- timestamp ms
  last_run_at         INTEGER,              -- último ciclo del worker
  emails_sent         INTEGER DEFAULT 0,
  emails_failed       INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0,
  email_frequency     TEXT DEFAULT 'immediate', -- immediate|daily|weekly
  shipping_only       INTEGER DEFAULT 0,
  verified            INTEGER DEFAULT 0,
  verification_token  TEXT,
  last_digest_at      INTEGER,
  webhook_url         TEXT
);

-- Items ya vistos por suscripción (para evitar duplicados)
CREATE TABLE seen_items (
  subscription_id  TEXT NOT NULL,
  item_id          TEXT NOT NULL,
  seen_at          INTEGER,
  PRIMARY KEY (subscription_id, item_id)
);

-- Acumulación de items para resúmenes diarios/semanales
CREATE TABLE digest_store (
  subscription_id  TEXT NOT NULL,
  item_id          TEXT NOT NULL,
  item_json        TEXT NOT NULL,
  added_at         INTEGER,
  PRIMARY KEY (subscription_id, item_id)
);

-- Límites de alertas personalizados por email
CREATE TABLE email_limits (
  email       TEXT PRIMARY KEY,
  max_alerts  INTEGER NOT NULL
);
```

### Capa de acceso a datos (`web/db/`)

Cada módulo gestiona un grupo de operaciones relacionadas:

| Módulo | Responsabilidad |
|--------|----------------|
| `connection.js` | Conexión singleton, migraciones automáticas al arrancar |
| `subscriptions.js` | CRUD completo: crear, leer, actualizar, soft-delete, hard-delete |
| `seen-items.js` | `filterNewItems()`, `markItemsSeen()`, `cleanupOldSeenItems()` |
| `digest.js` | `addDigestItems()`, `getDigestItems()`, `clearDigestItems()` |
| `stats.js` | `getStats()` (KPIs del admin), `getEmailStats()` (por email) |

`web/db.js` re-exporta todo para que los consumidores usen un solo punto de importación:

```javascript
const { createSubscription, getActiveSubscriptions, ... } = require('./db');
```

---

## Sistema de email

### Módulo `src/mailer.js`

El mailer unifica dos transportes bajo la misma API pública:

```
RESEND_API_KEY definida?
  Sí → sendViaResend()  (HTTP nativo, compatible Node 16+)
  No → createSmtpTransporter() + nodemailer
```

#### Funciones públicas

| Función | Descripción |
|---------|-------------|
| `sendAlertEmail(items, config, email, subId, lang)` | Email de alerta con productos nuevos. `subId=null` en CLI (sin link de baja) |
| `sendConfirmationEmail(email, sub, lang)` | Email de confirmación al crear una suscripción |
| `sendVerificationEmail(email, sub, lang)` | Email con link de verificación (si `REQUIRE_EMAIL_VERIFICATION=true`) |
| `sendAdminAlert(email, keywords, count, error)` | Notificación al admin cuando el scraper falla N veces |
| `verifyEmailConfig()` | Verifica la conexión SMTP al arrancar (solo en modo SMTP) |

#### Plantillas de email

Las plantillas están en `web/views/emails/` como HTML con tokens `{{variable}}`:

| Plantilla | Cuándo se usa |
|-----------|--------------|
| `alert.html` | Alerta de nuevos productos |
| `confirmation.html` | Confirmación al suscribirse |
| `verification.html` | Verificación de email |
| `admin-alert.html` | Alerta al administrador por fallos del scraper |

El mailer aplica el tema de color actual (`THEME_COLOR`) a todas las plantillas a través de `src/theme-web.js` → `web/theme.js`.

---

## Internacionalización (i18n)

### Idiomas soportados

| Código | Idioma | Archivo |
|--------|--------|---------|
| `es` | Español (defecto) | `web/i18n/es.js` |
| `en` | English | `web/i18n/en.js` |
| `it` | Italiano | `web/i18n/it.js` |
| `ca` | Català | `web/i18n/ca.js` |

### Middleware

`web/i18n/index.js` exporta `i18nMiddleware` que inyecta en cada petición:
- `req.lang` — código del idioma detectado
- `req.t` — función de traducción `t(key, vars?)`

### Añadir un nuevo idioma

1. Crea `web/i18n/xx.js` (donde `xx` es el código ISO 639-1)
2. Copia la estructura de `web/i18n/en.js` y traduce todos los valores
3. Añade el código al objeto `LOCALES` en `web/i18n/index.js`:
   ```javascript
   const LOCALES = {
     es: require('./es'),
     en: require('./en'),
     it: require('./it'),
     ca: require('./ca'),
     xx: require('./xx'), // ← nuevo idioma
   };
   ```
4. Añade el nombre nativo en `getNativeName()` y la bandera en `buildLangSelector()`

### Añadir una nueva clave de traducción

1. Añade la clave en **todos** los archivos de idioma (`es.js`, `en.js`, `it.js`, `ca.js`)
2. Si una clave no existe en un idioma, el sistema hace fallback a `es.js` (defecto)
3. Si tampoco existe en `es.js`, devuelve la propia clave como texto

---

## Motor de plantillas

`web/views/render.js` implementa un motor de plantillas minimalista basado en sustitución de tokens `{{variable}}`.

### Funciones

```javascript
// Renderiza una plantilla completa con variables
renderTemplate('admin', { primary: '#f97316', title: '...', ... })

// Renderiza un partial (fragmento HTML)
renderPartial('sub-row', { keywords: 'iphone', email: 'user@...' })

// Renderiza una lista de partials (o un mensaje vacío si no hay datos)
renderPartialList('sub-row', subscriptions, mapSubRow, emptyMessage)
```

### Estructura de archivos

```
web/views/
├── admin.html          ← Plantilla completa del panel admin
├── success.html        ← Página de éxito tras suscribirse
├── simple-page.html    ← Página genérica (unsubscribe, verify)
├── emails/
│   ├── alert.html
│   ├── confirmation.html
│   ├── verification.html
│   └── admin-alert.html
└── partials/
    ├── sub-row.html    ← Fila de la tabla de alertas (admin)
    ├── email-row.html  ← Fila de la tabla de usuarios (admin)
    ├── alert-card.html ← Tarjeta de alerta (vista móvil admin)
    ├── users-card.html ← Tarjeta de usuario (vista móvil admin)
    ├── post-btn.html   ← Botón de acción POST (delete, reactivate...)
    └── empty-row.html  ← Fila vacía cuando no hay datos
```

---

## Tests

Los tests están en el directorio `tests/` y usan **Jest** con **supertest** para tests de integración HTTP.

### Ejecutar los tests

```bash
npm test                 # Todos los tests (en serie, --runInBand)
npm run test:watch       # En modo watch
npm run test:coverage    # Con reporte de cobertura HTML
```

### Archivos de test

| Archivo | Qué prueba |
|---------|------------|
| `tests/config.test.js` | Carga y validación de `src/config.js` |
| `tests/categories.test.js` | Estructura de `src/categories.js` |
| `tests/scraper.test.js` | `buildSearchUrl()` y `parseItems()` de `src/scraper.js` |
| `tests/mailer.test.js` | `sendAlertEmail()`, `sendConfirmationEmail()`, etc. |
| `tests/webhook.test.js` | `buildPayload()` y `dispatchWebhook()` |
| `tests/db.test.js` | CRUD completo de `web/db/` con BD en memoria |
| `tests/subscribe.test.js` | Rutas HTTP de `web/routes/subscribe.js` |
| `tests/admin.test.js` | Rutas HTTP del panel `/admin` |
| `tests/theme.test.js` | `getThemeVars()` e `injectTheme()` |
| `tests/integration.test.js` | Flujo completo: suscribir → verificar → desuscribir |

### Configuración de Jest

En `package.json`:

```json
{
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/tests/**/*.test.js"],
    "testTimeout": 10000,
    "coveragePathIgnorePatterns": [
      "src/scraper.js", "src/agent.js", "src/notifier.js",
      "src/store.js", "server.js", "index.js"
    ]
  }
}
```

Los archivos que usan Puppeteer (`scraper.js`, `agent.js`) están excluidos de la cobertura porque requieren un navegador real.

### Notas importantes sobre los tests

- Los tests usan `NODE_ENV=test`, lo que desactiva automáticamente la protección CSRF
- Los tests de BD usan una BD SQLite **en memoria** (`:memory:`) para no contaminar datos de desarrollo
- `--runInBand` ejecuta los tests en serie para evitar conflictos de BD y puertos

---

## Convenciones de código

### Estilo

- **CommonJS** (`require`/`module.exports`) — sin ES modules
- Sin linter configurado (puedes añadir ESLint si contribuyes)
- Comentarios en **español** (comentarios JSDoc en los módulos públicos)
- Strings con comillas simples por convención

### Estructura de módulos

Cada módulo exporta solo lo que necesitan los consumidores. Los detalles de implementación son funciones locales no exportadas.

```javascript
// ── Internals ────────────────────────────────
function internalHelper() { ... }

// ── API pública ───────────────────────────────
function publicFunction() { ... }

module.exports = { publicFunction };
```

### Gestión de errores

- En el **worker**: los errores por suscripción se capturan y logean, pero no detienen el ciclo
- En las **rutas Express**: respuestas JSON `{ error: string }` con código HTTP apropiado
- En el **mailer**: devuelve `false` en caso de fallo (no lanza excepciones al caller)
- En los **webhooks**: devuelve `{ ok: false, error: string }` sin lanzar excepciones

### Logging

El worker y el agente usan prefijos estandarizados en los logs:

```
✓  → Éxito
✗  → Error
🆕 → Nuevos productos detectados
📧 → Email enviado
❌ → Email fallido
⚠️  → Advertencia
🔗 → Webhook
🚨 → Alerta crítica
⏸  → Suscripción omitida
```

---

## Cómo añadir nuevas funcionalidades

### Añadir una nueva variable de entorno

1. Añade la variable en `.env.example` con su descripción y valor por defecto
2. Lee la variable donde sea necesario (con `process.env.MI_VARIABLE || 'default'`)
3. Documéntala en [CONFIGURATION.md](CONFIGURATION.md)

### Añadir una nueva ruta HTTP

1. Crea la función handler en `web/routes/subscribe.js` (rutas públicas) o `web/routes/admin.js` (admin)
2. Añade tests en `tests/subscribe.test.js` o `tests/admin.test.js`
3. Si es una acción destructiva, usa `POST` en vez de `GET`

### Añadir una nueva columna a la BD

1. Añade la columna en `web/db/connection.js` en la sección de migraciones:
   ```javascript
   // Añadir nueva columna si no existe (migración idempotente)
   try {
     db.prepare('ALTER TABLE subscriptions ADD COLUMN nueva_columna TEXT DEFAULT NULL').run();
   } catch (e) { /* ya existe */ }
   ```
2. Actualiza las funciones de `web/db/subscriptions.js` que necesiten leer/escribir la columna
3. Añade tests en `tests/db.test.js`

### Añadir un nuevo idioma de email

Los emails leen las traducciones a través de `getTForLang(lang)` en `src/mailer.js`. Para añadir soporte de email en un nuevo idioma, sigue los pasos de [Añadir un nuevo idioma](#añadir-un-nuevo-idioma) y asegúrate de que los archivos de idioma incluyen todas las claves `email_*`.

### Añadir un nuevo tema de color

1. Añade el nuevo tema en `web/theme.js` en la función `getThemeVars()`:
   ```javascript
   if (theme === 'pink') {
     return { primary: '#ec4899', primaryDark: '#db2777', bg: '#fdf2f8', shadowRgb: '236,72,153' };
   }
   ```
2. Documéntalo en [CONFIGURATION.md](CONFIGURATION.md) y en el README principal
