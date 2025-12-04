/**
 * ════════════════════════════════════════════════════════════════════════════
 * DATA LOADER - Patrón DataLoader para deduplicación y batching
 * Previene N+1 queries y optimiza requests duplicados
 * ════════════════════════════════════════════════════════════════════════════
 */

const { LoggerFactory } = require('./logger');

const logger = LoggerFactory.create({ service: 'data-loader' });

/**
 * DataLoader - Implementación del patrón DataLoader de Facebook
 * Deduplica y agrupa requests para prevenir N+1 queries
 */
class DataLoader {
  /**
   * @param {Function} batchLoadFn - Función que carga múltiples keys en batch
   * @param {Object} options - Opciones de configuración
   * @param {number} options.maxBatchSize - Tamaño máximo del batch (default: 50)
   * @param {number} options.batchScheduleFn - Función para programar el batch (default: setImmediate)
   * @param {Function} options.cacheKeyFn - Función para generar cache key (default: identity)
   * @param {Map} options.cacheMap - Map para cache (default: new Map())
   * @param {boolean} options.cache - Si usar cache (default: true)
   * @param {number} options.cacheTTL - TTL del cache en ms (default: 100ms)
   */
  constructor(batchLoadFn, options = {}) {
    if (typeof batchLoadFn !== 'function') {
      throw new Error('DataLoader requires a batch load function');
    }

    this.batchLoadFn = batchLoadFn;
    this.maxBatchSize = options.maxBatchSize || 50;
    this.batchScheduleFn = options.batchScheduleFn || setImmediate;
    this.cacheKeyFn = options.cacheKeyFn || (key => key);
    this.cache = options.cache !== false;
    this.cacheMap = options.cacheMap || new Map();
    this.cacheTTL = options.cacheTTL || 100; // 100ms default para requests duplicados

    // Batch actual
    this.batch = null;
    this.batchTimeout = null;

    // Estadísticas
    this.stats = {
      loads: 0,
      batches: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  /**
   * Carga un key (o múltiples keys)
   * @param {*} key - Key a cargar
   * @returns {Promise} Promise que resuelve con el valor
   */
  load(key) {
    const cacheKey = this.cacheKeyFn(key);

    // Verificar cache
    if (this.cache) {
      const cached = this.cacheMap.get(cacheKey);
      if (cached) {
        // Verificar TTL
        if (Date.now() - cached.timestamp < this.cacheTTL) {
          this.stats.cacheHits++;
          return Promise.resolve(cached.value);
        } else {
          // Cache expirado
          this.cacheMap.delete(cacheKey);
        }
      }
    }

    this.stats.cacheMisses++;
    this.stats.loads++;

    // Inicializar batch si no existe
    if (!this.batch) {
      this.batch = {
        keys: [],
        callbacks: [],
        resolved: false
      };

      // Programar ejecución del batch
      this.batchTimeout = this.batchScheduleFn(() => {
        this.dispatchBatch();
      });
    }

    // Agregar key al batch
    return new Promise((resolve, reject) => {
      this.batch.keys.push(key);
      this.batch.callbacks.push({ resolve, reject });

      // Si el batch alcanzó el tamaño máximo, ejecutar inmediatamente
      if (this.batch.keys.length >= this.maxBatchSize) {
        this.dispatchBatch();
      }
    });
  }

  /**
   * Carga múltiples keys en batch
   * @param {Array} keys - Array de keys a cargar
   * @returns {Promise<Array>} Promise que resuelve con array de valores
   */
  loadMany(keys) {
    return Promise.all(
      keys.map(
        key => this.load(key).catch(error => error) // No rechazar, retornar error
      )
    );
  }

  /**
   * Limpia un key del cache
   * @param {*} key - Key a limpiar
   */
  clear(key) {
    const cacheKey = this.cacheKeyFn(key);
    this.cacheMap.delete(cacheKey);
  }

  /**
   * Limpia todo el cache
   */
  clearAll() {
    this.cacheMap.clear();
  }

  /**
   * Precarga un key en el cache
   * @param {*} key - Key a precargar
   * @param {*} value - Valor a cachear
   */
  prime(key, value) {
    const cacheKey = this.cacheKeyFn(key);
    this.cacheMap.set(cacheKey, {
      value: Promise.resolve(value),
      timestamp: Date.now()
    });
  }

  /**
   * Ejecuta el batch actual
   */
  dispatchBatch() {
    if (!this.batch || this.batch.resolved) {
      return;
    }

    const batch = this.batch;
    this.batch = null;

    if (this.batchTimeout) {
      clearImmediate(this.batchTimeout);
      this.batchTimeout = null;
    }

    batch.resolved = true;
    this.stats.batches++;

    // Ejecutar batch load function
    Promise.resolve(this.batchLoadFn(batch.keys))
      .then(values => {
        // Validar que el resultado es un array
        if (!Array.isArray(values)) {
          throw new Error(
            'DataLoader batchLoadFn must return an Array of values the same length as the Array of keys'
          );
        }

        if (values.length !== batch.keys.length) {
          throw new Error(
            `DataLoader batchLoadFn must return an Array of values the same length as the Array of keys (${batch.keys.length} keys, ${values.length} values)`
          );
        }

        // Resolver todas las promises
        for (let i = 0; i < batch.callbacks.length; i++) {
          const value = values[i];
          const { resolve } = batch.callbacks[i];

          // Cachear resultado
          if (this.cache) {
            const cacheKey = this.cacheKeyFn(batch.keys[i]);
            this.cacheMap.set(cacheKey, {
              value: Promise.resolve(value),
              timestamp: Date.now()
            });
          }

          resolve(value);
        }
      })
      .catch(error => {
        // Rechazar todas las promises con el error
        for (const { reject } of batch.callbacks) {
          reject(error);
        }
      });
  }

  /**
   * Obtiene estadísticas del DataLoader
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cacheMap.size,
      batchSize: this.batch ? this.batch.keys.length : 0
    };
  }
}

/**
 * Factory para crear DataLoaders con configuración común
 */
class DataLoaderFactory {
  /**
   * Crea un DataLoader para servicios
   * @param {Function} batchLoadFn - Función batch load
   * @param {Object} options - Opciones adicionales
   */
  static createServiceLoader(batchLoadFn, options = {}) {
    return new DataLoader(batchLoadFn, {
      maxBatchSize: 50,
      cacheTTL: 100, // 100ms para requests duplicados
      ...options
    });
  }

  /**
   * Crea un DataLoader para health checks
   * @param {Function} batchLoadFn - Función batch load
   * @param {Object} options - Opciones adicionales
   */
  static createHealthCheckLoader(batchLoadFn, options = {}) {
    return new DataLoader(batchLoadFn, {
      maxBatchSize: 20,
      cacheTTL: 5000, // 5s para health checks
      ...options
    });
  }
}

module.exports = {
  DataLoader,
  DataLoaderFactory
};
