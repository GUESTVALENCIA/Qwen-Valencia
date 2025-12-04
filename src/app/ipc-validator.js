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
  // NOTA: Estos canales usan ipcMain.on (no ipcMain.handle) y no pasan por validateIPC
  // Por lo tanto, no necesitan rate limiting
  window: ['window-minimize', 'window-maximize', 'window-close'],

  // Canales de audio/TTS (validación media)
  media: ['generate-speech', 'cartesia-tts', 'transcribe-audio', 'deepgram-transcribe'],

  // Canales de laboratorio (validación alta)
  lab: ['execute-in-lab'],

  // Canales de terminal (validación media)
  terminal: ['create-terminal', 'get-available-terminals'],

  // Canales de multi-ventana (validación básica)
  // Incluye create-floating-avatar-window porque usa ipcMain.handle con validateIPC
  multiWindow: ['create-window', 'get-windows', 'create-floating-avatar-window'],

  // Canales de lazy loading (validación media)
  lazy: ['load-lazy-module'],

  // Canales de HeyGen (deshabilitados temporalmente, pero con validación)
  heygen: ['heygen-start-session', 'heygen-stop', 'heygen-interrupt']
};

/**
 * Schemas de validación JSON para cada canal IPC
 * Basados en tipos JSDoc y type-validator
 */
const IPC_SCHEMAS = {
  'route-message': {
    text: { type: 'string', required: true, minLength: 1 },
    modality: { type: 'string', required: false, enum: ['text', 'voice', 'image'], default: 'text' },
    attachments: { type: 'array', required: false, default: [] },
    options: { type: 'object', required: false, default: {} }
  },
  'execute-code': {
    language: { type: 'string', required: true, minLength: 1 },
    code: { type: 'string', required: true, minLength: 1 }
  },
  'read-file': {
    filePath: { type: 'string', required: true, minLength: 1 }
  },
  'list-files': {
    dirPath: { type: 'string', required: false, default: '.' }
  },
  'update-shared-state': {
    key: { type: 'string', required: true, minLength: 1 },
    value: { type: 'any', required: true }
  },
  'sync-state': {
    state: { type: 'object', required: true }
  },
  'start-conversation': {
    options: { type: 'object', required: false, default: {} }
  },
  'stop-conversation': {
    conversationId: { type: 'string', required: false }
  },
  'send-audio-to-conversation': {
    conversationId: { type: 'string', required: true },
    audioData: { type: 'string', required: true } // base64
  },
  'deepgram-start-live': {
    options: { type: 'object', required: false, default: {} }
  },
  'deepgram-stop-live': {},
  'deepgram-send-audio': {
    audioData: { type: 'string', required: true } // base64
  },
  'start-mcp-master': {},
  'stop-mcp-master': {},
  'generate-speech': {
    text: { type: 'string', required: true, minLength: 1 },
    voice: { type: 'string', required: false }
  },
  'cartesia-tts': {
    text: { type: 'string', required: true, minLength: 1 },
    voice: { type: 'string', required: false }
  },
  'transcribe-audio': {
    audioData: { type: 'string', required: true } // base64
  },
  'deepgram-transcribe': {
    audioData: { type: 'string', required: true } // base64
  },
  'execute-in-lab': {
    code: { type: 'string', required: true, minLength: 1 },
    language: { type: 'string', required: false, default: 'javascript' }
  },
  'create-terminal': {
    options: { type: 'object', required: false, default: {} }
  },
  'get-available-terminals': {},
  'create-window': {
    windowType: { type: 'string', required: false, enum: ['main', 'terminal', 'settings'], default: 'main' },
    options: { type: 'object', required: false, default: {} }
  },
  'get-windows': {},
  'create-floating-avatar-window': {
    videoSrc: { type: 'string', required: true, minLength: 1 }
  },
  'load-lazy-module': {
    moduleName: { type: 'string', required: true, enum: ['mcpServer', 'ollamaMcpServer', 'groqApiServer', 'conversationService', 'deepgramService'] },
    forceReload: { type: 'boolean', required: false, default: false }
  },
  'get-shared-state': {
    key: { type: 'string', required: false }
  },
  'get-system-memory': {},
  'get-performance-metrics': {},
  'get-mcp-master-status': {},
  'heygen-start-session': {},
  'heygen-stop': {},
  'heygen-interrupt': {}
};

