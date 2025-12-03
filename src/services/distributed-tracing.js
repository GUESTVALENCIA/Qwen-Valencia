/**
 * ════════════════════════════════════════════════════════════════════════════
 * DISTRIBUTED TRACING - Trazabilidad Distribuida Enterprise-Level
 * Spans, trace context propagation y distributed tracing completo
 * ════════════════════════════════════════════════════════════════════════════
 */

const crypto = require('crypto');
const { LoggerFactory } = require('../utils/logger');
const { MetricsFactory } = require('../utils/metrics');

const logger = LoggerFactory.create({ service: 'distributed-tracing' });
const metrics = MetricsFactory.create({ service: 'tracing' });

/**
 * Genera un trace ID único
 */
function generateTraceId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Genera un span ID único
 */
function generateSpanId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Span de tracing
 */
class Span {
  constructor(name, traceId, parentSpanId = null, options = {}) {
    this.name = name;
    this.traceId = traceId;
    this.spanId = generateSpanId();
    this.parentSpanId = parentSpanId;
    this.startTime = Date.now();
    this.endTime = null;
    this.duration = null;
    this.tags = options.tags || {};
    this.logs = [];
    this.status = 'started';
    this.service = options.service || 'unknown';
    this.operation = options.operation || name;
  }
  
  /**
   * Agrega un tag
   */
  setTag(key, value) {
    this.tags[key] = value;
    return this;
  }
  
  /**
   * Agrega múltiples tags
   */
  setTags(tags) {
    Object.assign(this.tags, tags);
    return this;
  }
  
  /**
   * Agrega un log
   */
  addLog(timestamp, fields) {
    this.logs.push({
      timestamp: timestamp || Date.now(),
      fields
    });
    return this;
  }
  
  /**
   * Finaliza el span
   */
  finish(status = 'success', error = null) {
    this.endTime = Date.now();
    this.duration = this.endTime - this.startTime;
    this.status = status;
    
    if (error) {
      this.setTag('error', true);
      this.setTag('error.message', error.message);
      this.setTag('error.type', error.constructor.name);
      this.addLog(this.endTime, {
        event: 'error',
        message: error.message,
        stack: error.stack
      });
    }
    
    // Registrar métricas
    metrics.increment('span_finished', {
      service: this.service,
      operation: this.operation,
      status
    });
    metrics.observe('span_duration_ms', {
      service: this.service,
      operation: this.operation
    }, this.duration);
    
    return this;
  }
  
  /**
   * Obtiene el contexto del span para propagación
   */
  getContext() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      sampled: true
    };
  }
  
  /**
   * Serializa el span
   */
  toJSON() {
    return {
      name: this.name,
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      tags: this.tags,
      logs: this.logs,
      status: this.status,
      service: this.service,
      operation: this.operation
    };
  }
}

/**
 * Tracer para distributed tracing
 */
class Tracer {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'qwen-valencia';
    this.enabled = options.enabled !== false;
    this.sampleRate = options.sampleRate || 1.0; // 100% por defecto
    
    // Spans activos
    this.activeSpans = new Map();
    
    // Spans completados (buffer)
    this.completedSpans = [];
    this.maxBufferSize = options.maxBufferSize || 1000;
    
