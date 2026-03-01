# 🚀 Guía de despliegue

Esta guía cubre todas las opciones de despliegue disponibles: Railway, Render, Docker autoalojado y servidor VPS.

---

## Índice

- [Requisitos previos](#requisitos-previos)
- [Railway](#railway)
- [Render](#render)
- [Docker (autoalojado)](#docker-autoalojado)
- [VPS / servidor bare-metal](#vps--servidor-bare-metal)
- [Variables de entorno de producción](#variables-de-entorno-de-producción)
- [Actualizaciones y redespliegues](#actualizaciones-y-redespliegues)
- [Monitorización y logs](#monitorización-y-logs)

---

## Requisitos previos

Antes de desplegar, asegúrate de tener:

- Una cuenta de email o API key de **Resend** (https://resend.com) para enviar alertas
- Un repositorio Git con el código (fork o clone)
- Conocer el dominio/URL final de tu servicio (necesario para `BASE_URL`)

> ⚠️ **Vercel NO está soportado**: no soporta SQLite persistente, workers de larga duración ni Puppeteer.

---

## Railway

Railway soporta volúmenes persistentes, workers en background y Docker de forma nativa. Es la opción recomendada.

### Despliegue inicial

1. **Fork / push** el repositorio a GitHub
2. Ve a [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → selecciona tu fork
3. Railway detectará el `Dockerfile` y comenzará el primer despliegue automáticamente
4. El servicio arrancará en el puerto que Railway asigne (inyectado automáticamente como `PORT`)

### Crear el volumen persistente (imprescindible)

Sin volumen, la base de datos SQLite **se pierde en cada redespliegue**.

1. En el proyecto Railway, haz clic en tu **servicio** (no en el proyecto)
2. Ve a la pestaña **Volumes** (en la barra lateral de configuración del servicio)
3. Haz clic en **+ New Volume**
4. Configura:
   - **Mount path**: `/data`
   - **Size**: 1 GB (suficiente para la mayoría de casos)
5. Haz clic en **Create**
6. Añade la variable de entorno `DB_PATH=/data/alerts.db`
7. Railway redesplegará automáticamente — a partir de ahora la BD persiste ✅

> ℹ️ Si no ves la pestaña **Volumes**, asegúrate de estar en la configuración del **servicio**, no del proyecto.

### Variables de entorno en Railway

Ve a **Service → Variables** y añade:

```env
BASE_URL=https://tuapp.up.railway.app
DB_PATH=/data/alerts.db
ADMIN_PASSWORD=contraseña_segura

# Email — Railway bloquea SMTP (587/465), usa Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_EMAIL_FROM=alertas@tudominio.com

# Comportamiento
WORKER_INTERVAL_SECONDS=120
WORKER_CONCURRENCY=3
MAX_ALERTS_PER_EMAIL=10

# Seguridad
CSRF_ENABLED=true
CSRF_SECRET=genera-un-secreto-aqui

# Opcionales
ADMIN_EMAIL=admin@tudominio.com
THEME_COLOR=orange
DEFAULT_LANG=es
```

> ⚠️ Railway **bloquea los puertos SMTP 587 y 465**. Usa obligatoriamente **Resend** (`RESEND_API_KEY`) en lugar de `EMAIL_SMTP_*`.

### Dominio personalizado en Railway

1. Ve a **Service → Settings → Networking**
2. Haz clic en **Add Custom Domain**
3. Añade tu dominio y configura los registros DNS según las instrucciones
4. Actualiza `BASE_URL` con tu dominio definitivo

### `railway.json`

El repositorio incluye `railway.json` con la configuración de despliegue:

```json
{
  "build": { "builder": "DOCKERFILE" },
  "deploy": { "startCommand": "node server.js", "restartPolicyType": "ON_FAILURE" }
}
```

---

## Render

Render soporta Docker con discos persistentes y tiene un plan gratuito.

### Despliegue inicial

1. **Fork / push** el repositorio a GitHub
2. Ve a [render.com](https://render.com) → **New → Web Service** → conecta tu repositorio
3. Selecciona **Docker** como runtime (Render detecta el `Dockerfile` automáticamente)
4. **Start Command**: `node server.js`
5. **Instance Type**: Free (con limitaciones) o Starter ($7/mes para servicio siempre activo

### Añadir disco persistente

1. En la configuración del servicio, ve a **Disks**
2. Añade un disco:
   - **Mount Path**: `/data`
   - **Size**: 1 GB
3. Añade la variable `DB_PATH=/data/alerts.db`

### Variables de entorno en Render

En **Service → Environment**, añade las mismas variables que en Railway.

> ⚠️ Render puede también bloquear SMTP en ciertos planes. Usa **Resend** para mayor compatibilidad.

### Limitaciones del plan gratuito de Render

| Limitación | Valor |
|------------|-------|
| Inactividad | El servicio se **apaga tras 15 min sin peticiones** |
| Tiempo de arranque | ~30-60 segundos al recibir la primera petición tras el apagado |
| Horas mensuales | 750 horas/mes (suficiente para 1 servicio 24/7) |

> Para un servicio de alertas con worker continuo, **el plan gratuito no es adecuado** ya que el worker se detiene cuando el servicio se apaga. Considera el plan Starter ($7/mes).

---

## Docker (autoalojado)

### Usar la imagen preconfigurada

El `Dockerfile` incluido usa **Node 18 slim** con Chromium instalado vía `apt`:

```dockerfile
FROM node:18-slim
# Instala Chromium y dependencias del sistema
# Configura PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

### Construir y ejecutar localmente

```bash
# Construir la imagen
docker build -t wallapop-alertas .

# Ejecutar con variables de entorno
docker run -d \
  --name wallapop-alertas \
  -p 3000:3000 \
  -v $(pwd)/data:/data \
  -e BASE_URL=http://localhost:3000 \
  -e DB_PATH=/data/alerts.db \
  -e ADMIN_PASSWORD=mipassword \
  -e RESEND_API_KEY=re_xxxx \
  -e RESEND_EMAIL_FROM=alertas@tudominio.com \
  wallapop-alertas
```

### Con docker-compose

Crea un archivo `docker-compose.yml`:

```yaml
version: '3.8'

services:
  wallapop-alertas:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    environment:
      BASE_URL: http://localhost:3000
      DB_PATH: /data/alerts.db
      ADMIN_PASSWORD: mipassword_seguro
      RESEND_API_KEY: re_xxxxxxxxxxxxxxxxxxxx
      RESEND_EMAIL_FROM: alertas@tudominio.com
      WORKER_INTERVAL_SECONDS: "120"
      CSRF_ENABLED: "true"
      CSRF_SECRET: mi-secreto-aleatorio
```

```bash
docker-compose up -d
docker-compose logs -f   # Ver logs en tiempo real
```

### Variables específicas de Docker

Estas variables ya están configuradas en el `Dockerfile` y **no necesitan ajuste manual**:

```env
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

---

## VPS / servidor bare-metal

### Requisitos del sistema

- **Node.js** ≥ 16 (recomendado 18 LTS)
- **Chromium** o Google Chrome instalado
- **npm** ≥ 8

### Instalar en Ubuntu/Debian

```bash
# 1. Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Instalar Chromium
sudo apt-get install -y chromium-browser

# 3. Clonar el repositorio
git clone https://github.com/enrimr/used-items-alert-agent.git
cd used-items-alert-agent

# 4. Instalar dependencias (sin devDependencies)
npm ci --omit=dev

# 5. Configurar entorno
cp .env.example .env
nano .env   # Editar con tus valores

# 6. Crear directorio de datos
mkdir -p /data

# 7. Arrancar
node server.js
```

### Ejecutar como servicio con PM2

```bash
# Instalar PM2
npm install -g pm2

# Arrancar la aplicación
pm2 start server.js --name wallapop-alertas

# Guardar configuración para reinicio automático
pm2 save
pm2 startup   # Sigue las instrucciones para configurar el arranque automático

# Comandos útiles
pm2 logs wallapop-alertas      # Ver logs
pm2 restart wallapop-alertas   # Reiniciar
pm2 stop wallapop-alertas      # Detener
pm2 status                     # Estado de todos los procesos
```

### Ejecutar como servicio systemd

Crea `/etc/systemd/system/wallapop-alertas.service`:

```ini
[Unit]
Description=Wallapop Alertas
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/wallapop-alertas
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
EnvironmentFile=/opt/wallapop-alertas/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable wallapop-alertas
sudo systemctl start wallapop-alertas
sudo systemctl status wallapop-alertas
```

### Nginx como proxy inverso

Crea `/etc/nginx/sites-available/wallapop-alertas`:

```nginx
server {
    listen 80;
    server_name alertas.tudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/wallapop-alertas /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# HTTPS con Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d alertas.tudominio.com
```

---

## Variables de entorno de producción

Resumen de las variables imprescindibles para cualquier despliegue en producción:

| Variable | Ejemplo | Por qué es necesaria |
|----------|---------|----------------------|
| `BASE_URL` | `https://alertas.midominio.com` | Links de cancelación en emails |
| `DB_PATH` | `/data/alerts.db` | Ubicación de la base de datos en el volumen persistente |
| `ADMIN_PASSWORD` | `Xk9#mP2$vQ8nRt` | Acceso al panel de administración |
| `RESEND_API_KEY` | `re_xxxx` | Envío de emails (o `EMAIL_SMTP_*` como alternativa) |
| `RESEND_EMAIL_FROM` | `alertas@tudominio.com` | Dirección remitente verificada |
| `CSRF_ENABLED` | `true` | Protección contra ataques CSRF |
| `CSRF_SECRET` | *(valor aleatorio)* | Firmado de tokens CSRF |

Ver [CONFIGURATION.md](CONFIGURATION.md) para la referencia completa.

---

## Actualizaciones y redespliegues

### Railway / Render (CI/CD automático)

Con el repositorio conectado a GitHub, cada `git push` a la rama principal disparará un redespliegue automático. El volumen persistente garantiza que la base de datos se conserva.

```bash
git add .
git commit -m "feat: descripción del cambio"
git push origin main
# → Railway/Render redespliegaa automáticamente
```

### Docker autoalojado

```bash
# Reconstruir imagen con los últimos cambios
docker-compose pull   # si usas imagen de registry
# o
docker-compose build  # si builds localmente

# Reiniciar el servicio (la BD en el volumen se conserva)
docker-compose up -d --force-recreate
```

### VPS con PM2

```bash
cd /opt/wallapop-alertas
git pull origin main
npm ci --omit=dev
pm2 restart wallapop-alertas
```

---

## Monitorización y logs

### Logs del worker

El worker escribe en stdout con este formato:

```
[Worker #42] Procesando 5 suscripción(es) [concurrencia: 3]...
  ✓ [user@example.com] "ps5" → sin novedades
  🆕 [otro@example.com] "iphone 13" → 2 nuevos, enviando email inmediato...
  📧 [otro@example.com] "iphone 13" → email enviado OK
[Worker #42] Ciclo completado en 8.3s
```

### Railway logs

En el panel de Railway: **Service → Logs**

### Docker logs

```bash
docker logs wallapop-alertas -f --tail 100
```

### PM2 logs

```bash
pm2 logs wallapop-alertas --lines 100
```

### Señales de salida limpia

El servidor maneja `SIGINT` (Ctrl+C) y `SIGTERM` (Docker stop / `kill`) para:
1. Detener el worker
2. Cerrar el navegador Puppeteer
3. Salir con código 0

Esto garantiza que no queden procesos de Chromium huérfanos.
