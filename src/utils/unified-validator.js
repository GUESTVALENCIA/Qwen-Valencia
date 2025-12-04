/**
 * ════════════════════════════════════════════════════════════════════════════
 * UNIFIED VALIDATOR - Validación Consolidada Enterprise-Level
 * Consolida parameter-validator, ipc-validator, middleware/validator
 * Una sola fuente de verdad para validación
 * ════════════════════════════════════════════════════════════════════════════
 */

const { createValidator, quickValidate } = require('./parameter-validator');
const { globalTypeValidator } = require('./type-validator');
const { validateSchema: validateIPCSchema, IPC_SCHEMAS } = require('../app/ipc-validator');
const { LoggerFactory } = require('./logger');

const logger = LoggerFactory.create({ service: 'unified-validator' });

/**
 * Unified Validator - Consolida todas las validaciones del sistema
 */
class UnifiedValidator {
  constructor() {
    this.validators = new Map(); // context -> validator
    this.schemas = new Map(); // schemaName -> schema
  }

  /**
   * Registra un schema de validación
   * @param {string} schemaName - Nombre del schema
   * @param {Object} schema - Schema de validación
   * @param {string} context - Contexto (ipc, api, frontend)
   */
  registerSchema(schemaName, schema, context = 'api') {
    const validator = createValidator();

    // Convertir schema a reglas de validación
    for (const [field, rule] of Object.entries(schema)) {
      validator.addRule(field, rule);
    }

    const key = `${context}:${schemaName}`;
    this.validators.set(key, validator);
    this.schemas.set(key, schema);

    logger.debug('Schema registrado', { schemaName, context, fields: Object.keys(schema) });
  }

  /**
   * Valida datos usando un schema registrado
   * @param {string} schemaName - Nombre del schema
   * @param {*} data - Datos a validar
   * @param {string} context - Contexto (ipc, api, frontend)
   * @returns {Object} { valid: boolean, errors: Array, validated: Object }
   */
  validate(schemaName, data, context = 'api') {
    const key = `${context}:${schemaName}`;
    const validator = this.validators.get(key);
    const schema = this.schemas.get(key);

    if (!validator || !schema) {
      return {
        valid: false,
        errors: [`Schema ${schemaName} no registrado en contexto ${context}`],
        validated: null
      };
    }

    try {
      const validated = validator.validate(data);
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
   * Valida datos IPC usando schemas de IPC
   * @param {string} channel - Canal IPC
   * @param {*} params - Parámetros a validar
   * @returns {Object} { valid: boolean, errors: Array, validated: Object }
   */
  validateIPC(channel, params) {
    return validateIPCSchema(channel, params);
  }

  /**
   * Valida datos usando type-validator
   * @param {string} typeName - Nombre del tipo
   * @param {*} value - Valor a validar
   * @returns {Object} { valid: boolean, errors: Array, validated: Object }
   */
  validateType(typeName, value) {
    return globalTypeValidator.validate(typeName, value);
  }

  /**
   * Validación rápida (quick validate)
   * @param {*} value - Valor a validar
   * @param {Object} rule - Regla de validación
   * @returns {boolean} Si es válido
   */
  quickValidate(value, rule) {
    return quickValidate(value, rule);
  }

  /**
   * Valida y retorna el valor validado o lanza error
   * @param {string} schemaName - Nombre del schema
   * @param {*} data - Datos a validar
   * @param {string} context - Contexto
   * @returns {*} Datos validados
   * @throws {Error} Si la validación falla
   */
  validateOrThrow(schemaName, data, context = 'api') {
    const result = this.validate(schemaName, data, context);

    if (!result.valid) {
      const error = new Error(`Validación falló para ${schemaName}: ${result.errors.join(', ')}`);
      error.type = 'ValidationError';
      error.errors = result.errors;
      error.schemaName = schemaName;
      error.context = context;
      throw error;
    }

    return result.validated;
  }

  /**
   * Carga schemas IPC en el unified validator
   */
  loadIPCSchemas() {
    for (const [channel, schema] of Object.entries(IPC_SCHEMAS)) {
      this.registerSchema(channel, schema, 'ipc');
    }
    logger.info('Schemas IPC cargados', { count: Object.keys(IPC_SCHEMAS).length });
  }

  /**
   * Carga tipos comunes del type-validator
   */
  loadCommonTypes() {
    // Los tipos ya están registrados en globalTypeValidator
    // Solo loguear que están disponibles
    logger.debug('Tipos comunes disponibles desde type-validator');
  }

  /**
   * Obtiene estadísticas de validación
   */
  getStats() {
    return {
      schemas: this.schemas.size,
      validators: this.validators.size,
      ipcSchemas: Object.keys(IPC_SCHEMAS).length,
      contexts: Array.from(new Set(Array.from(this.schemas.keys()).map(k => k.split(':')[0])))
    };
  }
}

// Instancia global del unified validator
const globalUnifiedValidator = new UnifiedValidator();

// Cargar schemas IPC al inicializar
globalUnifiedValidator.loadIPCSchemas();
globalUnifiedValidator.loadCommonTypes();

module.exports = {
  UnifiedValidator,
  globalUnifiedValidator
};

