/**
 * Tests unitarios para src/config.js — loadConfig()
 *
 * src/config.js llama require('dotenv').config() en el TOP LEVEL del módulo,
 * es decir, al importarse por primera vez. dotenv.config() lee el .env real
 * del disco y rellena process.env ANTES de que podamos manipularlo.
 *
 * Solución: mockear dotenv completamente para que no toque process.env,
 * y controlar manualmente las variables que cada test necesita.
 */

// ── Mock de dotenv (DEBE estar antes de cualquier require del módulo) ──────
jest.mock('dotenv', () => ({
  config: jest.fn(), // no-op: nunca lee el .env
}));

// ── Mock de process.exit ───────────────────────────────────────────────────
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

// ── Silenciar console.error en tests ──────────────────────────────────────
jest.spyOn(console, 'error').mockImplementation(() => {});

// Variables del .env que pueden interferir
const RELEVANT_VARS = [
  'KEYWORDS', 'MIN_PRICE', 'MAX_PRICE', 'CATEGORY_ID',
  'POLL_INTERVAL_SECONDS', 'MAX_RESULTS', 'HEADLESS',
  'DESKTOP_NOTIFICATIONS', 'SAVE_TO_FILE', 'OUTPUT_FILE',
  'EMAIL_TO', 'EMAIL_FROM', 'RESEND_API_KEY', 'RESEND_EMAIL_FROM',
  'EMAIL_SMTP_HOST', 'EMAIL_SMTP_PORT', 'EMAIL_SMTP_USER',
  'EMAIL_SMTP_PASS', 'EMAIL_SMTP_SECURE',
];

beforeEach(() => {
  // Limpiar todas las variables relevantes antes de cada test
  RELEVANT_VARS.forEach(k => delete process.env[k]);
  jest.resetModules();
});

afterAll(() => {
  mockExit.mockRestore();
  jest.restoreAllMocks();
});

function loadFresh(env = {}) {
  // Aplicar solo las vars del test
  Object.assign(process.env, env);
  // Importar config limpio (sin cache)
  return require('../src/config').loadConfig;
}

// ── Validaciones básicas ───────────────────────────────────────────────────

describe('loadConfig — validaciones', () => {
  test('lanza error si KEYWORDS está vacío', () => {
    expect(() => loadFresh({ KEYWORDS: '' })()).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('lanza error si KEYWORDS no está definido', () => {
    expect(() => loadFresh()()).toThrow('process.exit called');
  });

  test('lanza error si MIN_PRICE no es un número', () => {
    expect(() => loadFresh({ KEYWORDS: 'ps5', MIN_PRICE: 'abc' })()).toThrow('process.exit called');
  });

  test('lanza error si MAX_PRICE no es un número', () => {
    expect(() => loadFresh({ KEYWORDS: 'ps5', MAX_PRICE: 'xyz' })()).toThrow('process.exit called');
  });

  test('lanza error si MIN_PRICE > MAX_PRICE', () => {
    expect(() => loadFresh({ KEYWORDS: 'ps5', MIN_PRICE: '500', MAX_PRICE: '100' })()).toThrow('process.exit called');
  });
});

// ── Configuración válida ───────────────────────────────────────────────────

describe('loadConfig — configuración válida', () => {
  test('carga configuración mínima con solo KEYWORDS', () => {
    const config = loadFresh({ KEYWORDS: 'ps5' })();
    expect(config.keywords).toBe('ps5');
    expect(config.minPrice).toBeNull();
    expect(config.maxPrice).toBeNull();
    expect(config.categoryId).toBe('');
    expect(config.pollInterval).toBeGreaterThan(0);
    expect(config.maxResults).toBeGreaterThan(0);
  });

  test('trimea los espacios de keywords', () => {
    expect(loadFresh({ KEYWORDS: '  iphone 13  ' })().keywords).toBe('iphone 13');
  });

  test('convierte MIN_PRICE y MAX_PRICE a floats', () => {
    const config = loadFresh({ KEYWORDS: 'ps5', MIN_PRICE: '100', MAX_PRICE: '500' })();
    expect(config.minPrice).toBe(100);
    expect(config.maxPrice).toBe(500);
  });

  test('pollInterval mínimo es 30 segundos (en ms)', () => {
    expect(loadFresh({ KEYWORDS: 'ps5', POLL_INTERVAL_SECONDS: '5' })().pollInterval).toBe(30 * 1000);
  });

  test('maxResults está acotado a 100 como máximo', () => {
    expect(loadFresh({ KEYWORDS: 'ps5', MAX_RESULTS: '200' })().maxResults).toBe(100);
  });

  test('maxResults está acotado a 1 como mínimo', () => {
    expect(loadFresh({ KEYWORDS: 'ps5', MAX_RESULTS: '0' })().maxResults).toBe(1);
  });

  test('emailEnabled es true con RESEND_API_KEY y EMAIL_TO', () => {
    const config = loadFresh({ KEYWORDS: 'ps5', EMAIL_TO: 'me@example.com', RESEND_API_KEY: 're_test' })();
    expect(config.emailEnabled).toBe(true);
  });

  test('emailEnabled es true con SMTP completo y EMAIL_TO', () => {
    const config = loadFresh({
      KEYWORDS: 'ps5', EMAIL_TO: 'me@example.com',
      EMAIL_SMTP_HOST: 'smtp.gmail.com', EMAIL_SMTP_USER: 'u', EMAIL_SMTP_PASS: 'p',
    })();
    expect(config.emailEnabled).toBe(true);
  });

  test('emailEnabled es false sin EMAIL_TO', () => {
    expect(loadFresh({ KEYWORDS: 'ps5', RESEND_API_KEY: 're_test' })().emailEnabled).toBe(false);
  });

  test('emailEnabled es false sin transporte configurado', () => {
    expect(loadFresh({ KEYWORDS: 'ps5', EMAIL_TO: 'me@example.com' })().emailEnabled).toBe(false);
  });

  test('categoryName se resuelve correctamente', () => {
    const config = loadFresh({ KEYWORDS: 'ps5', CATEGORY_ID: '12461' })();
    expect(config.categoryId).toBe('12461');
    expect(config.categoryName).toMatch(/consolas/i);
  });

  test('categoryName muestra el ID si la categoría es desconocida', () => {
    expect(loadFresh({ KEYWORDS: 'ps5', CATEGORY_ID: '99999' })().categoryName).toContain('99999');
  });
});
