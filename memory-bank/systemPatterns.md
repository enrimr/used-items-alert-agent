# System Patterns — Used Items Alert Agent

Catálogo de patrones arquitectónicos y de implementación usados en el proyecto.
Sirve de referencia para mantener la consistencia al añadir nueva funcionalidad.

---

## 1. Patrón de módulo (CommonJS)

Cada módulo tiene dos zonas claramente separadas:

```javascript
// ── Internals ────────────────────────────────────────────────────────────────
function internalHelper(x) { /* lógica privada */ }

// ── API pública ───────────────────────────────────────────────────────────────
/**
 * @param {string} param - descripción
 * @returns {boolean}
 */
function publicFunction(param) {
  return internalHelper(param);
}

module.exports = { publicFunction };
```

**Regla**: solo se exporta lo que el consumidor necesita. Las funciones internas
no se exportan nunca.

---

## 2. Capa de datos — Módulo por responsabilidad

La BD nunca se accede directamente desde rutas o el worker.
Se delega siempre en `web/db/`:

```
web/db/connection.js   → getDb() — singleton SQLite + migraciones
web/db/subscriptions.js → createSubscription, getActiveSubscriptions, ...
web/db/seen-items.js    → filterNewItems, markItemsSeen, cleanupOldSeenItems
web/db/digest.js        → addDigestItems, getDigestItems, clearDigestItems
web/db/stats.js         → getStats, getEmailStats
web/db/index.js         → re-exporta todo
web/db.js               → punto de entrada público: const db = require('./db')
```

**Regla de migraciones idempotentes**:
```javascript
// En initSchema() de connection.js
const migrations = [
  'ALTER TABLE subscriptions ADD COLUMN nueva_col TEXT DEFAULT NULL',
];
for (const sql of migrations) {
  try { getDb().exec(sql); } catch (e) { /* columna ya existe */ }
}
```

---

## 3. Motor de email — Transporte unificado

`src/mailer.js` detecta automáticamente el transporte en tiempo de ejecución:

```
RESEND_API_KEY definida?
  Sí → sendViaResend()   (HTTP puro, compatible Railway/Render)
  No → createSmtpTransporter() + nodemailer
```

**Contrato de las funciones públicas**:
- Siempre devuelven `true` en éxito o `false` en fallo.
- Nunca lanzan excepciones al caller.
- Leen el tema activo via `injectTheme()` para colorear las plantillas.

---

## 4. Motor de plantillas — Tokens `{{variable}}`

`web/views/render.js` sustituye tokens en HTML:

```javascript
// Plantilla completa
renderTemplate('admin', { primary: '#f97316', title: 'Admin', rows: '...' })

// Fragmento (partial)
renderPartial('sub-row', { keywords: 'iphone', email: 'user@x.com' })

// Lista con mensaje vacío automático
renderPartialList('sub-row', items, mapFn, t('admin_empty_alerts'))
```

Ficheros en `web/views/partials/` — uno por componente UI reutilizable.

---

## 5. Internacionalización (i18n)

**Middleware Express**:
```javascript
app.use(i18nMiddleware);   // inyecta req.lang y req.t
```

**Detección de idioma** (por prioridad):
1. Query param `?lang=xx`
2. Cookie `lang`
3. Header `Accept-Language`
4. `DEFAULT_LANG` (defecto: `es`)

**Función de traducción**:
```javascript
const t = req.t;
t('btn_submit')                            // → texto simple
t('api_limit_reached', { limit: 5 })      // → interpolación con {var}
```

**Uso standalone** (fuera de req, e.g. mailer):
```javascript
const { getT } = require('../i18n');
const t = getT('en');
```

**Namespacing de claves**:
| Prefijo | Área |
|---------|------|
| `page_` | Meta de página (title, description) |
| `label_` | Etiquetas de formulario |
| `btn_` | Botones |
| `error_` | Errores de UI |
| `api_` | Respuestas de error de API |
| `email_` | Asuntos y cuerpos de email |
| `admin_` | Panel de administración |
| `cat_` | Nombres de categorías |

---

## 6. Patrón de rutas Express

Las rutas solo hacen:
1. Validar entrada (con `isValidEmail`, `validatePriceRange`, etc.)
2. Llamar a la capa de datos o servicio
3. Responder con JSON o HTML

```javascript
// ✅ Correcto
router.post('/subscribe', async (req, res) => {
  const { email, keywords } = req.body;
  if (!isValidEmail(email)) return res.status(400).json({ error: t('api_email_invalid') });
  const sub = createSubscription({ email, keywords, ... });
  return res.json({ id: sub.id });
});

// ❌ Incorrecto — lógica de negocio en la ruta
router.post('/subscribe', async (req, res) => {
  // No poner aquí: consultas directas a BD, lógica de deduplicación, etc.
});
```

---

## 7. Patrón worker — Resiliencia por suscripción

Cada suscripción se procesa de forma independiente con `try/catch`:

