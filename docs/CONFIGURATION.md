# ⚙️ Referencia de configuración

Todas las variables de entorno que acepta la aplicación, con su valor por defecto, modo de uso y descripción detallada.

Copia `.env.example` como punto de partida:

```bash
cp .env.example .env
```

---

## Índice

- [Búsqueda (CLI)](#búsqueda-cli)
- [Notificaciones (CLI)](#notificaciones-cli)
- [Email](#email)
- [Servidor web](#servidor-web)
- [Worker](#worker)
- [Base de datos](#base-de-datos)
- [Administración](#administración)
- [Idioma y tema](#idioma-y-tema)
- [Seguridad](#seguridad)
- [Integración](#integración)
- [Constantes internas](#constantes-internas)

---

## Búsqueda (CLI)

Variables usadas exclusivamente en el modo CLI (`npm start` / `node index.js`).

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `KEYWORDS` | *(requerido)* | Palabras clave de búsqueda. Ejemplo: `iphone 13` |
| `MIN_PRICE` | — | Precio mínimo en euros. Dejar vacío para sin límite inferior |
| `MAX_PRICE` | — | Precio máximo en euros. Dejar vacío para sin límite superior |
| `CATEGORY_ID` | — | ID de categoría de Wallapop (ver tabla abajo). Vacío = todas |
| `POLL_INTERVAL_SECONDS` | `90` | Segundos entre búsquedas. Mínimo aplicado: `30` |
| `MAX_RESULTS` | `40` | Máximo de resultados por búsqueda. Rango: 1–100 |
| `HEADLESS` | `true` | `true` = navegador sin ventana. `false` = visible (útil para depurar) |

### IDs de categoría disponibles

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

## Notificaciones (CLI)

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `DESKTOP_NOTIFICATIONS` | `true` | Notificaciones de escritorio del sistema operativo al encontrar nuevos productos |
| `SAVE_TO_FILE` | `true` | Guarda los productos encontrados en un archivo JSON |
| `OUTPUT_FILE` | `./encontrados.json` | Ruta del archivo JSON de salida |

> **Nota:** El archivo JSON actúa como historial persistente entre reinicios del CLI: los productos ya guardados no vuelven a notificarse.

---

## Email

El sistema detecta automáticamente el transporte a usar en este orden de prioridad:
1. **Resend** si `RESEND_API_KEY` está definida
2. **SMTP** si `EMAIL_SMTP_HOST` + `EMAIL_SMTP_USER` + `EMAIL_SMTP_PASS` están definidas
3. Sin email si ninguno está configurado

### Variables comunes

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `EMAIL_FROM` | — | Dirección remitente genérica. Usada como fallback si no se especifica `RESEND_EMAIL_FROM` |
| `EMAIL_TO` | — | Destinatario de alertas en **modo CLI** únicamente |

### Opción 1 — Resend (recomendado en producción)

Resend es una API HTTP de email que **no usa puertos SMTP**, por lo que funciona perfectamente en Railway y Render (que bloquean los puertos 587/465). Ofrece **3 000 emails/mes gratuitos**.

Registro: https://resend.com

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `RESEND_API_KEY` | — | API key de Resend. Formato: `re_xxxxxxxxxxxxxxxxxxxx` |
| `RESEND_EMAIL_FROM` | valor de `EMAIL_FROM` | Dirección remitente verificada en Resend. Obligatorio verificar el dominio en el panel de Resend |

### Opción 2 — SMTP

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `EMAIL_SMTP_HOST` | — | Servidor SMTP. Ejemplo: `smtp.gmail.com` |
| `EMAIL_SMTP_PORT` | `587` | Puerto SMTP. `587` para STARTTLS, `465` para SSL |
| `EMAIL_SMTP_SECURE` | `false` | `true` solo para puerto 465 (SSL directo) |
| `EMAIL_SMTP_USER` | — | Usuario SMTP (normalmente la dirección de email) |
| `EMAIL_SMTP_PASS` | — | Contraseña SMTP o contraseña de aplicación |

#### Configurar Gmail

1. Activa **Verificación en dos pasos** en https://myaccount.google.com/security
2. Ve a https://myaccount.google.com/apppasswords
3. Crea una contraseña de aplicación para "Correo"
4. Usa esa contraseña de 16 caracteres en `EMAIL_SMTP_PASS`

```env
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_USER=tuemail@gmail.com
EMAIL_SMTP_PASS=xxxx xxxx xxxx xxxx
```

---

## Servidor web

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `WEB_PORT` | `3000` | Puerto del servidor Express. Railway sobreescribe esto automáticamente con `PORT` |
| `BASE_URL` | `http://localhost:3000` | URL pública del servidor. **Imprescindible** en producción para los links de cancelación en los emails |

> ⚠️ Si `BASE_URL` es incorrecto, los links de "Eliminar alerta" en los emails llevarán a una URL inexistente.

### Ejemplos de `BASE_URL`

```env
# Desarrollo local
BASE_URL=http://localhost:3000

# Railway
BASE_URL=https://miapp.up.railway.app

# Dominio propio
BASE_URL=https://alertas.midominio.com
```

---

## Worker

El worker es el proceso de fondo que comprueba Wallapop periódicamente para cada suscripción activa.

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `WORKER_INTERVAL_SECONDS` | `120` | Segundos entre ciclos del worker. Cada ciclo procesa todas las suscripciones activas |
| `WORKER_CONCURRENCY` | `3` | Número de suscripciones procesadas en paralelo. Aumentar para más usuarios, reducir para ahorrar memoria RAM |

### Frecuencias de email por suscripción

Cada suscripción puede tener su propia frecuencia de envío:

| Valor | Comportamiento |
|-------|---------------|
| `immediate` | Envía email en cuanto se detectan nuevos productos (por defecto) |
| `daily` | Acumula productos durante 24 horas y envía un resumen diario |
| `weekly` | Acumula productos durante 7 días y envía un resumen semanal |

Los productos acumulados para digest se persisten en SQLite (`digest_store`), por lo que sobreviven a reinicios del servidor.

---

## Base de datos

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `DB_PATH` | `./data/alerts.db` | Ruta del archivo SQLite. En Railway/Render, usa la ruta del volumen persistente: `/data/alerts.db` |

> ⚠️ **En Railway y Render**, el sistema de archivos es efímero. Si no configuras un volumen persistente y apuntas `DB_PATH` a su ruta de montaje, **perderás todas las suscripciones en cada despliegue**. Ver [DEPLOYMENT.md](DEPLOYMENT.md).

### Chromium en entornos Docker

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `PUPPETEER_EXECUTABLE_PATH` | *(auto)* | Ruta al ejecutable de Chrome/Chromium. Se configura automáticamente en el Dockerfile |
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` | `false` | `true` en Docker/Railway para usar el Chromium del sistema en vez de descargar uno extra |

---

## Administración

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `ADMIN_PASSWORD` | — | Contraseña para acceder a `/admin`. Si se deja vacía, el panel está **deshabilitado** |
| `MAX_ALERTS_PER_EMAIL` | `10` | Límite global de alertas activas por dirección de email. Se puede sobrescribir por email individual desde el panel admin |
| `EMAIL_FAILURE_THRESHOLD` | `5` | Número de fallos de entrega de email consecutivos antes de desactivar automáticamente **todas** las alertas de ese email |
| `SCRAPER_FAILURE_THRESHOLD` | `3` | Número de fallos consecutivos del scraper para una suscripción antes de enviar una alerta al administrador |
| `ADMIN_EMAIL` | — | Email del administrador del sitio que recibe las alertas de fallos del scraper. Dejar vacío para deshabilitar |

### Auto-desactivación por fallos de email

Cuando `consecutive_failures` alcanza `EMAIL_FAILURE_THRESHOLD`, el sistema desactiva **automáticamente** todas las alertas activas de ese email para evitar reintentos inútiles. Las alertas pueden reactivarse manualmente desde el panel `/admin`.

```
❌ [user@example.com] "ps5" → email FALLÓ
⚠️ Auto-desactivadas 2 alerta(s) de user@example.com tras 5 fallos consecutivos
```

### Alertas de scraper al admin

Cuando el scraper falla `SCRAPER_FAILURE_THRESHOLD` veces consecutivas para la misma suscripción, se envía **una sola** notificación a `ADMIN_EMAIL`. El contador se resetea automáticamente cuando la suscripción procesa con éxito.

---

## Idioma y tema

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `DEFAULT_LANG` | `es` | Idioma por defecto del sitio web. Opciones: `es` `en` `it` `ca` |
| `THEME_COLOR` | `orange` | Paleta de colores. Opciones: `orange` `teal` `purple` `blue` `neutral` |

### Detección de idioma por usuario

El idioma se detecta en este orden de prioridad para cada petición:
1. Query param `?lang=xx` → se guarda en cookie durante 1 año
2. Cookie `lang`
3. Cabecera `Accept-Language` del navegador
4. `DEFAULT_LANG` como fallback

El idioma detectado se usa también para los emails enviados al usuario (alertas, confirmaciones, verificación).

---

## Seguridad

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `CSRF_ENABLED` | `false` | Activa la protección CSRF en formularios HTML. Recomendado `true` en producción. Se desactiva automáticamente en `NODE_ENV=test` |
| `CSRF_SECRET` | `wallapop-csrf-secret-dev-change-in-prod` | Secreto para firmar los tokens CSRF. **Cambiar obligatoriamente en producción** |
| `REQUIRE_EMAIL_VERIFICATION` | `false` | Exige que el usuario confirme su email antes de activar la alerta. Previene el abuso con emails ajenos |
| `GLOBAL_RATE_LIMIT` | `300` | Máximo de peticiones por IP en una ventana de 15 minutos (global). El endpoint `/subscribe` tiene además su propio límite de 5 peticiones/15 min |

> Ver [SECURITY.md](SECURITY.md) para la guía completa de seguridad.

---

## Integración

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `ADSENSE_CLIENT_ID` | — | ID de publicador de Google AdSense (formato: `ca-pub-XXXXXXXXXXXXXXXXX`). Si se deja vacío, no se inserta ningún script |
| `WEBHOOK_TIMEOUT_MS` | `8000` | Tiempo máximo de espera (ms) para que responda un webhook |
| `WEBHOOK_MAX_RETRIES` | `2` | Número de reintentos ante fallos del webhook (con backoff exponencial: 1s, 2s) |

> Ver [WEBHOOKS.md](WEBHOOKS.md) para la guía completa de webhooks.

---

## Constantes internas

Estas constantes se definen en `src/constants.js` y no se exponen como variables de entorno. Se pueden modificar directamente en el código si es necesario ajustarlas.

| Constante | Valor | Descripción |
|-----------|-------|-------------|
| `SCRAPER_API_TIMEOUT_MS` | `40 000` | Tiempo máximo (ms) esperando la respuesta de la API de Wallapop |
| `SCRAPER_NAV_TIMEOUT_MS` | `50 000` | Tiempo máximo (ms) para la navegación de Puppeteer |
| `SCRAPER_MAX_IMAGES` | `3` | Número máximo de imágenes por producto que se extraen |
| `AGENT_BROWSER_RESTART_CYCLES` | `5` | Cada cuántos ciclos se reinicia el navegador en modo CLI |
| `AGENT_MAX_CONSECUTIVE_ERRORS` | `5` | Errores consecutivos que disparan el reinicio forzado del navegador (CLI) |
| `AGENT_CLEANUP_CYCLES` | `100` | Cada cuántos ciclos se limpian los items antiguos del store (CLI) |
| `AGENT_STORE_MAX_DAYS` | `30` | Antigüedad máxima en días de los items guardados en el store JSON (CLI) |
| `WORKER_BROWSER_RESTART_CYCLES` | `10` | Cada cuántos ciclos del worker se reinicia el navegador |
| `WORKER_CLEANUP_CYCLES` | `50` | Cada cuántos ciclos del worker se limpian los `seen_items` antiguos de SQLite |
| `WORKER_MAX_RESULTS` | `40` | Máximo de resultados solicitados por suscripción al scraper |
| `DIGEST_MAX_ITEMS` | `100` | Máximo de items acumulados por suscripción en el digest store |

---

## Resumen rápido de producción (Railway/Render)

```env
# Imprescindibles
BASE_URL=https://tuapp.up.railway.app
ADMIN_PASSWORD=contraseña_muy_segura
DB_PATH=/data/alerts.db

# Email (elige uno)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_EMAIL_FROM=alertas@tudominio.com
# -- o SMTP --
# EMAIL_FROM=noreply@tudominio.com
# EMAIL_SMTP_HOST=smtp.tudominio.com
# ...

# Seguridad
CSRF_ENABLED=true
CSRF_SECRET=genera-un-secreto-aleatorio-aqui

# Comportamiento
WORKER_INTERVAL_SECONDS=120
MAX_ALERTS_PER_EMAIL=10
REQUIRE_EMAIL_VERIFICATION=false

# Opcionales
ADMIN_EMAIL=admin@tudominio.com
THEME_COLOR=orange
DEFAULT_LANG=es
```