    logger.info('Tracer inicializado', {
      service: this.serviceName,
      enabled: this.enabled,
      sampleRate: this.sampleRate
    });
  }
  
  /**
   * Inicia un nuevo span
   */
  startSpan(name, options = {}) {
    if (!this.enabled) {
      return new Span(name, 'disabled', null, options);
    }
    
    // Decidir si muestrear
    const sampled = Math.random() < this.sampleRate;
    if (!sampled) {
      return new Span(name, 'not-sampled', null, options);
    }
    
    // Obtener trace context del parent si existe
    const parentSpanId = options.parentSpanId || null;
    let traceId = options.traceId;
    
    // Si no hay traceId, generar uno nuevo (root span)
    if (!traceId) {
      traceId = generateTraceId();
    }
    
    const span = new Span(name, traceId, parentSpanId, {
      ...options,
      service: this.serviceName
    });
    
    // Guardar span activo
    this.activeSpans.set(span.spanId, span);
    
    logger.debug('Span iniciado', {
      name: span.name,
      traceId: span.traceId,
      spanId: span.spanId
    });
    
    return span;
  }
  
  /**
   * Finaliza un span
   */
  finishSpan(span, status = 'success', error = null) {
    if (!span || !this.enabled) {
      return;
    }
    
    span.finish(status, error);
    
    // Remover de spans activos
    this.activeSpans.delete(span.spanId);
    
    // Agregar a spans completados
    this.completedSpans.push(span);
    
    // Limpiar buffer si es necesario
    if (this.completedSpans.length > this.maxBufferSize) {
      this.completedSpans.shift();
    }
    
    logger.debug('Span finalizado', {
      name: span.name,
      traceId: span.traceId,
      spanId: span.spanId,
      duration: span.duration
    });
  }
  
  /**
   * Crea un span hijo
   */
  startChildSpan(parentSpan, name, options = {}) {
    if (!parentSpan || !this.enabled) {
      return this.startSpan(name, options);
    }
    
    return this.startSpan(name, {
      ...options,
      traceId: parentSpan.traceId,
      parentSpanId: parentSpan.spanId
    });
  }
  
  /**
   * Extrae trace context de headers HTTP
   */
  extractContext(headers) {
    const traceId = headers['x-trace-id'] || headers['x-traceid'] || null;
    const spanId = headers['x-span-id'] || headers['x-spanid'] || null;
    const parentSpanId = headers['x-parent-span-id'] || headers['x-parent-spanid'] || null;
    const sampled = headers['x-trace-sampled'] !== 'false';
    
    if (traceId) {
      return {
        traceId,
        spanId,
        parentSpanId,
        sampled
      };
    }
    
    return null;
  }
  
  /**
   * Inyecta trace context en headers HTTP
   */
  injectContext(span, headers = {}) {
    if (!span || !this.enabled) {
      return headers;
    }
    
    const context = span.getContext();
    
    return {
      ...headers,
      'X-Trace-ID': context.traceId,
      'X-Span-ID': context.spanId,
      'X-Parent-Span-ID': context.parentSpanId || '',
      'X-Trace-Sampled': context.sampled ? 'true' : 'false'
    };
  }
  
  /**
   * Obtiene spans de un trace
   */
  getTraceSpans(traceId) {
    return this.completedSpans.filter(span => span.traceId === traceId);
  }
  
  /**
   * Obtiene todos los spans completados
   */
  getCompletedSpans(limit = 100) {
    return this.completedSpans.slice(-limit);
  }
  
  /**
   * Limpia spans antiguos
   */
  cleanup(maxAge = 3600000) { // 1 hora por defecto
    const now = Date.now();
    const initialLength = this.completedSpans.length;
    
    this.completedSpans = this.completedSpans.filter(span => {
      return span.endTime && (now - span.endTime) < maxAge;
    });
    
    const removed = initialLength - this.completedSpans.length;
    if (removed > 0) {
      logger.debug('Spans limpiados', { removed });
    }
    
    return removed;
  }
  
  /**
   * Obtiene estadísticas del tracer
   */
  getStats() {
    return {
      service: this.serviceName,
      enabled: this.enabled,
      activeSpans: this.activeSpans.size,
      completedSpans: this.completedSpans.length,
      traces: new Set(this.completedSpans.map(s => s.traceId)).size
    };
  }
}

// Instancia global del tracer
const globalTracer = new Tracer({
  serviceName: 'qwen-valencia',
  enabled: true
});

// Limpiar spans antiguos cada hora
setInterval(() => {
  globalTracer.cleanup();
}, 3600000);

module.exports = {
  Tracer,
  Span,
  globalTracer,
  generateTraceId,
  generateSpanId
};

