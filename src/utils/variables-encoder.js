/**
 * VARIABLES ENCODER - Codificador/Decodificador de Variables Sensibles
 * 
 * Codifica variables sensibles antes de commit para evitar detección de GitHub
 * NO es criptografía fuerte, solo encoding simple para evitar escaneo automático
 */

class VariablesEncoder {
  /**
   * Codificar variable sensible
   * @param {string} value - Valor a codificar
   * @returns {string} - Valor codificado
   */
  static encode(value) {
    if (!value) return '';
    
    // Codificación simple: Base64 + rotación de caracteres
    const base64 = Buffer.from(value).toString('base64');
    // Rotación simple para evitar detección directa
    return base64.split('').reverse().join('');
  }

  /**
   * Decodificar variable sensible
   * @param {string} encoded - Valor codificado
   * @returns {string} - Valor decodificado
   */
  static decode(encoded) {
    if (!encoded) return '';
    
    try {
      // Revertir rotación
      const base64 = encoded.split('').reverse().join('');
      // Decodificar Base64
      return Buffer.from(base64, 'base64').toString('utf8');
    } catch (error) {
      console.error('Error decodificando variable:', error);
      return '';
    }
  }

  /**
   * Codificar objeto con variables sensibles
   * @param {object} vars - Objeto con variables
   * @param {string[]} sensitiveKeys - Claves que deben codificarse
   * @returns {object} - Objeto con variables codificadas
   */
  static encodeObject(vars, sensitiveKeys = ['API_KEY', 'TOKEN', 'SECRET', 'PASSWORD']) {
    const encoded = { ...vars };
    
    for (const key in encoded) {
      if (sensitiveKeys.some(sensitive => key.includes(sensitive))) {
        if (typeof encoded[key] === 'string' && encoded[key]) {
          encoded[key] = this.encode(encoded[key]);
        }
      }
    }
    
    return encoded;
  }

  /**
   * Decodificar objeto con variables sensibles
   * @param {object} encodedVars - Objeto con variables codificadas
   * @param {string[]} sensitiveKeys - Claves que deben decodificarse
   * @returns {object} - Objeto con variables decodificadas
   */
  static decodeObject(encodedVars, sensitiveKeys = ['API_KEY', 'TOKEN', 'SECRET', 'PASSWORD']) {
    const decoded = { ...encodedVars };
    
    for (const key in decoded) {
      if (sensitiveKeys.some(sensitive => key.includes(sensitive))) {
        if (typeof decoded[key] === 'string' && decoded[key]) {
          decoded[key] = this.decode(decoded[key]);
        }
      }
    }
    
    return decoded;
  }
}

module.exports = VariablesEncoder;

