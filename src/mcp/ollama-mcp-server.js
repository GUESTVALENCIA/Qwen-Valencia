/**
 * OLLAMA MCP SERVER - Servidor Dedicado Optimizado
 *
 * Características:
 * - Streaming real con Server-Sent Events (SSE)
 * - Conexiones HTTP keep-alive persistentes
 * - Pool de conexiones reutilizables
 * - Cache inteligente con TTL
 * - Límites de recursos (CPU throttling, memoria)
 * - Priorización de procesos
 * - Timeout adaptativo según modelo
 * - Queue de requests con prioridades
 */

const express = require('express');
const axios = require('axios');
const http = require('http');
const crypto = require('crypto');
const EventEmitter = require('events');
const path = require('path');
const os = require('os');
const { RateLimiterFactory } = require('../utils/rate-limiter');
const { LoggerFactory } = require('../utils/logger');
const { MetricsFactory } = require('../utils/metrics');
const { getServiceConfig, getServicePortPool } = require('../config');
const SecurityMiddleware = require('../middleware/security');
const CorrelationMiddleware = require('../middleware/correlation');
const ValidatorMiddleware = require('../middleware/validator');
const { setupSwagger } = require('../utils/swagger-setup');
const { StreamManager } = require('../utils/stream-manager');
const { PortPoolManager } = require('../utils/port-pool-manager');
const { getPortShieldManager } = require('../utils/port-shield');
const { getInstanceManager } = require('../utils/instance-manager');

