/**
 * ════════════════════════════════════════════════════════════════════════════
 * STREAM MANAGER - Abstracción Unificada para Server-Sent Events (SSE)
 * Manejo centralizado de streaming con timeout, cleanup y reconexión
 * ════════════════════════════════════════════════════════════════════════════
 */

const { LoggerFactory } = require('./logger');
const { EventEmitter } = require('events');

const logger = LoggerFactory.create({ service: 'stream-manager' });

/**
 * Stream Manager - Maneja streams SSE de forma unificada
 */
class StreamManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.maxStreamTimeout = options.maxStreamTimeout || 300000; // 5 minutos
    this.cleanupInterval = options.cleanupInterval || 60000; // 1 minuto
    this.activeStreams = new Map(); // requestId -> StreamInfo

    // Iniciar cleanup periódico
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredStreams();
    }, this.cleanupInterval);

    logger.info('Stream Manager inicializado', {
      maxStreamTimeout: this.maxStreamTimeout,
      cleanupInterval: this.cleanupInterval
    });
  }

  /**
   * Crea un nuevo stream SSE
   * @param {Object} res - Response object de Express
   * @param {string} requestId - ID único del request
   * @param {Object} options - Opciones del stream
   * @returns {StreamInfo} Información del stream creado
   */
  createStream(res, requestId, options = {}) {
    // Verificar si ya existe un stream con este ID
    if (this.activeStreams.has(requestId)) {
      logger.warn('Stream ya existe, cerrando anterior', { requestId });
      this.closeStream(requestId);
    }

    // Configurar headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Enviar ID inicial
    this.write(res, { type: 'start', requestId });

    // Crear información del stream
    const streamInfo = {
      requestId,
      res,
      startTime: Date.now(),
      lastActivity: Date.now(),
      options,
      closed: false,
      timeout: null
    };

    // Configurar timeout automático
    if (this.maxStreamTimeout > 0) {
      streamInfo.timeout = setTimeout(() => {
        logger.warn('Stream timeout expirado', { requestId, timeout: this.maxStreamTimeout });
        this.closeStream(requestId, 'timeout');
      }, this.maxStreamTimeout);
    }

    // Manejar cierre de conexión
    res.on('close', () => {
      if (!streamInfo.closed) {
        logger.debug('Stream cerrado por cliente', { requestId });
        this.closeStream(requestId, 'client_close');
      }
    });

    // Registrar stream
    this.activeStreams.set(requestId, streamInfo);

    logger.debug('Stream creado', { requestId });

    return streamInfo;
  }

  /**
   * Escribe datos al stream
   * @param {Object} res - Response object
   * @param {Object} data - Datos a enviar
   */
  write(res, data) {
    try {
      const jsonData = JSON.stringify(data);
      res.write(`data: ${jsonData}\n\n`);
    } catch (error) {
      logger.error('Error escribiendo al stream', { error: error.message });
      throw error;
    }
  }

  /**
   * Envía un token al stream
   * @param {string} requestId - ID del request
   * @param {string} token - Token a enviar
   * @param {string} fullContent - Contenido completo hasta ahora
   */
  sendToken(requestId, token, fullContent) {
    const streamInfo = this.activeStreams.get(requestId);
    if (!streamInfo || streamInfo.closed) {
      return;
    }

    streamInfo.lastActivity = Date.now();

    this.write(streamInfo.res, {
      type: 'token',
      token,
      fullContent,
      requestId
    });
  }

  /**
   * Completa el stream
   * @param {string} requestId - ID del request
   * @param {string} fullContent - Contenido final
   */
  complete(requestId, fullContent) {
    const streamInfo = this.activeStreams.get(requestId);
    if (!streamInfo || streamInfo.closed) {
      return;
    }

    this.write(streamInfo.res, {
      type: 'complete',
      content: fullContent,
      requestId
    });

    this.closeStream(requestId, 'complete');
  }

  /**
   * Envía un error al stream
   * @param {string} requestId - ID del request
   * @param {Error|string} error - Error a enviar
   */
  sendError(requestId, error) {
    const streamInfo = this.activeStreams.get(requestId);
    if (!streamInfo || streamInfo.closed) {
      return;
    }

    const errorMessage = error instanceof Error ? error.message : error;

    this.write(streamInfo.res, {
      type: 'error',
      error: errorMessage,
      requestId
    });

    this.closeStream(requestId, 'error');
  }

  /**
   * Cierra un stream
   * @param {string} requestId - ID del request
   * @param {string} reason - Razón del cierre
   */
  closeStream(requestId, reason = 'manual') {
    const streamInfo = this.activeStreams.get(requestId);
    if (!streamInfo) {
      return;
    }

    if (streamInfo.closed) {
      return;
    }

    streamInfo.closed = true;

    // Limpiar timeout
    if (streamInfo.timeout) {
      clearTimeout(streamInfo.timeout);
      streamInfo.timeout = null;
    }

    // Cerrar response si no está cerrada
    if (!streamInfo.res.writableEnded) {
      try {
        streamInfo.res.end();
      } catch (error) {
        logger.warn('Error cerrando stream response', { requestId, error: error.message });
      }
    }

    // Remover del mapa
    this.activeStreams.delete(requestId);

    const duration = Date.now() - streamInfo.startTime;

    logger.debug('Stream cerrado', {
      requestId,
      reason,
      duration
    });

    // Emitir evento
    this.emit('stream-closed', {
      requestId,
      reason,
      duration
    });
  }

  /**
   * Limpia streams expirados
   */
  cleanupExpiredStreams() {
    const now = Date.now();
    const expiredStreams = [];

    for (const [requestId, streamInfo] of this.activeStreams.entries()) {
      const timeSinceLastActivity = now - streamInfo.lastActivity;

      // Si no hay actividad en más del timeout, cerrar
      if (timeSinceLastActivity > this.maxStreamTimeout) {
        expiredStreams.push(requestId);
      }
    }

    for (const requestId of expiredStreams) {
      logger.warn('Limpiando stream expirado', { requestId });
      this.closeStream(requestId, 'expired');
    }

    if (expiredStreams.length > 0) {
      logger.info('Streams limpiados', { count: expiredStreams.length });
    }
  }

  /**
   * Obtiene estadísticas de streams
   */
  getStats() {
    return {
      active: this.activeStreams.size,
      streams: Array.from(this.activeStreams.entries()).map(([requestId, info]) => ({
        requestId,
        duration: Date.now() - info.startTime,
        lastActivity: Date.now() - info.lastActivity,
        closed: info.closed
      }))
    };
  }

  /**
   * Cierra todos los streams activos
   */
  closeAll(reason = 'shutdown') {
    const requestIds = Array.from(this.activeStreams.keys());

    for (const requestId of requestIds) {
      this.closeStream(requestId, reason);
    }

    logger.info('Todos los streams cerrados', { count: requestIds.length });
  }

  /**
   * Detiene el stream manager y limpia recursos
   */
  shutdown() {
    // Detener cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Cerrar todos los streams
    this.closeAll('shutdown');

    logger.info('Stream Manager detenido');
  }
}

module.exports = {
  StreamManager
};
