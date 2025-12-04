/**
 * ═══════════════════════════════════════════════════════════════════
 * RESOURCE CLEANUP - Gestión Centralizada de Cleanup Enterprise-Level
 * Previene memory leaks limpiando intervals, timeouts y event listeners
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Resource Cleanup Manager
 * Centraliza la gestión de cleanup para prevenir memory leaks
 */
class ResourceCleanupManager {
  constructor() {
    this.intervals = new Set();
    this.timeouts = new Set();
    this.eventListeners = new Map(); // element -> [{ event, handler, options }]
    this.cleanupCallbacks = new Set();
    this.isCleanedUp = false;
    
    // Auto-cleanup en beforeunload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.cleanupAll());
      // También cleanup en pagehide (más confiable en algunos navegadores)
      window.addEventListener('pagehide', () => this.cleanupAll());
    }
  }

  /**
   * Registra un interval para cleanup automático
   * @param {number} intervalId - ID del interval retornado por setInterval
   * @returns {number} - El mismo intervalId para chaining
   */
  registerInterval(intervalId) {
    if (this.isCleanedUp) {
      console.warn('ResourceCleanupManager: Intentando registrar interval después de cleanup');
      clearInterval(intervalId);
      return intervalId;
    }
    this.intervals.add(intervalId);
    return intervalId;
  }

  /**
   * Registra un timeout para cleanup automático
   * @param {number} timeoutId - ID del timeout retornado por setTimeout
   * @returns {number} - El mismo timeoutId para chaining
   */
  registerTimeout(timeoutId) {
    if (this.isCleanedUp) {
      console.warn('ResourceCleanupManager: Intentando registrar timeout después de cleanup');
      clearTimeout(timeoutId);
      return timeoutId;
    }
    this.timeouts.add(timeoutId);
    return timeoutId;
  }

  /**
   * Registra un event listener para cleanup automático
   * @param {HTMLElement} element - Elemento del DOM
   * @param {string} event - Nombre del evento
   * @param {Function} handler - Handler del evento
   * @param {Object} options - Opciones del listener
   */
  registerEventListener(element, event, handler, options = {}) {
    if (this.isCleanedUp) {
      console.warn('ResourceCleanupManager: Intentando registrar event listener después de cleanup');
      return;
    }
    
    if (!this.eventListeners.has(element)) {
      this.eventListeners.set(element, []);
    }
    
    this.eventListeners.get(element).push({ event, handler, options });
  }

  /**
   * Registra un callback de cleanup personalizado
   * @param {Function} callback - Función de cleanup
   */
  registerCleanupCallback(callback) {
    if (this.isCleanedUp) {
      console.warn('ResourceCleanupManager: Intentando registrar cleanup callback después de cleanup');
      return;
    }
    this.cleanupCallbacks.add(callback);
  }

  /**
   * Limpia un interval específico
   * @param {number} intervalId - ID del interval
   */
  clearInterval(intervalId) {
    if (this.intervals.has(intervalId)) {
      clearInterval(intervalId);
      this.intervals.delete(intervalId);
    }
  }

  /**
   * Limpia un timeout específico
   * @param {number} timeoutId - ID del timeout
   */
  clearTimeout(timeoutId) {
    if (this.timeouts.has(timeoutId)) {
      clearTimeout(timeoutId);
      this.timeouts.delete(timeoutId);
    }
  }

  /**
   * Limpia todos los event listeners de un elemento
   * @param {HTMLElement} element - Elemento del DOM
   */
  cleanupElement(element) {
    if (!this.eventListeners.has(element)) {
      return;
    }

    const listeners = this.eventListeners.get(element);
    listeners.forEach(({ event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    
    this.eventListeners.delete(element);
  }

  /**
   * Limpia todos los recursos registrados
   */
  cleanupAll() {
    if (this.isCleanedUp) {
      return;
    }

    // Limpiar intervals
    this.intervals.forEach(intervalId => {
      clearInterval(intervalId);
    });
    this.intervals.clear();

    // Limpiar timeouts
    this.timeouts.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    this.timeouts.clear();

    // Limpiar event listeners
    for (const [element, listeners] of this.eventListeners.entries()) {
      listeners.forEach(({ event, handler, options }) => {
        element.removeEventListener(event, handler, options);
      });
    }
    this.eventListeners.clear();

    // Ejecutar callbacks de cleanup
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error en cleanup callback:', error);
      }
    });
    this.cleanupCallbacks.clear();

    this.isCleanedUp = true;
    
    if (typeof window !== 'undefined' && window.defaultLogger) {
      window.defaultLogger.info('ResourceCleanupManager: Todos los recursos limpiados');
    } else {
      console.log('ResourceCleanupManager: Todos los recursos limpiados');
    }
  }

  /**
   * Wrapper para setInterval que registra automáticamente
   * @param {Function} callback - Función a ejecutar
   * @param {number} delay - Delay en ms
   * @returns {number} - ID del interval
   */
  setInterval(callback, delay) {
    const intervalId = window.setInterval(callback, delay);
    return this.registerInterval(intervalId);
  }

  /**
   * Wrapper para setTimeout que registra automáticamente
   * @param {Function} callback - Función a ejecutar
   * @param {number} delay - Delay en ms
   * @returns {number} - ID del timeout
   */
  setTimeout(callback, delay) {
    const timeoutId = window.setTimeout(callback, delay);
    return this.registerTimeout(timeoutId);
  }
}

// Instancia global del Resource Cleanup Manager
let globalResourceCleanup = null;

/**
 * Obtiene la instancia global del Resource Cleanup Manager
 * @returns {ResourceCleanupManager}
 */
function getResourceCleanupManager() {
  if (!globalResourceCleanup) {
    globalResourceCleanup = new ResourceCleanupManager();
  }
  return globalResourceCleanup;
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.ResourceCleanupManager = ResourceCleanupManager;
  window.getResourceCleanupManager = getResourceCleanupManager;
  window.resourceCleanup = getResourceCleanupManager();
}

