/**
 * Tests unitarios para src/scraper.js
 *
 * Solo testea funciones puras (no requieren browser ni red):
 *   - buildSearchUrl()
 *   - parseItems() — a través de los helpers internos
 */

// Las funciones internas no se exportan directamente; las probamos
// a través de los exports públicos o extrayendo la lógica.
// buildSearchUrl y parseItems son accesibles porque los exportamos en el módulo.
const { buildSearchUrl } = require('../src/scraper');

// ── buildSearchUrl ─────────────────────────────────────────────────────────

describe('buildSearchUrl', () => {
  test('genera URL con keywords obligatorias', () => {
    const url = buildSearchUrl({ keywords: 'ps5', minPrice: null, maxPrice: null, categoryId: '' });
    expect(url).toContain('https://es.wallapop.com/search');
    expect(url).toContain('keywords=ps5');
    expect(url).toContain('order_by=newest');
  });

  test('incluye min_sale_price cuando minPrice está definido', () => {
    const url = buildSearchUrl({ keywords: 'ps5', minPrice: 100, maxPrice: null, categoryId: '' });
    expect(url).toContain('min_sale_price=100');
    expect(url).not.toContain('max_sale_price');
  });

  test('incluye max_sale_price cuando maxPrice está definido', () => {
    const url = buildSearchUrl({ keywords: 'ps5', minPrice: null, maxPrice: 500, categoryId: '' });
    expect(url).toContain('max_sale_price=500');
    expect(url).not.toContain('min_sale_price');
  });

  test('incluye ambos precios cuando están definidos', () => {
    const url = buildSearchUrl({ keywords: 'iphone 13', minPrice: 200, maxPrice: 600, categoryId: '' });
    expect(url).toContain('min_sale_price=200');
    expect(url).toContain('max_sale_price=600');
  });

  test('incluye category_ids cuando categoryId está definido', () => {
    const url = buildSearchUrl({ keywords: 'ps5', minPrice: null, maxPrice: null, categoryId: '12461' });
    expect(url).toContain('category_ids=12461');
  });

  test('no incluye category_ids cuando categoryId está vacío', () => {
    const url = buildSearchUrl({ keywords: 'ps5', minPrice: null, maxPrice: null, categoryId: '' });
    expect(url).not.toContain('category_ids');
  });

  test('codifica correctamente keywords con espacios', () => {
    const url = buildSearchUrl({ keywords: 'game boy color', minPrice: null, maxPrice: null, categoryId: '' });
    expect(url).toContain('keywords=game+boy+color');
  });
});
