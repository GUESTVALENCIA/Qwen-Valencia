// ═══════════════════════════════════════════════════════════════════
// API ERROR - Formato Estándar de Errores para APIs
// Enterprise-level error handling con códigos estandarizados
// ═══════════════════════════════════════════════════════════════════

/**
 * Códigos de error estandarizados
 */
const ErrorCodes = {
  // Errores de autenticación (401)
  ERR_API_KEY_INVALID: 'ERR_API_KEY_INVALID',
  ERR_API_KEY_MISSING: 'ERR_API_KEY_MISSING',
  ERR_AUTH_REQUIRED: 'ERR_AUTH_REQUIRED',
  
  // Errores de rate limiting (429)
  ERR_RATE_LIMIT_EXCEEDED: 'ERR_RATE_LIMIT_EXCEEDED',
  ERR_TOO_MANY_REQUESTS: 'ERR_TOO_MANY_REQUESTS',
  ERR_CONCURRENT_LIMIT: 'ERR_CONCURRENT_LIMIT',
  
  // Errores de recursos (404)
  ERR_MODEL_NOT_FOUND: 'ERR_MODEL_NOT_FOUND',
  ERR_RESOURCE_NOT_FOUND: 'ERR_RESOURCE_NOT_FOUND',
  
  // Errores de validación (400)
  ERR_INVALID_REQUEST: 'ERR_INVALID_REQUEST',
  ERR_MISSING_PARAMETERS: 'ERR_MISSING_PARAMETERS',
  ERR_INVALID_PARAMETERS: 'ERR_INVALID_PARAMETERS',
  
  // Errores del servidor (500)
  ERR_INTERNAL_ERROR: 'ERR_INTERNAL_ERROR',
  ERR_SERVICE_UNAVAILABLE: 'ERR_SERVICE_UNAVAILABLE',
  ERR_TIMEOUT: 'ERR_TIMEOUT',
  
  // Errores de Ollama
  ERR_OLLAMA_NOT_RUNNING: 'ERR_OLLAMA_NOT_RUNNING',
  ERR_OLLAMA_MODEL_NOT_INSTALLED: 'ERR_OLLAMA_MODEL_NOT_INSTALLED',
  ERR_OLLAMA_CONNECTION_FAILED: 'ERR_OLLAMA_CONNECTION_FAILED',
  
  // Errores de Groq
  ERR_GROQ_API_ERROR: 'ERR_GROQ_API_ERROR',
  ERR_GROQ_SERVICE_UNAVAILABLE: 'ERR_GROQ_SERVICE_UNAVAILABLE',
  
  // Errores de fallback
  ERR_FALLBACK_FAILED: 'ERR_FALLBACK_FAILED',
  ERR_ALL_PROVIDERS_FAILED: 'ERR_ALL_PROVIDERS_FAILED'
};

/**
 * Mapeo de códigos HTTP a códigos de error
 */
const HTTP_TO_ERROR_CODE = {
  400: ErrorCodes.ERR_INVALID_REQUEST,
  401: ErrorCodes.ERR_API_KEY_INVALID,
  404: ErrorCodes.ERR_RESOURCE_NOT_FOUND,
  429: ErrorCodes.ERR_RATE_LIMIT_EXCEEDED,
  500: ErrorCodes.ERR_INTERNAL_ERROR,
  503: ErrorCodes.ERR_SERVICE_UNAVAILABLE
};

/**
 * Clase APIError - Error estándar para APIs
 */
class APIError extends Error {
  constructor(code, message, statusCode = 500, details = {}, retryable = false) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.retryable = retryable;
    this.timestamp = new Date().toISOString();
    
