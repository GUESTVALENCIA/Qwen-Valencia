// ═══════════════════════════════════════════════════════════════════
// TIPOS DE ESTADO
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {('agent'|'chat'|'code')} AppMode
 * Modo de la aplicación
 */

/**
 * @typedef {Object} UIConfig
 * Configuración de UI/frontend de la aplicación
 * @property {string} ollamaUrl - URL de Ollama
 * @property {number} temperature - Temperatura por defecto
 * @property {number} maxTokens - Máximo de tokens por defecto
 * @property {string} [cartesiaVoiceId] - ID de voz de Cartesia
 */

/**
 * @typedef {Object} AppState
 * Estado completo de la aplicación frontend
 * @property {string} model - Modelo seleccionado
 * @property {AppMode} mode - Modo de la aplicación
 * @property {ChatMessage[]} messages - Mensajes de la conversación
 * @property {boolean} isGenerating - Si está generando respuesta
 * @property {string|null} attachedImage - Imagen adjunta (base64 o URL)
 * @property {Object|null} stream - Stream activo
 * @property {UIConfig} config - Configuración de UI de la app
 * @property {string} theme - Tema ('dark'|'light')
 * @property {boolean} useAPI - Si usar API (Groq) o local (Ollama)
 * @property {boolean} autoMode - Si está en modo auto
 * @property {boolean} maxMode - Si está en modo máximo
 * @property {boolean} multiModel - Si está en modo multi-modelo
 * @property {string[]} selectedModels - Modelos seleccionados (multi-modelo)
 * @property {string|null} autoModeMaxModel - Modelo máximo para auto mode
 * @property {boolean} voiceCallActive - Si hay llamada de voz activa
 * @property {boolean} deepgramAvailable - Si Deepgram está disponible
 * @property {boolean} micActive - Si el micrófono está activo
 */

/**
 * @typedef {Object} MemoryInfo
 * @property {number} total - Memoria total en MB
 * @property {number} free - Memoria libre en MB
 * @property {number} used - Memoria usada en MB
 * @property {number} available - Memoria disponible en MB
 * @property {number} percentage - Porcentaje de uso
 */

module.exports = {
  // Tipos exportados para uso en JSDoc
};

