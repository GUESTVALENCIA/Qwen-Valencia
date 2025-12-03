// ═══════════════════════════════════════════════════════════════════
// TIPOS DE ERRORES
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} APIErrorDetails
 * @property {string} [model] - Modelo relacionado con el error
 * @property {string} [suggestion] - Sugerencia para resolver el error
 * @property {number} [retryAfter] - Segundos antes de reintentar
 * @property {boolean} [circuitBreakerOpen] - Si el circuit breaker está abierto
 * @property {string} [ollamaUrl] - URL de Ollama (si aplica)
 * @property {*} [originalError] - Error original
 */

/**
 * @typedef {Object} APIErrorResponse
 * @property {string} code - Código de error
 * @property {string} message - Mensaje de error
 * @property {number} statusCode - Código HTTP
 * @property {APIErrorDetails} details - Detalles del error
 * @property {boolean} retryable - Si el error es retryable
 * @property {string} timestamp - Timestamp ISO del error
 */

/**
 * @typedef {('api'|'dom'|'storage'|'network'|'validation'|'permission'|'unknown')} ErrorType
 * Tipo de error
 */

/**
 * @typedef {('low'|'medium'|'high'|'critical')} ErrorSeverity
 * Severidad del error
 */

/**
 * @typedef {Object} ErrorContext
 * @property {ErrorType} type - Tipo de error
 * @property {ErrorSeverity} severity - Severidad
 * @property {string} source - Fuente del error
 * @property {Object} metadata - Metadatos adicionales
 * @property {boolean} [showToast=true] - Si mostrar toast al usuario
 * @property {boolean} [logToConsole=true] - Si loggear en consola
 */

module.exports = {
  // Tipos exportados para uso en JSDoc
};

