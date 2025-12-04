/**
 * ════════════════════════════════════════════════════════════════════════════
 * SANDRA IA MCP SERVER - Servidor MCP para Sandra IA 8.0
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Servidor MCP que expone Sandra IA 8.0 como un modelo disponible
 * en la aplicación QWEN Valencia.
 */

const express = require('express');
const { LoggerFactory } = require('../utils/logger');
const { MetricsFactory } = require('../utils/metrics');
const { getServiceConfig, getServicePortPool } = require('../config');
const SecurityMiddleware = require('../middleware/security');
const CorrelationMiddleware = require('../middleware/correlation');
const ValidatorMiddleware = require('../middleware/validator');
const { PortPoolManager } = require('../utils/port-pool-manager');
const { getPortShieldManager } = require('../utils/port-shield');
const { getInstanceManager } = require('../utils/instance-manager');

// Cargar orquestador de Sandra IA
let SandraOrchestrator;
try {
  // Intentar ruta relativa desde src/mcp/
  // src/mcp/ -> src/ -> raíz -> core/sandra-core
  const path = require('path');
  const sandraCorePath = path.join(__dirname, '..', '..', 'core', 'sandra-core');
  const sandraCore = require(sandraCorePath);
  SandraOrchestrator = sandraCore.SandraOrchestrator;
  console.log('✅ SandraOrchestrator cargado correctamente');
} catch (error) {
  console.warn('⚠️  No se pudo cargar Sandra Core, usando fallback', error.message);
  SandraOrchestrator = null;
}

class SandraIAMCPServer {
  constructor() {
    this.app = express();

    // Cargar configuración
    const serviceConfig = getServiceConfig('sandra-ia-mcp-server');

    // Obtener pool de puertos exclusivos
    const portPool = getServicePortPool('sandra-ia');
    const instanceManager = getInstanceManager();

    this.portPoolManager = null;
    this.port = null; // Se asignará al adquirir del pool
    this.shield = null;

    // Logger y métricas
    this.logger = LoggerFactory.create('sandra-ia-mcp-server');
    this.metrics = MetricsFactory.create('sandra_ia_mcp');

    // Orquestador de Sandra IA
    this.orchestrator = null;
    this.initializeOrchestrator();

    // Estadísticas
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errors: 0
    };

    this.setupMiddleware();
    this.setupRoutes();

    this.server = null;

