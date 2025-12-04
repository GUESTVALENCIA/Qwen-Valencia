/**
 * ════════════════════════════════════════════════════════════════════════════
 * JAVASCRIPT HELPERS - Utilidades Modernas ES2023+
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Utilidades funcionales y helpers modernos para JavaScript
 */

/**
 * Debounce function - Retrasa la ejecución hasta que pase un tiempo sin llamadas
 * @param {Function} fn - Función a debounce
 * @param {number} delay - Delay en milisegundos
 * @param {boolean} immediate - Si ejecutar inmediatamente en la primera llamada
 * @returns {Function} Función debounced
 */
function debounce(fn, delay = 300, immediate = false) {
  let timeoutId = null;
  let lastCallTime = null;
  
  return function debounced(...args) {
    const context = this;
    const now = Date.now();
    
    // Si es la primera llamada e immediate es true
    if (immediate && !lastCallTime) {
      lastCallTime = now;
      return fn.apply(context, args);
    }
    
    // Limpiar timeout anterior
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    // Crear nuevo timeout
    timeoutId = setTimeout(() => {
      lastCallTime = Date.now();
      fn.apply(context, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Throttle function - Limita la frecuencia de ejecución
 * @param {Function} fn - Función a throttle
 * @param {number} delay - Delay mínimo entre ejecuciones
 * @param {Object} options - Opciones { leading, trailing }
 * @returns {Function} Función throttled
 */
function throttle(fn, delay = 300, options = {}) {
  const { leading = true, trailing = true } = options;
  let timeoutId = null;
  let lastExecTime = 0;
  let lastArgs = null;
  
  return function throttled(...args) {
    const context = this;
    const now = Date.now();
    lastArgs = args;
    
    // Si leading es true y ha pasado suficiente tiempo
    if (leading && now - lastExecTime >= delay) {
      lastExecTime = now;
      fn.apply(context, args);
      return;
    }
    
    // Si no hay timeout pendiente y trailing es true
    if (!timeoutId && trailing) {
      timeoutId = setTimeout(() => {
        lastExecTime = Date.now();
        fn.apply(context, lastArgs);
        timeoutId = null;
      }, delay - (now - lastExecTime));
    }
  };
}

/**
 * Memoize function - Cachea resultados de funciones
 * @param {Function} fn - Función a memoizar
 * @param {Function} keyGenerator - Generador de keys para el cache
 * @param {number} maxSize - Tamaño máximo del cache (LRU)
 * @returns {Function} Función memoizada
 */
function memoize(fn, keyGenerator = null, maxSize = 100) {
  const cache = new Map();
  const accessOrder = new Map();
  let accessCounter = 0;
  
  return function memoized(...args) {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    
    // Si existe en cache
    if (cache.has(key)) {
      accessOrder.set(key, ++accessCounter);
      return cache.get(key);
    }
    
    // Si el cache está lleno, eliminar el menos usado (LRU)
    if (cache.size >= maxSize) {
      let oldestKey = null;
      let oldestAccess = Infinity;
      
      for (const [k, access] of accessOrder.entries()) {
        if (access < oldestAccess) {
          oldestAccess = access;
          oldestKey = k;
        }
      }
      
      if (oldestKey) {
        cache.delete(oldestKey);
        accessOrder.delete(oldestKey);
      }
    }
    
    // Ejecutar función y cachear resultado
    const result = fn.apply(this, args);
    cache.set(key, result);
    accessOrder.set(key, ++accessCounter);
    
    return result;
  };
}

/**
 * Compose functions - Compone múltiples funciones
 * @param {...Function} fns - Funciones a componer
 * @returns {Function} Función compuesta
 */
function compose(...fns) {
  return function composed(initialValue) {
    return fns.reduceRight((value, fn) => fn(value), initialValue);
  };
}

/**
 * Pipe functions - Pasa el valor a través de funciones
 * @param {...Function} fns - Funciones a aplicar
 * @returns {Function} Función piped
 */
function pipe(...fns) {
  return function piped(initialValue) {
    return fns.reduce((value, fn) => fn(value), initialValue);
  };
}

/**
 * Safe async wrapper - Envuelve funciones async para manejo seguro de errores
 * @param {Function} fn - Función async a envolver
 * @param {*} defaultValue - Valor por defecto si falla
 * @returns {Function} Función envuelta
 */
function safeAsync(fn, defaultValue = null) {
  return async function safeWrapped(...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      console.error('Safe async error:', error);
      return defaultValue;
    }
  };
}

/**
 * Retry with exponential backoff - Helper para retry con backoff exponencial
 * @param {Function} fn - Función a ejecutar
 * @param {number} maxRetries - Máximo de reintentos
 * @param {number} baseDelay - Delay base en ms
 * @returns {Promise} Resultado de la función
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Batch async operations - Ejecuta operaciones async en lotes
 * @param {Array} items - Items a procesar
 * @param {Function} processor - Función async que procesa cada item
 * @param {number} batchSize - Tamaño del lote
 * @returns {Promise<Array>} Resultados de todas las operaciones
 */
async function batchAsync(items, processor, batchSize = 5) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(item => processor(item))
    );
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Sleep utility - Espera un tiempo determinado
 * @param {number} ms - Milisegundos a esperar
 * @returns {Promise} Promise que se resuelve después del delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Timeout wrapper - Agrega timeout a una promesa
 * @param {Promise} promise - Promise a envolver
 * @param {number} ms - Timeout en milisegundos
 * @param {string} message - Mensaje de error si timeout
 * @returns {Promise} Promise con timeout
 */
function withTimeout(promise, ms, message = 'Operation timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    })
  ]);
}

/**
 * Safe JSON parse - Parsea JSON de forma segura
 * @param {string} str - String JSON
 * @param {*} defaultValue - Valor por defecto si falla
 * @returns {*} Objeto parseado o defaultValue
 */
function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

/**
 * Safe JSON stringify - Stringify JSON de forma segura
 * @param {*} obj - Objeto a stringify
 * @param {string} defaultValue - Valor por defecto si falla
 * @returns {string} JSON string o defaultValue
 */
function safeJsonStringify(obj, defaultValue = '{}') {
  try {
    return JSON.stringify(obj);
  } catch {
    return defaultValue;
  }
}

/**
 * Deep clone - Clona un objeto de forma profunda
 * @param {*} obj - Objeto a clonar
 * @returns {*} Objeto clonado
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

module.exports = {
  debounce,
  throttle,
  memoize,
  compose,
  pipe,
  safeAsync,
  retryWithBackoff,
  batchAsync,
  sleep,
  withTimeout,
  safeJsonParse,
  safeJsonStringify,
  deepClone
};

