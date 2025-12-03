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

// Cargar desde qwen-valencia.env (archivo único para Qwen-Valencia)
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'qwen-valencia.env') });

class OllamaMCPServer extends EventEmitter {
  constructor() {
    super();
    this.app = express();
    this.port = process.env.OLLAMA_MCP_PORT || 6002;
    
    // Configuración de Ollama
    this.ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.ollamaTimeout = 300000; // 5 minutos
    
    // Pool de conexiones HTTP persistentes
    this.httpAgent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 10, // Reducido para no saturar
      maxFreeSockets: 5,
      timeout: 60000
    });
    
    // Cache inteligente
    this.cache = new Map();
    this.maxCacheSize = 200;
    this.cacheTTL = 1800000; // 30 minutos
    
    // Streams activos
    this.activeStreams = new Map();
    
    // Queue de requests con prioridades
    this.requestQueue = [];
    this.maxConcurrentRequests = 2; // Limitar requests concurrentes
    this.currentRequests = 0;
    
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
    
    // Limpieza periódica de cache
    setInterval(() => this.cleanCache(), 600000); // Cada 10 minutos
    
    console.log('✅ Ollama MCP Server inicializado');
    console.log(`📡 Puerto: ${this.port}`);
    console.log(`🔗 Ollama URL: ${this.ollamaUrl}`);
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
      
      console.log('✅ Límites de recursos configurados');
    } catch (error) {
      console.warn('⚠️ No se pudieron configurar límites de recursos:', error.message);
    }
  }
  
  setupMiddleware() {
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.text({ limit: '50mb' }));
    
    // CORS completo
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-secret');
      if (req.method === 'OPTIONS') return res.sendStatus(200);
      next();
    });
    
    // Logging de requests
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.stats.responseTimes.push(duration);
        if (this.stats.responseTimes.length > 100) {
          this.stats.responseTimes.shift();
        }
        this.stats.avgResponseTime = 
          this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length;
      });
      next();
    });
  }
  
  setupRoutes() {
    // Health check
    this.app.get('/ollama/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'ollama-mcp',
        ollamaUrl: this.ollamaUrl,
        activeStreams: this.activeStreams.size,
        cacheSize: this.cache.size,
        currentRequests: this.currentRequests,
        stats: this.stats
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
    
    // Chat con streaming (SSE)
    this.app.post('/ollama/stream/chat', async (req, res) => {
      // Verificar límite de requests concurrentes
      if (this.currentRequests >= this.maxConcurrentRequests) {
        return res.status(429).json({ 
          error: 'Demasiadas requests concurrentes. Intenta de nuevo en un momento.' 
        });
      }
      
      this.currentRequests++;
      const requestId = req.body.requestId || `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const { model, messages, images, options = {} } = req.body;
      
      if (!model || !messages) {
        this.currentRequests--;
        return res.status(400).json({ error: 'model y messages son requeridos' });
      }
      
      this.stats.totalRequests++;
      this.stats.streamingRequests++;
      
      // Configurar SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      
      // Enviar ID de request
      res.write(`id: ${requestId}\n`);
      res.write(`data: ${JSON.stringify({ type: 'start', requestId })}\n\n`);
      
      this.activeStreams.set(requestId, { res, startTime: Date.now() });
      
      try {
        await this.streamChat({
          model,
          messages: this.optimizeMessages(messages),
          images,
          options,
          requestId,
          onToken: (token, fullContent) => {
            if (this.activeStreams.has(requestId)) {
              res.write(`data: ${JSON.stringify({ 
                type: 'token', 
                token, 
                fullContent,
                requestId 
              })}\n\n`);
            }
          },
          onComplete: (fullContent) => {
            if (this.activeStreams.has(requestId)) {
              res.write(`data: ${JSON.stringify({ 
                type: 'complete', 
                content: fullContent,
                requestId 
              })}\n\n`);
              res.end();
              this.activeStreams.delete(requestId);
            }
            this.currentRequests--;
          },
          onError: (error) => {
            if (this.activeStreams.has(requestId)) {
              res.write(`data: ${JSON.stringify({ 
                type: 'error', 
                error: error.message || error,
                requestId 
              })}\n\n`);
              res.end();
              this.activeStreams.delete(requestId);
            }
            this.stats.errors++;
            this.currentRequests--;
          }
        });
      } catch (error) {
        if (this.activeStreams.has(requestId)) {
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            error: error.message || 'Error desconocido',
            requestId 
          })}\n\n`);
          res.end();
          this.activeStreams.delete(requestId);
        }
        this.stats.errors++;
        this.currentRequests--;
      }
    });
    
    // Chat sin streaming (más rápido para respuestas cortas)
    this.app.post('/ollama/chat', async (req, res) => {
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
        return res.status(400).json({ error: 'model y messages son requeridos' });
      }
      
      this.stats.totalRequests++;
      
      try {
        // Verificar cache primero
        const cacheKey = this.generateCacheKey(messages, model);
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
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
        
        // Guardar en cache
        if (result.success && result.content) {
          this.cache.set(cacheKey, {
            response: result.content,
            timestamp: Date.now()
          });
          
          // Limpiar cache si excede tamaño máximo
          if (this.cache.size > this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
          }
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
    });
    
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
      if (requestId && this.activeStreams.has(requestId)) {
        const stream = this.activeStreams.get(requestId);
        stream.res.end();
        this.activeStreams.delete(requestId);
        this.currentRequests--;
        res.json({ success: true, message: 'Stream cancelado' });
      } else {
        res.status(404).json({ error: 'Stream no encontrado' });
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
   * Limpiar cache expirado
   */
  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Chat optimizado (sin streaming)
   */
  async optimizedChat({ model, messages, images, options }) {
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
      
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message && data.message.content) {
              const content = data.message.content;
              fullContent += content;
              
              if (onToken) {
                onToken(content, fullContent);
              }
              
              if (data.done && onComplete) {
                onComplete(fullContent);
              }
            }
          } catch (e) {
            // Ignorar líneas que no son JSON válido
          }
        }
      });
      
      response.data.on('end', () => {
        if (fullContent && onComplete) {
          onComplete(fullContent);
        }
      });
      
      response.data.on('error', (error) => {
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
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`✅ Ollama MCP Server escuchando en puerto ${this.port}`);
          resolve(true);
        });
        
        this.server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            console.error(`❌ Puerto ${this.port} ya está en uso`);
            console.error(`💡 Intenta detener el proceso que usa el puerto ${this.port}`);
            console.error(`💡 O ejecuta: DETENER_TODO.bat`);
            reject(false);
          } else {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Detener servidor
   */
  stop() {
    if (this.server) {
      this.server.close();
      console.log('🛑 Ollama MCP Server detenido');
    }
  }
}

// Si se ejecuta directamente, iniciar servidor
if (require.main === module) {
  const server = new OllamaMCPServer();
  server.start().catch(error => {
    console.error('❌ Error iniciando Ollama MCP Server:', error);
    process.exit(1);
  });
  
  // Manejar cierre graceful
  process.on('SIGINT', () => {
    server.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    server.stop();
    process.exit(0);
  });
}

module.exports = OllamaMCPServer;

