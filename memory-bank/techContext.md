# Tech Context — Used Items Alert Agent

## Stack técnico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Runtime | Node.js | ≥ 16 (recomendado 18 LTS) |
| Framework web | Express | ^4.22 |
| BD | SQLite via better-sqlite3 | ^9.6 (síncrono) |
| Scraper | Puppeteer | ^19 |
| Email | Resend API o Nodemailer (SMTP) | resend ^6, nodemailer ^8 |
| HTTP client | Axios | ^1.6 |
| CSRF | csrf-csrf | ^4 |
| Rate limit | express-rate-limit | ^8 |
| IDs | uuid v4 | ^8 |
| Tests | Jest + supertest | jest ^29, supertest ^7 |
| Módulos | CommonJS (`require`/`module.exports`) | — |
| Contenedor | Docker (node:18-slim + chromium) | — |
| Despliegue | Railway / Render / Docker self-hosted | — |

## Estructura de directorios

```
wallapop/
├── index.js              # Entry-point CLI
├── server.js             # Entry-point web
├── src/                  # Módulos compartidos CLI + web
│   ├── agent.js          # Loop de polling CLI con autorrecuperación
│   ├── browser.js        # Singleton Puppeteer + mutex
│   ├── categories.js     # IDs de categorías Wallapop España
│   ├── config.js         # Carga/valida .env (modo CLI)
│   ├── constants.js      # Magic numbers centralizados
│   ├── mailer.js         # Motor email unificado (Resend o SMTP)
│   ├── notifier.js       # Consola + desktop notifications
│   ├── scraper.js        # Intercepta /api/v3/search/section
│   ├── store.js          # Historial JSON en disco (CLI)
│   ├── theme-web.js      # Puente CLI → web/theme.js
│   ├── utils.js          # isValidEmail, validatePriceRange
│   └── webhook.js        # dispatchWebhook + buildPayload
├── web/                  # Módulos exclusivos del servidor web
│   ├── db.js             # Re-exporta web/db/* (punto de entrada único)
│   ├── helpers.js        # escapeHtml, renderSimplePage
│   ├── server.js         # Express: middlewares + rutas
│   ├── theme.js          # Paletas de color (getThemeVars)
│   ├── worker.js         # Loop de polling para suscripciones
│   ├── db/               # Capa de datos por responsabilidad
│   │   ├── connection.js # Singleton SQLite + migraciones
│   │   ├── subscriptions.js
│   │   ├── seen-items.js
│   │   ├── digest.js
│   │   ├── stats.js
│   │   └── index.js
│   ├── i18n/             # Internacionalización
│   │   ├── index.js      # Middleware + getT + buildLangSelector
│   │   ├── es.js, en.js, it.js, ca.js
│   ├── routes/
│   │   ├── subscribe.js  # GET /, POST /subscribe, GET /unsubscribe/:id, GET /verify/:token
│   │   └── admin.js      # /admin/* (Basic Auth)
│   ├── views/
│   │   ├── render.js     # Motor de plantillas {{token}}
│   │   ├── *.html        # Páginas completas
│   │   ├── emails/       # Plantillas HTML de email
│   │   └── partials/     # Fragmentos reutilizables
│   └── public/           # Estáticos: HTML/CSS/JS del cliente
├── tests/                # Jest tests (10 ficheros)
├── docs/                 # Markdown: CONFIGURATION, DEVELOPMENT,
│                         #           DEPLOYMENT, SECURITY, WEBHOOKS
├── .env.example          # Plantilla de variables de entorno
├── Dockerfile
├── nixpacks.toml
└── railway.json
```

## Variables de entorno clave

### Modo CLI
| Variable | Defecto | Descripción |
|----------|---------|-------------|
| `KEYWORDS` | — | **Requerida**. Palabras clave de búsqueda |
| `MIN_PRICE` / `MAX_PRICE` | null | Rango de precio |
| `CATEGORY_ID` | '' | ID de categoría Wallapop |
| `POLL_INTERVAL_SECONDS` | 90 | Intervalo entre ciclos (mín. 30s) |
| `MAX_RESULTS` | 40 | Resultados por búsqueda (máx. 100) |
| `HEADLESS` | true | Puppeteer headless |

### Modo web
| Variable | Defecto | Descripción |
|----------|---------|-------------|
| `WEB_PORT` | 3000 | Puerto Express |
| `BASE_URL` | http://localhost:3000 | URL pública (para links en emails) |
| `ADMIN_PASSWORD` | — | Contraseña panel /admin (Basic Auth) |
| `WORKER_INTERVAL_SECONDS` | 120 | Intervalo del worker |
| `WORKER_CONCURRENCY` | 3 | Suscripciones en paralelo |
| `DB_PATH` | ./data/alerts.db | Ruta al fichero SQLite |
| `MAX_ALERTS_PER_EMAIL` | 10 | Límite de alertas por email |
| `REQUIRE_EMAIL_VERIFICATION` | false | Exige verificar email al suscribirse |
| `THEME_COLOR` | orange | Tema visual (orange/teal/purple/blue/neutral) |
| `DEFAULT_LANG` | es | Idioma por defecto |

### Email
| Variable | Defecto | Descripción |
|----------|---------|-------------|
| `RESEND_API_KEY` | — | API key de Resend (prioritario sobre SMTP) |
| `RESEND_EMAIL_FROM` | — | Remitente Resend (debe estar verificado) |
| `EMAIL_FROM` | — | Remitente SMTP |
| `EMAIL_SMTP_HOST/PORT/SECURE/USER/PASS` | — | Config SMTP |
| `ADMIN_EMAIL` | — | Email del admin para alertas críticas |

### Webhooks
| Variable | Defecto | Descripción |
|----------|---------|-------------|
| `WEBHOOK_TIMEOUT_MS` | 8000 | Timeout por intento |
| `WEBHOOK_MAX_RETRIES` | 2 | Reintentos con back-off exponencial |

## Esquema de BD (SQLite)

```sql
subscriptions   -- alertas: email, keywords, precio, categoría, frecuencia...
seen_items      -- (subscription_id, item_id) → deduplicación
digest_store    -- items acumulados para resúmenes diarios/semanales
email_limits    -- límites personalizados por email
```

## Seguridad
- CSRF con `csrf-csrf` (desactivado automáticamente en `NODE_ENV=test`)
- Rate limiting con `express-rate-limit` en endpoints públicos
- Basic Auth en `/admin` (contraseña en tiempo constante para evitar timing attacks)
- Escape HTML via `escapeHtml()` en todos los datos de usuario
- `.env` en `.gitignore`, nunca commiteado

## Tests
- Framework: Jest + supertest (sin levantar servidor real)
- BD de test: SQLite en `:memory:` o `os.tmpdir()`
- Mocks: `jest.mock()` para mailer, scraper, webhooks
- Cobertura mínima: 80% en statements/branches/functions/lines
- Excluidos: `scraper.js`, `agent.js`, `notifier.js`, `store.js`, `server.js`, `index.js`
- Ejecución: `--runInBand` (serie, evita conflictos de BD/puerto)