// Rate limiting por canal
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const RATE_LIMIT_MAX = {
  read: 100,
  write: 30,
  control: 20,
  // window: removido - los canales window usan ipcMain.on y no pasan por validateIPC
  multiWindow: 10,
  media: 15,
  lab: 5,
  terminal: 10,
  lazy: 5,
  heygen: 5
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
 * Valida parámetros usando schema JSON
 * @param {string} channel - Canal IPC
 * @param {*} params - Parámetros a validar
 * @returns {Object} { valid: boolean, errors: Array, validated: Object }
 */
function validateSchema(channel, params) {
  const schema = IPC_SCHEMAS[channel];
  
  // Si no hay schema, permitir (canales sin parámetros o legacy)
  if (!schema) {
    return { valid: true, errors: [], validated: params };
  }

  // Validar cada campo del schema
  const validated = {};
  const errors = [];

  for (const [field, rule] of Object.entries(schema)) {
    const value = params?.[field];
    const isRequired = rule.required !== false;
    const hasValue = value !== undefined && value !== null;

    // Validar requerido
    if (isRequired && !hasValue) {
      errors.push(`Campo requerido: ${field}`);
      continue;
    }

    // Si no tiene valor y no es requerido, usar default
    if (!hasValue && !isRequired) {
      if (rule.default !== undefined) {
        validated[field] = rule.default;
      }
      continue;
    }

    // Validar tipo
    if (rule.type && hasValue) {
      const typeCheck = typeof value;
      if (rule.type === 'string' && typeCheck !== 'string') {
        errors.push(`Campo ${field} debe ser string`);
        continue;
      }
      if (rule.type === 'number' && typeCheck !== 'number') {
        errors.push(`Campo ${field} debe ser number`);
        continue;
      }
      if (rule.type === 'boolean' && typeCheck !== 'boolean') {
        errors.push(`Campo ${field} debe ser boolean`);
        continue;
      }
      if (rule.type === 'array' && !Array.isArray(value)) {
        errors.push(`Campo ${field} debe ser array`);
        continue;
      }
      if (rule.type === 'object' && (typeCheck !== 'object' || Array.isArray(value))) {
        errors.push(`Campo ${field} debe ser object`);
        continue;
      }
    }

    // Validar enum
    if (rule.enum && hasValue && !rule.enum.includes(value)) {
      errors.push(`Campo ${field} debe ser uno de: ${rule.enum.join(', ')}`);
      continue;
    }

    // Validar minLength
    if (rule.minLength && hasValue && typeof value === 'string' && value.length < rule.minLength) {
      errors.push(`Campo ${field} debe tener al menos ${rule.minLength} caracteres`);
      continue;
    }

    // Valor validado
    validated[field] = value;
  }

  return {
    valid: errors.length === 0,
    errors,
    validated: errors.length === 0 ? validated : null
  };
}

/**
 * Middleware de validación IPC con schema validation
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

    // Validar schema de parámetros
    // args[0] es el primer parámetro (puede ser objeto con parámetros o parámetros individuales)
    const params = args[0] && typeof args[0] === 'object' && !Array.isArray(args[0]) 
      ? args[0] 
      : args.length > 0 
        ? { ...args } 
        : {};
    
    const schemaValidation = validateSchema(channel, params);
    
    if (!schemaValidation.valid) {
      logger.warn('Validación de schema falló', {
        channel,
        errors: schemaValidation.errors
      });
      return {
        success: false,
        error: 'Invalid parameters',
        details: schemaValidation.errors
      };
    }

    // Ejecutar handler con parámetros validados
    try {
      // Si el handler espera parámetros individuales, expandir validated
      // Si espera un objeto, pasar validated como primer argumento
      const validatedArgs = Object.keys(schemaValidation.validated).length > 0
        ? [schemaValidation.validated, ...args.slice(1)]
        : args;
      
      return await handler(event, ...validatedArgs);
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
  validateSchema,
  ALLOWED_CHANNELS,
  IPC_SCHEMAS
};
