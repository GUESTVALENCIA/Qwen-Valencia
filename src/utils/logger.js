// ═══════════════════════════════════════════════════════════════════
// LOGGER - Logging Estructurado Enterprise-Level
// Logging estructurado con niveles, contexto y formato JSON
// ═══════════════════════════════════════════════════════════════════

/**
 * Niveles de log
 */
const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal'
};

/**
 * Logger estructurado
 */
class Logger {
  constructor(options = {}) {
    this.service = options.service || 'qwen-valencia';
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.minLevel = options.minLevel || (this.environment === 'production' ? LogLevel.INFO : LogLevel.DEBUG);
    this.enableColors = options.enableColors !== false && this.environment !== 'production';
    this.enableJSON = options.enableJSON || this.environment === 'production';
  }

  /**
   * Verifica si un nivel debe ser loggeado
   */
  shouldLog(level) {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
    const currentIndex = levels.indexOf(level);
    const minIndex = levels.indexOf(this.minLevel);
    return currentIndex >= minIndex;
  }

  /**
   * Formatea mensaje de log
   */
  formatMessage(level, message, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      ...context
    };

    if (this.enableJSON) {
      return JSON.stringify(logEntry);
    }

    // Formato legible para desarrollo
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.FATAL]: '\x1b[35m'  // Magenta
    };
    const reset = '\x1b[0m';
    const color = this.enableColors ? colors[level] || '' : '';
    
    const contextStr = Object.keys(context).length > 0 
      ? ` ${JSON.stringify(context)}` 
      : '';
    
    return `${color}[${logEntry.timestamp}] [${level.toUpperCase()}] ${message}${contextStr}${reset}`;
  }

  /**
   * Log genérico
   */
  log(level, message, context = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const formatted = this.formatMessage(level, message, context);
    
    // Usar console apropiado según nivel
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  /**
   * Log de debug
   */
  debug(message, context = {}) {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log de info
   */
  info(message, context = {}) {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log de warning
   */
  warn(message, context = {}) {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log de error
   */
  error(message, error = null, context = {}) {
    const errorContext = {
      ...context
    };

    if (error) {
      errorContext.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    this.log(LogLevel.ERROR, message, errorContext);
  }

  /**
   * Log de fatal
   */
  fatal(message, error = null, context = {}) {
    const errorContext = {
      ...context
    };

    if (error) {
      errorContext.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    this.log(LogLevel.FATAL, message, errorContext);
  }

  /**
   * Log de request HTTP
   */
  request(req, res, duration = null) {
    const context = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection?.remoteAddress
    };

    if (duration !== null) {
      context.duration = `${duration}ms`;
    }

    const level = res.statusCode >= 500 ? LogLevel.ERROR :
                  res.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;

    this.log(level, `${req.method} ${req.path} ${res.statusCode}`, context);
  }
}

/**
 * Factory para crear loggers
 */
class LoggerFactory {
  static create(service, options = {}) {
    return new Logger({ service, ...options });
  }
}

// Logger por defecto
const defaultLogger = new Logger();

module.exports = {
  Logger,
  LoggerFactory,
  LogLevel,
  defaultLogger
};

