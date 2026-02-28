/**
 * Tests unitarios para src/categories.js
 */

const { CATEGORIES } = require('../src/categories');

describe('CATEGORIES', () => {
  test('es un objeto no vacío', () => {
    expect(typeof CATEGORIES).toBe('object');
    expect(Object.keys(CATEGORIES).length).toBeGreaterThan(0);
  });

  test('contiene la entrada vacía para "todas las categorías"', () => {
    expect(CATEGORIES['']).toBeDefined();
    expect(CATEGORIES['']).toMatch(/todas/i);
  });

  test('contiene categorías conocidas', () => {
    expect(CATEGORIES['12579']).toMatch(/móviles/i);
    expect(CATEGORIES['12461']).toMatch(/consolas/i);
    expect(CATEGORIES['12465']).toMatch(/tecnología/i);
  });

  test('todos los valores son strings no vacíos', () => {
    for (const [id, name] of Object.entries(CATEGORIES)) {
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
    }
  });

  test('todos los IDs son strings numéricos o vacíos', () => {
    for (const id of Object.keys(CATEGORIES)) {
      expect(id === '' || /^\d+$/.test(id)).toBe(true);
    }
  });
});
