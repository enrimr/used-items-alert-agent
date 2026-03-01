# 🔍 Used Items Alert Agent

> Monitoriza Wallapop España en busca de nuevas publicaciones y recibe alertas al instante — por CLI, email o interfaz web pública.

![Used Items Alerts Web](docs/screenshot.png)

> **Panel de administración** (`/admin`)
> ![Admin Panel](docs/admin-screenshot.png)

---

## ✨ Características

- 🔎 **Búsqueda por palabras clave** con filtros de precio y categoría
- 🚫 **Filtra automáticamente** productos reservados y vendidos
- 📧 **Alertas por email** con foto, precio, descripción y enlace directo
- 🌐 **Interfaz web** — cualquiera puede suscribirse sin registrarse
- ❌ **Baja con un clic** desde cada email
- 🔗 **Webhooks** — integra con Zapier, n8n, Make, Slack, etc.
- 📅 **Frecuencia configurable** — inmediata, diaria o semanal
- 🚚 **Filtro de envío** — solo productos con opción de envío
- 🌍 **Multiidioma** — español, inglés, italiano y catalán
- 💾 **Historial persistente** — sin alertas duplicadas entre reinicios
- 🛡️ **Autorrecuperación** ante caídas del navegador
- 🔄 **Polling continuo** con intervalo configurable

---

## 🚀 Inicio rápido

```bash
# Clonar e instalar
git clone https://github.com/enrimr/used-items-alert-agent.git
cd used-items-alert-agent
npm install

# Configurar
cp .env.example .env
# Edita .env con tus ajustes
```

---

## 🖥️ Modo 1 — CLI (uso personal)

Monitoriza Wallapop desde el terminal para tus propias búsquedas.

```bash
npm start              # Bucle continuo de monitorización
npm run once           # Búsqueda única
node index.js --help   # Muestra la ayuda
```

**Configura `.env`:**
```env
KEYWORDS=iphone 13
MIN_PRICE=100
MAX_PRICE=500
CATEGORY_ID=12579       # Opcional — ver tabla de categorías abajo
POLL_INTERVAL_SECONDS=90
```

---

## 🌐 Modo 2 — Servidor web (servicio público)

Levanta una interfaz web donde cualquier persona puede crear sus propias alertas de Wallapop.

```bash
npm run web         # Servidor web + worker en segundo plano
npm run web:only    # Solo el servidor web (sin worker)
```

**Cómo funciona:**
1. El usuario rellena el formulario (palabras clave, precio, categoría, email)
2. La alerta se guarda en SQLite — sin necesidad de cuenta
3. El worker comprueba Wallapop cada N minutos para cada suscripción
4. Nuevos productos → email HTML con enlace de cancelación
5. El usuario hace clic en "❌ Eliminar esta alerta" → alerta eliminada

**Configura `.env` para web:**
```env
WEB_PORT=3000
BASE_URL=http://localhost:3000   # Tu dominio público en producción
WORKER_INTERVAL_SECONDS=120
EMAIL_FROM=noreply@tudominio.com
RESEND_API_KEY=re_xxxx           # Recomendado (ver abajo)
```

---

## 🏷️ IDs de categoría

| ID | Categoría |
|----|-----------|
| `12465` | Tecnología |
| `12579` | Móviles y telefonía |
| `15000` | Informática |
| `12545` | Moda y accesorios |
| `12543` | Motor |
| `12463` | Deporte y ocio |
| `12459` | Hogar y jardín |
| `12467` | Televisión y audio |
| `12461` | Consolas y videojuegos |
| `12473` | Cámaras y fotografía |
| `14000` | Coleccionismo |
| `12449` | Libros y música |
| `12469` | Bebés y niños |
| `12471` | Otros |

---

## 🏗️ Estructura del proyecto

