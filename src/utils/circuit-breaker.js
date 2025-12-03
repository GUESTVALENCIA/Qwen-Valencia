// ═══════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER - Patrón Circuit Breaker para APIs
// Previene intentos repetidos fallidos y permite recuperación automática
// ═══════════════════════════════════════════════════════════════════

/**
 * Estados del Circuit Breaker
 */
const CircuitState = {
  CLOSED: 'CLOSED',      // Normal, permitiendo requests
  OPEN: 'OPEN',          // Bloqueado, rechazando requests
  HALF_OPEN: 'HALF_OPEN' // Probando si el servicio se recuperó
};

/**
 * Circuit Breaker para proteger servicios externos
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'default';
    this.failureThreshold = options.failureThreshold || 5;      // Número de fallos antes de abrir
    this.successThreshold = options.successThreshold || 2;       // Número de éxitos para cerrar
    this.timeout = options.timeout || 60000;                      // Tiempo en OPEN antes de intentar HALF_OPEN
    this.resetTimeout = options.resetTimeout || 30000;           // Tiempo para resetear contadores
    
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextAttemptTime = null;
    
    // Estadísticas
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      stateChanges: 0
    };
  }

  /**
   * Ejecuta una función protegida por el circuit breaker
   */
  async execute(fn, ...args) {
    this.stats.totalRequests++;
    
    // Verificar si el circuit breaker está abierto
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        this.stats.rejectedRequests++;
        throw new Error(`Circuit breaker ${this.name} está OPEN. Reintento en ${Math.ceil((this.nextAttemptTime - Date.now()) / 1000)}s`);
      }
      
      // Intentar cambiar a HALF_OPEN
      this.setState(CircuitState.HALF_OPEN);
    }
    
    try {
      const result = await fn(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Maneja éxito
   */
  onSuccess() {
    this.lastSuccessTime = Date.now();
    this.stats.successfulRequests++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.successThreshold) {
        this.setState(CircuitState.CLOSED);
        this.successCount = 0;
        this.failureCount = 0;
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Resetear contador de fallos después de un tiempo sin errores
      if (this.lastFailureTime && (Date.now() - this.lastFailureTime) > this.resetTimeout) {
        this.failureCount = 0;
      }
    }
  }

  /**
   * Maneja fallo
   */
  onFailure() {
    this.lastFailureTime = Date.now();
    this.failureCount++;
    this.stats.failedRequests++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Si falla en HALF_OPEN, volver a OPEN
      this.setState(CircuitState.OPEN);
      this.successCount = 0;
    } else if (this.state === CircuitState.CLOSED) {
      // Si alcanza el umbral, abrir el circuit breaker
      if (this.failureCount >= this.failureThreshold) {
        this.setState(CircuitState.OPEN);
      }
    }
  }

  /**
   * Cambia el estado del circuit breaker
   */
  setState(newState) {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.stats.stateChanges++;
      
      if (newState === CircuitState.OPEN) {
        this.nextAttemptTime = Date.now() + this.timeout;
        this.successCount = 0;
      } else if (newState === CircuitState.CLOSED) {
        this.nextAttemptTime = null;
        this.failureCount = 0;
        this.successCount = 0;
      }
      
      console.log(`🔌 Circuit breaker ${this.name}: ${oldState} → ${newState}`);
    }
  }

  /**
   * Resetea el circuit breaker manualmente
   */
  reset() {
    this.setState(CircuitState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = null;
  }

  /**
   * Obtiene el estado actual
   */
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttemptTime: this.nextAttemptTime,
      stats: { ...this.stats }
    };
  }

  /**
   * Verifica si el circuit breaker está disponible
   */
  isAvailable() {
    if (this.state === CircuitState.OPEN) {
      return Date.now() >= this.nextAttemptTime;
    }
    return this.state !== CircuitState.OPEN;
  }
}

/**
 * Manager de circuit breakers
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Obtiene o crea un circuit breaker
   */
  getBreaker(name, options = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ name, ...options }));
    }
    return this.breakers.get(name);
  }

  /**
   * Resetea un circuit breaker
   */
  resetBreaker(name) {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
    }
  }

  /**
   * Obtiene estadísticas de todos los circuit breakers
   */
  getStats() {
    const stats = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getState();
    });
    return stats;
  }
}

// Instancia global del manager
const circuitBreakerManager = new CircuitBreakerManager();

module.exports = {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitState,
  circuitBreakerManager
};

