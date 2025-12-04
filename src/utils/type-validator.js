/**
 * ════════════════════════════════════════════════════════════════════════════
 * TYPE VALIDATOR - Validación de Tipos en Runtime
 * Valida tipos basados en JSDoc y proporciona type safety en runtime
 * ════════════════════════════════════════════════════════════════════════════
 */

const { createValidator, VALIDATION_TYPES } = require('./parameter-validator');
const { LoggerFactory } = require('./logger');

const logger = LoggerFactory.create({ service: 'type-validator' });

/**
 * Type Validator - Valida tipos en runtime basado en definiciones
 */
class TypeValidator {
  constructor() {
    this.validators = new Map(); // typeName -> validator function
    this.schemas = new Map(); // typeName -> schema definition
  }

  /**
   * Registra un tipo con su validador
   * @param {string} typeName - Nombre del tipo
   * @param {Object} schema - Schema de validación
   */
  registerType(typeName, schema) {
    const validator = createValidator();

    // Convertir schema a reglas de validación
    for (const [field, rule] of Object.entries(schema)) {
      validator.addRule(field, rule);
    }

    this.validators.set(typeName, validator);
    this.schemas.set(typeName, schema);

    logger.debug('Tipo registrado', { typeName, fields: Object.keys(schema) });
  }

  /**
   * Valida un valor contra un tipo
   * @param {string} typeName - Nombre del tipo
   * @param {*} value - Valor a validar
   * @returns {Object} { valid: boolean, errors: Array, validated: Object }
   */
  validate(typeName, value) {
    const validator = this.validators.get(typeName);

    if (!validator) {
      return {
        valid: false,
        errors: [`Tipo ${typeName} no registrado`],
        validated: null
      };
    }

    try {
      const validated = validator.validate(value);
      return {
        valid: true,
        errors: [],
        validated
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
        validated: null
      };
    }
  }

  /**
   * Valida y retorna el valor validado o lanza error
   * @param {string} typeName - Nombre del tipo
   * @param {*} value - Valor a validar
   * @returns {*} Valor validado
   * @throws {Error} Si la validación falla
   */
  validateOrThrow(typeName, value) {
    const result = this.validate(typeName, value);

    if (!result.valid) {
      const error = new Error(`Validación de tipo ${typeName} falló: ${result.errors.join(', ')}`);
      error.type = 'TypeValidationError';
      error.errors = result.errors;
      throw error;
    }

    return result.validated;
  }

  /**
   * Valida parámetros de función
   * @param {Object} paramTypes - Mapa de nombre de parámetro -> tipo
   * @param {Object} params - Parámetros a validar
   * @returns {Object} Parámetros validados
   */
  validateParams(paramTypes, params) {
    const validated = {};
    const errors = [];

    for (const [paramName, typeName] of Object.entries(paramTypes)) {
      const value = params[paramName];
      const result = this.validate(typeName, value);

      if (!result.valid) {
        errors.push(`Parámetro ${paramName}: ${result.errors.join(', ')}`);
      } else {
        validated[paramName] = result.validated;
      }
    }

    if (errors.length > 0) {
      const error = new Error(`Validación de parámetros falló: ${errors.join('; ')}`);
      error.type = 'ParameterValidationError';
      error.errors = errors;
      throw error;
    }

    return validated;
  }
}

// Instancia global del type validator
const globalTypeValidator = new TypeValidator();

/**
 * Registra tipos comunes del sistema
 */
function registerCommonTypes() {
  // ModelId - string no vacío
  globalTypeValidator.registerType('ModelId', {
    model: {
      type: VALIDATION_TYPES.STRING,
      required: true,
      minLength: 1
    }
  });

  // ChatMessage
  globalTypeValidator.registerType('ChatMessage', {
    role: {
      type: VALIDATION_TYPES.ENUM,
      required: true,
      enum: ['system', 'user', 'assistant']
    },
    content: {
      type: VALIDATION_TYPES.STRING,
      required: true,
      minLength: 1
    },
    timestamp: {
      type: VALIDATION_TYPES.STRING,
      required: false
    }
  });

  // MessageRequest
  globalTypeValidator.registerType('MessageRequest', {
    text: {
      type: VALIDATION_TYPES.STRING,
      required: true,
      minLength: 1
    },
    attachments: {
      type: VALIDATION_TYPES.ARRAY,
      required: false,
      default: []
    },
    model: {
      type: VALIDATION_TYPES.STRING,
      required: false
    },
    useAPI: {
      type: VALIDATION_TYPES.BOOLEAN,
      required: false,
      default: true
    }
  });
}

// Registrar tipos comunes al cargar
registerCommonTypes();

module.exports = {
  TypeValidator,
  globalTypeValidator,
  registerCommonTypes
};
