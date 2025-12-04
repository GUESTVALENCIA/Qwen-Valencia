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
const { getServiceConfig } = require('../config');
const SecurityMiddleware = require('../middleware/security');
const CorrelationMiddleware = require('../middleware/correlation');
const ValidatorMiddleware = require('../middleware/validator');

// Cargar orquestador de Sandra IA
let SandraOrchestrator;
try {
  const sandraCore = require('../../../core/sandra-core');
  SandraOrchestrator = sandraCore.SandraOrchestrator;
} catch (error) {
  console.warn('⚠️  No se pudo cargar Sandra Core, usando fallback');
  SandraOrchestrator = null;
}

class SandraIAMCPServer {
  constructor() {
    this.app = express();
    
    // Cargar configuración
    const serviceConfig = getServiceConfig('sandra-ia-mcp-server');
    this.port = serviceConfig.port || 6004;
    
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
      port: this.port,
      orchestratorAvailable: !!this.orchestrator
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
          this.logger.warn('GROQ_API_KEY no encontrada. Sandra IA puede no funcionar correctamente.');
        } else {
          this.logger.info('GROQ_API_KEY cargada para Sandra IA');
        }
        
        this.orchestrator = new SandraOrchestrator({
          groqApiKey: groqApiKey
        });
        
        // Configurar eventos
        this.orchestrator.on('taskCompleted', (result) => {
          this.logger.debug('Tarea completada', { taskId: result.taskId });
        });
        
        this.orchestrator.on('taskFailed', (error) => {
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
          prompt: prompt,
          context: {
            conversationHistory: messages.slice(0, -1),
            options: options
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
        
        // Determinar tipo de tarea
        let taskType = 'reasoning';
        const textLower = text.toLowerCase();
        
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
            attachments: attachments,
            modality: modality
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
   * Inicia el servidor
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          this.logger.info(`Sandra IA MCP Server escuchando en puerto ${this.port}`);
          resolve();
        });
        
        this.server.on('error', (error) => {
          this.logger.error('Error en servidor', { error: error.message });
          reject(error);
        });
      } catch (error) {
        this.logger.error('Error iniciando servidor', { error: error.message });
        reject(error);
      }
    });
  }
  
  /**
   * Detiene el servidor
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('Sandra IA MCP Server detenido');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = SandraIAMCPServer;

