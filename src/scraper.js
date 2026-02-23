/**
 * Scraper de Wallapop usando Puppeteer
 * Intercepta la llamada a /api/v3/search/section que contiene los productos
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Construye la URL de búsqueda de Wallapop (nueva URL con /search)
 */
function buildSearchUrl(config) {
  const base = 'https://es.wallapop.com/search';
  const params = new URLSearchParams();

  params.set('keywords', config.keywords);
  params.set('order_by', 'newest');
  params.set('country_code', 'ES');
  params.set('source', 'default_filters');

  if (config.minPrice !== null) {
    params.set('min_sale_price', config.minPrice.toString());
  }
  if (config.maxPrice !== null) {
    params.set('max_sale_price', config.maxPrice.toString());
  }
  if (config.categoryId) {
    params.set('category_ids', config.categoryId);
  }

  return `${base}?${params.toString()}`;
}

/**
 * Parsea los items de la respuesta de /api/v3/search/section
 * Estructura: { data: { section: { items: [...] } } }
 */
function parseItems(responseData) {
  const items = [];

  try {
    const rawItems = responseData?.data?.section?.items || [];

    for (const item of rawItems) {
      // reserved es un objeto {flag: true/false}
      const isReserved = item.reserved?.flag === true;
      if (isReserved) continue;

      // price es un objeto {amount, currency}
      const priceRaw = item.price;
      const priceAmount = typeof priceRaw === 'object' && priceRaw !== null
        ? (priceRaw.amount || 0)
        : (priceRaw || 0);
      const priceCurrency = (typeof priceRaw === 'object' && priceRaw !== null)
        ? (priceRaw.currency || 'EUR')
        : (item.currency || 'EUR');

      // URL correcta: usar web_slug
      const url = item.web_slug
        ? `https://es.wallapop.com/item/${item.web_slug}`
        : buildItemUrl(item);

      const parsed = {
        id: item.id || '',
        title: item.title || '',
        description: item.description || '',
        price: priceAmount,
        currency: priceCurrency,
        location: formatLocation(item.location),
        seller: item.user_id || 'Desconocido',
        images: extractImages(item),
        url,
        reserved: isReserved,
        sold: false,
        categoryId: item.category_id || '',
        shippingAllowed: item.shipping?.item_is_shippable || false,
        publishedAt: item.modified_at || item.created_at || null,
      };

      items.push(parsed);
    }
  } catch (err) {
    console.error('Error parseando items:', err.message);
  }

  return items;
}

function formatLocation(location) {
  if (!location) return 'España';
  const parts = [location.city, location.region, location.country_code].filter(Boolean);
  return parts.join(', ') || 'España';
}

function extractImages(item) {
  if (!item.images || !Array.isArray(item.images)) return [];
  return item.images.slice(0, 3).map((img) => {
    if (img.urls) {
      return img.urls.medium || img.urls.large || img.urls.small || Object.values(img.urls)[0];
    }
    return img.medium || img.large || img.url || '';
  }).filter(Boolean);
}

function buildItemUrl(item) {
  const id = item.id || '';
  const title = item.title || '';
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50);
  return `https://es.wallapop.com/item/${slug}-${id}`;
}

/**
 * Fetches items from Wallapop using Puppeteer to intercept the /search/section API
 */
async function fetchItems(config, browser) {
  let page = null;
  const searchUrl = buildSearchUrl(config);

  try {
    page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Intercept /api/v3/search/section responses
    let apiData = null;
    const responsePromise = new Promise((resolve) => {
      page.on('response', async (response) => {
        const url = response.url();
        if (
          url.includes('api.wallapop.com') &&
          url.includes('/search/section') &&
          apiData === null
        ) {
          try {
            const data = await response.json();
            if (data?.data?.section?.items) {
              apiData = data;
              resolve(data);
            }
          } catch (e) {
            // Not JSON or already consumed
          }
        }
      });

      // Timeout after 40s
      setTimeout(() => resolve(null), 40000);
    });

    // Navigate to the search page
    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 50000,
    });

    // Wait for API response interception
    const data = await responsePromise;

    if (data) {
      const items = parseItems(data);
      return { items, source: 'api', url: searchUrl };
    }

    console.log('⚠️  No se pudo interceptar la API de búsqueda');
    return { items: [], source: 'empty', url: searchUrl };

  } catch (err) {
    throw new Error(`Error al hacer scraping: ${err.message}`);
  } finally {
    if (page) {
      try { await page.close(); } catch(e) {}
    }
  }
}

/**
 * Devuelve la ruta al ejecutable de Chrome/Chromium
 */
function findChromePath() {
  // 0. Variable de entorno explícita (Railway/Docker)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // 1. Usar el Chromium de Puppeteer si existe
  try {
    const puppeteerPath = puppeteer.executablePath();
    if (puppeteerPath && fs.existsSync(puppeteerPath)) {
      return puppeteerPath;
    }
  } catch (e) {}

  // 2. Buscar en rutas del sistema
  const candidates = [
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    path.join(os.homedir(), '.cache/puppeteer/chrome/mac-1108766/chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
    // Linux
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (e) {}
  }

  return null;
}

/**
 * Creates and returns a Puppeteer browser instance
 */
async function createBrowser(headless = true) {
  const chromePath = findChromePath();

  if (chromePath) {
    console.log(`  🌐 Usando Chrome: ${path.basename(path.dirname(chromePath))}`);
  } else {
    console.warn('  ⚠️  No se encontró Chrome/Chromium instalado.');
  }

  const launchOptions = {
    headless: headless ? 'new' : false,
    timeout: 60000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--lang=es-ES,es',
      '--window-size=1280,800',
    ],
  };

  if (chromePath) {
    launchOptions.executablePath = chromePath;
  }

  const browser = await puppeteer.launch(launchOptions);
  return browser;
}

module.exports = { fetchItems, createBrowser, buildSearchUrl };
