/**
 * GROQ API SERVER - Servidor Dedicado con Rotación de Keys
 * 
 * Características:
 * - Rotación automática de API keys para evitar bloqueos
 * - Rate limiting inteligente
 * - Cache de respuestas
 * - Fallback automático entre keys
 * - Listado de modelos disponibles
 * - Estadísticas de uso
 */

const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { RateLimiterFactory } = require('../utils/rate-limiter');
const path = require('path');

// Cargar desde qwen-valencia.env (archivo único para Qwen-Valencia)
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'qwen-valencia.env') });

class GroqAPIServer {
  constructor() {
    this.app = express();
    this.port = process.env.GROQ_API_PORT || 6003;
    
    // Logger y métricas
    this.logger = LoggerFactory.create('groq-api-server');
    this.metrics = MetricsFactory.create('groq_api');
    
    // Cargar múltiples API keys (separadas por comas)
    const groqKeys = process.env.GROQ_API_KEY || '';
    // Limpiar y procesar API keys usando APIKeyCleaner
    const APIKeyCleaner = require('../utils/api-key-cleaner');
    this.apiKeys = groqKeys.split(',')
      .map(k => {
        const cleaned = APIKeyCleaner.cleanAndValidateGroq(k);
        return cleaned.valid ? cleaned.cleaned : cleaned.cleaned; // Usar limpia aunque no sea válida
      })
      .filter(k => k && k.length > 0);
    
    if (this.apiKeys.length === 0) {
      console.warn('⚠️ No se encontraron GROQ_API_KEY en .env.pro');
    } else {
      console.log(`✅ ${this.apiKeys.length} API Key(s) de Groq cargada(s) y limpiada(s)`);
    }
    
    // Rotación de keys
    this.currentKeyIndex = 0;
    this.keyUsageCount = new Map(); // Contador de uso por key
    this.keyBlockedUntil = new Map(); // Timestamp de bloqueo por key
    this.maxRequestsPerKey = 4; // Máximo de requests antes de rotar (menos de 5 para evitar bloqueo)
    this.blockDuration = 60000; // 1 minuto de bloqueo si una key falla
    
    // Cache inteligente
    this.cache = new Map();
    this.maxCacheSize = 100;
    this.cacheTTL = 300000; // 5 minutos
    
    // Rate limiting
    this.requestQueue = [];
    this.maxConcurrentRequests = 3;
    this.currentRequests = 0;
    
    // Modelos disponibles en Groq (actualizados 2025)
    // Prioridad: Qwen y DeepSeek (modelos principales de la app)
    this.availableModels = [
      // Qwen (prioridad)
      'qwen2.5-72b-instruct',
      'qwen2.5-32b-instruct',
      'qwen2.5-14b-instruct',
      'qwen2.5-7b-instruct',
      // DeepSeek (prioridad)
      'deepseek-r1-distill-llama-70b',
      'deepseek-r1-distill-qwen-7b',
      'deepseek-r1-distill-llama-8b',
      // Modelos adicionales disponibles
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'llama-3.1-70b-versatile',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
      'gemma-7b-it'
    ];
    
    // Estadísticas
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      keyRotations: 0,
      errors: 0
    };
    
    this.setupMiddleware();
    this.setupRoutes();
    
    // Limpieza periódica de cache
    setInterval(() => this.cleanCache(), 300000); // Cada 5 minutos
    
