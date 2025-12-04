/**
 * ═══════════════════════════════════════════════════════════════════
 * LAZY LOADER - Sistema de Carga Bajo Demanda
 * Carga módulos solo cuando se necesitan para mejorar startup time
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Cache de módulos cargados
 */
const loadedModules = new Map();

/**
 * Promesas de carga en curso (evita cargar el mismo módulo múltiples veces)
 */
const loadingPromises = new Map();

/**
 * Estadísticas de carga
 */
const stats = {
  totalLoads: 0,
  cacheHits: 0,
  cacheMisses: 0,
  loadTimes: []
};

/**
 * Carga un módulo de forma lazy (bajo demanda)
 * @param {string} modulePath - Ruta del módulo (relativa a src/)
 * @param {Object} options - Opciones
 * @param {boolean} options.forceReload - Forzar recarga aunque ya esté cargado
 * @param {Function} options.onLoad - Callback cuando se carga
 * @param {Function} options.onError - Callback de error
 * @returns {Promise<*>} Módulo cargado
 */
async function loadLazyModule(modulePath, options = {}) {
  const { forceReload = false, onLoad, onError } = options;
  
  // Verificar cache
  if (!forceReload && loadedModules.has(modulePath)) {
    stats.cacheHits++;
    const module = loadedModules.get(modulePath);
    if (onLoad) onLoad(module);
    return module;
  }
  
  // Verificar si ya está cargando
  if (loadingPromises.has(modulePath)) {
    const module = await loadingPromises.get(modulePath);
    if (onLoad) onLoad(module);
    return module;
  }
  
  // Iniciar carga
  stats.cacheMisses++;
  const startTime = Date.now();
  
  const loadPromise = (async () => {
    try {
      let module;
      
      // Determinar si es Node.js (require) o Browser (dynamic import)
      if (typeof require !== 'undefined' && typeof window === 'undefined') {
        // Node.js environment
        module = require(modulePath);
      } else if (typeof window !== 'undefined' && window.dynamicImport) {
        // Browser con dynamic import support
        module = await window.dynamicImport(modulePath);
      } else {
        // Fallback: intentar require si está disponible
        if (typeof require !== 'undefined') {
          module = require(modulePath);
        } else {
          throw new Error(`No se puede cargar módulo: ${modulePath}. Entorno no soportado.`);
        }
      }
      
      const loadTime = Date.now() - startTime;
      stats.loadTimes.push(loadTime);
      stats.totalLoads++;
      
      // Guardar en cache
      loadedModules.set(modulePath, module);
      
      // Remover de promesas de carga
      loadingPromises.delete(modulePath);
      
      if (onLoad) onLoad(module);
      
      return module;
    } catch (error) {
      loadingPromises.delete(modulePath);
      
      if (onError) {
        onError(error);
      } else {
        console.error(`Error cargando módulo lazy: ${modulePath}`, error);
      }
      
      throw error;
    }
  })();
  
  loadingPromises.set(modulePath, loadPromise);
  return loadPromise;
}

/**
 * Precarga un módulo (carga en background)
 * @param {string} modulePath - Ruta del módulo
 * @returns {Promise<void>}
 */
async function preloadModule(modulePath) {
  try {
    await loadLazyModule(modulePath);
  } catch (error) {
    // Ignorar errores en precarga (no crítico)
    console.debug(`Precarga fallida para ${modulePath}:`, error.message);
  }
}

/**
 * Precarga múltiples módulos en paralelo
 * @param {string[]} modulePaths - Array de rutas de módulos
 * @returns {Promise<void>}
 */
async function preloadModules(modulePaths) {
  const promises = modulePaths.map(path => preloadModule(path));
  await Promise.allSettled(promises);
}

/**
 * Descarga un módulo del cache (libera memoria)
 * @param {string} modulePath - Ruta del módulo
 * @returns {boolean} true si se descargó, false si no existía
 */
function unloadModule(modulePath) {
  return loadedModules.delete(modulePath);
}

/**
 * Limpia todos los módulos del cache
 */
function clearCache() {
  loadedModules.clear();
  loadingPromises.clear();
}

/**
 * Obtiene estadísticas de carga
 * @returns {Object} Estadísticas
 */
function getStats() {
  const avgLoadTime = stats.loadTimes.length > 0
    ? stats.loadTimes.reduce((a, b) => a + b, 0) / stats.loadTimes.length
    : 0;
  
  const hitRate = stats.totalLoads > 0
    ? (stats.cacheHits / (stats.cacheHits + stats.cacheMisses) * 100).toFixed(2)
    : 0;
  
  return {
    ...stats,
    loadedModules: loadedModules.size,
    loadingModules: loadingPromises.size,
    avgLoadTime: `${avgLoadTime.toFixed(2)}ms`,
    hitRate: `${hitRate}%`
  };
}

/**
 * Verifica si un módulo está cargado
 * @param {string} modulePath - Ruta del módulo
 * @returns {boolean}
 */
function isModuleLoaded(modulePath) {
  return loadedModules.has(modulePath);
}

/**
 * Obtiene lista de módulos cargados
 * @returns {string[]}
 */
function getLoadedModules() {
  return Array.from(loadedModules.keys());
}

// Exportar para Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadLazyModule,
    preloadModule,
    preloadModules,
    unloadModule,
    clearCache,
    getStats,
    isModuleLoaded,
    getLoadedModules
  };
}

// Exportar para Browser
if (typeof window !== 'undefined') {
  window.LazyLoader = {
    load: loadLazyModule,
    preload: preloadModule,
    preloadMany: preloadModules,
    unload: unloadModule,
    clear: clearCache,
    getStats,
    isLoaded: isModuleLoaded,
    getLoaded: getLoadedModules
  };
}

