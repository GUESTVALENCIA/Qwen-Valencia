/**
 * API KEY CLEANER - Limpieza robusta de API keys para headers HTTP
 * Elimina TODOS los caracteres inválidos que pueden causar errores en headers
 */

class APIKeyCleaner {
  /**
   * Limpiar API key para uso en headers HTTP
   * Elimina caracteres de control, espacios, saltos de línea, etc.
   * @param {string} apiKey - API key a limpiar
   * @returns {string} - API key limpia y validada
   */
  static clean(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return '';
    }

    // Paso 1: Eliminar comillas simples y dobles
    let cleaned = apiKey.replace(/['"]/g, '');
    
    // Paso 2: Eliminar TODOS los espacios (espacios, tabs, etc.)
    cleaned = cleaned.replace(/\s+/g, '');
    
    // Paso 3: Eliminar caracteres de control (incluyendo \r, \n, \t, etc.)
    cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    
    // Paso 4: Eliminar caracteres no ASCII (solo mantener ASCII printable)
    cleaned = cleaned.replace(/[^\x20-\x7E]/g, '');
    
    // Paso 5: Trim final
    cleaned = cleaned.trim();
    
    return cleaned;
  }

  /**
   * Validar formato de API key de Groq
   * @param {string} apiKey - API key a validar
   * @returns {boolean} - true si es válida
   */
  static validateGroqKey(apiKey) {
    if (!apiKey || apiKey.length < 20) {
      return false;
    }
    
    // Groq API keys suelen empezar con 'gsk_'
    if (!apiKey.startsWith('gsk_')) {
      return false;
    }
    
    // Solo caracteres alfanuméricos y guiones bajos después de 'gsk_'
    const pattern = /^gsk_[a-zA-Z0-9_]+$/;
    return pattern.test(apiKey);
  }

  /**
   * Limpiar y validar API key de Groq
   * @param {string} apiKey - API key a limpiar y validar
   * @returns {object} - { cleaned: string, valid: boolean, error?: string }
   */
  static cleanAndValidateGroq(apiKey) {
    const cleaned = this.clean(apiKey);
    
    if (!cleaned) {
      return {
        cleaned: '',
        valid: false,
        error: 'API key vacía después de limpieza'
      };
    }
    
    if (!this.validateGroqKey(cleaned)) {
      return {
        cleaned: cleaned,
        valid: false,
        error: `Formato de API key inválido. Debe empezar con 'gsk_' y tener al menos 20 caracteres. Longitud actual: ${cleaned.length}`
      };
    }
    
    return {
      cleaned: cleaned,
      valid: true
    };
  }
}

module.exports = APIKeyCleaner;

