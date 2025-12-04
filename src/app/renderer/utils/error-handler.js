// ═══════════════════════════════════════════════════════════════════
// ERROR HANDLER - Manejo Centralizado de Errores
// Prevención de errores no manejados y mejor UX
// ═══════════════════════════════════════════════════════════════════

/**
 * Tipos de error categorizados
 */
const ErrorType = {
    API: 'api',
    DOM: 'dom',
    STORAGE: 'storage',
    NETWORK: 'network',
    VALIDATION: 'validation',
    PERMISSION: 'permission',
    UNKNOWN: 'unknown'
};

/**
 * Niveles de severidad
 */
const ErrorSeverity = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

/**
 * Clase ErrorHandler centralizada
 */
class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 100;
        this.onErrorCallbacks = [];
        this.errorCounts = new Map();
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
     * Maneja un error de forma centralizada
     * @param {Error|string} error - Error a manejar
     * @param {Object} context - Contexto adicional del error
     * @param {string} context.type - Tipo de error (ErrorType)
     * @param {string} context.severity - Severidad (ErrorSeverity)
     * @param {string} context.source - Fuente del error (archivo/función)
     * @param {Object} context.metadata - Metadatos adicionales
     * @param {boolean} context.showToast - Si debe mostrar toast al usuario
     * @param {boolean} context.logToConsole - Si debe loggear en consola
     * @returns {Object} - Información del error manejado
     */
    handle(error, context = {}) {
        const {
            type = ErrorType.UNKNOWN,
            severity = ErrorSeverity.MEDIUM,
            source = 'unknown',
            metadata = {},
            showToast = true,
            logToConsole = true
        } = context;
        
        // Normalizar error
        const errorObj = this.normalizeError(error);
        
        // Crear objeto de error completo
        const errorInfo = {
            error: errorObj,
            type,
            severity,
            source,
            metadata,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        // Loggear en consola si está habilitado
        if (logToConsole) {
            this.logToConsole(errorInfo);
        }
        
        // Agregar al log
        this.addToLog(errorInfo);
        
        // Incrementar contador
        this.incrementErrorCount(type);
        
        // Mostrar toast al usuario si está habilitado
        if (showToast && typeof window !== 'undefined' && window.showToast) {
            this.showUserFriendlyMessage(errorInfo);
        }
        
        // Ejecutar callbacks
        this.onErrorCallbacks.forEach(callback => {
            try {
                callback(errorInfo);
            } catch (e) {
                console.error('⚠️ Error en callback de error handler:', e);
            }
        });
        
        return errorInfo;
    }
    
    /**
     * Normaliza un error a un objeto estándar
     * @param {Error|string|*} error - Error a normalizar
     * @returns {Object} - Error normalizado
     */
    normalizeError(error) {
        // Si es un objeto APIError (del backend o parseado)
        if (error && typeof error === 'object' && error.code && error.statusCode) {
            return {
                message: error.message || 'Error de API',
                name: 'APIError',
                code: error.code,
                statusCode: error.statusCode,
                details: error.details || {},
                retryable: error.retryable || false,
                timestamp: error.timestamp,
                stack: error.stack || null,
                original: error
            };
        }
        
        // Si es un Error estándar
        if (error instanceof Error) {
            return {
                message: error.message,
                name: error.name,
                stack: error.stack,
                original: error
            };
        } else if (typeof error === 'string') {
            return {
                message: error,
                name: 'Error',
                stack: null,
                original: error
            };
        } else if (error && typeof error === 'object') {
            return {
                message: error.message || 'Error desconocido',
                name: error.name || 'Error',
                code: error.code || null,
                statusCode: error.status || error.statusCode || null,
                details: error.details || {},
                stack: error.stack || null,
                original: error
            };
        } else {
            return {
                message: 'Error desconocido',
                name: 'Error',
                stack: null,
                original: error
            };
        }
    }
    
    /**
     * Loggea error en consola con formato apropiado
     * @param {Object} errorInfo - Información del error
     */
    logToConsole(errorInfo) {
        const { error, type, severity, source } = errorInfo;
        const emoji = this.getSeverityEmoji(severity);
        const prefix = `${emoji} [${type.toUpperCase()}]`;
        
        console.group(`${prefix} Error en ${source}`);
        console.error('Mensaje:', error.message);
        console.error('Severidad:', severity);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
        if (Object.keys(errorInfo.metadata).length > 0) {
            console.error('Metadata:', errorInfo.metadata);
        }
        console.groupEnd();
    }
    
    /**
     * Muestra mensaje amigable al usuario
     * @param {Object} errorInfo - Información del error
     */
    showUserFriendlyMessage(errorInfo) {
        const { error, type, severity } = errorInfo;
        let message = this.getUserFriendlyMessage(error, type, severity);
        const toastType = severity === ErrorSeverity.CRITICAL ? 'error' : 
                         severity === ErrorSeverity.HIGH ? 'error' : 'warning';
        
        if (typeof window !== 'undefined' && window.showToast) {
            window.showToast(message, toastType);
        } else {
            // Fallback: alert si showToast no está disponible
            console.warn('showToast no disponible, mensaje:', message);
        }
    }
    
    /**
     * Obtiene mensaje amigable para el usuario
     * @param {Object} error - Error normalizado
     * @param {string} type - Tipo de error
     * @param {string} severity - Severidad
     * @returns {string} - Mensaje amigable
     */
    getUserFriendlyMessage(error, type, severity) {
        const messages = {
            [ErrorType.API]: {
                [ErrorSeverity.CRITICAL]: 'Error crítico al comunicarse con el servidor. Por favor, intenta de nuevo.',
                [ErrorSeverity.HIGH]: 'Error al procesar tu solicitud. Verifica tu conexión e intenta de nuevo.',
                [ErrorSeverity.MEDIUM]: 'Hubo un problema al procesar tu solicitud.',
                [ErrorSeverity.LOW]: 'Solicitud completada con advertencias.'
            },
            [ErrorType.DOM]: {
                [ErrorSeverity.CRITICAL]: 'Error al cargar la interfaz. Por favor, recarga la página.',
                [ErrorSeverity.HIGH]: 'Algunos elementos de la interfaz no se cargaron correctamente.',
                [ErrorSeverity.MEDIUM]: 'Problema menor al cargar elementos de la interfaz.',
                [ErrorSeverity.LOW]: 'Advertencia menor en la interfaz.'
            },
            [ErrorType.STORAGE]: {
                [ErrorSeverity.CRITICAL]: 'No se puede guardar tu configuración. Verifica los permisos del navegador.',
                [ErrorSeverity.HIGH]: 'Problema al guardar datos. Algunas configuraciones pueden no persistir.',
                [ErrorSeverity.MEDIUM]: 'Advertencia al guardar datos.',
                [ErrorSeverity.LOW]: 'Nota: Algunos datos no se guardaron.'
            },
            [ErrorType.NETWORK]: {
                [ErrorSeverity.CRITICAL]: 'Sin conexión a internet. Verifica tu conexión.',
                [ErrorSeverity.HIGH]: 'Problema de conexión. Algunas funciones pueden no estar disponibles.',
                [ErrorSeverity.MEDIUM]: 'Conexión lenta o inestable.',
                [ErrorSeverity.LOW]: 'Advertencia de red menor.'
            },
            [ErrorType.PERMISSION]: {
                [ErrorSeverity.CRITICAL]: 'Permisos necesarios denegados. Por favor, habilita los permisos requeridos.',
                [ErrorSeverity.HIGH]: 'Algunos permisos no están disponibles. Algunas funciones pueden no funcionar.',
                [ErrorSeverity.MEDIUM]: 'Advertencia de permisos.',
                [ErrorSeverity.LOW]: 'Nota sobre permisos.'
            }
        };
        
        const typeMessages = messages[type] || messages[ErrorType.UNKNOWN];
        return typeMessages[severity] || error.message || 'Ocurrió un error inesperado.';
    }
    
    /**
     * Obtiene emoji para severidad
     * @param {string} severity - Severidad
     * @returns {string} - Emoji
     */
    getSeverityEmoji(severity) {
        const emojis = {
            [ErrorSeverity.CRITICAL]: '🔴',
            [ErrorSeverity.HIGH]: '🟠',
            [ErrorSeverity.MEDIUM]: '🟡',
            [ErrorSeverity.LOW]: '🟢'
        };
        return emojis[severity] || '⚪';
    }
    
    /**
     * Agrega error al log
     * @param {Object} errorInfo - Información del error
     */
    addToLog(errorInfo) {
        this.errorLog.push(errorInfo);
        
        // Limitar tamaño del log
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }
    }
    
    /**
     * Incrementa contador de errores por tipo
     * @param {string} type - Tipo de error
     */
    incrementErrorCount(type) {
        const current = this.errorCounts.get(type) || 0;
        this.errorCounts.set(type, current + 1);
    }
    
    /**
     * Obtiene estadísticas de errores
     * @returns {Object} - Estadísticas
     */
    getStats() {
        return {
            total: this.errorLog.length,
            byType: Object.fromEntries(this.errorCounts),
            recent: this.errorLog.slice(-10)
        };
    }
    
    /**
     * Limpia el log de errores
     */
    clearLog() {
        this.errorLog = [];
        this.errorCounts.clear();
    }
}

