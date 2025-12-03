// ═══════════════════════════════════════════════════════════════════
// VALIDATOR MIDDLEWARE - Validación de Entrada Centralizada
// Validación y sanitización de request bodies, query params y path params
// ═══════════════════════════════════════════════════════════════════

const { APIError } = require('../utils/api-error');
const { ValidationSchemas, validateMessages, validateAttachments } = require('../types/validation-schemas');

/**
 * Validador de entrada centralizado
 */
class ValidatorMiddleware {
  constructor() {
    this.schemas = new Map();
  }

  /**
   * Registra un esquema de validación para una ruta
   */
  registerSchema(route, schema) {
    this.schemas.set(route, schema);
  }

  /**
   * Valida un valor contra un esquema simple
   */
  validateValue(value, rules) {
    const errors = [];

    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${rules.name || 'Campo'} es requerido`);
    }

    if (value !== undefined && value !== null && value !== '') {
      if (rules.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rules.type) {
          errors.push(`${rules.name || 'Campo'} debe ser de tipo ${rules.type}`);
        }
      }

      if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
        errors.push(`${rules.name || 'Campo'} debe tener al menos ${rules.minLength} caracteres`);
      }

      if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
        errors.push(`${rules.name || 'Campo'} no debe exceder ${rules.maxLength} caracteres`);
      }

      if (rules.min && typeof value === 'number' && value < rules.min) {
        errors.push(`${rules.name || 'Campo'} debe ser al menos ${rules.min}`);
      }

      if (rules.max && typeof value === 'number' && value > rules.max) {
        errors.push(`${rules.name || 'Campo'} no debe exceder ${rules.max}`);
      }

      if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
        errors.push(`${rules.name || 'Campo'} no cumple con el formato requerido`);
      }

      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${rules.name || 'Campo'} debe ser uno de: ${rules.enum.join(', ')}`);
      }
    }

    return errors;
  }

  /**
   * Valida un objeto contra un esquema
   */
  validateObject(data, schema) {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      const fieldErrors = this.validateValue(value, { ...rules, name: field });
      errors.push(...fieldErrors);
    }

    // Verificar campos adicionales no permitidos
    const allowedFields = Object.keys(schema);
    const providedFields = Object.keys(data);
    const extraFields = providedFields.filter(field => !allowedFields.includes(field));
    
    if (extraFields.length > 0 && schema._strict !== false) {
      errors.push(`Campos no permitidos: ${extraFields.join(', ')}`);
    }

    return errors;
  }

  /**
   * Sanitiza un string
   */
  sanitizeString(value) {
    if (typeof value !== 'string') {
      return value;
    }
    
    // Eliminar caracteres de control
    return value
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim();
  }

  /**
   * Sanitiza un objeto recursivamente
   */
  sanitizeObject(obj, schema = null) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, schema));
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        if (schema && schema[key] && schema[key].sanitize) {
          sanitized[key] = this.sanitizeString(value);
        } else if (typeof value === 'string') {
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

  /**
   * Middleware de validación para una ruta específica
   */
  validate(route, schema) {
    return (req, res, next) => {
      // Obtener esquema (puede ser pasado directamente o registrado)
      const validationSchema = schema || this.schemas.get(route);
      
      if (!validationSchema) {
        return next(); // Sin esquema, pasar sin validar
      }

      // Validar body
      if (validationSchema.body && req.body) {
        const bodyErrors = this.validateObject(req.body, validationSchema.body);
        if (bodyErrors.length > 0) {
          const error = APIError.invalidRequest('Errores de validación en body', {
            errors: bodyErrors,
            field: 'body'
          });
          return res.status(error.statusCode).json(error.toJSON());
        }
        
        // Sanitizar body
        req.body = this.sanitizeObject(req.body, validationSchema.body);
      }

      // Validar query params
      if (validationSchema.query && req.query) {
        const queryErrors = this.validateObject(req.query, validationSchema.query);
        if (queryErrors.length > 0) {
          const error = APIError.invalidRequest('Errores de validación en query params', {
            errors: queryErrors,
            field: 'query'
          });
          return res.status(error.statusCode).json(error.toJSON());
        }
        
        // Sanitizar query
        req.query = this.sanitizeObject(req.query, validationSchema.query);
      }

      // Validar path params
      if (validationSchema.params && req.params) {
        const paramsErrors = this.validateObject(req.params, validationSchema.params);
        if (paramsErrors.length > 0) {
          const error = APIError.invalidRequest('Errores de validación en path params', {
            errors: paramsErrors,
            field: 'params'
          });
          return res.status(error.statusCode).json(error.toJSON());
        }
      }

      next();
    };
  }

  /**
   * Esquemas predefinidos comunes
   * Usa esquemas compartidos de validation-schemas.js
   */
  static get commonSchemas() {
    return ValidationSchemas;
  }

  /**
   * Factory method
   */
  static create() {
    return new ValidatorMiddleware();
  }
}

module.exports = ValidatorMiddleware;

