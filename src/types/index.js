// ═══════════════════════════════════════════════════════════════════
// TIPOS COMPARTIDOS - Frontend y Backend
// Sistema de tipos compartidos usando JSDoc para type safety
// ═══════════════════════════════════════════════════════════════════

/**
 * @fileoverview Tipos compartidos entre frontend y backend
 * @module types
 */

// Re-exportar todos los tipos
module.exports = {
  // Modelos
  ...require('./models'),
  
  // Mensajes
  ...require('./messages'),
  
  // Estado
  ...require('./state'),
  
  // API
  ...require('./api'),
  
  // Errores
  ...require('./errors'),
  
  // Imágenes/Attachments
  ...require('./attachments'),
  
  // Configuración
  ...require('./config')
};