// Instancia global
let errorHandlerInstance = null;

/**
 * Obtiene la instancia global del ErrorHandler
 * @returns {ErrorHandler} - Instancia del ErrorHandler
 */
function getErrorHandler() {
    if (!errorHandlerInstance) {
        errorHandlerInstance = new ErrorHandler();
    }
    return errorHandlerInstance;
}

/**
 * Función helper para manejar errores de API
 * @param {Error|Response} error - Error o Response de fetch
 * @param {string} source - Fuente del error
 * @param {Object} metadata - Metadatos adicionales
 * @returns {Promise<Object>} - Información del error
 */
async function handleAPIError(error, source = 'api', metadata = {}) {
    const handler = getErrorHandler();
    
    let errorObj = error;
    let severity = ErrorSeverity.MEDIUM;
    
    // Si es Response de fetch, extraer información y convertir a APIError
    if (error && typeof error.ok === 'boolean') {
        const status = error.status;
        severity = status >= 500 ? ErrorSeverity.HIGH : 
                   status >= 400 ? ErrorSeverity.MEDIUM : ErrorSeverity.LOW;
        
        // Intentar parsear respuesta JSON para obtener APIError
        try {
            const data = await error.json();
            if (data?.error?.code) {
                // Es un APIError del backend
                errorObj = {
                    code: data.error.code,
                    message: data.error.message,
                    statusCode: data.error.statusCode ?? status,
                    details: data.error.details ?? {},
                    retryable: data.error.retryable ?? false,
                    timestamp: data.error.timestamp
                };
            } else {
                errorObj = new Error(data?.error ?? data?.message ?? `API Error: ${status} ${error.statusText ?? 'Unknown'}`);
                errorObj.status = status;
                errorObj.statusText = error.statusText;
            }
        } catch {
            errorObj = new Error(`API Error: ${status} ${error.statusText ?? 'Unknown'}`);
            errorObj.status = status;
            errorObj.statusText = error.statusText;
        }
        
        metadata.status = status;
        metadata.statusText = error.statusText;
    }
    
    // Si es un objeto con estructura de APIError (parseado del JSON)
    if (error && typeof error === 'object' && error.code && error.statusCode) {
        severity = error.statusCode >= 500 ? ErrorSeverity.HIGH : 
                   error.statusCode >= 400 ? ErrorSeverity.MEDIUM : ErrorSeverity.LOW;
        metadata.code = error.code;
        metadata.details = error.details || {};
        metadata.retryable = error.retryable || false;
    }
    
    return handler.handle(errorObj, {
        type: ErrorType.API,
        severity,
        source,
        metadata,
        showToast: true,
        logToConsole: true
    });
}

