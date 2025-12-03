// ═══════════════════════════════════════════════════════════════════
// RATE LIMITER - Rate Limiting Avanzado por Tiempo y Usuario/IP
// Enterprise-level rate limiting con ventanas de tiempo y tracking por IP/usuario
// ═══════════════════════════════════════════════════════════════════

/**
 * Opciones por defecto para rate limiting
 */
const DEFAULT_OPTIONS = {
  windowMs: 60000,              // Ventana de tiempo en ms (1 minuto por defecto)
  maxRequests: 100,             // Máximo de requests por ventana
  skipSuccessfulRequests: false, // No contar requests exitosos
  skipFailedRequests: false,    // No contar requests fallidos
  keyGenerator: null,           // Función para generar key (IP por defecto)
  onLimitReached: null,         // Callback cuando se alcanza el límite
  standardHeaders: true,        // Incluir headers estándar X-RateLimit-*
  legacyHeaders: false          // Incluir headers legacy Retry-After
};

/**
 * Rate Limiter con ventana deslizante
 */
class RateLimiter {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.store = new Map(); // Almacenamiento en memoria (en producción usar Redis)
    this.cleanupInterval = setInterval(() => this.cleanup(), this.options.windowMs);
  }

  /**
   * Genera key para identificar al cliente
   */
  generateKey(req) {
    if (this.options.keyGenerator) {
      return this.options.keyGenerator(req);
    }
    
    // Por defecto usar IP
    return req.ip || 
           req.connection?.remoteAddress || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           'unknown';
  }

  /**
   * Verifica si el request está dentro del límite
   */
  checkLimit(key) {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    
    // Obtener o crear registro para esta key
    if (!this.store.has(key)) {
      this.store.set(key, {
        requests: [],
        resetTime: now + this.options.windowMs
      });
    }
    
    const record = this.store.get(key);
    
    // Limpiar requests fuera de la ventana
    record.requests = record.requests.filter(timestamp => timestamp > windowStart);
    
    // Verificar límite
    const count = record.requests.length;
    const remaining = Math.max(0, this.options.maxRequests - count);
    const resetTime = record.resetTime;
    
    return {
      allowed: count < this.options.maxRequests,
      remaining,
      resetTime,
      total: count,
      limit: this.options.maxRequests
    };
  }

  /**
   * Registra un request
   */
  recordRequest(key, success = true) {
    const now = Date.now();
    
    if (!this.store.has(key)) {
      this.store.set(key, {
        requests: [],
        resetTime: now + this.options.windowMs
      });
    }
    
    const record = this.store.get(key);
    
    // Saltar según configuración
    if (success && this.options.skipSuccessfulRequests) {
      return;
    }
    if (!success && this.options.skipFailedRequests) {
      return;
    }
    
    // Agregar timestamp del request
    record.requests.push(now);
    
    // Actualizar reset time
    record.resetTime = now + this.options.windowMs;
  }

  /**
   * Middleware para Express
   */
  middleware() {
    // Capturar 'this' para usar en el closure
    const rateLimiter = this;
    
    return (req, res, next) => {
      const key = this.generateKey(req);
      const limitInfo = this.checkLimit(key);
      
      // Agregar headers de rate limit
      if (this.options.standardHeaders) {
        res.setHeader('X-RateLimit-Limit', this.options.maxRequests);
        res.setHeader('X-RateLimit-Remaining', limitInfo.remaining);
        res.setHeader('X-RateLimit-Reset', new Date(limitInfo.resetTime).toISOString());
      }
      
      if (this.options.legacyHeaders) {
        const retryAfter = Math.ceil((limitInfo.resetTime - Date.now()) / 1000);
        res.setHeader('Retry-After', retryAfter);
      }
      
      // Si excede el límite
      if (!limitInfo.allowed) {
        if (this.options.onLimitReached) {
          this.options.onLimitReached(req, res, limitInfo);
        }
        
        const { APIError } = require('./api-error');
        const error = APIError.rateLimitExceeded(
          Math.ceil((limitInfo.resetTime - Date.now()) / 1000),
          {
            limit: limitInfo.limit,
            remaining: limitInfo.remaining,
            resetTime: limitInfo.resetTime
          }
        );
        
        return res.status(error.statusCode).json(error.toJSON());
      }
      
      // Registrar request después de procesar
      const originalSend = res.send;
      res.send = function(data) {
        const success = res.statusCode < 400;
        rateLimiter.recordRequest(key, success);
        return originalSend.call(this, data);
      };
      
      next();
    };
  }

  /**
   * Limpia registros expirados
   */
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    
    for (const [key, record] of this.store.entries()) {
      // Limpiar requests expirados
      record.requests = record.requests.filter(timestamp => timestamp > windowStart);
      
      // Si no hay requests y el reset time expiró, eliminar registro
      if (record.requests.length === 0 && record.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Resetea el rate limit para una key específica
   */
  reset(key) {
    this.store.delete(key);
  }

  /**
   * Resetea todos los rate limits
   */
  resetAll() {
    this.store.clear();
  }

  /**
   * Obtiene estadísticas de rate limiting
   */
  getStats() {
    const stats = {
      totalKeys: this.store.size,
      keys: {}
    };
    
    for (const [key, record] of this.store.entries()) {
      stats.keys[key] = {
        requests: record.requests.length,
        resetTime: record.resetTime,
        oldestRequest: record.requests[0] || null
      };
    }
    
    return stats;
  }

  /**
   * Destruye el rate limiter y limpia recursos
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

/**
 * Factory para crear rate limiters preconfigurados
 */
class RateLimiterFactory {
  /**
   * Rate limiter estándar (100 requests/minuto)
   */
  static standard(options = {}) {
    return new RateLimiter({
      windowMs: 60000,
      maxRequests: 100,
      ...options
    });
  }

  /**
   * Rate limiter estricto (10 requests/minuto)
   */
  static strict(options = {}) {
    return new RateLimiter({
      windowMs: 60000,
      maxRequests: 10,
      ...options
    });
  }

  /**
   * Rate limiter por segundo (10 requests/segundo)
   */
  static perSecond(maxRequests = 10, options = {}) {
    return new RateLimiter({
      windowMs: 1000,
      maxRequests,
      ...options
    });
  }

  /**
   * Rate limiter por hora (1000 requests/hora)
   */
  static perHour(maxRequests = 1000, options = {}) {
    return new RateLimiter({
      windowMs: 3600000,
      maxRequests,
      ...options
    });
  }
}

module.exports = {
  RateLimiter,
  RateLimiterFactory,
  DEFAULT_OPTIONS
};
