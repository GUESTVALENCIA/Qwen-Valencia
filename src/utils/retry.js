// ═══════════════════════════════════════════════════════════════════
// RETRY LOGIC - Retry con Backoff Exponencial y Jitter
// Manejo inteligente de reintentos para errores transitorios
// ═══════════════════════════════════════════════════════════════════

const { isRetryableError } = require('./api-error');

/**
 * Opciones por defecto para retry
 */
const DEFAULT_OPTIONS = {
  maxRetries: 3,
  initialDelay: 1000,        // 1 segundo
  maxDelay: 30000,           // 30 segundos
  factor: 2,                 // Factor exponencial
  jitter: true,              // Agregar jitter aleatorio
  retryableErrors: [429, 500, 502, 503, 504], // Códigos HTTP retryables
  onRetry: null              // Callback opcional
};

/**
 * Calcula el delay para el siguiente intento con backoff exponencial
 */
function calculateDelay(attempt, options) {
  const { initialDelay, maxDelay, factor, jitter } = options;
  
  // Backoff exponencial: delay = initialDelay * (factor ^ attempt)
  let delay = initialDelay * Math.pow(factor, attempt);
  
  // Limitar al máximo
  delay = Math.min(delay, maxDelay);
  
  // Agregar jitter aleatorio (0-30% del delay)
  if (jitter) {
    const jitterAmount = delay * 0.3 * Math.random();
    delay = delay + jitterAmount;
  }
  
  return Math.floor(delay);
}

/**
 * Ejecuta una función con retry automático
 */
async function retry(fn, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;
      
      // Verificar si el error es retryable
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // Si es el último intento, lanzar el error
      if (attempt >= opts.maxRetries) {
        throw error;
      }
      
      // Calcular delay para el siguiente intento
      const delay = calculateDelay(attempt, opts);
      
      // Ejecutar callback de retry si existe
      if (opts.onRetry) {
        opts.onRetry(error, attempt + 1, delay);
      } else {
        console.log(`🔄 Reintento ${attempt + 1}/${opts.maxRetries} en ${delay}ms...`);
      }
      
      // Esperar antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Retry con condición personalizada
 */
async function retryWithCondition(fn, shouldRetry, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      lastError = error;
      
      // Verificar condición personalizada
      if (!shouldRetry(error, attempt)) {
        throw error;
      }
      
      // Si es el último intento, lanzar el error
      if (attempt >= opts.maxRetries) {
        throw error;
      }
      
      const delay = calculateDelay(attempt, opts);
      
      if (opts.onRetry) {
        opts.onRetry(error, attempt + 1, delay);
      } else {
        console.log(`🔄 Reintento ${attempt + 1}/${opts.maxRetries} en ${delay}ms...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Retry con timeout
 */
async function retryWithTimeout(fn, timeoutMs, options = {}) {
  return Promise.race([
    retry(fn, options),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout después de ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

module.exports = {
  retry,
  retryWithCondition,
  retryWithTimeout,
  calculateDelay,
  DEFAULT_OPTIONS
};

