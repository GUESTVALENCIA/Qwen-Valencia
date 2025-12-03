// ═══════════════════════════════════════════════════════════════════
// VALIDACIÓN FRONTEND - Validación de Contratos API
// Validación client-side de requests antes de enviarlos al backend
// ═══════════════════════════════════════════════════════════════════

/**
 * @fileoverview Validación de contratos API en el frontend
 * @module validation
 */

/**
 * Validador de contratos API para frontend
 * Sincronizado con validation-schemas.js del backend
 */
class FrontendValidator {
  /**
   * Valida un ChatRequest
   * @param {Object} request - Request a validar
   * @returns {{valid: boolean, errors: string[]}}
   */
  static validateChatRequest(request) {
    const errors = [];

    // Validar model
    if (!request.model || typeof request.model !== 'string' || request.model.trim().length === 0) {
      errors.push('model es requerido y debe ser un string no vacío');
    } else if (request.model.length > 100) {
      errors.push('model no debe exceder 100 caracteres');
    } else if (!/^[a-zA-Z0-9\-_:.]+$/.test(request.model)) {
      errors.push('model contiene caracteres inválidos');
    }

    // Validar messages
    if (!request.messages || !Array.isArray(request.messages)) {
      errors.push('messages es requerido y debe ser un array');
    } else if (request.messages.length === 0) {
      errors.push('messages debe contener al menos un mensaje');
    } else {
      request.messages.forEach((msg, idx) => {
        if (!msg || typeof msg !== 'object') {
          errors.push(`messages[${idx}] debe ser un objeto`);
          return;
        }
        
        if (!msg.role || !['system', 'user', 'assistant'].includes(msg.role)) {
          errors.push(`messages[${idx}].role debe ser 'system', 'user' o 'assistant'`);
        }
        
        if (msg.content === undefined || msg.content === null) {
          errors.push(`messages[${idx}].content es requerido`);
        } else if (typeof msg.content !== 'string' && typeof msg.content !== 'object') {
          errors.push(`messages[${idx}].content debe ser string u objeto`);
        }
      });
    }

    // Validar temperature
    if (request.temperature !== undefined) {
      if (typeof request.temperature !== 'number' || request.temperature < 0 || request.temperature > 2) {
        errors.push('temperature debe ser un número entre 0 y 2');
      }
    }

    // Validar max_tokens
    if (request.max_tokens !== undefined) {
      if (typeof request.max_tokens !== 'number' || request.max_tokens < 1 || request.max_tokens > 32768) {
        errors.push('max_tokens debe ser un número entre 1 y 32768');
      }
    }

    // Validar stream
    if (request.stream !== undefined && typeof request.stream !== 'boolean') {
      errors.push('stream debe ser un boolean');
    }

    // Validar attachments
    if (request.attachments !== undefined) {
      if (!Array.isArray(request.attachments)) {
        errors.push('attachments debe ser un array');
      } else {
        request.attachments.forEach((att, idx) => {
          if (!att || typeof att !== 'object') {
            errors.push(`attachments[${idx}] debe ser un objeto`);
            return;
          }
          
          if (!att.type || !['image', 'file', 'audio', 'video'].includes(att.type)) {
            errors.push(`attachments[${idx}].type debe ser 'image', 'file', 'audio' o 'video'`);
          }
          
          if (!att.url || typeof att.url !== 'string') {
            errors.push(`attachments[${idx}].url es requerido y debe ser string`);
          }
          
          if (att.type === 'image') {
            if (att.width !== undefined && (typeof att.width !== 'number' || att.width < 1)) {
              errors.push(`attachments[${idx}].width debe ser un número positivo`);
            }
            if (att.height !== undefined && (typeof att.height !== 'number' || att.height < 1)) {
              errors.push(`attachments[${idx}].height debe ser un número positivo`);
            }
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Valida un MessageRequest (formato simplificado para frontend)
   * @param {Object} request - Request a validar
   * @returns {{valid: boolean, errors: string[]}}
   */
  static validateMessageRequest(request) {
    const errors = [];

    // Validar text
    if (!request.text || typeof request.text !== 'string' || request.text.trim().length === 0) {
      errors.push('text es requerido y debe ser un string no vacío');
    } else if (request.text.length > 100000) {
      errors.push('text no debe exceder 100000 caracteres');
    }

    // Validar model (opcional)
    if (request.model !== undefined) {
      if (typeof request.model !== 'string' || request.model.trim().length === 0) {
        errors.push('model debe ser un string no vacío si se proporciona');
      } else if (request.model.length > 100) {
        errors.push('model no debe exceder 100 caracteres');
      }
    }

    // Validar useAPI (opcional)
    if (request.useAPI !== undefined && typeof request.useAPI !== 'boolean') {
      errors.push('useAPI debe ser un boolean si se proporciona');
    }

    // Validar attachments
    if (request.attachments !== undefined) {
      if (!Array.isArray(request.attachments)) {
        errors.push('attachments debe ser un array');
      } else {
        request.attachments.forEach((att, idx) => {
          if (!att || typeof att !== 'object') {
            errors.push(`attachments[${idx}] debe ser un objeto`);
            return;
          }
          
          if (!att.type || !['image', 'file', 'audio', 'video'].includes(att.type)) {
            errors.push(`attachments[${idx}].type debe ser 'image', 'file', 'audio' o 'video'`);
          }
          
          if (!att.url || typeof att.url !== 'string') {
            errors.push(`attachments[${idx}].url es requerido y debe ser string`);
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitiza un string (elimina caracteres de control)
   * @param {string} value - String a sanitizar
   * @returns {string} String sanitizado
   */
  static sanitizeString(value) {
    if (typeof value !== 'string') {
      return value;
    }
    
    return value
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim();
  }

  /**
   * Sanitiza un objeto recursivamente
   * @param {Object} obj - Objeto a sanitizar
   * @returns {Object} Objeto sanitizado
   */
  static sanitizeObject(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          sanitized[key] = this.sanitizeString(value);
        } else if (typeof value === 'object') {
          sanitized[key] = this.sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    return obj;
  }
}

// Exportar para uso global en el navegador
if (typeof window !== 'undefined') {
  window.FrontendValidator = FrontendValidator;
}

// Solo exportar si estamos en Node.js (no en navegador)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FrontendValidator;
}

