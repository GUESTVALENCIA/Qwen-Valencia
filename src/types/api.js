// ═══════════════════════════════════════════════════════════════════
// TIPOS DE API
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} APIRequest
 * @property {string} endpoint - Endpoint de la API
 * @property {string} [method='GET'] - Método HTTP
 * @property {Object} [headers] - Headers HTTP
 * @property {Object|string} [body] - Body de la petición
 * @property {number} [timeout] - Timeout en ms
 * @property {string} [correlationId] - ID de correlación
 */

/**
 * @typedef {Object} APIResponse
 * @property {boolean} success - Si la petición fue exitosa
 * @property {*} data - Datos de la respuesta
 * @property {number} status - Código de estado HTTP
 * @property {Object} headers - Headers de la respuesta
 * @property {string} correlationId - ID de correlación
 * @property {number} [duration] - Duración en ms
 */

/**
 * @typedef {Object} ChatAPIRequest
 * @property {string} model - Modelo a usar
 * @property {ChatMessage[]} messages - Mensajes de la conversación
 * @property {number} [temperature=0.7] - Temperatura
 * @property {number} [max_tokens=4096] - Máximo de tokens
 * @property {boolean} [stream=false] - Si usar streaming
 * @property {MessageAttachment[]} [attachments] - Attachments
 */

/**
 * @typedef {Object} ChatAPIResponse
 * @property {string} content - Contenido de la respuesta
 * @property {string} model - Modelo usado
 * @property {number} [tokens] - Tokens usados
 * @property {number} [duration] - Duración en ms
 * @property {Object} [metadata] - Metadatos adicionales
 */

/**
 * @typedef {Object} HealthCheckResponse
 * @property {string} status - Estado ('ok'|'error')
 * @property {string} service - Nombre del servicio
 * @property {number} [uptime] - Tiempo activo en segundos
 * @property {Object} [metrics] - Métricas del servicio
 */

module.exports = {
  // Tipos exportados para uso en JSDoc
};