    // Mantener stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError);
    }
  }

  /**
   * Convierte el error a formato JSON estándar
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details,
        retryable: this.retryable,
        timestamp: this.timestamp
      }
    };
  }

  /**
   * Crea respuesta HTTP estándar
   */
  toResponse() {
    return {
      statusCode: this.statusCode,
      body: this.toJSON()
    };
  }

  /**
   * Factory method: Crear error desde código HTTP
   */
  static fromHTTPStatus(statusCode, message, details = {}) {
    const code = HTTP_TO_ERROR_CODE[statusCode] || ErrorCodes.ERR_INTERNAL_ERROR;
    const retryable = statusCode >= 500 || statusCode === 429;
    return new APIError(code, message, statusCode, details, retryable);
  }

  /**
   * Factory method: Error de API key inválida
   */
  static invalidAPIKey(details = {}) {
    return new APIError(
      ErrorCodes.ERR_API_KEY_INVALID,
      'API Key inválida o no autorizada. Verifica tu GROQ_API_KEY en qwen-valencia.env',
      401,
      details,
      false
    );
  }

  /**
   * Factory method: Error de rate limit
   */
  static rateLimitExceeded(retryAfter = null, details = {}) {
    const error = new APIError(
      ErrorCodes.ERR_RATE_LIMIT_EXCEEDED,
      'Límite de rate limit alcanzado. Espera unos momentos e intenta de nuevo.',
      429,
      { ...details, retryAfter },
      true
    );
    return error;
  }

  /**
   * Factory method: Modelo no encontrado
   */
  static modelNotFound(modelName, details = {}) {
    return new APIError(
      ErrorCodes.ERR_MODEL_NOT_FOUND,
      `Modelo '${modelName}' no encontrado. Asegúrate de que esté instalado o disponible.`,
      404,
      { model: modelName, ...details },
      false
    );
  }

  /**
   * Factory method: Ollama no disponible
   */
  static ollamaNotAvailable(details = {}) {
    return new APIError(
      ErrorCodes.ERR_OLLAMA_NOT_RUNNING,
      'Ollama no está corriendo. Ejecuta `ollama serve` o verifica la conexión.',
      503,
      details,
      true
    );
  }

  /**
   * Factory method: Error de fallback
   */
  static fallbackFailed(originalError, details = {}) {
    return new APIError(
      ErrorCodes.ERR_FALLBACK_FAILED,
      `Fallback falló: ${originalError.message}`,
      500,
      { originalError: originalError.message, ...details },
      false
    );
  }

  /**
   * Factory method: Todos los proveedores fallaron
   */
  static allProvidersFailed(errors = [], details = {}) {
    return new APIError(
      ErrorCodes.ERR_ALL_PROVIDERS_FAILED,
      'Todos los proveedores fallaron. Verifica tu configuración.',
      503,
      { errors: errors.map(e => e.message), ...details },
      true
    );
  }

  /**
   * Factory method: Error de request inválido
   */
  static invalidRequest(message, details = {}) {
    return new APIError(
      ErrorCodes.ERR_INVALID_REQUEST,
      message || 'Request inválido',
      400,
      details,
      false
    );
  }

  /**
   * Factory method: Error de autenticación requerida
   */
  static authRequired(message = 'Autenticación requerida', details = {}) {
    return new APIError(
      ErrorCodes.ERR_AUTH_REQUIRED,
      message,
      401,
      details,
      false
    );
  }
}

/**
 * Helper: Crear respuesta de error estándar para Express
 */
function sendErrorResponse(res, error) {
  const apiError = error instanceof APIError 
    ? error 
    : APIError.fromHTTPStatus(500, error.message || 'Error interno del servidor');
  
  const response = apiError.toResponse();
  res.status(response.statusCode).json(response.body);
}

/**
 * Helper: Detectar si un error es retryable
 */
function isRetryableError(error) {
  if (error instanceof APIError) {
    return error.retryable;
  }
  
  // Errores HTTP retryables
  if (error.response) {
    const status = error.response.status;
    return status >= 500 || status === 429 || status === 408;
  }
  
  // Errores de timeout o conexión
  return error.code === 'ECONNREFUSED' || 
         error.code === 'ETIMEDOUT' || 
         error.message?.includes('timeout');
}

/**
 * Helper: Extraer información de error de axios
 */
function extractErrorInfo(error) {
  if (error.response) {
    return {
      statusCode: error.response.status,
      message: error.response.data?.error?.message || error.message,
      details: error.response.data?.error?.details || {}
    };
  }
  
  if (error.request) {
    return {
      statusCode: 503,
      message: 'Error de conexión con el servicio',
      details: { code: error.code }
    };
  }
  
  return {
    statusCode: 500,
    message: error.message || 'Error desconocido',
    details: {}
  };
}

module.exports = {
  APIError,
  ErrorCodes,
  sendErrorResponse,
  isRetryableError,
  extractErrorInfo
};