class OllamaMCPServer extends EventEmitter {
  constructor() {
    super();
    this.app = express();

    // Cargar configuración centralizada
    const serviceConfig = getServiceConfig('ollama-mcp-server');

    // Obtener pool de puertos exclusivos
    const portPool = getServicePortPool('ollama-mcp');
    const instanceManager = getInstanceManager();

    this.portPoolManager = null;
    this.port = null; // Se asignará al adquirir del pool
    this.shield = null;

    // Logger y métricas
    this.logger = LoggerFactory.create('ollama-mcp-server');
    this.metrics = MetricsFactory.create('ollama_api');

    // Configuración de Ollama
    this.ollamaUrl = serviceConfig.baseUrl || 'http://localhost:11434';

    // Cache de modelos disponibles
    this.availableModels = [];
    this.modelsCacheTime = 0;
    this.modelsCacheTTL = serviceConfig.modelsCacheTTL || 60000;
    this.ollamaTimeout = serviceConfig.timeout || 300000;

    // Pool de conexiones HTTP persistentes
    this.httpAgent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 60000
    });

    // Cache inteligente con LRU
    const LRUCache = require('../utils/lru-cache');
    this.cache = new LRUCache({
      maxSize: serviceConfig.cache?.maxSize || 200,
      ttl: serviceConfig.cache?.ttl || 1800000,
      onEvict: (key, value) => {
        this.logger.debug('Elemento evictado del cache', { key });
      }
    });
    this.maxCacheSize = serviceConfig.cache?.maxSize || 200;
    this.cacheTTL = serviceConfig.cache?.ttl || 1800000;

    // Stream Manager - Abstracción unificada para SSE
    this.streamManager = new StreamManager({
      maxStreamTimeout: this.ollamaTimeout,
      cleanupInterval: 60000 // 1 minuto
    });

    // Mantener activeStreams para compatibilidad (deprecated, usar streamManager)
    this.activeStreams = this.streamManager.activeStreams;

    // Queue de requests con prioridades
    this.requestQueue = [];
    this.maxConcurrentRequests = serviceConfig.maxConcurrentRequests || 2;
    this.currentRequests = 0;

    // Servidor HTTP
    this.server = null;

    // Intervals para cleanup (guardar referencias para poder limpiarlos)
    this.cleanupIntervals = [];

    // Estadísticas
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      streamingRequests: 0,
      errors: 0,
      avgResponseTime: 0,
      responseTimes: []
    };

    // Optimización de recursos
    this.setupResourceLimits();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSwagger();

    // Limpieza periódica de cache (guardar referencia)
    const cacheCleanupInterval = setInterval(() => this.cleanCache(), 600000); // Cada 10 minutos
    this.cleanupIntervals.push(cacheCleanupInterval);

    this.logger.info('Ollama MCP Server inicializado', {
      portPool,
      ollamaUrl: this.ollamaUrl,
      instanceId: instanceManager?.instanceId || 'pending'
    });
  }

  /**
   * Configurar Swagger UI para documentación OpenAPI
   */
  setupSwagger() {
    try {
      setupSwagger(this.app);
      this.logger.info('Swagger UI configurado en /api/docs');
    } catch (error) {
      this.logger.warn('No se pudo configurar Swagger UI', { error: error.message });
    }
  }

  /**
   * Configurar límites de recursos para evitar ralentización del sistema
   */
  setupResourceLimits() {
    try {
      // Reducir prioridad del proceso (Windows)
      if (process.platform === 'win32') {
        // En Windows, usar setPriority si está disponible
        if (process.setPriority) {
          process.setPriority(process.priority || 10); // Prioridad normal-baja
        }
      } else {
        // Linux/Mac: usar nice
        try {
          os.setPriority(process.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
        } catch (e) {
          // Ignorar si no hay permisos
        }
      }

      // Limitar memoria (si Node.js lo permite)
      if (process.env.NODE_OPTIONS) {
        process.env.NODE_OPTIONS += ' --max-old-space-size=2048';
      }

      this.logger.info('Límites de recursos configurados');
    } catch (error) {
      this.logger.warn('No se pudieron configurar límites de recursos', { error: error.message });
    }
  }

  setupMiddleware() {
    const serviceConfig = getServiceConfig('ollama-mcp-server');

    // Body parser
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.text({ limit: '50mb' }));

    // Correlation IDs
    const correlationMiddleware = CorrelationMiddleware.create();
    this.app.use(correlationMiddleware.middleware());

    // Security middleware
    const securityMiddleware = SecurityMiddleware.create({
      enableHelmet: serviceConfig.security?.enableHelmet !== false,
      corsOrigin: serviceConfig.security?.corsOrigin || '*',
      corsCredentials: serviceConfig.security?.corsCredentials !== false,
      corsMethods: ['GET', 'POST', 'OPTIONS'],
      corsHeaders: ['Content-Type', 'Authorization', 'mcp-secret', 'X-Correlation-ID'],
      trustProxy: serviceConfig.security?.trustProxy || false
    });
    this.app.use(securityMiddleware.middleware());

    // Rate limiting avanzado (más permisivo para Ollama local)
    this.rateLimiter = RateLimiterFactory.standard({
      windowMs: serviceConfig.rateLimit?.windowMs || 60000,
      maxRequests: serviceConfig.rateLimit?.maxRequests || 200,
      keyGenerator: req => {
        return req.ip || 'unknown';
      }
    });
    this.app.use(this.rateLimiter.middleware());

    // Validator middleware
    this.validator = ValidatorMiddleware.create();

    // Logging de requests con correlation ID
    this.app.use((req, res, next) => {
      const correlationId = req.correlationId || 'unknown';
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        this.stats.responseTimes.push(duration);
        if (this.stats.responseTimes.length > 100) {
          this.stats.responseTimes.shift();
        }
        this.stats.avgResponseTime =
          this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length;

        this.logger.info('Request procesado', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          correlationId
        });

        // Métricas
        this.metrics.recordRequest(req.method, req.path, res.statusCode, duration);
      });

      next();
    });
  }

  setupRoutes() {
    // Health check (liveness)
    this.app.get('/ollama/health', (req, res) => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      res.json({
        status: 'healthy',
        service: 'ollama-mcp',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        ollamaUrl: this.ollamaUrl,
        activeStreams: this.streamManager.activeStreams.size,
        cacheSize: this.cache.size(),
        currentRequests: this.currentRequests,
        stats: this.stats,
        system: {
          memory: {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
          },
          cpu: {
            user: `${cpuUsage.user / 1000}ms`,
            system: `${cpuUsage.system / 1000}ms`
          },
          platform: process.platform,
          nodeVersion: process.version
        }
      });
    });

    // Health check (readiness)
    this.app.get('/ollama/health/ready', async (req, res) => {
      // Verificar conexión con Ollama
      let ollamaAvailable = false;
      try {
        const response = await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 5000 });
        ollamaAvailable = response.status === 200;
      } catch (error) {
        ollamaAvailable = false;
      }

      const isReady = ollamaAvailable && this.server && this.server.listening;
      res.status(isReady ? 200 : 503).json({
        ready: isReady,
        service: 'ollama-mcp',
        checks: {
          ollama: ollamaAvailable,
          server: this.server && this.server.listening
        }
      });
    });

    // Health check (liveness)
    this.app.get('/ollama/health/live', (req, res) => {
      res.json({
        alive: true,
        service: 'ollama-mcp',
        pid: process.pid
      });
    });

    // Verificar conexión con Ollama y listar modelos
    this.app.get('/ollama/models', async (req, res) => {
      try {
        const response = await axios.get(`${this.ollamaUrl}/api/tags`, {
          timeout: 5000,
          httpAgent: this.httpAgent
        });
        res.json({
          success: true,
          ollamaAvailable: true,
          models: response.data.models || []
        });
      } catch (error) {
        res.json({
          success: false,
          ollamaAvailable: false,
          error: error.message,
          models: []
        });
      }
    });

    // Chat con streaming (SSE) - con validación
    this.app.post(
      '/ollama/stream/chat',
      this.validator.validate(
        '/ollama/stream/chat',
        ValidatorMiddleware.commonSchemas.ollamaChatRequest
      ),
      async (req, res) => {
        // Verificar límite de requests concurrentes
        if (this.currentRequests >= this.maxConcurrentRequests) {
          return res.status(429).json({
            error: 'Demasiadas requests concurrentes. Intenta de nuevo en un momento.'
          });
        }

        this.currentRequests++;
        const requestId =
          req.body.requestId || `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const { model, messages, images, options = {} } = req.body;

        if (!model || !messages) {
          this.currentRequests--;
          const { APIError } = require('../utils/api-error');
          const error = APIError.invalidRequest('model y messages son requeridos', {
            missing: !model ? ['model'] : ['messages']
          });
          return res.status(error.statusCode).json(error.toJSON());
        }

        this.stats.totalRequests++;
        this.stats.streamingRequests++;

        // Usar StreamManager para manejar el stream
        const streamInfo = this.streamManager.createStream(res, requestId, {
          model,
          messages,
          images,
          options
        });

        try {
          await this.streamChat({
            model,
            messages: this.optimizeMessages(messages),
            images,
            options,
            requestId,
            onToken: (token, fullContent) => {
              this.streamManager.sendToken(requestId, token, fullContent);
            },
            onComplete: fullContent => {
              this.streamManager.complete(requestId, fullContent);
              this.currentRequests--;
            },
            onError: error => {
              this.streamManager.sendError(requestId, error);
              this.stats.errors++;
              this.currentRequests--;
            }
          });
        } catch (error) {
          this.streamManager.sendError(requestId, error);
          this.stats.errors++;
          this.currentRequests--;
        }
      }
    );

    // Chat sin streaming (más rápido para respuestas cortas) - con validación
    this.app.post(
      '/ollama/chat',
      this.validator.validate('/ollama/chat', ValidatorMiddleware.commonSchemas.ollamaChatRequest),
      async (req, res) => {
        // Verificar límite de requests concurrentes
        if (this.currentRequests >= this.maxConcurrentRequests) {
          return res.status(429).json({
            error: 'Demasiadas requests concurrentes. Intenta de nuevo en un momento.'
          });
        }

        this.currentRequests++;
        const { model, messages, images, options = {} } = req.body;

        if (!model || !messages) {
          this.currentRequests--;
          const { APIError } = require('../utils/api-error');
          const error = APIError.invalidRequest('model y messages son requeridos', {
            missing: !model ? ['model'] : ['messages']
          });
          return res.status(error.statusCode).json(error.toJSON());
        }

        this.stats.totalRequests++;

        try {
          // Verificar cache primero
          const cacheKey = this.generateCacheKey(messages, model);
          const cached = this.cache.get(cacheKey);
          if (cached) {
            // LRUCache maneja TTL automáticamente, si existe no está expirado
            this.stats.cacheHits++;
            this.currentRequests--;
            return res.json({
              success: true,
              content: cached.response,
              cached: true
            });
          }

          this.stats.cacheMisses++;

          const result = await this.optimizedChat({
            model,
            messages: this.optimizeMessages(messages),
            images,
            options
          });

          // Guardar en cache (LRUCache maneja TTL y tamaño máximo automáticamente)
          if (result.success && result.content) {
            this.cache.set(cacheKey, {
              response: result.content,
              timestamp: Date.now()
            });
          }

          this.currentRequests--;
          res.json(result);
        } catch (error) {
          this.stats.errors++;
          this.currentRequests--;
          res.status(500).json({
            success: false,
            error: error.message || 'Error desconocido'
          });
        }
      }
    );

    // Estadísticas
    this.app.get('/ollama/stats', (req, res) => {
      res.json(this.stats);
    });

    // Limpiar cache
    this.app.post('/ollama/cache/clear', (req, res) => {
      this.cache.clear();
      res.json({ success: true, message: 'Cache limpiado' });
    });

    // Cancelar stream
    this.app.post('/ollama/stream/cancel', (req, res) => {
      const { requestId } = req.body;
      if (requestId && this.streamManager.activeStreams.has(requestId)) {
        this.streamManager.closeStream(requestId, 'cancel');
        this.currentRequests--;
        res.json({ success: true, message: 'Stream cancelado' });
      } else {
        const { APIError } = require('../utils/api-error');
        const error = APIError.modelNotFound('stream', { streamId: requestId });
        res.status(error.statusCode).json(error.toJSON());
      }
    });
  }

  /**
   * Optimizar mensajes (truncar si son muy largos)
   */
  optimizeMessages(messages) {
    const maxLength = 8000; // Máximo de caracteres por mensaje
    return messages.map(msg => {
      if (msg.content && msg.content.length > maxLength) {
        return {
          ...msg,
          content: msg.content.substring(0, maxLength) + '...[truncado]'
        };
      }
      return msg;
    });
  }

  /**
   * Generar clave de cache
   */
  generateCacheKey(messages, model) {
    const content = JSON.stringify({ messages, model });
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Limpiar cache expirado (LRUCache lo hace automáticamente, pero mantenemos método para compatibilidad)
   */
  cleanCache() {
    // LRUCache limpia elementos expirados automáticamente
    const cleaned = this.cache.cleanExpired();
    if (cleaned > 0) {
      this.logger.debug(`Cache limpiado: ${cleaned} elementos expirados removidos`);
    }
  }

  /**
   * Chat optimizado (sin streaming)
   */
  async optimizedChat({ model, messages, images, options }) {
    // Verificar que el modelo esté disponible antes de intentar usarlo
    const isAvailable = await this.isModelAvailable(model);
    if (!isAvailable) {
      const { APIError } = require('../utils/api-error');
      throw APIError.modelNotFound(model, {
        suggestion: `Ejecuta: ollama pull ${model}`,
        availableModels: this.availableModels.slice(0, 10) // Primeros 10 modelos disponibles
      });
    }
    try {
      const response = await axios.post(
        `${this.ollamaUrl}/api/chat`,
        {
          model,
          messages,
          stream: false,
          options: {
            temperature: options.temperature || 0.7,
            num_ctx: options.num_ctx || 4096,
            ...options
          }
        },
        {
          timeout: this.ollamaTimeout,
          httpAgent: this.httpAgent
        }
      );

      if (!response.data || !response.data.message || !response.data.message.content) {
        throw new Error('Respuesta inválida de Ollama');
      }

      return {
        success: true,
        content: response.data.message.content,
        model: response.data.model || model
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Error desconocido'
      };
    }
  }

  /**
   * Chat con streaming (SSE)
   */
  async streamChat({ model, messages, images, options, requestId, onToken, onComplete, onError }) {
    try {
      const response = await axios.post(
        `${this.ollamaUrl}/api/chat`,
        {
          model,
          messages,
          stream: true,
          options: {
            temperature: options.temperature || 0.7,
            num_ctx: options.num_ctx || 4096,
            ...options
          }
        },
        {
          timeout: this.ollamaTimeout,
          responseType: 'stream',
          httpAgent: this.httpAgent
        }
      );

      let fullContent = '';
      let isComplete = false; // Flag para evitar llamar onComplete dos veces

      response.data.on('data', chunk => {
        const lines = chunk
          .toString()
          .split('\n')
          .filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message && data.message.content) {
              const content = data.message.content;
              fullContent += content;

              if (onToken) {
                onToken(content, fullContent);
              }

              // FIX: Solo llamar onComplete cuando data.done es true, y marcar como completo
              if (data.done && onComplete && !isComplete) {
                isComplete = true;
                onComplete(fullContent);
              }
            }
          } catch (e) {
            // Ignorar líneas que no son JSON válido
          }
        }
      });

      // FIX: Solo llamar onComplete si no se llamó ya (cuando data.done fue true)
      response.data.on('end', () => {
        if (fullContent && onComplete && !isComplete) {
          isComplete = true;
          onComplete(fullContent);
        }
      });

      response.data.on('error', error => {
        if (onError) {
          onError(error);
        }
      });
    } catch (error) {
      if (onError) {
        onError(error);
      }
    }
  }

  /**
   * Iniciar servidor
   */
  async start() {
    try {
      // Obtener pool de puertos y crear pool manager
      const portPool = getServicePortPool('ollama-mcp');
      const instanceManager = getInstanceManager();

      if (!instanceManager || !instanceManager.instanceNumber) {
        throw new Error(
          'Instance manager no inicializado. La aplicación debe inicializarse primero.'
        );
      }

      this.portPoolManager = new PortPoolManager(
        'ollama-mcp',
        portPool,
        process.pid,
        instanceManager.instanceId
      );

      // Adquirir puerto del pool con rotación automática
      this.port = await this.portPoolManager.acquirePortFromPool();

      if (!this.port) {
        const acquisitionInfo = this.portPoolManager.getAcquisitionInfo();
        this.logger.error('ERROR FATAL: No se pudo adquirir ningún puerto del pool', {
          service: 'ollama-mcp',
          portPool,
          attemptedPorts: acquisitionInfo.attemptedPorts,
          instanceId: instanceManager.instanceId
        });

        throw new Error(
          `No se pudo adquirir ningún puerto del pool de Ollama MCP. ` +
            `Pool: [${portPool.join(', ')}]. ` +
            `Todos los puertos están bloqueados exclusivamente.`
        );
      }

      // Activar shield de protección del puerto
      const shieldManager = getPortShieldManager();
      this.shield = shieldManager.createShield(
        this.port,
        process.pid,
        instanceManager.instanceId,
        port => {
          this.logger.error(
            `SHIELD PERDIDO: Puerto ${port} ya no está bajo nuestro control. Cerrando servidor.`
          );
          this.stop();
        }
      );

      // Iniciar servidor en el puerto adquirido
      return new Promise((resolve, reject) => {
        try {
          this.server = this.app.listen(this.port, () => {
            this.logger.info(`✅ Ollama MCP Server escuchando en puerto ${this.port}`, {
              port: this.port,
              portPool,
              instanceId: instanceManager.instanceId
            });
            this.setupGracefulShutdown();
            resolve(true);
          });

          this.server.on('error', error => {
            if (error.code === 'EADDRINUSE') {
              this.logger.error(
                `ERROR FATAL: Puerto ${this.port} está en uso después de adquirir lock`,
                {
                  port: this.port,
                  error: error.message
                }
              );

              // Liberar lock y shield
              if (this.portPoolManager) {
                this.portPoolManager.releasePort();
              }
              if (this.shield) {
                const shieldManager = getPortShieldManager();
                shieldManager.removeShield(this.port);
              }

              reject(new Error(`Puerto ${this.port} está en uso. Conflicto detectado.`));
            } else {
              reject(error);
            }
          });
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      this.logger.error('Error iniciando Ollama MCP Server', {
        error: error.message,
        stack: error.stack
      });

      // Liberar recursos en caso de error
      if (this.portPoolManager && this.port) {
        this.portPoolManager.releasePort();
      }
      if (this.shield && this.port) {
        const shieldManager = getPortShieldManager();
        shieldManager.removeShield(this.port);
      }

      throw error;
    }
  }

  /**
   * Detener el servidor y liberar recursos
   */
  async stop() {
    this.logger.info('Deteniendo Ollama MCP Server...');

    // Cerrar servidor HTTP
    if (this.server) {
      return new Promise(resolve => {
        this.server.close(() => {
          this.logger.info('Servidor HTTP cerrado');

          // Liberar shield
          if (this.shield && this.port) {
            const shieldManager = getPortShieldManager();
            shieldManager.removeShield(this.port);
          }

          // Liberar puerto del pool
          if (this.portPoolManager) {
            this.portPoolManager.releasePort();
            this.logger.info(`Puerto ${this.port} liberado del pool`);
          }

          // Cerrar streams activos
          if (this.streamManager) {
            this.streamManager.closeAll('stop');
          }

          // Cerrar pool de conexiones HTTP
          if (this.httpAgent) {
            this.httpAgent.destroy();
          }

          resolve();
        });
      });
    }

    // Liberar recursos incluso si el servidor no estaba corriendo
    if (this.shield && this.port) {
      const shieldManager = getPortShieldManager();
      shieldManager.removeShield(this.port);
    }

    if (this.portPoolManager) {
      this.portPoolManager.releasePort();
    }
  }

  /**
   * Configurar graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = async signal => {
      this.logger.info(`Recibida señal ${signal}, iniciando cierre graceful...`);

      // Usar método stop() para liberar todos los recursos
      await this.stop();

      // Esperar a que requests en curso terminen (máximo 30 segundos)
      const maxWait = 30000;
      const startTime = Date.now();

      while (this.currentRequests > 0 && Date.now() - startTime < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (this.currentRequests > 0) {
        this.logger.warn(`${this.currentRequests} requests aún en curso después del timeout`);
      }

      // Limpiar recursos adicionales
      this.cache.clear();
      this.logger.info('Cierre graceful completado');

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Si se ejecuta directamente, iniciar servidor
if (require.main === module) {
  const server = new OllamaMCPServer();
  server.start().catch(error => {
    const logger = LoggerFactory.create('ollama-mcp-server');
    logger.error('Error iniciando Ollama MCP Server', { error: error.message, stack: error.stack });
    process.exit(1);
  });
}

module.exports = OllamaMCPServer;
