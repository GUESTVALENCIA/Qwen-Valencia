/**
 * ═══════════════════════════════════════════════════════════════════
 * UNIFIED ERROR HANDLER - Sistema Unificado de Manejo de Errores
 * Integra error-handler.js (renderer) y api-error.js (backend)
 * ═══════════════════════════════════════════════════════════════════
 */

const { APIError, ErrorCodes } = require('./api-error');
const { LoggerFactory } = require('./logger');

/**
 * Sistema unificado de manejo de errores
 * Funciona tanto en Node.js (backend) como en Browser (renderer)
 */
class UnifiedErrorHandler {
  constructor(options = {}) {
    this.logger = options.logger || LoggerFactory.create({ service: 'error-handler' });
    this.enableMetrics = options.enableMetrics !== false;
    this.errorCounts = new Map();
    this.errorHistory = [];
    this.maxHistorySize = options.maxHistorySize || 100;
    
    // Callbacks de error
    this.onErrorCallbacks = [];
    
    // En browser, integrar con error-handler.js si está disponible
    if (typeof window !== 'undefined' && window.getErrorHandler) {
      this.browserHandler = window.getErrorHandler();
    }
  }

  /**
   * Registra un callback para cuando ocurre un error
   * @param {Function} callback - Función a llamar con el error
   */
  onError(callback) {
    if (typeof callback === 'function') {
      this.onErrorCallbacks.push(callback);
    }
  }

  /**
   * Maneja un error de forma unificada
   * @param {Error|APIError|string} error - Error a manejar
   * @param {Object} context - Contexto adicional
   * @param {string} context.source - Fuente del error
   * @param {string} context.type - Tipo de error
   * @param {string} context.severity - Severidad (low, medium, high, critical)
   * @param {Object} context.metadata - Metadatos adicionales
   * @param {boolean} context.showToast - Si debe mostrar toast (solo browser)
   * @param {boolean} context.logToConsole - Si debe loggear en consola
   * @returns {Object} Información del error manejado
   */
  handle(error, context = {}) {
    const {
      source = 'unknown',
      type = 'unknown',
      severity = 'medium',
      metadata = {},
      showToast = true,
      logToConsole = true
    } = context;

    // Normalizar error a APIError si es necesario
    const normalizedError = this.normalizeError(error);
    
    // Crear objeto de error completo
    const errorInfo = {
      error: normalizedError,
      source,
      type,
      severity,
      metadata,
      timestamp: new Date().toISOString(),
      environment: typeof window !== 'undefined' ? 'browser' : 'node'
    };

    // Loggear
    if (logToConsole) {
      this.logError(errorInfo);
    }

    // Agregar al historial
    this.addToHistory(errorInfo);

    // Incrementar contador
    this.incrementErrorCount(type);

    // En browser, usar error-handler.js si está disponible
    if (this.browserHandler) {
      try {
        this.browserHandler.handle(error, {
          type,
          severity,
          source,
          metadata,
          showToast,
          logToConsole
        });
      } catch (e) {
        this.logger.warn('Error en browser error handler', { error: e.message });
      }
    }

    // Ejecutar callbacks
    this.onErrorCallbacks.forEach(callback => {
      try {
        callback(errorInfo);
      } catch (e) {
        this.logger.warn('Error en error callback', { error: e.message });
      }
    });

    return errorInfo;
  }

  /**
   * Normaliza un error a APIError
   * @param {Error|APIError|string|*} error - Error a normalizar
   * @returns {APIError} Error normalizado
   */
  normalizeError(error) {
    // Si ya es APIError, retornar
    if (error instanceof APIError) {
      return error;
    }

    // Si es Error estándar
    if (error instanceof Error) {
      // Intentar extraer información de APIError del mensaje o propiedades
      const statusCode = error.statusCode || error.status || 500;
      const code = error.code || this.getErrorCodeFromStatus(statusCode);
      
      return new APIError(
        code,
        error.message || 'Unknown error',
        statusCode,
        {
          originalError: error.name,
          stack: error.stack,
          ...(error.details || {})
        },
        error.retryable || false
      );
    }

    // Si es string
    if (typeof error === 'string') {
      return new APIError(
        ErrorCodes.ERR_INTERNAL_ERROR,
        error,
        500,
        {},
        false
      );
    }

    // Si es objeto con estructura de error
    if (error && typeof error === 'object') {
      return new APIError(
        error.code || ErrorCodes.ERR_INTERNAL_ERROR,
        error.message || error.error || 'Unknown error',
        error.statusCode || error.status || 500,
        error.details || {},
        error.retryable || false
      );
    }

    // Fallback
    return new APIError(
      ErrorCodes.ERR_INTERNAL_ERROR,
      'Unknown error occurred',
      500,
      { originalError: String(error) },
      false
    );
  }