```
used-items-alert-agent/
│
├── index.js              # Punto de entrada CLI
├── server.js             # Punto de entrada web
│
├── src/
│   ├── agent.js          # Bucle de polling CLI con autorrecuperación
│   ├── scraper.js        # Scraper Puppeteer (intercepta /api/v3/search/section)
│   ├── config.js         # Carga y valida .env (modo CLI)
│   ├── store.js          # Store en memoria + persistencia JSON (CLI)
│   ├── browser.js        # Ciclo de vida del navegador (singleton + mutex)
│   ├── mailer.js         # Motor de email unificado (Resend + SMTP)
│   ├── webhook.js        # Dispatcher de webhooks HTTP
│   ├── notifier.js       # Salida en consola + notificaciones de escritorio
│   ├── categories.js     # IDs de categorías de Wallapop España
│   ├── constants.js      # Constantes compartidas (timeouts, ciclos, etc.)
│   ├── theme-web.js      # Puente para acceder al tema desde el mailer CLI
│   └── utils.js          # Utilidades compartidas (validaciones)
│
├── web/
│   ├── server.js         # Express: monta rutas y middlewares globales
│   ├── worker.js         # Worker de fondo: procesa todas las suscripciones
│   ├── theme.js          # Paletas de color configurable (THEME_COLOR)
│   ├── helpers.js        # Helpers Express (escapeHtml, renderSimplePage)
│   ├── db.js             # Re-exporta todos los módulos de BD
│   ├── routes/
│   │   ├── subscribe.js  # Rutas públicas: /, /subscribe, /unsubscribe, /verify
│   │   └── admin.js      # Panel /admin (autenticado con Basic Auth)
│   ├── db/
│   │   ├── connection.js # Conexión SQLite + migraciones automáticas
│   │   ├── subscriptions.js # CRUD de suscripciones
│   │   ├── seen-items.js # Items ya vistos por suscripción
│   │   ├── digest.js     # Acumulación persistente para emails diarios/semanales
│   │   └── stats.js      # Estadísticas para el dashboard admin
│   ├── i18n/
│   │   ├── index.js      # Middleware i18n, detección de idioma
│   │   ├── es.js         # Traducciones español
│   │   ├── en.js         # Traducciones inglés
│   │   ├── it.js         # Traducciones italiano
│   │   └── ca.js         # Traducciones catalán
│   ├── views/
│   │   ├── render.js     # Motor de plantillas (reemplaza {{tokens}})
│   │   ├── admin.html    # Dashboard de administración
│   │   ├── success.html  # Página de confirmación de suscripción
│   │   ├── simple-page.html # Página genérica (unsubscribe, verify, etc.)
│   │   ├── emails/       # Plantillas HTML de email
│   │   └── partials/     # Fragmentos HTML reutilizables
│   └── public/
│       ├── index.html    # Formulario público (HTML/CSS/JS puro)
│       ├── index.css     # Estilos del formulario
│       └── admin.css     # Estilos del panel admin
│
├── tests/                # Suite de tests Jest
├── docs/                 # Documentación y capturas
├── .env.example          # Plantilla de configuración
├── Dockerfile            # Imagen Docker (Node 18 + Chromium)
└── LICENSE               # MIT
```

---

## 📚 Documentación completa

| Documento | Descripción |
|-----------|-------------|
| [CONFIGURATION.md](docs/CONFIGURATION.md) | Referencia completa de todas las variables de entorno |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Railway, Render, Docker, auto-hospedaje |
| [SECURITY.md](docs/SECURITY.md) | CSRF, rate limiting, autenticación, buenas prácticas |
| [WEBHOOKS.md](docs/WEBHOOKS.md) | Integración con Zapier, n8n, Make, Slack y más |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Arquitectura, tests, cómo contribuir |

---

## 📧 Configuración de email

### Opción 1: Resend (recomendado en producción)

[Resend](https://resend.com) ofrece 3 000 emails/mes gratuitos y **no usa SMTP** (compatble con Railway y Render que bloquean puertos SMTP).

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_EMAIL_FROM=alertas@tudominio.com   # Debe estar verificado en resend.com
```

### Opción 2: Gmail (uso local)

1. Activa la verificación en dos pasos en tu cuenta Google
2. Ve a https://myaccount.google.com/apppasswords
3. Crea una contraseña de aplicación para "Correo"
4. Úsala en `EMAIL_SMTP_PASS`

```env
EMAIL_FROM=tuemail@gmail.com
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_USER=tuemail@gmail.com
EMAIL_SMTP_PASS=xxxx xxxx xxxx xxxx
```

---

## 🔧 Panel de administración

Accede al dashboard en `/admin` (protegido con `ADMIN_PASSWORD`).

**Funcionalidades:**
- 📊 **8 KPIs**: alertas activas/totales, usuarios, emails enviados/fallidos, tasa de éxito, % eliminadas, productos procesados
- 📧 **Gestión de usuarios**: ver alertas por email, ajustar límites individuales
- 🔔 **Tabla de alertas**: búsqueda, filtros, edición inline de palabras clave/precio/categoría/frecuencia
- 🔗 **Webhooks**: configurar/eliminar webhook URL por alerta desde el panel
- ♻️ **Reactivar** alertas desactivadas con un clic
- 🗑️ **Borrado permanente** con doble confirmación
- 📄 **Paginación** en ambas tablas (10 filas/página)

```env
ADMIN_PASSWORD=tucontraseña_segura
MAX_ALERTS_PER_EMAIL=10
```

---

## 🎨 Temas de color

```env
THEME_COLOR=orange   # orange | teal | purple | blue | neutral
```

| Valor | Color |
|-------|-------|
| `orange` | Naranja cálido *(por defecto)* |
| `teal` | Verde azulado |
| `purple` | Violeta/índigo |
| `blue` | Azul cielo |
| `neutral` | Gris pizarra |

El tema se aplica al formulario web, panel admin y plantillas de email.

---

## ⚠️ Notas

- Usa Puppeteer (navegador headless) para sortear la protección CloudFront de Wallapop
- Intervalo mínimo recomendado: 60-90 segundos
- El worker procesa suscripciones en paralelo (por defecto: 3 simultáneas) — configurable con `WORKER_CONCURRENCY`
- Los items del digest (diario/semanal) se persisten en SQLite y sobreviven a reinicios del servidor

---

## 📄 Licencia

MIT © [Enrique Mendoza](https://github.com/enrimr)

*Si usas este proyecto, ¡se agradece una mención o estrella ⭐!*
