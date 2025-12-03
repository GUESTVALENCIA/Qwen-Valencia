// ═══════════════════════════════════════════════════════════════════
// ESQUEMAS DE VALIDACIÓN COMPARTIDOS
// Esquemas de validación basados en tipos JSDoc, sincronizados con OpenAPI
// ═══════════════════════════════════════════════════════════════════

/**
 * @fileoverview Esquemas de validación compartidos frontend-backend
 * @module validation-schemas
 */

/**
 * Esquemas de validación para ValidatorMiddleware
 * Estos esquemas están sincronizados con los tipos JSDoc y OpenAPI
 */
const ValidationSchemas = {
  /**
   * Esquema para ChatRequest (Groq/Ollama)
   * @type {Object}
   */
  chatRequest: {
    body: {
      model: { 
        type: 'string', 
        required: true, 
        minLength: 1,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\-_:.]+$/
      },
      messages: { 
        type: 'array', 
        required: true,
        minLength: 1,
        validate: (messages) => {
          if (!Array.isArray(messages)) {
            return ['messages debe ser un array'];
          }
          const errors = [];
          messages.forEach((msg, idx) => {
            if (!msg.role || !['system', 'user', 'assistant'].includes(msg.role)) {
              errors.push(`messages[${idx}].role debe ser 'system', 'user' o 'assistant'`);
            }
            if (!msg.content || (typeof msg.content !== 'string' && typeof msg.content !== 'object')) {
              errors.push(`messages[${idx}].content es requerido y debe ser string u objeto`);
            }
          });
          return errors;
        }
      },
      temperature: { 
        type: 'number', 
        min: 0, 
        max: 2,
        default: 0.7
      },
      max_tokens: { 
        type: 'number', 
        min: 1, 
        max: 32768,
        default: 2048
      },
      stream: { 
        type: 'boolean',
        default: false
      },
      attachments: {
        type: 'array',
        required: false,
        validate: (attachments) => {
          if (!attachments || !Array.isArray(attachments)) {
            return [];
          }
          const errors = [];
          attachments.forEach((att, idx) => {
            if (!att.type || !['image', 'file', 'audio', 'video'].includes(att.type)) {
              errors.push(`attachments[${idx}].type debe ser 'image', 'file', 'audio' o 'video'`);
            }
            if (!att.url || typeof att.url !== 'string') {
              errors.push(`attachments[${idx}].url es requerido y debe ser string`);
            }
          });
          return errors;
        }
      }
    }
  },

  /**
   * Esquema para OllamaChatRequest (formato específico de Ollama)
   * @type {Object}
   */
  ollamaChatRequest: {
    body: {
      model: { 
        type: 'string', 
        required: true, 
        minLength: 1,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\-_:.]+$/
      },
      prompt: { 
        type: 'string', 
        required: true,
        minLength: 1,
        maxLength: 100000
      },
      images: {
        type: 'array',
        required: false,
        validate: (images) => {
          if (!images || !Array.isArray(images)) {
            return [];
          }
          return images.filter(img => typeof img !== 'string').map((_, idx) => 
            `images[${idx}] debe ser un string (base64 o URL)`
          );
        }
      },
      stream: { 
        type: 'boolean',
        default: false
      },
      options: {
        type: 'object',
        required: false,
        validate: (options) => {
          if (!options || typeof options !== 'object') {
            return [];
          }
          const errors = [];
          if (options.temperature !== undefined && (typeof options.temperature !== 'number' || options.temperature < 0 || options.temperature > 2)) {
            errors.push('options.temperature debe ser un número entre 0 y 2');
          }
          if (options.num_predict !== undefined && (typeof options.num_predict !== 'number' || options.num_predict < 1)) {
            errors.push('options.num_predict debe ser un número mayor a 0');
          }
          return errors;
        }
      }
    }
  },

  /**
   * Esquema para ModelRequest (obtener información de modelo)
   * @type {Object}
   */
  modelRequest: {
    params: {
      modelName: { 
        type: 'string', 
        required: true, 
        minLength: 1,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\-_:.]+$/
      }
    }
  },

  /**
   * Esquema para verificar disponibilidad de modelo
   * @type {Object}
   */
  modelAvailabilityRequest: {
    params: {
      modelName: { 
        type: 'string', 
        required: true, 
        minLength: 1,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\-_:.]+$/
      }
    }
  },

  /**
   * Esquema para health check (sin validación)
   * @type {Object}
   */
  healthCheck: {
    // Sin validación para health checks
  },

  /**
   * Esquema para ejecutar código
   * @type {Object}
   */
  executeCodeRequest: {
    body: {
      code: { 
        type: 'string', 
        required: true,
        minLength: 1,
        maxLength: 100000
      },
      language: {
        type: 'string',
        required: false,
        enum: ['python', 'javascript', 'bash', 'powershell', 'cmd'],
        default: 'python'
      },
      timeout: {
        type: 'number',
        required: false,
        min: 1000,
        max: 300000,
        default: 30000
      }
    }
  },

  /**
   * Esquema para listar modelos
   * @type {Object}
   */
  listModelsRequest: {
    query: {
      provider: {
        type: 'string',
        required: false,
        enum: ['groq', 'ollama', 'all'],
        default: 'all'
      },
      category: {
        type: 'string',
        required: false,
        enum: ['chat', 'code', 'api', 'all'],
        default: 'all'
      }
    }
  }
};

/**
 * Validador personalizado para arrays de mensajes
 * @param {Array} messages - Array de mensajes
 * @returns {Array<string>} Array de errores
 */
function validateMessages(messages) {
  if (!Array.isArray(messages)) {
    return ['messages debe ser un array'];
  }
  
  if (messages.length === 0) {
    return ['messages debe contener al menos un mensaje'];
  }
  
  const errors = [];
  messages.forEach((msg, idx) => {
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
  
  return errors;
}

/**
 * Validador personalizado para attachments
 * @param {Array} attachments - Array de attachments
 * @returns {Array<string>} Array de errores
 */
function validateAttachments(attachments) {
  if (!attachments || !Array.isArray(attachments)) {
    return [];
  }
  
  const errors = [];
  attachments.forEach((att, idx) => {
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
  
  return errors;
}

module.exports = {
  ValidationSchemas,
  validateMessages,
  validateAttachments
};

