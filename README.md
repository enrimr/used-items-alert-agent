# 🔍 Wallapop Agent

Agente que monitoriza automáticamente Wallapop España y te notifica cuando aparecen **nuevos productos** que cumplan tus criterios. Filtra automáticamente productos **con reserva** y **vendidos**.

## ✨ Características

- 🔎 **Búsqueda por palabras clave** (requerido)
- 💶 **Filtro de rango de precio** (min/max, opcional)
- 🏷️ **Filtro por categoría** (opcional)
- 🚫 **Excluye automáticamente** productos con reserva y vendidos
- 🔔 **Notificaciones de escritorio** al encontrar nuevos productos
- 💾 **Guarda resultados** en JSON para historial
- 🔄 **Polling continuo** con intervalo configurable
- 🛡️ **Resistente a errores** con reintentos automáticos

## 📋 Requisitos

- Node.js 16+
- Chrome/Chromium (se descarga automáticamente con Puppeteer)

## 🚀 Instalación

```bash
# Clonar / entrar al directorio
cd wallapop-agent

# Instalar dependencias
npm install

# Copiar configuración
cp .env.example .env

# Editar tu configuración
nano .env   # o code .env
```

## ⚙️ Configuración (`.env`)

```env
# REQUERIDO: palabras de búsqueda
KEYWORDS=iphone 13

# OPCIONAL: rango de precio en €
MIN_PRICE=100
MAX_PRICE=500

# OPCIONAL: categoría (ver lista abajo)
CATEGORY_ID=12579

# Intervalo de comprobación en segundos (mínimo 30)
POLL_INTERVAL_SECONDS=90

# Número máximo de resultados por búsqueda
MAX_RESULTS=40

# Navegador sin ventana (true) o con ventana (false)
HEADLESS=true

# Notificaciones de escritorio
DESKTOP_NOTIFICATIONS=true

# Guardar resultados en archivo
SAVE_TO_FILE=true
OUTPUT_FILE=./encontrados.json
```

### 🏷️ IDs de Categorías

| ID | Categoría |
|-----|-----------|
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

## 🎯 Uso

### Modo continuo (recomendado)
```bash
npm start
# o
node index.js
```

### Búsqueda única
```bash
npm run once
# o
node index.js --once
```

### Ayuda
```bash
node index.js --help
```

### Variables desde línea de comandos
```bash
# Buscar iPhone 13 entre 100€ y 500€
KEYWORDS="iphone 13" MIN_PRICE=100 MAX_PRICE=500 node index.js

# Buscar MacBook en categoría Informática cada 2 minutos
KEYWORDS="macbook pro" CATEGORY_ID=15000 POLL_INTERVAL_SECONDS=120 node index.js

# PlayStation 5 sin límite de precio, una sola búsqueda
KEYWORDS="ps5 playstation 5" node index.js --once
```

## 📦 Archivo de resultados

Los productos encontrados se guardan en `encontrados.json` con el siguiente formato:

```json
[
  {
    "id": "abc123",
    "title": "iPhone 13 128GB Negro",
    "price": 450,
    "currency": "EUR",
    "location": "Madrid, Madrid",
    "seller": "usuario123",
    "url": "https://es.wallapop.com/item/iphone-13-abc123",
    "reserved": false,
    "sold": false,
    "detectedAt": "2024-01-15T10:30:00.000Z"
  }
]
```

## 🏗️ Estructura del proyecto

```
wallapop-agent/
├── index.js          # Punto de entrada
├── src/
│   ├── agent.js      # Bucle principal del agente
│   ├── config.js     # Carga y validación de configuración
│   ├── scraper.js    # Scraper con Puppeteer + intercepción de API
│   ├── store.js      # Store de items vistos (evita duplicados)
│   └── notifier.js   # Sistema de notificaciones y salida
├── .env              # Tu configuración (no subir a git)
├── .env.example      # Plantilla de configuración
├── encontrados.json  # Resultados guardados (generado automáticamente)
└── package.json
```

## ⚠️ Notas

- El agente usa un navegador headless para evitar el bloqueo de Wallapop a peticiones directas
- Se recomienda un intervalo mínimo de 60-90 segundos para no sobrecargar el servidor
- Los productos ya vistos se recuerdan entre reinicios gracias al archivo JSON
- Los productos con más de 30 días se limpian automáticamente del historial

## 📄 Licencia

ISC
