# 🛡️ Guía de seguridad

Este documento describe todas las medidas de seguridad implementadas en el proyecto y las recomendaciones para un despliegue seguro en producción.

---

## Índice

- [Protección CSRF](#protección-csrf)
- [Autenticación del panel admin](#autenticación-del-panel-admin)
- [Rate limiting](#rate-limiting)
- [Verificación de email](#verificación-de-email)
- [Gestión de secretos](#gestión-de-secretos)
- [Cabeceras HTTP](#cabeceras-http)
- [Seguridad de la base de datos](#seguridad-de-la-base-de-datos)
- [Seguridad de webhooks](#seguridad-de-webhooks)
- [Checklist de producción](#checklist-de-producción)

---

## Protección CSRF

### Cómo funciona

Se utiliza el patrón **Double Submit Cookie** (`csrf-csrf`) para proteger todos los formularios HTML contra ataques Cross-Site Request Forgery.

- El servidor genera un token CSRF al servir cada página
- El token se inyecta en `window.__CSRF_TOKEN__` vía `<script>` en el HTML
- El frontend lo incluye en cada petición POST como campo `_csrf` o cabecera `x-csrf-token`
- El servidor valida que el token del body/cabecera coincida con la cookie firmada

### Configuración

```env
CSRF_ENABLED=true          # Activar en producción
CSRF_SECRET=secreto-largo-y-aleatorio   # Cambiar obligatoriamente
```

> El CSRF se desactiva **automáticamente** cuando `NODE_ENV=test` para no interferir con los tests de integración.

### Cuándo activarlo

| Entorno | Recomendación |
|---------|---------------|
| Desarrollo local | `CSRF_ENABLED=false` (por defecto) |
| Staging / Producción | `CSRF_ENABLED=true` ✅ |

### Rutas protegidas

| Ruta | Método | Protección CSRF |
|------|--------|-----------------|
| `POST /subscribe` | Formulario HTML | ✅ Sí |
| `POST /subscribe` | `Accept: application/json` | ❌ No (API — protegida por rate limit) |
| `POST /admin/*` | Todas las acciones del panel | ✅ Sí |

Las peticiones JSON a `/subscribe` quedan exentas del CSRF porque se validan por `Content-Type` y no son vulnerables al ataque clásico de formulario.

### Generar un secreto seguro

```bash
# Linux / macOS
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Alternativa con openssl
openssl rand -hex 32
```

---

## Autenticación del panel admin

El panel `/admin` está protegido con **HTTP Basic Authentication**.

```env
ADMIN_PASSWORD=contraseña_muy_segura_aqui
```

**Comportamiento:**
- Si `ADMIN_PASSWORD` está vacía, el panel devuelve `503 Service Unavailable` con un mensaje explicativo
- Si la contraseña es incorrecta, responde `401` con cabecera `WWW-Authenticate` para que el navegador muestre el diálogo de login
- El usuario de Basic Auth es `admin` (cualquier valor — solo se comprueba la contraseña)

### Recomendaciones para la contraseña del admin

- Mínimo 16 caracteres
- Combinación de letras, números y símbolos
- No reutilizar contraseñas de otros servicios
- Generar con un gestor de contraseñas o:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

### Doble capa de seguridad en el admin

Las rutas del panel admin tienen dos capas:
1. **Basic Auth** — bloquea el acceso sin autenticación
2. **CSRF** — protege las acciones destructivas (delete, hard-delete, edit) contra ataques CSRF aun cuando el atacante conoce la contraseña

---

## Rate limiting

Se aplican dos niveles de rate limiting con `express-rate-limit`.

### Límite global

```
300 peticiones / IP / 15 minutos
```

- Se aplica a **todas las rutas** excepto `/admin`
- Responde `429 Too Many Requests` con el mensaje `"Demasiadas solicitudes. Inténtalo más tarde."`
- Configurable con `GLOBAL_RATE_LIMIT`

### Límite de suscripciones

```
5 peticiones a POST /subscribe / IP / 15 minutos
```

- Protege contra la creación masiva de alertas
- No configurable por entorno (hardcoded en `web/routes/subscribe.js`)
- Responde con el texto i18n `api_rate_limit` según el idioma del usuario

### Límite de alertas por email

```env
MAX_ALERTS_PER_EMAIL=10   # Límite global por defecto
```

- Limita cuántas alertas activas puede tener un mismo email
- Evita que un email acapare recursos del worker
- Configurable por email individual desde el panel `/admin`

---

## Verificación de email

La verificación de email es una capa de protección anti-abuso opcional.

```env
REQUIRE_EMAIL_VERIFICATION=true
```

### Qué previene

- Creación de alertas con el email de otra persona (spam/acoso)
- Llenado de la base de datos con emails falsos
- Alertas que nunca serán recibidas (buzones inexistentes)

### Flujo

```
1. Usuario envía formulario
2. Suscripción se crea con verified=0
3. Se envía email con enlace único: GET /verify/<token>
4. Worker IGNORA suscripciones con verified=0
5. Usuario hace clic en el enlace → verified=1
6. A partir del próximo ciclo del worker, la alerta queda activa
```

### Token de verificación

- Generado con `uuid v4` (128 bits de entropía — criptográficamente seguro)
- De un solo uso: se elimina de la BD tras el primer clic
- Sin caducidad por diseño (el usuario puede perder el email)
- Si el token no existe → `404` con mensaje de error

> ⚠️ Si activas `REQUIRE_EMAIL_VERIFICATION=true` pero no configuras ningún transporte de email, **ninguna alerta se activará jamás** (el token nunca llega al usuario).

---

## Gestión de secretos

### Variables sensibles

| Variable | Por qué es sensible |
|----------|---------------------|
| `ADMIN_PASSWORD` | Acceso total al panel de administración |
| `CSRF_SECRET` | Comprometerlo permite forjar tokens CSRF |
| `RESEND_API_KEY` | Permite enviar emails desde tu dominio (coste + reputación) |
| `EMAIL_SMTP_PASS` | Acceso a la cuenta de correo |

### Reglas básicas

1. **Nunca** commitear `.env` al repositorio — está en `.gitignore`
2. **Nunca** exponer variables de entorno en logs o respuestas de API
3. Usar `.env.example` con valores ficticios como plantilla pública
4. En Railway/Render, configurar los secretos en el panel de variables de entorno del servicio, no en archivos
5. Rotar `RESEND_API_KEY` y contraseñas si se sospecha que han sido comprometidos

### Verificar que .env no se commitea

```bash
git check-ignore -v .env      # Debe mostrar .gitignore:.env
git ls-files --error-unmatch .env   # Debe fallar (significa que no está tracked)
```

---

## Cabeceras HTTP

El proyecto usa Express con las siguientes medidas:

### Content-Type validation

- `express.urlencoded` y `express.json` con límite de `16kb` para prevenir ataques de payload gigante

### Cookies CSRF

Las cookies de token CSRF se configuran con:
- `httpOnly: true` — inaccesibles desde JavaScript
- `sameSite: 'strict'` — no se envían en peticiones cross-site
- `secure: true` — solo sobre HTTPS (en producción)
- `path: '/'` — disponible en toda la aplicación

### Trust proxy

```javascript
app.set('trust proxy', 1);
```

Necesario para que `express-rate-limit` obtenga la IP real del cliente (no la del proxy de Railway/Render) a través de `X-Forwarded-For`.

### Recomendaciones adicionales para producción

Se recomienda añadir `helmet` como middleware para agregar cabeceras de seguridad estándar:

```bash
npm install helmet
```

```javascript
// En web/server.js
const helmet = require('helmet');
app.use(helmet());
```

Esto añadiría automáticamente: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, etc.

---

## Seguridad de la base de datos

### SQLite con better-sqlite3

- **Consultas parametrizadas** en toda la capa de acceso a datos — inmune a SQL injection
- Sin red: SQLite es un archivo local, no expuesto a ningún puerto
- El archivo de BD debe estar en una ruta no accesible públicamente (por defecto `/data/alerts.db` en producción)

### Soft delete vs hard delete

- `deleteSubscription()` hace **soft delete** (pone `active=0`) — los datos se conservan
- `hardDeleteSubscription()` elimina la fila y sus `seen_items` permanentemente
- Ambas solo están disponibles desde el panel `/admin` autenticado

### IDs de suscripción

Los IDs son **UUID v4** (ej.: `3f2504e0-4f89-11d3-9a0c-0305e82c3301`), lo que hace imposible adivinar o enumerar suscripciones. Esto protege el endpoint `GET /unsubscribe/:id` de acceso no autorizado.

---

## Seguridad de webhooks

Cuando un usuario configura una URL de webhook, el sistema envía peticiones HTTP POST a esa URL con los nuevos productos. Considera estas implicaciones:

### Validación de URLs

- Solo se aceptan URLs con protocolo `http://` o `https://`
- Se valida tanto en el frontend como en el backend (`POST /subscribe` y `POST /admin/set-webhook/:id`)

### Lo que el servidor envía

```json
{
  "event": "new_items",
  "subscription_id": "uuid-de-la-suscripcion",
  "keywords": "iphone 13",
  ...
}
```

No se incluyen datos personales del usuario más allá del `subscription_id`. Sin embargo, ten en cuenta que el receptor del webhook puede correlacionar `subscription_id` con búsquedas.

### Cabecera User-Agent

```
User-Agent: WallapopAlertas-Webhook/1.0
```

Identificable en los logs del servidor receptor.

### Consideraciones de red

- Los webhooks se envían desde el servidor (no desde el navegador del usuario)
- Esto implica que el receptor ve la IP del **servidor de producción**, no del usuario
- No se soporta autenticación del receptor (HMAC secret) — considera añadirla si despliegas para usuarios externos

---

## Checklist de producción

Antes de poner en producción, verifica:

- [ ] `ADMIN_PASSWORD` configurada con una contraseña segura (≥16 caracteres)
- [ ] `CSRF_ENABLED=true`
- [ ] `CSRF_SECRET` cambiado por un valor aleatorio único (no el valor por defecto)
- [ ] `.env` **no** está en el repositorio Git
- [ ] `BASE_URL` apunta al dominio real (HTTPS)
- [ ] Volumen persistente configurado y `DB_PATH` apuntando a él
- [ ] Transporte de email configurado y verificado (Resend o SMTP)
- [ ] `REQUIRE_EMAIL_VERIFICATION=true` si el servicio es público y quieres prevenir abusos
- [ ] `MAX_ALERTS_PER_EMAIL` ajustado a un valor razonable
- [ ] `ADMIN_EMAIL` configurado para recibir alertas de fallos del scraper
- [ ] HTTPS activo en el servidor (Railway y Render lo gestionan automáticamente)
