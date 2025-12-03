/**
 * ════════════════════════════════════════════════════════════════════════════
 * IPC VALIDATOR - Validador de Canales IPC Enterprise-Level
 * Validación de origen, whitelist de canales y rate limiting
 * ════════════════════════════════════════════════════════════════════════════
 */

const { LoggerFactory } = require('../utils/logger');

const logger = LoggerFactory.create({ service: 'ipc-validator' });

/**
 * Whitelist de canales IPC permitidos
 */
const ALLOWED_CHANNELS = {
  // Canales de lectura (sin rate limit estricto)
  read: [
    'get-shared-state',
    'get-system-memory',
    'get-performance-metrics',
    'get-mcp-master-status'
  ],
  
  // Canales de escritura (con validación estricta)
  write: [
    'route-message',
    'execute-code',
    'read-file',
    'list-files',
    'update-shared-state',
    'sync-state'
  ],
  
  // Canales de control (validación media)
  control: [
    'start-conversation',
    'stop-conversation',
    'send-audio-to-conversation',
    'deepgram-start-live',
    'deepgram-stop-live',
    'deepgram-send-audio',
    'start-mcp-master',
    'stop-mcp-master'
  ],
  
  // Canales de ventana (validación básica)
  window: [
    'window-minimize',
    'window-maximize',
    'window-close',
    'create-floating-avatar-window'
  ],
  
  // Canales de audio/TTS (validación media)
  media: [
    'generate-speech',
    'cartesia-tts',
    'transcribe-audio',
    'deepgram-transcribe'
  ],
  
  // Canales de laboratorio (validación alta)
  lab: [
    'execute-in-lab'
  ],
  
  // Canales de terminal (validación media)
  terminal: [
    'create-terminal',
    'get-available-terminals'
  ],
  
  // Canales de multi-ventana (validación básica)
  window: [
    'create-window',
    'get-windows'
  ],
  
  // Canales de lazy loading (validación media)
  lazy: [
    'load-lazy-module'
  ]
};

// Rate limiting por canal
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const RATE_LIMIT_MAX = {
  read: 100,
  write: 30,
  control: 20,
  window: 10,
  media: 15,
  lab: 5,
  terminal: 10,
  lazy: 5
};

/**
 * Obtiene el tipo de canal
 */
function getChannelType(channel) {
  for (const [type, channels] of Object.entries(ALLOWED_CHANNELS)) {
    if (channels.includes(channel)) {
      return type;
    }
  }
  return null;
}

/**
 * Valida si un canal está permitido
 */
function isChannelAllowed(channel) {
  return getChannelType(channel) !== null;
}

/**
 * Verifica rate limiting
 */
function checkRateLimit(channel, senderId) {
  const channelType = getChannelType(channel);
  if (!channelType) {
    return { allowed: false, reason: 'Channel not allowed' };
  }
  
  const maxRequests = RATE_LIMIT_MAX[channelType] || 10;
  const key = `${channel}:${senderId}`;
  const now = Date.now();
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  
  const limit = rateLimitMap.get(key);
  
  // Reset si la ventana expiró
  if (now > limit.resetAt) {
    limit.count = 1;
    limit.resetAt = now + RATE_LIMIT_WINDOW;
    return { allowed: true };
  }
  
  // Verificar límite
  if (limit.count >= maxRequests) {
    return { 
      allowed: false, 
      reason: 'Rate limit exceeded',
      resetAt: limit.resetAt
    };
  }
  
  limit.count++;
  return { allowed: true };
}

/**
 * Valida el origen del evento IPC
 */
function validateOrigin(event) {
  // En Electron, el origen siempre es el renderer de la misma app
  // Pero podemos validar que la ventana existe y es válida
  if (!event.sender || !event.sender.getURL) {
    return false;
  }
  
  const url = event.sender.getURL();
  // Validar que viene del archivo local o de la app
  return url.startsWith('file://') || url.includes('qwen-valencia');
}

/**
 * Middleware de validación IPC
 */
function validateIPC(channel, handler) {
  return async (event, ...args) => {
    // Validar canal
    if (!isChannelAllowed(channel)) {
      logger.warn('Intento de acceso a canal no permitido', { channel });
      return {
        success: false,
        error: 'Channel not allowed'
      };
    }
    
    // Validar origen
    if (!validateOrigin(event)) {
      logger.warn('Intento de acceso desde origen no válido', { channel });
      return {
        success: false,
        error: 'Invalid origin'
      };
    }
    
    // Verificar rate limiting
    const senderId = event.sender.id || 'unknown';
    const rateLimit = checkRateLimit(channel, senderId);
    
    if (!rateLimit.allowed) {
      logger.warn('Rate limit excedido', { 
        channel, 
        senderId,
        reason: rateLimit.reason,
        resetAt: rateLimit.resetAt 
      });
      return {
        success: false,
        error: rateLimit.reason,
        resetAt: rateLimit.resetAt
      };
    }
    
    // Ejecutar handler
    try {
      return await handler(event, ...args);
    } catch (error) {
      logger.error('Error en handler IPC', { 
        channel, 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  };
}

/**
 * Limpia rate limits expirados
 */
function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, limit] of rateLimitMap.entries()) {
    if (now > limit.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}

// Limpiar rate limits cada 5 minutos
setInterval(cleanupRateLimits, 5 * 60 * 1000);

module.exports = {
  validateIPC,
  isChannelAllowed,
  getChannelType,
  checkRateLimit,
  validateOrigin,
  ALLOWED_CHANNELS
};

