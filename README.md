# 🔍 Wallapop Alert Agent

> Monitor Wallapop Spain for new listings and get notified instantly — via CLI, email, or a public web interface.

![Wallapop Alertas Web](docs/screenshot.png)

---

## ✨ Features

- 🔎 **Keyword search** with price range and category filters
- 🚫 **Excludes reserved and sold** items automatically
- 📧 **Email alerts** with product photo, price, description and direct link
- 🌐 **Web interface** — anyone can subscribe without registering
- ❌ **One-click unsubscribe** link in every email
- 💾 **Persistent history** — no duplicate alerts between restarts
- 🛡️ **Auto-recovery** on browser crashes
- 🔄 **Continuous polling** with configurable interval

---

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/enrimr/wallapop-alert-agent.git
cd wallapop-alert-agent
npm install

# Configure
cp .env.example .env
# Edit .env with your settings
```

---

## 🖥️ Mode 1 — CLI (personal use)

Monitor Wallapop for your own searches from the terminal.

```bash
npm start           # Continuous monitoring loop
npm run once        # Single search
node index.js --help
```

**Configure `.env`:**
```env
KEYWORDS=iphone 13
MIN_PRICE=100
MAX_PRICE=500
CATEGORY_ID=12579       # Optional
POLL_INTERVAL_SECONDS=90
```

---

## 🌐 Mode 2 — Web Server (public service)

Run a web interface where anyone can create their own Wallapop alerts.

```bash
npm run web         # Start web server + background worker
npm run web:only    # Start web server only (no worker)
```

**How it works:**
1. User fills in the form (keywords, price, category, email)
2. Alert is saved to SQLite — no account needed
3. Background worker polls Wallapop every 2 minutes for each subscription
4. New products → HTML email with unsubscribe link
5. User clicks "❌ Eliminar esta alerta" → alert deleted

**Configure `.env` for web:**
```env
# Web server
WEB_PORT=3000
BASE_URL=http://localhost:3000   # Your public domain in production

# Worker interval
WORKER_INTERVAL_SECONDS=120

# Email (SMTP)
EMAIL_FROM=turemitente@gmail.com
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_USER=turemitente@gmail.com
EMAIL_SMTP_PASS=xxxx xxxx xxxx xxxx   # Gmail App Password
```

---

## ⚙️ Full `.env` Reference

```env
# ── SEARCH (CLI mode) ──────────────────────────────────────
KEYWORDS=iphone 13           # Required
MIN_PRICE=100                # Optional
MAX_PRICE=500                # Optional
CATEGORY_ID=12579            # Optional (see categories below)
POLL_INTERVAL_SECONDS=90     # Minimum 30
MAX_RESULTS=40
HEADLESS=true

# ── NOTIFICATIONS (CLI mode) ───────────────────────────────
DESKTOP_NOTIFICATIONS=true
SAVE_TO_FILE=true
OUTPUT_FILE=./encontrados.json

# ── EMAIL ──────────────────────────────────────────────────
EMAIL_TO=me@example.com      # CLI mode recipient
EMAIL_FROM=sender@gmail.com
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_SECURE=false
EMAIL_SMTP_USER=sender@gmail.com
EMAIL_SMTP_PASS=app_password

# ── WEB SERVER ─────────────────────────────────────────────
WEB_PORT=3000
BASE_URL=http://localhost:3000
WORKER_INTERVAL_SECONDS=120
```

---

## 🏷️ Category IDs

| ID | Category |
|----|----------|
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

## 🏗️ Project Structure

```
wallapop-alert-agent/
│
├── index.js              # CLI entry point
├── server.js             # Web server entry point
│
├── src/
│   ├── agent.js          # CLI polling loop with auto-recovery
│   ├── scraper.js        # Puppeteer scraper (intercepts /api/v3/search/section)
│   ├── config.js         # Loads and validates .env
│   ├── store.js          # Persistent seen-items store (JSON)
│   ├── notifier.js       # Console output + desktop notifications
│   └── emailer.js        # SMTP email for CLI mode
│
├── web/
│   ├── server.js         # Express routes: /, /subscribe, /unsubscribe/:id
│   ├── worker.js         # Background worker for all subscriptions
│   ├── mailer.js         # HTML email templates with unsubscribe link
│   ├── db.js             # SQLite: subscriptions + seen items per user
│   └── public/
│       └── index.html    # Frontend form (no framework, pure HTML/CSS/JS)
│
├── docs/
│   └── screenshot.png    # Web interface screenshot
│
├── .env.example          # Configuration template
└── LICENSE               # MIT
```

---

## 📧 Gmail App Password

1. Enable 2-Step Verification on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Create an app password for "Mail"
4. Use it as `EMAIL_SMTP_PASS` in `.env`

---

## 🚂 Deploy on Railway

Railway is the recommended platform for hosting the web server (supports persistent storage, background workers and Node.js natively).

### Steps

1. **Fork / push** this repo to GitHub
2. Create a new project on [railway.app](https://railway.app) → **Deploy from GitHub repo**
3. Add a **Volume** and mount it at `/data`
4. Set these **environment variables** in Railway:

```env
# Required
BASE_URL=https://yourapp.up.railway.app
EMAIL_FROM=sender@gmail.com
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=sender@gmail.com
EMAIL_SMTP_PASS=xxxx xxxx xxxx xxxx
WORKER_INTERVAL_SECONDS=120
HEADLESS=true

# SQLite stored in the mounted volume
DB_PATH=/data/alerts.db

# Chromium (set automatically by nixpacks.toml — do NOT change)
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/run/current-system/sw/bin/chromium
```

5. Railway will auto-detect `railway.json` and `nixpacks.toml`, install Chromium and start `node server.js`

> **Vercel note:** Vercel does **not** support persistent SQLite, long-running background workers or Puppeteer. Use Railway instead.

---

## ⚠️ Notes

- Uses Puppeteer headless browser to bypass Wallapop's CloudFront protection
- Recommended minimum interval: 60-90 seconds to avoid overloading the server
- The web worker polls all active subscriptions sequentially with a 2s delay between each
- Seen items are stored per-subscription in SQLite (web) or JSON file (CLI)

---

## 📄 License

MIT © [Enrique Mendoza](https://github.com/enrimr)

*If you use this project, a mention or star ⭐ is appreciated!*
