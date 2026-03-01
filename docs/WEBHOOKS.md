# 🔗 Guía de webhooks

Los webhooks permiten que el servidor notifique a sistemas externos cuando se detectan nuevos productos en Wallapop, **sin necesidad de email**. Son la solución ideal para integraciones con Zapier, n8n, Make (Integromat), Slack, Discord, bases de datos propias, etc.

---

## Índice

- [🔗 Guía de webhooks](#-guía-de-webhooks)
  - [Índice](#índice)
  - [Cómo funciona](#cómo-funciona)
  - [Configurar un webhook](#configurar-un-webhook)
    - [Desde el formulario web](#desde-el-formulario-web)
    - [Desde el panel admin](#desde-el-panel-admin)
    - [Validación](#validación)
  - [Formato del payload](#formato-del-payload)
    - [Campos del payload raíz](#campos-del-payload-raíz)
    - [Campos de cada item](#campos-de-cada-item)
  - [Comportamiento y reintentos](#comportamiento-y-reintentos)
  - [Integraciones paso a paso](#integraciones-paso-a-paso)
    - [Zapier](#zapier)
    - [n8n](#n8n)
    - [Make (Integromat)](#make-integromat)
    - [Slack](#slack)
      - [Con Slack Incoming Webhooks](#con-slack-incoming-webhooks)
      - [Usando Make como intermediario](#usando-make-como-intermediario)
    - [Discord](#discord)
    - [Servidor propio (Express)](#servidor-propio-express)
  - [Variables de configuración](#variables-de-configuración)
  - [Depuración](#depuración)
    - [Probar un webhook con webhook.site](#probar-un-webhook-con-webhooksite)
    - [Ver logs del dispatcher en el servidor](#ver-logs-del-dispatcher-en-el-servidor)
    - [Errores comunes](#errores-comunes)

---

## Cómo funciona

1. El usuario crea una alerta en el formulario web e introduce una **URL de webhook**
2. Cuando el worker detecta nuevos productos para esa suscripción, envía un `POST` HTTP a la URL configurada con un payload JSON
3. El webhook se envía de forma **independiente al email** — una suscripción puede tener email, webhook, ambos o ninguno
4. Si el servidor responde con un código `2xx`, se considera exitoso. Ante errores se reintenta con backoff exponencial

---

## Configurar un webhook

### Desde el formulario web

Al crear una alerta, expande la sección **"Configuración de webhook"** e introduce la URL:

```
https://hooks.zapier.com/hooks/catch/123456/abcdef/
```

### Desde el panel admin

En `/admin`, en la columna **Webhook** de cualquier alerta, haz clic en el icono de edición e introduce o elimina la URL.

### Validación

- La URL debe comenzar con `http://` o `https://`
- Se valida tanto en el frontend como en el backend
- URLs `http://` están permitidas (útil para webhooks internos o en desarrollo)

---

## Formato del payload

El servidor envía siempre un `POST` con `Content-Type: application/json` y este cuerpo:

```json
{
  "event": "new_items",
  "subscription_id": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  "keywords": "iphone 13",
  "min_price": 100,
  "max_price": 500,
  "category": "Móviles y telefonía",
  "shipping_only": false,
  "timestamp": "2026-01-03T15:30:00.000Z",
  "items_count": 2,
  "items": [
    {
      "id": "abc123xyz",
      "title": "iPhone 13 128GB Azul",
      "price": 380,
      "currency": "EUR",
      "url": "https://es.wallapop.com/item/iphone-13-128gb-azul-abc123xyz",
      "image": "https://cdn.wallapop.com/images/abc123.jpg",
      "location": "Madrid, Madrid",
      "description": "iPhone 13 en perfecto estado, con caja original..."
    },
    {
      "id": "def456uvw",
      "title": "iPhone 13 Pro 256GB",
      "price": 490,
      "currency": "EUR",
      "url": "https://es.wallapop.com/item/iphone-13-pro-256gb-def456uvw",
      "image": "https://cdn.wallapop.com/images/def456.jpg",
      "location": "Barcelona, Cataluña",
      "description": null
    }
  ]
}
```

### Campos del payload raíz

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `event` | `string` | Siempre `"new_items"` |
| `subscription_id` | `string` (UUID) | ID único de la suscripción |
| `keywords` | `string` | Palabras clave de la búsqueda |
| `min_price` | `number \| null` | Precio mínimo configurado |
| `max_price` | `number \| null` | Precio máximo configurado |
| `category` | `string \| null` | Nombre de la categoría |
| `shipping_only` | `boolean` | Si la alerta filtra solo productos con envío |
| `timestamp` | `string` (ISO 8601) | Momento en que se generó el evento |
| `items_count` | `number` | Número de items nuevos encontrados |
| `items` | `array` | Lista de productos nuevos |

### Campos de cada item

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | ID único del producto en Wallapop |
| `title` | `string` | Título del anuncio |
| `price` | `number` | Precio en la moneda indicada |
| `currency` | `string` | Código de moneda (normalmente `"EUR"`) |
| `url` | `string` | URL directa al anuncio en Wallapop |
| `image` | `string \| null` | URL de la imagen principal del producto |
| `location` | `string \| null` | Localización del vendedor |
| `description` | `string \| null` | Descripción del producto (primeros ~180 caracteres) |

---

## Comportamiento y reintentos

| Aspecto | Comportamiento |
|---------|----------------|
| **Método HTTP** | `POST` |
| **Content-Type** | `application/json` |
| **User-Agent** | `WallapopAlertas-Webhook/1.0` |
| **Timeout** | 8 000 ms (configurable con `WEBHOOK_TIMEOUT_MS`) |
| **Reintentos** | 2 (configurable con `WEBHOOK_MAX_RETRIES`) |
| **Backoff** | Exponencial: 1s tras el primer fallo, 2s tras el segundo |
| **Errores 4xx** | No se reintenta (error de configuración en el cliente) |
| **Errores 5xx** | Se reintenta hasta `WEBHOOK_MAX_RETRIES` veces |

El webhook se despacha de forma **asíncrona** y en paralelo al envío de email: un fallo en el webhook no bloquea el email ni el procesamiento del siguiente ciclo.

Los fallos del webhook se registran en los logs del worker pero **no desactivan la suscripción**.

---

## Integraciones paso a paso

### Zapier

Zapier permite conectar el webhook con más de 5 000 apps (Google Sheets, Notion, Telegram, etc.) sin código.

1. Ve a [zapier.com](https://zapier.com) → **Create Zap**
2. **Trigger**: busca **Webhooks by Zapier** → selecciona **Catch Hook**
3. Copia la URL del webhook que genera Zapier (ej.: `https://hooks.zapier.com/hooks/catch/123456/abcdef/`)
4. Pega esa URL en el formulario de la alerta
5. **Activa la alerta** y espera a que lleguen nuevos productos (o usa un producto de prueba)
6. Zapier recibirá el payload y podrás mapearlo a cualquier acción:
   - Añadir fila en Google Sheets
   - Crear tarea en Notion
   - Enviar mensaje de Telegram
   - Publicar en Slack
   - etc.

**Campos útiles para mapear en Zapier:**

| Campo Zapier | Campo del payload |
|--------------|------------------|
| `keywords` | Palabras buscadas |
| `items[0].title` | Título del primer producto |
| `items[0].price` | Precio del primer producto |
| `items[0].url` | Enlace al producto |
| `items[0].image` | Imagen del producto |
| `items_count` | Número de nuevos productos |

---

### n8n

n8n es una herramienta de automatización open-source que puedes autoalojar.

1. En tu instancia de n8n, crea un nuevo **Workflow**
2. Añade el nodo **Webhook** como trigger
3. Selecciona **POST** como método HTTP
4. Copia la URL de producción del nodo webhook
5. Pega esa URL en la alerta de Wallapop
6. Añade los nodos de procesamiento que necesites:
   - **Split In Batches** para iterar sobre `items`
   - **HTTP Request** para enviar a otra API
   - **Send Email** para re-enviar con formato propio
   - **Google Sheets** para registrar en hoja de cálculo

**Ejemplo de expresión n8n para el primer item:**

```
{{ $json.items[0].title }} - {{ $json.items[0].price }}€
{{ $json.items[0].url }}
```

---

### Make (Integromat)

1. Ve a [make.com](https://make.com) → **Create a new scenario**
2. Añade el módulo **Webhooks → Custom webhook**
3. Copia la URL generada
4. Pégala en la alerta de Wallapop
5. Ejecuta el escenario y espera el primer evento para que Make detecte la estructura del payload
6. Añade módulos de acción según tus necesidades

---

### Slack

Puedes enviar los nuevos productos directamente a un canal de Slack.

#### Con Slack Incoming Webhooks

1. Ve a https://api.slack.com/apps → crea una nueva app o usa una existente
2. Activa **Incoming Webhooks** → **Add New Webhook to Workspace**
3. Selecciona el canal destino
4. Copia la URL del webhook (formato: `https://hooks.slack.com/services/T.../B.../...`)

⚠️ Slack Incoming Webhooks **solo acepta el formato de mensajes de Slack**, no el JSON genérico del servidor. Necesitas un intermediario (Zapier, n8n o Make) que transforme el payload al formato de Slack:

```json
{
  "text": "🆕 2 nuevos productos para \"iphone 13\"",
  "blocks": [...]
}
```

#### Usando Make como intermediario

1. Make recibe el webhook de Wallapop Alertas
2. Un módulo **Slack → Create a Message** formatea y envía el mensaje

---

### Discord

1. En tu servidor de Discord, ve a **Configuración del servidor → Integraciones → Webhooks**
2. Crea un webhook y copia la URL
3. Discord también requiere un formato específico (`content` o `embeds`), necesitas un intermediario

**Con Make:**
1. Make recibe el webhook de Wallapop Alertas
2. Un módulo **HTTP → Make a Request** envía al webhook de Discord con este cuerpo:

```json
{
  "embeds": [{
    "title": "{{items[0].title}}",
    "url": "{{items[0].url}}",
    "color": 16737536,
    "fields": [
      { "name": "Precio", "value": "{{items[0].price}}€", "inline": true },
      { "name": "Ubicación", "value": "{{items[0].location}}", "inline": true }
    ],
    "image": { "url": "{{items[0].image}}" }
  }]
}
```

---

### Servidor propio (Express)

Si quieres procesar los webhooks con tu propio servidor:

```javascript
const express = require('express');
const app = express();
app.use(express.json());

app.post('/webhook/wallapop', (req, res) => {
  const { event, keywords, items, items_count } = req.body;

  if (event !== 'new_items') {
    return res.status(200).json({ ok: true }); // ignorar otros eventos
  }

  console.log(`📦 ${items_count} nuevos productos para "${keywords}":`);

  items.forEach(item => {
    console.log(`  - ${item.title} → ${item.price}€ — ${item.url}`);
  });

  // Aquí puedes hacer lo que quieras:
  // - Guardar en base de datos
  // - Enviar notificación push
  // - Publicar en Telegram
  // - etc.

  res.status(200).json({ ok: true });
});

app.listen(4000, () => console.log('Webhook server on port 4000'));
```

> **Importante**: el servidor debe responder con un código `2xx` en menos de `WEBHOOK_TIMEOUT_MS` (8s por defecto). Si tarda más, el dispatcher lo considera fallido y reintenta.

---

## Variables de configuración

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `WEBHOOK_TIMEOUT_MS` | `8000` | Tiempo máximo de espera (ms) para que responda el servidor receptor |
| `WEBHOOK_MAX_RETRIES` | `2` | Número de reintentos en caso de fallo (backoff exponencial: 1s, 2s) |

---

## Depuración

### Probar un webhook con webhook.site

[webhook.site](https://webhook.site) es una herramienta gratuita que te da una URL temporal para inspeccionar las peticiones recibidas:

1. Ve a https://webhook.site
2. Copia tu URL única (ej.: `https://webhook.site/abc-123-xyz`)
3. Úsala como URL de webhook en una alerta
4. Cuando lleguen productos nuevos, verás el payload completo en la web

### Ver logs del dispatcher en el servidor

```
🔗 [user@example.com] "iphone 13" → webhook OK (200)
⚠️ [user@example.com] "iphone 13" → webhook FALLÓ: HTTP 500
⚠️ [user@example.com] "iphone 13" → webhook FALLÓ: Webhook timeout (8000ms)
```

### Errores comunes

| Error | Causa probable | Solución |
|-------|---------------|----------|
| `HTTP 4xx` | URL incorrecta, token caducado o endpoint no existe | Verificar y actualizar la URL del webhook |
| `Webhook timeout` | El servidor receptor es demasiado lento | Aumentar `WEBHOOK_TIMEOUT_MS` o acelerar el receptor |
| `URL inválida` | URL sin protocolo `http://` o `https://` | Corregir el formato de la URL |
| `ECONNREFUSED` | El servidor receptor no está disponible | Verificar que el servidor esté activo y accesible |