    this.logger.info('Sandra IA MCP Server inicializado', {
      portPool: getServicePortPool('sandra-ia'),
      orchestratorAvailable: !!this.orchestrator,
      instanceId: getInstanceManager()?.instanceId || 'pending'
    });
  }

  /**
   * Inicializa el orquestador de Sandra IA
   */
  initializeOrchestrator() {
    try {
      if (SandraOrchestrator) {
        // Cargar GROQ_API_KEY desde variables-loader (igual que el resto de la app)
        const variablesLoader = require('../utils/variables-loader');
        const groqApiKey = variablesLoader.get('GROQ_API_KEY') || process.env.GROQ_API_KEY;

        if (!groqApiKey) {
          this.logger.warn(
            'GROQ_API_KEY no encontrada. Sandra IA puede no funcionar correctamente.'
          );
        } else {
          this.logger.info('GROQ_API_KEY cargada para Sandra IA');
        }

        this.orchestrator = new SandraOrchestrator({
          groqApiKey
        });

        // Configurar eventos
        this.orchestrator.on('taskCompleted', result => {
          this.logger.debug('Tarea completada', { taskId: result.taskId });
        });

        this.orchestrator.on('taskFailed', error => {
          this.logger.error('Tarea fallida', { taskId: error.taskId, error: error.error });
        });

        this.logger.info('Orquestador de Sandra IA inicializado correctamente');
      } else {
        this.logger.warn('SandraOrchestrator no disponible');
      }
    } catch (error) {
      this.logger.error('Error inicializando orquestador', { error: error.message });
    }
  }

  /**
   * Configura middleware
   */
  setupMiddleware() {
    // Body parser
    this.app.use(express.json({ limit: '50mb' }));

    // Correlation IDs
    const correlationMiddleware = CorrelationMiddleware.create();
    this.app.use(correlationMiddleware);

    // Security
    const securityMiddleware = SecurityMiddleware.create();
    this.app.use(securityMiddleware);

    // Validator
    const validatorMiddleware = ValidatorMiddleware.create();
    this.app.use(validatorMiddleware);

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Correlation-ID');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });
  }

  /**
   * Configura rutas
   */
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        service: 'sandra-ia-mcp-server',
        orchestrator: !!this.orchestrator,
        timestamp: new Date().toISOString()
      });
    });

    // Chat endpoint (compatible con Groq API Server)
    this.app.post('/chat', async (req, res) => {
      const startTime = Date.now();
      this.stats.totalRequests++;

      try {
        const { messages, options = {} } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Messages array is required'
          });
        }

        // Extraer el último mensaje del usuario
        const lastMessage = messages[messages.length - 1];
        const prompt = lastMessage.content || lastMessage.text || '';

        if (!prompt) {
          return res.status(400).json({
            success: false,
            error: 'Message content is required'
          });
        }

        // Determinar tipo de tarea
        let taskType = 'reasoning';
        const promptLower = prompt.toLowerCase();

        if (promptLower.match(/(imagen|imágenes|ver|visualizar|analizar.*imagen|ocr)/)) {
          taskType = 'vision';
        } else if (promptLower.match(/(código|programar|ejecutar|función|script)/)) {
          taskType = 'code';
        } else if (promptLower.match(/(audio|voz|transcribir)/)) {
          taskType = 'audio';
        }

        // Crear tarea para Sandra
        const task = {
          type: taskType,
          prompt,
          context: {
            conversationHistory: messages.slice(0, -1),
            options
          },
          requirements: {
            accuracy: options.accuracy !== false,
            speed: options.speed === true,
            creativity: options.creativity === true
          }
        };

        // Orquestar tarea
        if (!this.orchestrator) {
          throw new Error('Orquestador de Sandra IA no disponible');
        }

        const result = await this.orchestrator.orchestrateTask(task);

        // Construir respuesta compatible
        const response = {
          success: true,
          response: result.finalResponse.content,
          model: 'sandra-ia-8.0',
          provider: 'sandra',
          usage: {
            prompt_tokens: result.decision.analysis.estimatedTokens || 0,
            completion_tokens: 0,
            total_tokens: result.decision.analysis.estimatedTokens || 0
          },
          latency: result.latency,
          sources: result.finalResponse.sources
        };

        this.stats.successfulRequests++;
        const duration = Date.now() - startTime;
        this.metrics.observe('chat_duration_ms', {}, duration);
        this.metrics.increment('chat_success');

        res.json(response);
      } catch (error) {
        this.stats.failedRequests++;
        this.stats.errors++;
        const duration = Date.now() - startTime;
        this.metrics.observe('chat_error_duration_ms', {}, duration);
        this.metrics.increment('chat_errors');

        this.logger.error('Error en chat endpoint', {
          error: error.message,
          stack: error.stack
        });

        res.status(500).json({
          success: false,
          error: error.message || 'Internal server error'
        });
      }
    });

    // Route message endpoint (compatible con ModelRouter)
    this.app.post('/route-message', async (req, res) => {
      const startTime = Date.now();
      this.stats.totalRequests++;

      try {
        const { text, attachments = [], modality = 'text', options = {} } = req.body;

        if (!text) {
          return res.status(400).json({
            success: false,
            error: 'Text is required'
          });
        }

        // Detectar si es un saludo o pregunta sobre identidad
        const textLower = text.toLowerCase().trim();
        const isGreeting = textLower.match(
          /^(hola|hi|hello|buenos días|buenas tardes|buenas noches|saludos)/
        );
        const isIdentityQuestion = textLower.match(
          /(quién eres|who are you|qué eres|what are you|presentarte|presentarte)/
        );

        // Si es saludo o pregunta de identidad, responder directamente con la identidad
        if (isGreeting || isIdentityQuestion || textLower.length < 10) {
          const identity = this.orchestrator?.getIdentity?.() || {
            response:
              'Hola, soy Sandra IA 8.0, un agente de inteligencia artificial modelo multimodal, creado por Clay. ¿En qué puedo ayudarte?'
          };

          return res.json({
            success: true,
            response:
              identity.response ||
              identity.variations?.[0] ||
              'Hola, soy Sandra IA 8.0, un agente de inteligencia artificial modelo multimodal, creado por Clay. ¿En qué puedo ayudarte?',
            content:
              identity.response ||
              identity.variations?.[0] ||
              'Hola, soy Sandra IA 8.0, un agente de inteligencia artificial modelo multimodal, creado por Clay. ¿En qué puedo ayudarte?',
            model: 'sandra-ia-8.0',
            provider: 'sandra',
            taskType: 'greeting',
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            latency: Date.now() - startTime
          });
        }

        // Determinar tipo de tarea
        let taskType = 'reasoning';

        if (attachments.length > 0 || modality === 'image' || modality === 'vision') {
          taskType = 'vision';
        } else if (textLower.match(/(código|programar|ejecutar|función|script)/)) {
          taskType = 'code';
        } else if (textLower.match(/(audio|voz|transcribir)/)) {
          taskType = 'audio';
        }

        // Crear tarea
        const task = {
          type: taskType,
          prompt: text,
          context: {
            attachments,
            modality
          },
          requirements: {
            accuracy: true,
            speed: options.speed === true
          }
        };

        // Orquestar
        if (!this.orchestrator) {
          throw new Error('Orquestador de Sandra IA no disponible');
        }

        const result = await this.orchestrator.orchestrateTask(task);

        // Respuesta compatible
        const response = {
          success: true,
          response: result.finalResponse.content,
          content: result.finalResponse.content,
          model: 'sandra-ia-8.0',
          provider: 'sandra',
          usage: {
            prompt_tokens: result.decision.analysis.estimatedTokens || 0,
            completion_tokens: 0,
            total_tokens: result.decision.analysis.estimatedTokens || 0
          }
        };

        this.stats.successfulRequests++;
        const duration = Date.now() - startTime;
        this.metrics.observe('route_message_duration_ms', {}, duration);
        this.metrics.increment('route_message_success');

        res.json(response);
      } catch (error) {
        this.stats.failedRequests++;
        this.stats.errors++;
        const duration = Date.now() - startTime;
        this.metrics.observe('route_message_error_duration_ms', {}, duration);
        this.metrics.increment('route_message_errors');

        this.logger.error('Error en route-message endpoint', {
          error: error.message,
          stack: error.stack
        });

        res.status(500).json({
          success: false,
          error: error.message || 'Internal server error'
        });
      }
    });

    // Stats endpoint
    this.app.get('/stats', (req, res) => {
      const metrics = this.orchestrator ? this.orchestrator.getMetrics() : null;

      res.json({
        stats: this.stats,
        orchestratorMetrics: metrics,
        orchestratorAvailable: !!this.orchestrator
      });
    });
  }

  /**
   * Inicia el servidor usando pool de puertos exclusivos con rotación automática
   */
  async start() {
    try {
      // Obtener pool de puertos y crear pool manager
      const portPool = getServicePortPool('sandra-ia');
      const instanceManager = getInstanceManager();

      if (!instanceManager || !instanceManager.instanceNumber) {
        throw new Error(
          'Instance manager no inicializado. La aplicación debe inicializarse primero.'
        );
      }

      this.portPoolManager = new PortPoolManager(
        'sandra-ia',
        portPool,
        process.pid,
        instanceManager.instanceId
      );

      // Adquirir puerto del pool con rotación automática
      this.port = await this.portPoolManager.acquirePortFromPool();

      if (!this.port) {
        const acquisitionInfo = this.portPoolManager.getAcquisitionInfo();
        this.logger.error('ERROR FATAL: No se pudo adquirir ningún puerto del pool', {
          service: 'sandra-ia',
          portPool,
          attemptedPorts: acquisitionInfo.attemptedPorts,
          instanceId: instanceManager.instanceId
        });

        throw new Error(
          `No se pudo adquirir ningún puerto del pool de Sandra IA. ` +
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
            this.logger.info(`✅ Sandra IA MCP Server escuchando en puerto ${this.port}`, {
              port: this.port,
              portPool,
              instanceId: instanceManager.instanceId
            });
            resolve();
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
      this.logger.error('Error iniciando Sandra IA MCP Server', {
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
   * Detiene el servidor y libera recursos
   */
  async stop() {
    this.logger.info('Deteniendo Sandra IA MCP Server...');

    return new Promise(resolve => {
      if (this.server) {
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

          resolve();
        });
      } else {
        // Liberar recursos incluso si el servidor no estaba corriendo
        if (this.shield && this.port) {
          const shieldManager = getPortShieldManager();
          shieldManager.removeShield(this.port);
        }

        if (this.portPoolManager) {
          this.portPoolManager.releasePort();
        }

        resolve();
      }
    });
  }
}

module.exports = SandraIAMCPServer;
