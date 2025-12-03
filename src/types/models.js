// ═══════════════════════════════════════════════════════════════════
// TIPOS DE MODELOS
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {('Groq'|'Ollama')} ModelProvider
 * Proveedor del modelo (Groq API o Ollama local)
 */

/**
 * @typedef {('Chat'|'Código'|'API'|'Auto')} ModelCategory
 * Categoría del modelo
 */

/**
 * @typedef {Object} ModelInfo
 * @property {string} name - Nombre completo del modelo
 * @property {ModelProvider} provider - Proveedor (Groq/Ollama)
 * @property {string} tokens - Contexto de tokens (ej: "32K", "16K")
 * @property {string} version - Versión del modelo
 * @property {ModelCategory} category - Categoría del modelo
 * @property {string} compact - Nombre compacto para UI
 * @property {string[]} capabilities - Lista de capacidades
 * @property {string} description - Descripción del modelo
 */

/**
 * @typedef {string} ModelId
 * ID del modelo (ej: "qwen-2.5-72b-instruct", "deepseek-coder:6.7b")
 */

/**
 * @typedef {Object} ModelConfig
 * @property {ModelId} model - ID del modelo a usar
 * @property {number} [temperature=0.7] - Temperatura (0-2)
 * @property {number} [maxTokens=4096] - Máximo de tokens
 * @property {boolean} [stream=false] - Si usar streaming
 * @property {boolean} [useAPI=true] - Si usar API (Groq) o local (Ollama)
 */

/**
 * @typedef {Object} ModelCapabilities
 * @property {boolean} vision - Si el modelo soporta imágenes
 * @property {boolean} code - Si el modelo está especializado en código
 * @property {boolean} reasoning - Si el modelo tiene capacidades de razonamiento
 * @property {boolean} streaming - Si el modelo soporta streaming
 */

/**
 * @typedef {Object} ModelMetadata
 * @property {ModelId} id - ID del modelo
 * @property {ModelInfo} info - Información del modelo
 * @property {ModelCapabilities} capabilities - Capacidades del modelo
 * @property {boolean} available - Si el modelo está disponible
 * @property {number} [ramRequired] - RAM requerida en MB (para modelos locales)
 */

module.exports = {
  // Tipos exportados para uso en JSDoc
};

