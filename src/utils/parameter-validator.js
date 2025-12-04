/**
 * ═══════════════════════════════════════════════════════════════════
 * PARAMETER VALIDATOR - Validación de Parámetros Reutilizable
 * Validadores type-safe para funciones críticas
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Tipos de validación disponibles
 */
const VALIDATION_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  OBJECT: 'object',
  ARRAY: 'array',
  FUNCTION: 'function',
  DATE: 'date',
  EMAIL: 'email',
  URL: 'url',
  UUID: 'uuid',
  ENUM: 'enum',
  CUSTOM: 'custom'
};

/**
 * Errores de validación personalizados
 */
class ValidationError extends Error {
  constructor(message, field, value, expected) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.expected = expected;
  }
}

/**
 * Validador base
 */
class ParameterValidator {
  constructor() {
    this.rules = new Map();
  }

  /**
   * Agrega una regla de validación
   * @param {string} field - Nombre del campo
   * @param {Object} rule - Regla de validación
   * @param {string} rule.type - Tipo esperado
   * @param {boolean} rule.required - Si es requerido
   * @param {*} rule.default - Valor por defecto
   * @param {Function} rule.validator - Función de validación personalizada
   * @param {Array} rule.enum - Valores permitidos (para ENUM)
   * @param {number} rule.min - Valor mínimo (para NUMBER)
   * @param {number} rule.max - Valor máximo (para NUMBER)
   * @param {number} rule.minLength - Longitud mínima (para STRING/ARRAY)
   * @param {number} rule.maxLength - Longitud máxima (para STRING/ARRAY)
   */
  addRule(field, rule) {
    this.rules.set(field, rule);
    return this;
  }

  /**
   * Valida un objeto contra las reglas
   * @param {Object} data - Datos a validar
   * @param {Object} options - Opciones
   * @param {boolean} options.strict - Si true, rechaza campos no definidos
   * @returns {Object} Datos validados (con defaults aplicados)
   * @throws {ValidationError} Si la validación falla
   */
  validate(data, options = {}) {
    const { strict = false } = options;
    const validated = {};
    const errors = [];

    // Validar campos definidos
    for (const [field, rule] of this.rules.entries()) {
      const value = data[field];
      const isDefined = field in data;

      // Verificar requerido
      if (rule.required && !isDefined && rule.default === undefined) {
        errors.push(new ValidationError(
          `Campo requerido: ${field}`,
          field,
          undefined,
          rule.type
        ));
        continue;
      }

      // Aplicar default
      if (!isDefined && rule.default !== undefined) {
        validated[field] = typeof rule.default === 'function'
          ? rule.default()
          : rule.default;
        continue;
      }

      // Si no está definido y no es requerido, saltar
      if (!isDefined) {
        continue;
      }

      // Validar tipo
      const typeError = this._validateType(field, value, rule);
      if (typeError) {
        errors.push(typeError);
        continue;
      }

      // Validaciones adicionales
      const additionalErrors = this._validateAdditional(field, value, rule);
      errors.push(...additionalErrors);

      // Validación personalizada
      if (rule.validator && typeof rule.validator === 'function') {
        try {
          const customResult = rule.validator(value, data);
          if (customResult !== true) {
            errors.push(new ValidationError(
              customResult || `Validación personalizada falló para ${field}`,
              field,
              value,
              'custom'
            ));
          }
        } catch (error) {
          errors.push(new ValidationError(
            error.message || `Error en validación personalizada para ${field}`,
            field,
            value,
            'custom'
          ));
        }
      }

      validated[field] = value;
    }

    // Modo estricto: rechazar campos no definidos
    if (strict) {
      for (const field in data) {
        if (!this.rules.has(field)) {
          errors.push(new ValidationError(
            `Campo no permitido: ${field}`,
            field,
            data[field],
            undefined
          ));
        }
      }
    }

    if (errors.length > 0) {
      const error = new ValidationError(
        `Validación falló: ${errors.map(e => e.message).join(', ')}`,
        'multiple',
        data,
        'validated'
      );
      error.errors = errors;
      throw error;
    }

    return validated;
  }

