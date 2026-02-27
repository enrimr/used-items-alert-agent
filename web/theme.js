/**
 * Theme helper — reads THEME_COLOR env var and returns color palette.
 * Supported themes: orange (default) | teal
 */

function getThemeVars() {
  const theme = (process.env.THEME_COLOR || 'orange').toLowerCase();
  if (theme === 'teal' || theme === 'green') {
    return {
      primary: '#13c1ac',
      primaryDark: '#0ea897',
      bg: '#f0fdf9',
      shadowRgb: '19,193,172',
    };
  }
  // default: orange
  return {
    primary: '#f97316',
    primaryDark: '#ea6a0a',
    bg: '#fff7f0',
    shadowRgb: '249,115,22',
  };
}

/**
 * Injects theme CSS variables into an HTML string by replacing
 * the CSS custom properties defined in index.html.
 */
function injectTheme(html) {
  const t = getThemeVars();
  return html
    .replace(/--primary:\s*#[0-9a-fA-F]+;/, `--primary: ${t.primary};`)
    .replace(/--primary-dark:\s*#[0-9a-fA-F]+;/, `--primary-dark: ${t.primaryDark};`)
    .replace(/--bg:\s*#[0-9a-fA-F]+;/, `--bg: ${t.bg};`)
    .replace(/rgba\(249,115,22,0\.12\)/g, `rgba(${t.shadowRgb},0.12)`)
    .replace(/rgba\(249,115,22,0\.1\)/g, `rgba(${t.shadowRgb},0.1)`)
    .replace(/rgba\(249,115,22,0\.15\)/g, `rgba(${t.shadowRgb},0.15)`);
}

module.exports = { getThemeVars, injectTheme };
