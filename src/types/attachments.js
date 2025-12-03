// ═══════════════════════════════════════════════════════════════════
// TIPOS DE ATTACHMENTS (IMÁGENES Y ARCHIVOS)
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {('image'|'file'|'audio'|'video')} AttachmentType
 * Tipo de attachment
 */

/**
 * @typedef {Object} ImageAttachment
 * @property {AttachmentType} type - Tipo ('image')
 * @property {string} url - URL o base64 de la imagen
 * @property {string} [name] - Nombre del archivo
 * @property {number} [width] - Ancho en píxeles
 * @property {number} [height] - Alto en píxeles
 * @property {string} [mimeType] - Tipo MIME (ej: 'image/png', 'image/jpeg')
 * @property {number} [size] - Tamaño en bytes
 * @property {string} [format] - Formato de la imagen ('png', 'jpeg', 'webp', etc.)
 */

/**
 * @typedef {Object} FileAttachment
 * @property {AttachmentType} type - Tipo ('file')
 * @property {string} url - URL o base64 del archivo
 * @property {string} name - Nombre del archivo
 * @property {string} mimeType - Tipo MIME
 * @property {number} size - Tamaño en bytes
 * @property {string} [extension] - Extensión del archivo
 */

/**
 * @typedef {ImageAttachment|FileAttachment} Attachment
 * Attachment genérico (imagen o archivo)
 */

/**
 * @typedef {Object} ImageProcessingOptions
 * @property {number} [maxWidth] - Ancho máximo en píxeles
 * @property {number} [maxHeight] - Alto máximo en píxeles
 * @property {number} [quality] - Calidad de compresión (0-1)
 * @property {string} [format] - Formato de salida ('png', 'jpeg', 'webp')
 * @property {number} [maxSize] - Tamaño máximo en bytes
 */

/**
 * @typedef {Object} ImageMetadata
 * @property {number} width - Ancho en píxeles
 * @property {number} height - Alto en píxeles
 * @property {string} format - Formato de la imagen
 * @property {number} size - Tamaño en bytes
 * @property {string} mimeType - Tipo MIME
 * @property {Object} [exif] - Datos EXIF (si disponibles)
 */

module.exports = {
  // Tipos exportados para uso en JSDoc
};

