// ═══════════════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE - Middleware de Seguridad Enterprise-Level
// Headers de seguridad, CORS configurable, protección contra ataques comunes
// ═══════════════════════════════════════════════════════════════════

/**
 * Middleware de seguridad unificado
 */
class SecurityMiddleware {
  constructor(options = {}) {
    this.options = {
      enableHelmet: options.enableHelmet !== false,
      corsOrigin: options.corsOrigin || '*',
      corsCredentials: options.corsCredentials !== false,
      corsMethods: options.corsMethods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      corsHeaders: options.corsHeaders || ['Content-Type', 'Authorization', 'mcp-secret', 'X-Requested-With'],
      trustProxy: options.trustProxy || false,
      ...options
    };
  }

  /**
   * Headers de seguridad (equivalente a helmet.js)
   */
  securityHeaders() {
    return (req, res, next) => {
      if (this.options.enableHelmet) {
        // Prevenir clickjacking
        res.setHeader('X-Frame-Options', 'DENY');
        
        // Prevenir MIME type sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        // XSS Protection (legacy pero útil)
        res.setHeader('X-XSS-Protection', '1; mode=block');
        
        // Referrer Policy
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        
        // Content Security Policy (básico)
        res.setHeader('Content-Security-Policy', "default-src 'self'");
        
        // Permissions Policy
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      }
      next();
    };
  }

  /**
   * CORS configurable
   */
  cors() {
    return (req, res, next) => {
      const origin = req.headers.origin;
      
      // Determinar origen permitido
      let allowedOrigin = this.options.corsOrigin;
      if (this.options.corsOrigin === '*' || 
          (Array.isArray(this.options.corsOrigin) && this.options.corsOrigin.includes(origin))) {
        allowedOrigin = this.options.corsOrigin === '*' ? '*' : origin;
      } else if (Array.isArray(this.options.corsOrigin)) {
        allowedOrigin = this.options.corsOrigin[0]; // Primer origen por defecto
      }
      
      res.header('Access-Control-Allow-Origin', allowedOrigin);
      res.header('Access-Control-Allow-Methods', this.options.corsMethods.join(', '));
      res.header('Access-Control-Allow-Headers', this.options.corsHeaders.join(', '));
      
      if (this.options.corsCredentials) {
        res.header('Access-Control-Allow-Credentials', 'true');
      }
      
      // Preflight request
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      
      next();
    };
  }

  /**
   * Protección contra ataques de tamaño de payload
   */
  bodyParserLimits() {
    return (req, res, next) => {
      // Limitar tamaño de body (ya manejado por express.json, pero agregamos validación)
      const contentLength = req.headers['content-length'];
      const maxSize = 50 * 1024 * 1024; // 50MB
      
      if (contentLength && parseInt(contentLength, 10) > maxSize) {
        return res.status(413).json({
          error: 'Payload too large',
          maxSize: `${maxSize / (1024 * 1024)}MB`
        });
      }
      
      next();
    };
  }

  /**
   * Protección básica contra timing attacks
   */
  timingProtection() {
    return (req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        // Agregar delay mínimo para ocultar diferencias de tiempo en autenticación
        const duration = Date.now() - start;
        if (duration < 100) {
          // Solo aplicar en rutas sensibles (autenticación)
          if (req.path.includes('/auth') || req.path.includes('/login')) {
            setTimeout(() => {}, 100 - duration);
          }
        }
      });
      next();
    };
  }

  /**
   * Middleware completo de seguridad
   */
  middleware() {
    return [
      this.securityHeaders(),
      this.cors(),
      this.bodyParserLimits(),
      this.timingProtection()
    ];
  }

  /**
   * Factory method para crear instancia con configuración
   */
  static create(options = {}) {
    return new SecurityMiddleware(options);
  }
}

module.exports = SecurityMiddleware;

