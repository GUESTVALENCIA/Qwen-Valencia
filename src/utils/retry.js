/**
 * ════════════════════════════════════════════════════════════════════════════
 * RETRY UTILITY - Estrategias de Reintento Enterprise-Level
 * Retry con backoff exponencial, jitter y más
 * ════════════════════════════════════════════════════════════════════════════
 */

const { LoggerFactory } = require('./logger');

const logger = LoggerFactory.create({ service: 'retry' });

/**
 * Estrategias de backoff
 */
const BackoffStrategy = {
  FIXED: 'fixed',
  EXPONENTIAL: 'exponential',
  LINEAR: 'linear'
};

/**
 * Calcula delay según estrategia
 */
function calculateDelay(attempt, baseDelay, strategy, maxDelay = 60000) {
  let delay = baseDelay;
  
  switch (strategy) {
    case BackoffStrategy.EXPONENTIAL:
      delay = baseDelay * Math.pow(2, attempt);
      break;
    case BackoffStrategy.LINEAR:
      delay = baseDelay * (attempt + 1);
      break;
    case BackoffStrategy.FIXED:
    default:
      delay = baseDelay;
      break;
  }
  
  // Agregar jitter (variación aleatoria)
  const jitter = Math.random() * 0.3 * delay; // 30% de jitter
  delay = delay + jitter;
  
  // Limitar delay máximo
  return Math.min(delay, maxDelay);
}

/**
 * Retry con estrategias configurables
 */
async function retry(fn, options = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    backoffStrategy = BackoffStrategy.EXPONENTIAL,
    maxDelay = 60000,
    retryable = (error) => {
      // Por defecto, reintentar errores de red y 5xx
      return error.code === 'ECONNREFUSED' ||
             error.code === 'ETIMEDOUT' ||
             error.code === 'ENOTFOUND' ||
             (error.response && error.response.status >= 500);
    },
    onRetry = null
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Si no es el último intento y el error es retryable
      if (attempt < maxRetries && retryable(error)) {
        const delay = calculateDelay(attempt, retryDelay, backoffStrategy, maxDelay);
        
        if (onRetry) {
          onRetry(error, attempt + 1, delay);
        } else {
          logger.debug('Reintentando operación', {
            attempt: attempt + 1,
            maxRetries,
            delay: `${delay}ms`,
            error: error.message
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // No más reintentos o error no retryable
        break;
      }
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  throw lastError;
}

/**
 * Retry con timeout
 */
async function retryWithTimeout(fn, timeout, options = {}) {
  return Promise.race([
    retry(fn, options),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);
    })
  ]);
}

module.exports = {
  retry,
  retryWithTimeout,
  BackoffStrategy,
  calculateDelay
};
