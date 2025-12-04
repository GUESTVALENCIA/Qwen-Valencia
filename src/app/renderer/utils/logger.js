// ═══════════════════════════════════════════════════════════════════
// LOGGER - Logging Estructurado Frontend Enterprise-Level
// Logging estructurado con niveles, contexto y correlation IDs
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
 * Logger estructurado para frontend
 */
class Logger {
  constructor(options = {}) {
    this.service = options.service || 'qwen-valencia-frontend';
    this.environment = options.environment || 'development';
    this.minLevel =
      options.minLevel || (this.environment === 'production' ? LogLevel.INFO : LogLevel.DEBUG);
    this.enableColors = options.enableColors !== false && this.environment !== 'production';
    this.enableJSON = options.enableJSON || this.environment === 'production';
    this.correlationId = null;
    this.context = {};
  }

  /**
   * Verifica si un nivel debe ser loggeado
   */
  shouldLog(level) {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
    const minIndex = levels.indexOf(this.minLevel);
    const levelIndex = levels.indexOf(level);
    return levelIndex >= minIndex;
  }

  /**
   * Genera correlation ID único
   */
  generateCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Establece correlation ID para la sesión actual
   */
  setCorrelationId(id) {
    this.correlationId = id || this.generateCorrelationId();
    return this.correlationId;
  }

  /**
   * Obtiene correlation ID actual o genera uno nuevo
   */
  getCorrelationId() {
    if (!this.correlationId) {
      this.correlationId = this.generateCorrelationId();
    }
    return this.correlationId;
  }

  /**
   * Establece contexto global
   */
  setContext(context) {
    this.context = { ...this.context, ...context };
  }

  /**
   * Limpia contexto
   */
  clearContext() {
    this.context = {};
  }

  /**
   * Formatea mensaje con colores (solo en desarrollo)
   */
  formatMessage(level, message, data = {}) {
    if (this.enableJSON) {
      return JSON.stringify({
        level,
        service: this.service,
        timestamp: new Date().toISOString(),
        correlationId: this.getCorrelationId(),
        message,
        context: this.context,
        data
      });
    }

    if (!this.enableColors) {
      return `[${level.toUpperCase()}] ${message}`;
    }

    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m', // Green
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      fatal: '\x1b[35m' // Magenta
    };
    const reset = '\x1b[0m';
    const color = colors[level] || '';

    let output = `${color}[${level.toUpperCase()}]${reset} ${message}`;

    if (Object.keys(data).length > 0) {
      output += ` ${JSON.stringify(data, null, 2)}`;
    }

    if (this.correlationId) {
      output += ` [correlationId: ${this.correlationId}]`;
    }

    return output;
  }

  /**
   * Log genérico
   */
  log(level, message, data = {}) {
    if (!this.shouldLog(level)) {
      return;
    }

    const formatted = this.formatMessage(level, message, data);

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

    // En producción, enviar errores críticos al backend (opcional)
    if (
      this.environment === 'production' &&
      (level === LogLevel.ERROR || level === LogLevel.FATAL)
    ) {
      this.sendToBackend(level, message, data);
    }
  }

  /**
   * Envía log crítico al backend (opcional)
   */
  async sendToBackend(level, message, data) {
    try {
      // Solo enviar errores críticos, no todos los logs
      if (level === LogLevel.FATAL || (level === LogLevel.ERROR && data.critical)) {
        await fetch('http://localhost:9000/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level,
            service: this.service,
            timestamp: new Date().toISOString(),
            correlationId: this.getCorrelationId(),
            message,
            context: this.context,
            data
          })
        }).catch(() => {
          // Silenciar errores de red para no crear loops
        });
      }
    } catch (error) {
      // Silenciar errores de logging
    }
  }

  /**
   * Métodos de conveniencia
   */
  debug(message, data = {}) {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message, data = {}) {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message, data = {}) {
    this.log(LogLevel.WARN, message, data);
  }

  error(message, data = {}) {
    this.log(LogLevel.ERROR, message, data);
  }

  fatal(message, data = {}) {
    this.log(LogLevel.FATAL, message, data);
  }

  /**
   * Log con contexto temporal
   */
  withContext(context, callback) {
    const previousContext = { ...this.context };
    this.setContext(context);
    try {
      return callback();
    } finally {
      this.context = previousContext;
    }
  }
}

/**
 * Factory para crear instancias de logger
 */
class LoggerFactory {
  static getInstances() {
    if (!LoggerFactory._instances) {
      LoggerFactory._instances = new Map();
    }
    return LoggerFactory._instances;
  }

  static create(service = 'qwen-valencia-frontend', options = {}) {
    const instancesMap = this.getInstances();
    if (instancesMap.has(service)) {
      return instancesMap.get(service);
    }

    const logger = new Logger({ service, ...options });
    instancesMap.set(service, logger);
    return logger;
  }

  static get(service = 'qwen-valencia-frontend') {
    const instancesMap = this.getInstances();
    return instancesMap.get(service) || this.create(service);
  }
}

// Exportar logger por defecto
const defaultLogger = LoggerFactory.create();

// Exportar también funciones de conveniencia globales
if (typeof window !== 'undefined') {
  window.logger = defaultLogger;
  window.LoggerFactory = LoggerFactory;
  window.defaultLogger = defaultLogger;
}

// Solo exportar si estamos en Node.js (no en navegador)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Logger,
    LoggerFactory,
    LogLevel,
    defaultLogger
  };
}
