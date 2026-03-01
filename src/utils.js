/**
 * Utilidades compartidas entre el modo CLI (src/) y el servidor web (web/)
 */

/**
 * Valida un rango de precios.
 * @param {number|null} min
 * @param {number|null} max
 * @returns {{ ok: boolean, error?: string }}
 */
function validatePriceRange(min, max) {
  if (min !== null && isNaN(min)) {
    return { ok: false, error: 'Precio mínimo no válido' };
  }
  if (max !== null && isNaN(max)) {
    return { ok: false, error: 'Precio máximo no válido' };
  }
  if (min !== null && max !== null && min > max) {
    return { ok: false, error: 'El precio mínimo no puede ser mayor que el máximo' };
  }
  return { ok: true };
}

/**
 * Comprueba si una cadena tiene formato de email válido.
 * @param {string} str
 * @returns {boolean}
 */
function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

module.exports = { validatePriceRange, isValidEmail };