  /**
   * Obtiene código de error desde status code HTTP
   * @param {number} statusCode - Status code HTTP
   * @returns {string} Código de error
   */
  getErrorCodeFromStatus(statusCode) {
    const mapping = {
      400: ErrorCodes.ERR_INVALID_REQUEST,
      401: ErrorCodes.ERR_API_KEY_INVALID,
      404: ErrorCodes.ERR_RESOURCE_NOT_FOUND,
      429: ErrorCodes.ERR_RATE_LIMIT_EXCEEDED,
      500: ErrorCodes.ERR_INTERNAL_ERROR,
      503: ErrorCodes.ERR_SERVICE_UNAVAILABLE,
      408: ErrorCodes.ERR_TIMEOUT
    };
    
    return mapping[statusCode] || ErrorCodes.ERR_INTERNAL_ERROR;
  }

  /**
   * Loggea un error
   * @param {Object} errorInfo - Información del error
   */
  logError(errorInfo) {
    const { error, source, severity, metadata } = errorInfo;
    
    const logData = {
      source,
      severity,
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      ...metadata
    };

    switch (severity) {
      case 'critical':
      case 'high':
        this.logger.error('Error crítico', logData);
        break;
      case 'medium':
        this.logger.warn('Error', logData);
        break;
      case 'low':
        this.logger.debug('Error menor', logData);
        break;
      default:
        this.logger.info('Error', logData);
    }
  }

  /**
   * Agrega error al historial
   * @param {Object} errorInfo - Información del error
   */
  addToHistory(errorInfo) {
    this.errorHistory.push(errorInfo);
    
    // Limitar tamaño del historial
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  /**
   * Incrementa contador de errores por tipo
   * @param {string} type - Tipo de error
   */
  incrementErrorCount(type) {
    const count = this.errorCounts.get(type) || 0;
    this.errorCounts.set(type, count + 1);
  }

  /**
   * Obtiene estadísticas de errores
   * @returns {Object} Estadísticas
   */
  getStats() {
    const totalErrors = Array.from(this.errorCounts.values())
      .reduce((sum, count) => sum + count, 0);
    
    const errorsByType = {};
    this.errorCounts.forEach((count, type) => {
      errorsByType[type] = count;
    });

    const errorsBySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    this.errorHistory.forEach(errorInfo => {
      const severity = errorInfo.severity || 'medium';
      if (errorsBySeverity[severity] !== undefined) {
        errorsBySeverity[severity]++;
      }
    });

    return {
      totalErrors,
      errorsByType,
      errorsBySeverity,
      historySize: this.errorHistory.length
    };
  }

  /**
   * Limpia el historial de errores
   */
  clearHistory() {
    this.errorHistory = [];
    this.errorCounts.clear();
  }

  /**
   * Wrapper para manejar errores en funciones async
   * @param {Function} fn - Función async a ejecutar
   * @param {Object} context - Contexto de error
   * @returns {Promise<*>} Resultado de la función
   */
  async wrapAsync(fn, context = {}) {
    try {
      return await fn();
    } catch (error) {
      this.handle(error, context);
      throw error; // Re-lanzar para que el caller pueda manejarlo
    }
  }

  /**
   * Wrapper para manejar errores en funciones sync
   * @param {Function} fn - Función sync a ejecutar
   * @param {Object} context - Contexto de error
   * @returns {*} Resultado de la función
   */
  wrapSync(fn, context = {}) {
    try {
      return fn();
    } catch (error) {
      this.handle(error, context);
      throw error; // Re-lanzar para que el caller pueda manejarlo
    }
  }
}

// Instancia global
let globalErrorHandler = null;

/**
 * Obtiene la instancia global del error handler
 * @returns {UnifiedErrorHandler}
 */
function getUnifiedErrorHandler() {
  if (!globalErrorHandler) {
    globalErrorHandler = new UnifiedErrorHandler();
  }
  return globalErrorHandler;
}

/**
 * Helper para manejar errores de forma rápida
 * @param {Error|APIError|string} error - Error a manejar
 * @param {Object} context - Contexto adicional
 * @returns {Object} Información del error
 */
function handleError(error, context = {}) {
  return getUnifiedErrorHandler().handle(error, context);
}

/**
 * Helper para wrap async functions
 * @param {Function} fn - Función async
 * @param {Object} context - Contexto de error
 * @returns {Promise<*>}
 */
async function wrapAsync(fn, context = {}) {
  return getUnifiedErrorHandler().wrapAsync(fn, context);
}

/**
 * Helper para wrap sync functions
 * @param {Function} fn - Función sync
 * @param {Object} context - Contexto de error
 * @returns {*}
 */
function wrapSync(fn, context = {}) {
  return getUnifiedErrorHandler().wrapSync(fn, context);
}

// Exportar para Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    UnifiedErrorHandler,
    getUnifiedErrorHandler,
    handleError,
    wrapAsync,
    wrapSync
  };
}

// Exportar para Browser
if (typeof window !== 'undefined') {
  window.UnifiedErrorHandler = UnifiedErrorHandler;
  window.getUnifiedErrorHandler = getUnifiedErrorHandler;
  window.handleError = handleError;
  window.wrapAsync = wrapAsync;
  window.wrapSync = wrapSync;
}

