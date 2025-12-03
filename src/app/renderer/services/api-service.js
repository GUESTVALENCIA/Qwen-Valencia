// ═══════════════════════════════════════════════════════════════════
// API SERVICE - Cliente API Centralizado Enterprise-Level
// Comunicación con backend, manejo de errores, retry logic
// ═══════════════════════════════════════════════════════════════════

const { defaultLogger } = require('../utils/logger');
const { handleAPIError } = require('../utils/error-handler');

/**
 * API Service centralizado
 */
class APIService {
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'http://localhost:6000';
    this.timeout = options.timeout || 30000;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.logger = defaultLogger;
    this.correlationId = null;
  }

  /**
   * Establece correlation ID para requests
   */
  setCorrelationId(id) {
    this.correlationId = id || this.logger.generateCorrelationId();
    this.logger.setCorrelationId(this.correlationId);
    return this.correlationId;
  }

  /**
   * Obtiene correlation ID actual
   */
  getCorrelationId() {
    if (!this.correlationId) {
      this.correlationId = this.logger.generateCorrelationId();
      this.logger.setCorrelationId(this.correlationId);
    }
    return this.correlationId;
  }

  /**
   * Crea headers para requests
   */
  createHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Correlation-ID': this.getCorrelationId(),
      ...customHeaders
    };
    return headers;
  }

  /**
   * Retry logic con backoff exponencial
   */
  async retry(fn, attempts = this.retryAttempts) {
    let lastError;
    
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // No reintentar errores 4xx (excepto 429)
        if (error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error;
        }
        
        // No reintentar en el último intento
        if (i < attempts - 1) {
          const delay = this.retryDelay * Math.pow(2, i);
          this.logger.warn(`Request failed, retrying in ${delay}ms`, { 
            attempt: i + 1, 
            attempts,
            error: error.message 
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Request genérico
   */
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    const method = options.method || 'GET';
    const headers = this.createHeaders(options.headers);
    const body = options.body ? JSON.stringify(options.body) : undefined;
    
    const correlationId = this.getCorrelationId();
    
    this.logger.debug('API request', { 
      method, 
      url, 
      correlationId 
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Parsear respuesta
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Manejar errores HTTP
      if (!response.ok) {
        const error = new Error(data.error || data.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.statusText = response.statusText;
        error.data = data;
        
        this.logger.error('API request failed', { 
          method, 
          url, 
          status: response.status,
          correlationId,
          error: error.message 
        });
        
        throw error;
      }

      this.logger.debug('API request successful', { 
        method, 
        url, 
        status: response.status,
        correlationId 
      });

      return {
        success: true,
        data,
        status: response.status,
        headers: response.headers,
        correlationId
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        error.message = 'Request timeout';
        error.status = 408;
      }

      this.logger.error('API request error', { 
        method, 
        url, 
        error: error.message,
        correlationId 
      });

      // Usar error handler centralizado
      handleAPIError(error, 'api-service', { 
        method, 
        url, 
        correlationId 
      });

      throw error;
    }
  }

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this.retry(() => this.request(endpoint, { ...options, method: 'GET' }));
  }

  /**
   * POST request
   */
  async post(endpoint, body, options = {}) {
    return this.retry(() => this.request(endpoint, { ...options, method: 'POST', body }));
  }

  /**
   * PUT request
   */
  async put(endpoint, body, options = {}) {
    return this.retry(() => this.request(endpoint, { ...options, method: 'PUT', body }));
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.retry(() => this.request(endpoint, { ...options, method: 'DELETE' }));
  }

  /**
   * Request con streaming
   */
  async stream(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    const method = options.method || 'POST';
    const headers = this.createHeaders(options.headers);
    const body = options.body ? JSON.stringify(options.body) : undefined;
    
    const correlationId = this.getCorrelationId();
    
    this.logger.debug('API stream request', { 
      method, 
      url, 
      correlationId 
    });

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: options.signal
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return {
        success: true,
        stream: response.body,
        status: response.status,
        correlationId
      };
    } catch (error) {
      this.logger.error('API stream error', { 
        method, 
        url, 
        error: error.message,
        correlationId 
      });
      throw error;
    }
  }

  /**
   * Route message to model (compatible con app.js)
   */
  async routeMessage(params) {
    const correlationId = this.setCorrelationId();
    
    try {
      const result = await this.post('/mcp/route-message', {
        text: params.text || '',
        attachments: params.attachments || [],
        model: params.model,
        useAPI: params.useAPI !== undefined ? params.useAPI : true,
        options: params.options || {}
      });

      return {
        success: true,
        response: result.data.response || result.data.content,
        model: result.data.model,
        provider: result.data.provider,
        correlationId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Error routing message',
        correlationId
      };
    }
  }
}

// Instancia global del API service
let globalAPIService = null;

/**
 * Factory para crear o obtener API service
 */
function createAPIService(options = {}) {
  if (!globalAPIService) {
    globalAPIService = new APIService(options);
  }
  return globalAPIService;
}

/**
 * Obtiene el API service global
 */
function getAPIService() {
  if (!globalAPIService) {
    globalAPIService = createAPIService();
  }
  return globalAPIService;
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.APIService = APIService;
  window.createAPIService = createAPIService;
  window.getAPIService = getAPIService;
}

module.exports = {
  APIService,
  createAPIService,
  getAPIService
};

