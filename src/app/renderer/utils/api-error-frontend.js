// ═══════════════════════════════════════════════════════════════════
// API ERROR FRONTEND - Adaptador de APIError para Frontend
// Convierte errores del backend a formato APIError para uso consistente
// ═══════════════════════════════════════════════════════════════════

/**
 * @fileoverview Adaptador de APIError para frontend
 * @module api-error-frontend
 */

/**
 * Códigos de error estandarizados (sincronizados con backend)
 */
const ErrorCodes = {
  ERR_API_KEY_INVALID: 'ERR_API_KEY_INVALID',
  ERR_API_KEY_MISSING: 'ERR_API_KEY_MISSING',
  ERR_AUTH_REQUIRED: 'ERR_AUTH_REQUIRED',
  ERR_RATE_LIMIT_EXCEEDED: 'ERR_RATE_LIMIT_EXCEEDED',
  ERR_TOO_MANY_REQUESTS: 'ERR_TOO_MANY_REQUESTS',
  ERR_CONCURRENT_LIMIT: 'ERR_CONCURRENT_LIMIT',
  ERR_MODEL_NOT_FOUND: 'ERR_MODEL_NOT_FOUND',
  ERR_RESOURCE_NOT_FOUND: 'ERR_RESOURCE_NOT_FOUND',
  ERR_INVALID_REQUEST: 'ERR_INVALID_REQUEST',
  ERR_MISSING_PARAMETERS: 'ERR_MISSING_PARAMETERS',
  ERR_INVALID_PARAMETERS: 'ERR_INVALID_PARAMETERS',
  ERR_INTERNAL_ERROR: 'ERR_INTERNAL_ERROR',
  ERR_SERVICE_UNAVAILABLE: 'ERR_SERVICE_UNAVAILABLE',
  ERR_TIMEOUT: 'ERR_TIMEOUT',
  ERR_OLLAMA_NOT_RUNNING: 'ERR_OLLAMA_NOT_RUNNING',
  ERR_OLLAMA_MODEL_NOT_INSTALLED: 'ERR_OLLAMA_MODEL_NOT_INSTALLED',
  ERR_OLLAMA_CONNECTION_FAILED: 'ERR_OLLAMA_CONNECTION_FAILED',
  ERR_GROQ_API_ERROR: 'ERR_GROQ_API_ERROR',
  ERR_GROQ_SERVICE_UNAVAILABLE: 'ERR_GROQ_SERVICE_UNAVAILABLE',
  ERR_FALLBACK_FAILED: 'ERR_FALLBACK_FAILED',
  ERR_ALL_PROVIDERS_FAILED: 'ERR_ALL_PROVIDERS_FAILED'
};

/**
 * Clase APIError para frontend (compatible con backend)
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
   * Factory method: Crear desde objeto de error del backend
   */
  static fromBackendError(errorObj) {
    if (!errorObj || typeof errorObj !== 'object') {
      return new APIError(
        ErrorCodes.ERR_INTERNAL_ERROR,
        'Error desconocido del servidor',
        500,
        {},
        false
      );
    }

    return new APIError(
      errorObj.code || ErrorCodes.ERR_INTERNAL_ERROR,
      errorObj.message || 'Error desconocido',
      errorObj.statusCode || 500,
      errorObj.details || {},
      errorObj.retryable || false
    );
  }

  /**
   * Factory method: Crear desde respuesta HTTP
   */
  static fromHTTPResponse(response, data = null) {
    const statusCode = response.status || 500;
    let errorData = data;

    // Intentar parsear JSON si data es string
    if (typeof data === 'string') {
      try {
        errorData = JSON.parse(data);
      } catch (e) {
        errorData = { error: { message: data } };
      }
    }

    // Extraer error del formato estándar { success: false, error: {...} }
    const errorObj = errorData?.error || errorData || {};
    
    return new APIError(
      errorObj.code || this.getErrorCodeFromStatus(statusCode),
      errorObj.message || response.statusText || 'Error de API',
      statusCode,
      errorObj.details || {},
      errorObj.retryable !== undefined ? errorObj.retryable : (statusCode >= 500 || statusCode === 429)
    );
  }

  /**
   * Obtiene código de error desde código HTTP
   */
  static getErrorCodeFromStatus(statusCode) {
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
    return new APIError(
      ErrorCodes.ERR_RATE_LIMIT_EXCEEDED,
      'Límite de rate limit alcanzado. Espera unos momentos e intenta de nuevo.',
      429,
      { ...details, retryAfter },
      true
    );
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
}

/**
 * Helper: Convierte cualquier error a APIError
 */
function toAPIError(error) {
  // Si ya es APIError, retornarlo
  if (error instanceof APIError) {
    return error;
  }

  // Si es un objeto con estructura de APIError (del backend)
  if (error && typeof error === 'object' && error.code && error.statusCode) {
    return APIError.fromBackendError(error);
  }

  // Si es un Error estándar con status
  if (error instanceof Error && error.status) {
    return APIError.fromHTTPResponse(
      { status: error.status, statusText: error.statusText || error.message },
      error.data
    );
  }

  // Error genérico
  return new APIError(
    ErrorCodes.ERR_INTERNAL_ERROR,
    error.message || 'Error desconocido',
    500,
    { originalError: error },
    false
  );
}

// Exportar para uso global en el navegador
if (typeof window !== 'undefined') {
  window.APIError = APIError;
  window.ErrorCodes = ErrorCodes;
  window.toAPIError = toAPIError;
}

// Solo exportar si estamos en Node.js (no en navegador)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    APIError,
    ErrorCodes,
    toAPIError
  };
}

