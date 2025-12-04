// ═══════════════════════════════════════════════════════════════════
// PERFORMANCE MONITORING - Monitor de Performance Frontend
// Métricas de rendimiento del frontend y sincronización con backend
// ═══════════════════════════════════════════════════════════════════

/**
 * Monitor de performance para el frontend
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      pageLoadTime: null,
      renderTime: null,
      apiCalls: [],
      errors: [],
      memoryUsage: null,
      startTime: Date.now()
    };
    
    this.maxApiCallsHistory = 100;
    this.maxErrorsHistory = 50;
    
    // Inicializar mediciones
    this.measurePageLoad();
    this.measureMemory();
    
    // Medir memoria periódicamente
    // FIX: Usar ResourceCleanupManager para prevenir memory leaks
    if (typeof window !== 'undefined' && window.qwenValencia) {
      const cleanupManager = window.resourceCleanup || window.getResourceCleanupManager?.();
      if (cleanupManager) {
        this.memoryIntervalId = cleanupManager.setInterval(() => this.measureMemory(), 30000); // Cada 30 segundos
      } else {
        // Fallback si ResourceCleanupManager no está disponible
        this.memoryIntervalId = setInterval(() => this.measureMemory(), 30000);
      }
    }
  }

  /**
   * Mide el tiempo de carga de la página
   */
  measurePageLoad() {
    if (typeof window !== 'undefined' && window.performance) {
      window.addEventListener('load', () => {
        const perfData = window.performance.timing;
        this.metrics.pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
      });
    }
  }

  /**
   * Mide el uso de memoria (si está disponible)
   */
  async measureMemory() {
    try {
      if (window.qwenValencia && window.qwenValencia.getSystemMemory) {
        const memory = await window.qwenValencia.getSystemMemory();
        if (memory) {
          this.metrics.memoryUsage = memory;
        }
      }
    } catch (error) {
      console.warn('No se pudo medir memoria:', error);
    }
  }

  /**
   * Registra una llamada a la API
   */
  recordAPICall(endpoint, method, duration, success = true) {
    const apiCall = {
      endpoint,
      method,
      duration,
      success,
      timestamp: Date.now()
    };
    
    this.metrics.apiCalls.push(apiCall);
    
    // Mantener solo los últimos N calls
    if (this.metrics.apiCalls.length > this.maxApiCallsHistory) {
      this.metrics.apiCalls.shift();
    }
  }

  /**
   * Registra un error
   */
  recordError(error, context = {}) {
    const errorRecord = {
      message: error.message || String(error),
      stack: error.stack,
      context,
      timestamp: Date.now()
    };
    
    this.metrics.errors.push(errorRecord);
    
    // Mantener solo los últimos N errores
    if (this.metrics.errors.length > this.maxErrorsHistory) {
      this.metrics.errors.shift();
    }
  }

  /**
   * Obtiene estadísticas de rendimiento
   */
  getStats() {
    const apiCalls = this.metrics.apiCalls;
    const successfulCalls = apiCalls.filter(call => call.success);
    const failedCalls = apiCalls.filter(call => !call.success);
    
    const avgDuration = apiCalls.length > 0
      ? apiCalls.reduce((sum, call) => sum + call.duration, 0) / apiCalls.length
      : 0;
    
    return {
      pageLoadTime: this.metrics.pageLoadTime,
      memoryUsage: this.metrics.memoryUsage,
      apiCalls: {
        total: apiCalls.length,
        successful: successfulCalls.length,
        failed: failedCalls.length,
        successRate: apiCalls.length > 0 
          ? (successfulCalls.length / apiCalls.length) * 100 
          : 0,
        avgDuration: avgDuration
      },
      errors: {
        total: this.metrics.errors.length,
        recent: this.metrics.errors.slice(-10)
      },
      uptime: (Date.now() - this.metrics.startTime) / 1000
    };
  }

  /**
   * Obtiene métricas completas
   */
  getMetrics() {
    return {
      ...this.metrics,
      stats: this.getStats()
    };
  }

  /**
   * Sincroniza métricas con el backend
   */
  async syncWithBackend() {
    try {
      if (window.qwenValencia && window.qwenValencia.getPerformanceMetrics) {
        const backendMetrics = await window.qwenValencia.getPerformanceMetrics();
        return {
          frontend: this.getMetrics(),
          backend: backendMetrics
        };
      }
    } catch (error) {
      this.recordError(error, { context: 'syncWithBackend' });
      return null;
    }
  }

  /**
   * Resetea las métricas
   */
  reset() {
    this.metrics = {
      pageLoadTime: this.metrics.pageLoadTime,
      renderTime: null,
      apiCalls: [],
      errors: [],
      memoryUsage: this.metrics.memoryUsage,
      startTime: Date.now()
    };
  }
}

// Instancia global
let performanceMonitorInstance = null;

/**
 * Obtiene o crea la instancia del monitor de performance
 */
function getPerformanceMonitor() {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor();
  }
  return performanceMonitorInstance;
}

// Exportar para uso global en el navegador
if (typeof window !== 'undefined') {
  window.PerformanceMonitor = PerformanceMonitor;
  window.getPerformanceMonitor = getPerformanceMonitor;
}

// Solo exportar si estamos en Node.js (no en navegador)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PerformanceMonitor,
    getPerformanceMonitor
  };
}

