// ═══════════════════════════════════════════════════════════════════
// TIPOS DE CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} ServiceConfig
 * @property {number} port - Puerto del servicio
 * @property {string} baseUrl - URL base del servicio
 * @property {number} timeout - Timeout en ms
 * @property {number} maxConcurrentRequests - Máximo de requests concurrentes
 * @property {Object} [apiKeys] - API keys (array o string)
 * @property {Object} [cors] - Configuración CORS
 * @property {Object} [rateLimit] - Configuración de rate limiting
 */

/**
 * @typedef {Object} GroqConfig
 * @property {string|string[]} apiKey - API key(s) de Groq
 * @property {number} port - Puerto del servidor Groq API
 * @property {number} timeout - Timeout en ms
 * @property {number} maxConcurrentRequests - Máximo de requests concurrentes
 * @property {number} maxRequestsPerKey - Máximo de requests por key
 * @property {number} blockDuration - Duración de bloqueo en ms
 */

/**
 * @typedef {Object} OllamaConfig
 * @property {string} baseUrl - URL base de Ollama
 * @property {number} port - Puerto del servidor Ollama MCP
 * @property {number} timeout - Timeout en ms
 * @property {number} maxConcurrentRequests - Máximo de requests concurrentes
 * @property {number} modelsCacheTTL - TTL del cache de modelos en ms
 * @property {number} cacheTTL - TTL del cache general en ms
 * @property {number} maxCacheSize - Tamaño máximo del cache
 */

/**
 * @typedef {Object} MCPConfig
 * @property {number} port - Puerto del servidor MCP
 * @property {string} secretKey - Secret key para autenticación
 * @property {number} timeout - Timeout en ms
 */

/**
 * @typedef {Object} APIConfig
 * @property {number} port - Puerto del servidor API
 * @property {Object} cors - Configuración CORS
 * @property {string[]} cors.origin - Orígenes permitidos
 * @property {boolean} cors.credentials - Si permitir credenciales
 * @property {string[]} cors.methods - Métodos HTTP permitidos
 * @property {string[]} cors.headers - Headers permitidos
 */

/**
 * @typedef {Object} ServiceAppConfig
 * Configuración de servicios backend de la aplicación
 * @property {GroqConfig} groq - Configuración de Groq
 * @property {OllamaConfig} ollama - Configuración de Ollama
 * @property {MCPConfig} mcp - Configuración de MCP
 * @property {APIConfig} api - Configuración de API
 * @property {string} environment - Ambiente ('development'|'production')
 * @property {boolean} isDevelopment - Si está en desarrollo
 * @property {boolean} isProduction - Si está en producción
 */

module.exports = {
  // Tipos exportados para uso en JSDoc
};

