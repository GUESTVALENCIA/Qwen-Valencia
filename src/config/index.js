// ═══════════════════════════════════════════════════════════════════
// CONFIG - Configuración Centralizada Enterprise-Level
// Carga, valida y proporciona configuración tipada para toda la aplicación
// ═══════════════════════════════════════════════════════════════════

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'qwen-valencia.env') });

/**
 * Valida que una variable de entorno esté presente
 */
function requireEnv(key, defaultValue = null) {
  const value = process.env[key] || defaultValue;
  if (value === null || value === undefined) {
    throw new Error(`Variable de entorno requerida no encontrada: ${key}`);
  }
  return value;
}

/**
 * Obtiene una variable de entorno como número
 */
function getEnvNumber(key, defaultValue = null) {
  const value = process.env[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Variable de entorno ${key} debe ser un número, recibido: ${value}`);
  }
  return num;
}

/**
 * Obtiene una variable de entorno como booleano
 */
function getEnvBoolean(key, defaultValue = false) {
  const value = process.env[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Obtiene una variable de entorno como array (separado por comas)
 */
function getEnvArray(key, defaultValue = []) {
  const value = process.env[key];
  if (!value) {
    return defaultValue;
  }
  return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
}

/**
 * Configuración centralizada
 */
const config = {
  // Ambiente
  environment: process.env.NODE_ENV || 'development',
  isDevelopment: (process.env.NODE_ENV || 'development') === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Groq API
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    apiKeys: getEnvArray('GROQ_API_KEY', []),
    port: getEnvNumber('GROQ_API_PORT', 6003),
    timeout: getEnvNumber('GROQ_API_TIMEOUT', 30000),
    maxConcurrentRequests: getEnvNumber('GROQ_MAX_CONCURRENT', 3),
    maxRequestsPerKey: getEnvNumber('GROQ_MAX_REQUESTS_PER_KEY', 4),
    blockDuration: getEnvNumber('GROQ_BLOCK_DURATION', 60000)
  },
  
  // Ollama
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    port: getEnvNumber('OLLAMA_MCP_PORT', 6002),
    timeout: getEnvNumber('OLLAMA_TIMEOUT', 300000),
    maxConcurrentRequests: getEnvNumber('OLLAMA_MAX_CONCURRENT', 2),
    modelsCacheTTL: getEnvNumber('OLLAMA_MODELS_CACHE_TTL', 60000),
    cacheTTL: getEnvNumber('OLLAMA_CACHE_TTL', 1800000),
    maxCacheSize: getEnvNumber('OLLAMA_MAX_CACHE_SIZE', 200)
  },
  
  // MCP Universal
  mcp: {
    port: getEnvNumber('MCP_PORT', 6000),
    secretKey: process.env.MCP_SECRET_KEY || 'qwen_valencia_mcp_secure_2025',
    timeout: getEnvNumber('MCP_TIMEOUT', 300000)
  },
  
  // API Server (main.js)
  api: {
    port: getEnvNumber('API_PORT', 3000),
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: getEnvBoolean('CORS_CREDENTIALS', true),
      methods: getEnvArray('CORS_METHODS', ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']),
      headers: getEnvArray('CORS_HEADERS', ['Content-Type', 'Authorization', 'mcp-secret', 'X-Requested-With'])
    }
  },
  
  // DeepGram
  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY || ''
  },
  
  // Cartesia
  cartesia: {
    apiKey: process.env.CARTESIA_API_KEY || '',
    voiceId: process.env.CARTESIA_VOICE_ID || ''
  },
  
  // HeyGen
  heygen: {
    apiKey: process.env.HEYGEN_API_KEY || ''
  },
  
  // Mode
  mode: process.env.MODE || 'auto',
  
  // Rate Limiting
  rateLimit: {
    windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
    maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
    standardHeaders: getEnvBoolean('RATE_LIMIT_STANDARD_HEADERS', true),
    legacyHeaders: getEnvBoolean('RATE_LIMIT_LEGACY_HEADERS', false)
  },
  
  // Cache
  cache: {
    ttl: getEnvNumber('CACHE_TTL', 300000),
    maxSize: getEnvNumber('CACHE_MAX_SIZE', 100)
  },
  
  // Security
  security: {
    enableHelmet: getEnvBoolean('SECURITY_ENABLE_HELMET', true),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    trustProxy: getEnvBoolean('TRUST_PROXY', false)
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    enableJSON: getEnvBoolean('LOG_JSON', process.env.NODE_ENV === 'production'),
    enableColors: getEnvBoolean('LOG_COLORS', process.env.NODE_ENV !== 'production')
  },
  
  // Metrics
  metrics: {
    enabled: getEnvBoolean('METRICS_ENABLED', true),
    port: getEnvNumber('METRICS_PORT', 9090),
    path: process.env.METRICS_PATH || '/metrics'
  }
};

/**
 * Valida la configuración crítica al inicio
 */
function validateConfig() {
  const errors = [];
  
  // Validar Groq API Key (al menos una)
  if (config.groq.apiKeys.length === 0 && !config.groq.apiKey) {
    errors.push('GROQ_API_KEY no configurada (al menos una key requerida)');
  }
  
  // Validar puertos únicos
  const ports = [config.groq.port, config.ollama.port, config.mcp.port, config.api.port];
  const duplicates = ports.filter((port, index) => ports.indexOf(port) !== index);
  if (duplicates.length > 0) {
    errors.push(`Puertos duplicados detectados: ${duplicates.join(', ')}`);
  }
  
  // Validar URLs
  try {
    new URL(config.ollama.baseUrl);
  } catch (e) {
    errors.push(`OLLAMA_BASE_URL inválida: ${config.ollama.baseUrl}`);
  }
  
  if (errors.length > 0) {
    throw new Error(`Errores de configuración:\n${errors.join('\n')}`);
  }
}

/**
 * Obtiene configuración para un servicio específico
 */
function getServiceConfig(serviceName) {
  const serviceConfigs = {
    'groq-api-server': {
      port: config.groq.port,
      apiKeys: config.groq.apiKeys.length > 0 ? config.groq.apiKeys : [config.groq.apiKey],
      timeout: config.groq.timeout,
      maxConcurrentRequests: config.groq.maxConcurrentRequests,
      rateLimit: config.rateLimit,
      cache: config.cache,
      logging: config.logging,
      security: config.security
    },
    'ollama-mcp-server': {
      port: config.ollama.port,
      baseUrl: config.ollama.baseUrl,
      timeout: config.ollama.timeout,
      maxConcurrentRequests: config.ollama.maxConcurrentRequests,
      rateLimit: { ...config.rateLimit, maxRequests: 200 }, // Más permisivo para local
      cache: {
        ttl: config.ollama.cacheTTL,
        maxSize: config.ollama.maxCacheSize
      },
      logging: config.logging,
      security: config.security
    },
    'mcp-universal': {
      port: config.mcp.port,
      secretKey: config.mcp.secretKey,
      timeout: config.mcp.timeout,
      rateLimit: config.rateLimit,
      logging: config.logging,
      security: config.security
    },
    'api-server': {
      port: config.api.port,
      cors: config.api.cors,
      logging: config.logging,
      security: config.security
    }
  };
  
  return serviceConfigs[serviceName] || {};
}

// Validar configuración al cargar
try {
  validateConfig();
} catch (error) {
  console.error('❌ Error de configuración:', error.message);
  if (config.isProduction) {
    throw error; // En producción, fallar rápido
  } else {
    console.warn('⚠️ Continuando con configuración incompleta (modo desarrollo)');
  }
}

module.exports = {
  config,
  getServiceConfig,
  validateConfig,
  requireEnv,
  getEnvNumber,
  getEnvBoolean,
  getEnvArray
};