    console.log('✅ Groq API Server inicializado');
    console.log(`📡 Puerto: ${this.port}`);
    console.log(`🔑 API Keys configuradas: ${this.apiKeys.length}`);
  }
  
  setupMiddleware() {
    this.app.use(express.json({ limit: '50mb' }));
    
    // Rate limiting avanzado
    this.rateLimiter = RateLimiterFactory.standard({
      windowMs: 60000, // 1 minuto
      maxRequests: 100, // 100 requests por minuto
      keyGenerator: (req) => {
        // Usar IP o API key si está disponible
        return req.headers['x-api-key'] || req.ip || 'unknown';
      }
    });
    this.app.use(this.rateLimiter.middleware());
    
    // CORS completo
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') return res.sendStatus(200);
      next();
    });
  }
  
  
  /**
   * Maneja request de chat (extraído para reutilizar en v1 y legacy)
   */
  async handleChatRequest(req, res) {
    // Verificar límite de requests concurrentes
    if (this.currentRequests >= this.maxConcurrentRequests) {
      const { APIError } = require('../utils/api-error');
      const error = APIError.rateLimitExceeded(null, {
        reason: 'concurrent_requests_limit',
        currentRequests: this.currentRequests,
        maxConcurrentRequests: this.maxConcurrentRequests
      });
      return res.status(error.statusCode).json(error.toJSON());
    }
    
    this.currentRequests++;
    this.stats.totalRequests++;
    
    const { model, messages, temperature, max_tokens, stream } = req.body;
    
    if (!model || !messages) {
      this.currentRequests--;
      const { APIError } = require('../utils/api-error');
      const error = APIError.fromHTTPStatus(
        400,
        'model y messages son requeridos',
        { missing: !model ? ['model'] : ['messages'] }
      );
      return res.status(error.statusCode).json(error.toJSON());
    }
    
      // Verificar cache primero
      const cacheKey = this.generateCacheKey(messages, model);
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
        this.stats.cacheHits++;
        this.currentRequests--;
        this.metrics.increment('cache_hits', {});
        return res.json({
          success: true,
          content: cached.response,
          cached: true
        });
      }
      
      this.stats.cacheMisses++;
    
    // Intentar con la key actual
    let attempts = 0;
    const maxAttempts = this.apiKeys.length;
    
    while (attempts < maxAttempts) {
      const apiKey = this.getCurrentKey();
      
      // Verificar si la key está bloqueada
      if (this.keyBlockedUntil.has(apiKey)) {
        const blockedUntil = this.keyBlockedUntil.get(apiKey);
        if (Date.now() < blockedUntil) {
          // Key bloqueada, rotar a la siguiente
          this.rotateKey();
          attempts++;
          continue;
        } else {
          // Bloqueo expirado, desbloquear
          this.keyBlockedUntil.delete(apiKey);
        }
      }
      
      try {
        // Limpiar API key: eliminar espacios, saltos de línea, comillas, etc.
        const cleanApiKey = (apiKey || '').trim().replace(/['"]/g, '').replace(/\s+/g, '');
        
        if (!cleanApiKey) {
          throw new Error('API Key no válida o vacía');
        }
        
        const response = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: model || 'llama-3.3-70b-versatile',
            messages,
            temperature: temperature || 0.7,
            max_tokens: max_tokens || 2048,
            stream: stream || false
          },
          {
            headers: {
              'Authorization': `Bearer ${cleanApiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );
        
        // Éxito: incrementar contador de uso
        const usageCount = (this.keyUsageCount.get(apiKey) || 0) + 1;
        this.keyUsageCount.set(apiKey, usageCount);
        
        // Si alcanzó el límite, rotar key
        if (usageCount >= this.maxRequestsPerKey) {
          this.rotateKey();
          this.stats.keyRotations++;
        }
        
        const content = response.data.choices[0].message.content;
        
        // Guardar en cache
        this.cache.set(cacheKey, {
          response: content,
          timestamp: Date.now()
        });
        
        // Limpiar cache si excede tamaño máximo
        if (this.cache.size > this.maxCacheSize) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
        
        this.stats.successfulRequests++;
        this.currentRequests--;
        
        return res.json({
          success: true,
          content,
          model: response.data.model || model,
          usage: response.data.usage
        });
        
      } catch (error) {
          // Si es error 429 (rate limit) o 401 (invalid key), bloquear key temporalmente
          if (error.response && (error.response.status === 429 || error.response.status === 401)) {
            this.keyBlockedUntil.set(apiKey, Date.now() + this.blockDuration);
            this.logger.warn('Key bloqueada temporalmente', {
              statusCode: error.response.status,
              keyIndex: this.currentKeyIndex
            });
            this.metrics.increment('api_key_blocked', { status: error.response.status });
          }
        
        // Rotar a la siguiente key
        this.rotateKey();
        attempts++;
        
        // Si todas las keys fallaron, retornar error estandarizado
        if (attempts >= maxAttempts) {
          this.stats.failedRequests++;
          this.stats.errors++;
          this.currentRequests--;
          
          const { APIError } = require('../utils/api-error');
          const errorInfo = error.response 
            ? { statusCode: error.response.status, message: error.message }
            : { statusCode: 500, message: error.message };
          
          const apiError = APIError.fromHTTPStatus(
            errorInfo.statusCode,
            `Error con Groq API: ${errorInfo.message}. Todas las keys fueron intentadas.`,
            { attempts, maxAttempts }
          );
          
          return res.status(apiError.statusCode).json(apiError.toJSON());
        }
      }
    }
  }
  
  setupRoutes() {
    // ==================== API V1 (Versionado) ====================
    const v1Router = express.Router();
    
    // Health check v1
    v1Router.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'groq-api',
        version: 'v1',
        apiKeysCount: this.apiKeys.length,
        currentKeyIndex: this.currentKeyIndex,
        cacheSize: this.cache.size,
        stats: this.stats
      });
    });
    
    // Listar modelos disponibles v1
    v1Router.get('/models', (req, res) => {
      res.json({
        success: true,
        version: 'v1',
        models: this.availableModels,
        defaultModel: 'llama-3.3-70b-versatile'
      });
    });
    
    // Chat con Groq API v1
    v1Router.post('/chat', async (req, res) => {
      await this.handleChatRequest(req, res);
    });
    
    // Estadísticas v1
    v1Router.get('/stats', (req, res) => {
      res.json({
        ...this.stats,
        version: 'v1'
      });
    });
    
    // Limpiar cache v1
    v1Router.post('/cache/clear', (req, res) => {
      this.cache.clear();
      res.json({ success: true, message: 'Cache limpiado', version: 'v1' });
    });
    
    // Montar router v1
    this.app.use('/api/v1/groq', v1Router);
    
    // ==================== LEGACY ENDPOINTS (Deprecated) ====================
    // Health check (legacy - deprecated)
    this.app.get('/groq/health', (req, res) => {
      res.setHeader('X-API-Deprecated', 'true');
      res.setHeader('X-API-Version', 'v1');
      res.setHeader('X-API-Migration', '/api/v1/groq/health');
      res.json({
        status: 'healthy',
        service: 'groq-api',
        apiKeysCount: this.apiKeys.length,
        currentKeyIndex: this.currentKeyIndex,
        cacheSize: this.cache.size,
        stats: this.stats
      });
    });
    
    // Listar modelos disponibles (legacy - deprecated)
    this.app.get('/groq/models', (req, res) => {
      res.setHeader('X-API-Deprecated', 'true');
      res.setHeader('X-API-Version', 'v1');
      res.setHeader('X-API-Migration', '/api/v1/groq/models');
      res.json({
        success: true,
        models: this.availableModels,
        defaultModel: 'llama-3.3-70b-versatile'
      });
    });
    
    // Chat con Groq API (legacy - deprecated)
    this.app.post('/groq/chat', async (req, res) => {
      res.setHeader('X-API-Deprecated', 'true');
      res.setHeader('X-API-Version', 'v1');
      res.setHeader('X-API-Migration', '/api/v1/groq/chat');
      await this.handleChatRequest(req, res);
    });
    
    // Estadísticas (legacy - deprecated)
    this.app.get('/groq/stats', (req, res) => {
      res.setHeader('X-API-Deprecated', 'true');
      res.setHeader('X-API-Version', 'v1');
      res.setHeader('X-API-Migration', '/api/v1/groq/stats');
      res.json({
        ...this.stats,
        metrics: this.metrics.getJSONFormat()
      });
    });
    
    // Métricas Prometheus (legacy - deprecated)
    this.app.get('/groq/metrics', (req, res) => {
      res.setHeader('X-API-Deprecated', 'true');
      res.setHeader('X-API-Version', 'v1');
      res.setHeader('X-API-Migration', '/api/v1/groq/metrics');
      res.setHeader('Content-Type', 'text/plain');
      res.send(this.metrics.getPrometheusFormat());
    });
    
    // Limpiar cache (legacy - deprecated)
    this.app.post('/groq/cache/clear', (req, res) => {
      res.setHeader('X-API-Deprecated', 'true');
      res.setHeader('X-API-Version', 'v1');
      res.setHeader('X-API-Migration', '/api/v1/groq/cache/clear');
      this.cache.clear();
      res.json({ success: true, message: 'Cache limpiado' });
    });
    
    // Resetear rotación de keys (legacy - deprecated)
    this.app.post('/groq/keys/reset', (req, res) => {
      res.setHeader('X-API-Deprecated', 'true');
      res.setHeader('X-API-Version', 'v1');
      this.currentKeyIndex = 0;
      this.keyUsageCount.clear();
      this.keyBlockedUntil.clear();
      res.json({ success: true, message: 'Rotación de keys reseteada' });
    });
  }
  
  /**
   * Obtener key actual
   */
  getCurrentKey() {
    if (this.apiKeys.length === 0) {
      throw new Error('No hay API keys configuradas');
    }
    return this.apiKeys[this.currentKeyIndex];
  }
  
  /**
   * Rotar a la siguiente key
   */
  rotateKey() {
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
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
   * Iniciar servidor
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`✅ Groq API Server escuchando en puerto ${this.port}`);
          resolve(true);
        });
        
        this.server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            console.error(`❌ Puerto ${this.port} ya está en uso`);
            console.error(`💡 Intenta detener el proceso que usa el puerto ${this.port}`);
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
      console.log('🛑 Groq API Server detenido');
    }
  }
}

// Si se ejecuta directamente, iniciar servidor
if (require.main === module) {
  const server = new GroqAPIServer();
  server.start().catch(error => {
    console.error('❌ Error iniciando Groq API Server:', error);
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

module.exports = GroqAPIServer;

