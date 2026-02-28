/**
 * Tests unitarios para web/theme.js
 *
 * Prueba todos los temas disponibles y la inyección de CSS.
 */

const { getThemeVars, injectTheme } = require('../web/theme');

// Guardar THEME_COLOR original
const originalTheme = process.env.THEME_COLOR;
afterEach(() => { process.env.THEME_COLOR = originalTheme; });

// ── getThemeVars ───────────────────────────────────────────────────────────

describe('getThemeVars', () => {
  test('devuelve tema orange por defecto', () => {
    delete process.env.THEME_COLOR;
    const t = getThemeVars();
    expect(t.primary).toBe('#f97316');
    expect(t.primaryDark).toBe('#ea6a0a');
    expect(t.shadowRgb).toBe('249,115,22');
  });

  test('devuelve tema teal', () => {
    process.env.THEME_COLOR = 'teal';
    const t = getThemeVars();
    expect(t.primary).toBe('#13c1ac');
    expect(t.primaryDark).toBe('#0ea897');
  });

  test('devuelve tema green (alias de teal)', () => {
    process.env.THEME_COLOR = 'green';
    const t = getThemeVars();
    expect(t.primary).toBe('#13c1ac');
  });

  test('devuelve tema purple', () => {
    process.env.THEME_COLOR = 'purple';
    const t = getThemeVars();
    expect(t.primary).toBe('#7c3aed');
    expect(t.primaryDark).toBe('#6d28d9');
  });

  test('devuelve tema violet (alias de purple)', () => {
    process.env.THEME_COLOR = 'violet';
    const t = getThemeVars();
    expect(t.primary).toBe('#7c3aed');
  });

  test('devuelve tema blue', () => {
    process.env.THEME_COLOR = 'blue';
    const t = getThemeVars();
    expect(t.primary).toBe('#2563eb');
    expect(t.primaryDark).toBe('#1d4ed8');
  });

  test('devuelve tema neutral/gray', () => {
    process.env.THEME_COLOR = 'neutral';
    const t = getThemeVars();
    expect(t.primary).toBe('#475569');
    expect(t.primaryDark).toBe('#334155');
  });

  test('devuelve tema gray (alias de neutral)', () => {
    process.env.THEME_COLOR = 'gray';
    const t = getThemeVars();
    expect(t.primary).toBe('#475569');
  });

  test('devuelve tema orange para valores desconocidos', () => {
    process.env.THEME_COLOR = 'magenta';
    const t = getThemeVars();
    expect(t.primary).toBe('#f97316');
  });

  test('cada tema tiene primary, primaryDark, bg y shadowRgb', () => {
    for (const color of ['orange', 'teal', 'purple', 'blue', 'neutral']) {
      process.env.THEME_COLOR = color;
      const t = getThemeVars();
      expect(t).toHaveProperty('primary');
      expect(t).toHaveProperty('primaryDark');
      expect(t).toHaveProperty('bg');
      expect(t).toHaveProperty('shadowRgb');
    }
  });
});

// ── injectTheme ────────────────────────────────────────────────────────────

describe('injectTheme', () => {
  const sampleHtml = `<style>
    :root {
      --primary: #f97316;
      --primary-dark: #ea6a0a;
      --bg: #fff7f0;
    }
    .shadow { color: rgba(249,115,22,0.12); }
    .s2 { color: rgba(249,115,22,0.1); }
    .s3 { color: rgba(249,115,22,0.15); }
  </style>`;

  test('sustituye --primary con el color del tema', () => {
    process.env.THEME_COLOR = 'teal';
    const result = injectTheme(sampleHtml);
    expect(result).toContain('--primary: #13c1ac;');
    expect(result).not.toContain('--primary: #f97316;');
  });

  test('sustituye --primary-dark', () => {
    process.env.THEME_COLOR = 'teal';
    const result = injectTheme(sampleHtml);
    expect(result).toContain('--primary-dark: #0ea897;');
  });

  test('sustituye --bg', () => {
    process.env.THEME_COLOR = 'teal';
    const result = injectTheme(sampleHtml);
    expect(result).toContain('--bg: #f0fdf9;');
  });

  test('sustituye las referencias rgba con los valores del tema', () => {
    process.env.THEME_COLOR = 'teal';
    const result = injectTheme(sampleHtml);
    expect(result).toContain('rgba(19,193,172,0.12)');
    expect(result).toContain('rgba(19,193,172,0.1)');
    expect(result).toContain('rgba(19,193,172,0.15)');
  });

  test('devuelve el HTML original si no hay tokens que sustituir', () => {
    process.env.THEME_COLOR = 'orange';
    const html = '<p>Sin variables de tema</p>';
    expect(injectTheme(html)).toBe(html);
  });
});