  /**
   * Valida el tipo de un valor
   * @private
   */
  _validateType(field, value, rule) {
    const { type } = rule;

    switch (type) {
      case VALIDATION_TYPES.STRING:
        if (typeof value !== 'string') {
          return new ValidationError(
            `${field} debe ser string, recibido: ${typeof value}`,
            field,
            value,
            type
          );
        }
        break;

      case VALIDATION_TYPES.NUMBER:
        if (typeof value !== 'number' || isNaN(value)) {
          return new ValidationError(
            `${field} debe ser number, recibido: ${typeof value}`,
            field,
            value,
            type
          );
        }
        break;

      case VALIDATION_TYPES.BOOLEAN:
        if (typeof value !== 'boolean') {
          return new ValidationError(
            `${field} debe ser boolean, recibido: ${typeof value}`,
            field,
            value,
            type
          );
        }
        break;

      case VALIDATION_TYPES.OBJECT:
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return new ValidationError(
            `${field} debe ser object, recibido: ${typeof value}`,
            field,
            value,
            type
          );
        }
        break;

      case VALIDATION_TYPES.ARRAY:
        if (!Array.isArray(value)) {
          return new ValidationError(
            `${field} debe ser array, recibido: ${typeof value}`,
            field,
            value,
            type
          );
        }
        break;

      case VALIDATION_TYPES.FUNCTION:
        if (typeof value !== 'function') {
          return new ValidationError(
            `${field} debe ser function, recibido: ${typeof value}`,
            field,
            value,
            type
          );
        }
        break;

      case VALIDATION_TYPES.EMAIL:
        if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return new ValidationError(
            `${field} debe ser un email válido`,
            field,
            value,
            type
          );
        }
        break;

      case VALIDATION_TYPES.URL:
        try {
          new URL(value);
        } catch {
          return new ValidationError(
            `${field} debe ser una URL válida`,
            field,
            value,
            type
          );
        }
        break;

      default:
        // Tipo desconocido, no validar
        break;
    }

    return null;
  }

  /**
   * Valida reglas adicionales (min, max, length, enum, etc.)
   * @private
   */
  _validateAdditional(field, value, rule) {
    const errors = [];

    // ENUM
    if (rule.enum && Array.isArray(rule.enum)) {
      if (!rule.enum.includes(value)) {
        errors.push(new ValidationError(
          `${field} debe ser uno de: ${rule.enum.join(', ')}`,
          field,
          value,
          rule.enum
        ));
      }
    }

    // Min/Max para NUMBER
    if (rule.type === VALIDATION_TYPES.NUMBER) {
      if (rule.min !== undefined && value < rule.min) {
        errors.push(new ValidationError(
          `${field} debe ser >= ${rule.min}`,
          field,
          value,
          `>= ${rule.min}`
        ));
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push(new ValidationError(
          `${field} debe ser <= ${rule.max}`,
          field,
          value,
          `<= ${rule.max}`
        ));
      }
    }

    // MinLength/MaxLength para STRING/ARRAY
    if ((rule.type === VALIDATION_TYPES.STRING || rule.type === VALIDATION_TYPES.ARRAY)) {
      const length = value.length;
      if (rule.minLength !== undefined && length < rule.minLength) {
        errors.push(new ValidationError(
          `${field} debe tener longitud >= ${rule.minLength}`,
          field,
          value,
          `length >= ${rule.minLength}`
        ));
      }
      if (rule.maxLength !== undefined && length > rule.maxLength) {
        errors.push(new ValidationError(
          `${field} debe tener longitud <= ${rule.maxLength}`,
          field,
          value,
          `length <= ${rule.maxLength}`
        ));
      }
    }

    return errors;
  }
}

/**
 * Crea un validador nuevo
 * @returns {ParameterValidator}
 */
function createValidator() {
  return new ParameterValidator();
}

/**
 * Validador rápido para un objeto simple
 * @param {Object} data - Datos a validar
 * @param {Object} schema - Schema de validación
 * @returns {Object} Datos validados
 */
function quickValidate(data, schema) {
  const validator = createValidator();
  for (const [field, rule] of Object.entries(schema)) {
    validator.addRule(field, rule);
  }
  return validator.validate(data);
}

// Exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ParameterValidator,
    ValidationError,
    createValidator,
    quickValidate,
    VALIDATION_TYPES
  };
}

// Exportar para Browser
if (typeof window !== 'undefined') {
  window.ParameterValidator = ParameterValidator;
  window.ValidationError = ValidationError;
  window.createValidator = createValidator;
  window.quickValidate = quickValidate;
  window.VALIDATION_TYPES = VALIDATION_TYPES;
}

