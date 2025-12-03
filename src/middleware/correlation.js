// ═══════════════════════════════════════════════════════════════════
// CORRELATION MIDDLEWARE - Correlation IDs para Distributed Tracing
// Genera y propaga correlation IDs para rastrear requests a través de servicios
// ═══════════════════════════════════════════════════════════════════

const crypto = require('crypto');

/**
 * Genera un correlation ID único
 */
function generateCorrelationId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Middleware de correlation IDs
 */
class CorrelationMiddleware {
  constructor(options = {}) {
    this.options = {
      headerName: options.headerName || 'X-Correlation-ID',
      generateIfMissing: options.generateIfMissing !== false,
      includeInResponse: options.includeInResponse !== false,
      ...options
    };
  }

  /**
   * Middleware principal
   */
  middleware() {
    return (req, res, next) => {
      // Obtener correlation ID del header o generar uno nuevo
      let correlationId = req.headers[this.options.headerName.toLowerCase()] ||
                         req.headers['x-correlation-id'] ||
                         req.headers['correlation-id'];
      
      if (!correlationId && this.options.generateIfMissing) {
        correlationId = generateCorrelationId();
      }
      
      // Agregar al request para uso en handlers
      req.correlationId = correlationId;
      
      // Agregar al response header
      if (correlationId && this.options.includeInResponse) {
        res.setHeader(this.options.headerName, correlationId);
      }
      
      // Agregar a locals para acceso en templates/middleware
      res.locals.correlationId = correlationId;
      
      next();
    };
  }

  /**
   * Helper para obtener correlation ID de un request
   */
  static getCorrelationId(req) {
    return req.correlationId || 
           req.headers['x-correlation-id'] || 
           req.headers['correlation-id'] ||
           null;
  }

  /**
   * Helper para propagar correlation ID en headers de axios
   */
  static propagateHeaders(req, headers = {}) {
    const correlationId = CorrelationMiddleware.getCorrelationId(req);
    if (correlationId) {
      headers['X-Correlation-ID'] = correlationId;
    }
    return headers;
  }

  /**
   * Factory method
   */
  static create(options = {}) {
    return new CorrelationMiddleware(options);
  }
}

module.exports = CorrelationMiddleware;

