// ═══════════════════════════════════════════════════════════════════
// TIPOS DE MENSAJES
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {('system'|'user'|'assistant')} MessageRole
 * Rol del mensaje en la conversación
 */

/**
 * @typedef {Object} MessageContent
 * @property {string} [text] - Contenido de texto
 * @property {string} [image] - URL o base64 de imagen
 * @property {string} [type='text'] - Tipo de contenido
 */

/**
 * @typedef {Object} ChatMessage
 * @property {MessageRole} role - Rol del mensaje
 * @property {string|MessageContent} content - Contenido del mensaje
 * @property {string} [name] - Nombre opcional del autor
 * @property {string} [timestamp] - Timestamp ISO del mensaje
 * @property {string} [id] - ID único del mensaje
 */

/**
 * @typedef {Object} MessageAttachment
 * @property {string} type - Tipo de attachment ('image', 'file', etc.)
 * @property {string} url - URL o base64 del attachment
 * @property {string} [name] - Nombre del archivo
 * @property {number} [size] - Tamaño en bytes
 * @property {string} [mimeType] - Tipo MIME
 */

/**
 * @typedef {Object} StreamingChunk
 * @property {string} content - Contenido del chunk
 * @property {boolean} done - Si es el último chunk
 * @property {string} [id] - ID del chunk
 */

/**
 * @typedef {Object} MessageRequest
 * @property {string} text - Texto del mensaje
 * @property {MessageAttachment[]} [attachments] - Attachments del mensaje
 * @property {string} [model] - Modelo a usar (opcional, usa el seleccionado)
 * @property {boolean} [useAPI] - Si usar API o local
 * @property {Object} [options] - Opciones adicionales
 */

/**
 * @typedef {Object} MessageResponse
 * @property {boolean} success - Si la operación fue exitosa
 * @property {string} [content] - Contenido de la respuesta
 * @property {string} [error] - Mensaje de error si falló
 * @property {string} [model] - Modelo usado para la respuesta
 * @property {number} [duration] - Duración en ms
 * @property {Object} [metadata] - Metadatos adicionales
 */

module.exports = {
  // Tipos exportados para uso en JSDoc
};