/**
 * Función helper para manejar errores de DOM
 * @param {Error|string} error - Error
 * @param {string} source - Fuente del error
 * @param {Object} metadata - Metadatos adicionales
 * @returns {Object} - Información del error
 */
function handleDOMError(error, source = 'dom', metadata = {}) {
    const handler = getErrorHandler();
    return handler.handle(error, {
        type: ErrorType.DOM,
        severity: ErrorSeverity.MEDIUM,
        source,
        metadata,
        showToast: false,
        logToConsole: true
    });
}

/**
 * Función helper para manejar errores de Storage
 * @param {Error|string} error - Error
 * @param {string} source - Fuente del error
 * @param {Object} metadata - Metadatos adicionales
 * @returns {Object} - Información del error
 */
function handleStorageError(error, source = 'storage', metadata = {}) {
    const handler = getErrorHandler();
    return handler.handle(error, {
        type: ErrorType.STORAGE,
        severity: ErrorSeverity.LOW,
        source,
        metadata,
        showToast: false,
        logToConsole: true
    });
}

// Exportar instancia global
if (typeof window !== 'undefined') {
    window.ErrorHandler = ErrorHandler;
    window.getErrorHandler = getErrorHandler;
    window.handleAPIError = handleAPIError;
    window.handleDOMError = handleDOMError;
    window.handleStorageError = handleStorageError;
    window.ErrorType = ErrorType;
    window.ErrorSeverity = ErrorSeverity;
}