```javascript
for (const sub of subs) {
  try {
    const { items } = await scraper.fetchItems(config, page);
    const newItems  = filterNewItems(sub.id, items);
    // ... procesar newItems
    errorCounts.set(sub.id, 0);
  } catch (err) {
    const count = (errorCounts.get(sub.id) || 0) + 1;
    errorCounts.set(sub.id, count);
    if (count === SCRAPER_FAILURE_THRESHOLD) {
      await mailer.sendAdminAlert(sub.email, sub.keywords, count, err.message);
    }
    // ⚠️ No relanzar: el bucle continúa con la siguiente suscripción
  }
}
```

---

## 8. Webhook dispatcher — Retry con back-off exponencial

```javascript
// src/webhook.js
for (let attempt = 1; attempt <= WEBHOOK_MAX_RETRIES + 1; attempt++) {
  try {
    const result = await postJson(url, body);
    if (result.status >= 200 && result.status < 300) return { ok: true };
    if (result.status >= 400 && result.status < 500) break; // no reintentar 4xx
  } catch (err) { lastError = err.message; }
  if (attempt <= WEBHOOK_MAX_RETRIES) await sleep(1000 * attempt); // 1s, 2s
}
return { ok: false, error: lastError };
```

Payload estándar enviado a todos los webhooks:
```json
{
  "event": "new_items",
  "subscription_id": "uuid",
  "keywords": "iphone 13",
  "timestamp": "2026-01-03T12:00:00.000Z",
  "items_count": 3,
  "items": [{ "id", "title", "price", "currency", "url", "image", "location" }]
}
```

---

## 9. Singleton del navegador — Mutex Promise

`src/browser.js` garantiza una única instancia de Chromium compartida:

```javascript
let browserInstance = null;
let launchMutex     = null;   // Promise pendiente si hay un lanzamiento en curso

async function ensureBrowser() {
  if (browserInstance) return browserInstance;
  if (launchMutex)     return launchMutex;
  launchMutex = doLaunch().finally(() => { launchMutex = null; });
  return launchMutex;
}
```

Se reinicia periódicamente (cada N ciclos) para evitar memory leaks de Chromium.

---

## 10. Concurrencia del worker — Semáforo manual

```javascript
async function runWithConcurrency(items, fn, limit) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const p = fn(item).finally(() => executing.delete(p));
    executing.add(p);
    results.push(p);
    if (executing.size >= limit) await Promise.race(executing);
  }
  return Promise.all(results);
}
```

---

## 11. Gestión del tema de color

```
web/theme.js → getThemeVars(color)   // { primary, primaryDark, bg, shadowRgb }
src/theme-web.js → injectTheme(html) // lee THEME_COLOR y aplica tokens al HTML
```

Los tokens de tema (`{{primary}}`, `{{primaryDark}}`, etc.) se usan en todas las
plantillas HTML y emails. El mailer los inyecta automáticamente al renderizar.

---

## 12. Patrón BDD en tests

```javascript
// tests/xxx.test.js

jest.mock('../src/mailer');    // mocks primero, antes de imports

const { app }   = require('../web/server');
const request   = require('supertest');

describe('Flujo N: <nombre descriptivo>', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // configurar estado limpio por test
  });

  test('N.1 <condición inicial> → <resultado esperado>', async () => {
    // Arrange
    // Act
    // Assert
  });

  test('N.2 error/edge case → comportamiento esperado', async () => { ... });
});
```

**BD de test**:
```javascript
// Al principio del fichero, antes de require('../web/db')
const TEST_DB = path.join(os.tmpdir(), `test-${Date.now()}.db`);
process.env.DB_PATH = TEST_DB;
// En afterAll:
afterAll(() => { try { fs.unlinkSync(TEST_DB); } catch (e) {} });
```

---

## 13. Logging estandarizado

```javascript
console.log('✓  Alerta enviada a', email);
console.error('✗  Error en scraper:', err.message);
console.log('🆕 3 nuevos items encontrados para', sub.keywords);
console.log('📧 Email enviado a', email);
console.error('❌ Fallo email para', email, ':', err.message);
console.warn('⚠️  Suscripción con errores consecutivos:', sub.id);
console.log('🔗 Webhook OK:', webhookUrl);
console.error('🚨 Alerta crítica: scraper fallando', count, 'veces');
console.log('⏸  Suscripción no verificada, omitida:', sub.id);
```

---

## 14. Validaciones de entrada

Siempre usar las utilidades de `src/utils.js` antes de insertar en BD:

```javascript
const { isValidEmail, validatePriceRange } = require('../utils');

if (!isValidEmail(email)) return res.status(400).json({ error: t('api_email_invalid') });

const priceCheck = validatePriceRange(minPrice, maxPrice);
if (!priceCheck.ok) return res.status(400).json({ error: t('api_price_min_max') });
```

---

## 15. Escape HTML — Seguridad XSS

```javascript
const { escapeHtml } = require('../helpers');

// En cualquier dato de usuario que se inserte en HTML:
const safeKeywords = escapeHtml(sub.keywords);
```

**Regla**: nunca interpolar directamente datos del usuario en HTML.
Siempre pasar por `escapeHtml()` antes de usar en plantillas.
