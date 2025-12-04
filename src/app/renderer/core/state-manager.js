// ═══════════════════════════════════════════════════════════════════
// STATE MANAGER - Gestión Centralizada de Estado Enterprise-Level
// Estado reactivo con observadores, validación y persistencia
// ═══════════════════════════════════════════════════════════════════

// No usar require() en el navegador - usar window.defaultLogger

/**
 * State Manager centralizado
 */
class StateManager {
  constructor(initialState = {}, options = {}) {
    // FIX: Definir enableImmutable ANTES de llamar deepFreeze() para que funcione correctamente
    this.enableImmutable = options.enableImmutable !== false; // Por defecto habilitado
    
    // FIX: Crear copia profunda del estado inicial antes de congelarlo
    // Esto evita problemas si initialState ya está congelado o tiene objetos anidados congelados
    const initialStateCopy = this.deepCopy(initialState);
    this.state = this.deepFreeze(initialStateCopy);
    this.observers = new Map();
    this.middleware = [];
    this.history = [];
    this.maxHistorySize = options.maxHistorySize || 50;
    this.enablePersistence = options.enablePersistence !== false;
    this.persistenceKey = options.persistenceKey || 'qwen-valencia-state';
    this.logger = (typeof window !== 'undefined' && window.defaultLogger) || console;

    // Cargar estado persistido
    if (this.enablePersistence) {
      this.loadFromStorage();
    }

    // Guardar estado en storage cuando cambia
    if (this.enablePersistence) {
      this.addMiddleware((state, _action) => {
        this.saveToStorage();
        return state;
      });
    }

    // Middleware para logging de cambios (solo en desarrollo)
    if (options.enableChangeLogging !== false && this.logger.debug) {
      this.addMiddleware((state, action, context) => {
        this.logger.debug('State change', {
          action,
          key: context?.key,
          changes: context?.changes,
          correlationId: this.logger.getCorrelationId?.()
        });
        return state;
      });
    }
  }

  /**
   * Deep freeze para hacer objetos completamente inmutables
   * FIX: Excluye funciones, Date, Map, Set y otros objetos built-in que no deben congelarse
   * FIX: Maneja referencias circulares usando WeakSet para rastrear objetos visitados
   * @param {*} obj - Objeto a congelar
   * @param {WeakSet} visited - Set de objetos ya visitados (para detectar referencias circulares)
   * @returns {*} Objeto congelado
   */
  deepFreeze(obj, visited = new WeakSet()) {
    if (!this.enableImmutable) {
      return obj;
    }

    // FIX: No congelar valores primitivos, null, undefined
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    // FIX: Detectar referencias circulares
    if (visited.has(obj)) {
      // Retornar el objeto sin congelar para evitar stack overflow
      this.logger.warn('Referencia circular detectada en deepFreeze, omitiendo congelamiento');
      return obj;
    }

    // Marcar objeto como visitado antes de procesarlo
    visited.add(obj);

    // FIX: No congelar objetos built-in especiales que tienen contratos de mutabilidad
    // Date, Map, Set, WeakMap, WeakSet, RegExp, etc. no deben congelarse
    if (obj instanceof Date || 
        obj instanceof Map || 
        obj instanceof Set || 
        obj instanceof WeakMap || 
        obj instanceof WeakSet || 
        obj instanceof RegExp ||
        obj instanceof Error ||
        obj instanceof Promise) {
      return obj; // Retornar sin congelar
    }

    // FIX: No congelar funciones (aunque typeof 'function' !== 'object', 
    // algunas propiedades de objetos pueden ser funciones)
    if (typeof obj === 'function') {
      return obj;
    }

    // Obtener nombres de propiedades
    const propNames = Object.getOwnPropertyNames(obj);

    // Freeze propiedades recursivamente
    propNames.forEach(name => {
      const value = obj[name];

      // FIX: Solo freeze recursivamente si es un objeto plano o array
      // Excluir funciones y objetos built-in especiales
      if (value !== null && typeof value === 'object') {
        // Verificar que no sea un objeto built-in especial antes de congelar recursivamente
        if (!(value instanceof Date || 
              value instanceof Map || 
              value instanceof Set || 
              value instanceof WeakMap || 
              value instanceof WeakSet || 
              value instanceof RegExp ||
              value instanceof Error ||
              value instanceof Promise)) {
          this.deepFreeze(value, visited);
        }
      }
    });

    // Freeze el objeto mismo
    return Object.freeze(obj);
  }

  /**
   * Obtiene el estado actual (copia profunda para mantener inmutabilidad)
   */
  getState() {
    // Retornar copia profunda para mantener inmutabilidad
    return this.deepCopy(this.state);
  }

  /**
   * Deep copy para mantener inmutabilidad
   * FIX: Maneja referencias circulares usando WeakSet para rastrear objetos visitados
   * @param {*} obj - Objeto a copiar
   * @param {WeakSet} visited - Set de objetos ya visitados (para detectar referencias circulares)
   * @returns {*} Copia profunda del objeto
   */
  deepCopy(obj, visited = new WeakSet()) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    // FIX: Detectar referencias circulares
    if (visited.has(obj)) {
      // FIX: Lanzar error en lugar de retornar null para evitar cambios silenciosos en la estructura del estado
      // Esto previene que código que espera una propiedad exista reciba null inesperadamente
      const error = new Error('Referencia circular detectada en deepCopy. El estado contiene referencias circulares que no pueden ser copiadas.');
      this.logger.error('Referencia circular detectada en deepCopy', {
        error: error.message,
        objectType: obj.constructor?.name || typeof obj
      });
      throw error;
    }

    // Marcar objeto como visitado antes de procesarlo
    visited.add(obj);

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.deepCopy(item, visited));
    }

    const copy = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        copy[key] = this.deepCopy(obj[key], visited);
      }
    }

    return copy;
  }

  /**
   * Obtiene un valor específico del estado
   */
  get(key) {
    return this.state[key];
  }

  /**
   * Establece un valor en el estado (inmutable)
   */
  set(key, value, action = 'set') {
    // Crear copia profunda del estado anterior
    const previousState = this.deepCopy(this.state);

    // FIX: Crear copia profunda no congelada del estado actual
    // Usar deepCopy en lugar de spread operator para evitar que objetos anidados sigan congelados
    const newState = this.deepCopy(this.state);
    newState[key] = value;

    // Ejecutar middleware
    // FIX: Clarificar que middleware debe retornar un nuevo objeto, no mutar el existente
    // Si retorna el mismo objeto (incluyendo this.state congelado), crear una copia mutable
    let processedState = newState;
    for (const middleware of this.middleware) {
      const middlewareResult = middleware(processedState, action, { key, value, previousState });
      
      // FIX: Verificar si el middleware retornó el mismo objeto (frozen o no)
      // Si es así, crear una copia mutable para permitir futuras mutaciones
      if (middlewareResult === processedState || middlewareResult === this.state) {
        // Middleware retornó el mismo objeto (posiblemente congelado), crear copia mutable
        processedState = this.deepCopy(middlewareResult);
      } else {
        // Middleware retornó un nuevo objeto, usar ese
        processedState = middlewareResult;
      }
      
      // Validar que processedState es un objeto válido
      if (!processedState || typeof processedState !== 'object') {
        this.logger.warn('Middleware retornó valor inválido, usando estado anterior', {
          action,
          middlewareResult: typeof middlewareResult
        });
        processedState = newState;
      }
    }

    // FIX: Hacer el nuevo estado inmutable
    this.state = this.enableImmutable ? this.deepFreeze(processedState) : processedState;

    // Agregar al historial
    this.addToHistory(action, { key, value, previousState });

    // Notificar observadores
    this.notifyObservers(key, value, previousState[key]);

    this.logger.debug('State updated', {
      key,
      action,
      correlationId: this.logger.getCorrelationId?.()
    });
  }

  /**
   * Actualiza múltiples valores a la vez (inmutable)
   */
  update(updates, action = 'update') {
    // Crear copia profunda del estado anterior
    const previousState = this.deepCopy(this.state);
    const changes = {};

    // FIX: Crear copia profunda no congelada del estado actual
    // Usar deepCopy en lugar de spread operator para evitar que objetos anidados sigan congelados
    const newState = this.deepCopy(this.state);
    for (const [key, value] of Object.entries(updates)) {
      newState[key] = value;
      changes[key] = { from: previousState[key], to: value };
    }

    // Ejecutar middleware
    // FIX: Clarificar que middleware debe retornar un nuevo objeto, no mutar el existente
    // Si retorna el mismo objeto (incluyendo this.state congelado), crear una copia mutable
    let processedState = newState;
    for (const middleware of this.middleware) {
      const middlewareResult = middleware(processedState, action, { changes, previousState });
      
      // FIX: Verificar si el middleware retornó el mismo objeto (frozen o no)
      // Si es así, crear una copia mutable para permitir futuras mutaciones
      if (middlewareResult === processedState || middlewareResult === this.state) {
        // Middleware retornó el mismo objeto (posiblemente congelado), crear copia mutable
        processedState = this.deepCopy(middlewareResult);
      } else {
        // Middleware retornó un nuevo objeto, usar ese
        processedState = middlewareResult;
      }
      
      // Validar que processedState es un objeto válido
      if (!processedState || typeof processedState !== 'object') {
        this.logger.warn('Middleware retornó valor inválido, usando estado anterior', {
          action,
          middlewareResult: typeof middlewareResult
        });
        processedState = newState;
      }
    }

    // FIX: Hacer el nuevo estado inmutable
    this.state = this.enableImmutable ? this.deepFreeze(processedState) : processedState;

    // Agregar al historial
    this.addToHistory(action, { changes, previousState });

    // Notificar observadores para cada cambio
    for (const [key, value] of Object.entries(updates)) {
      this.notifyObservers(key, value, previousState[key]);
    }

    this.logger.debug('State updated (multiple)', { keys: Object.keys(updates), action });
  }

  /**
   * Suscribe un observador a cambios en una clave específica
   */
  subscribe(key, callback) {
    if (!this.observers.has(key)) {
      this.observers.set(key, new Set());
    }
    this.observers.get(key).add(callback);

    // Retornar función de unsubscribe
    return () => {
      const callbacks = this.observers.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.observers.delete(key);
        }
      }
    };
  }

  /**
   * Suscribe a todos los cambios
   */
  subscribeAll(callback) {
    return this.subscribe('*', callback);
  }

  /**
   * Notifica observadores
   */
  notifyObservers(key, newValue, oldValue) {
    // Notificar observadores específicos de la clave
    const specificObservers = this.observers.get(key);
    if (specificObservers) {
      specificObservers.forEach(callback => {
        try {
          callback(newValue, oldValue, key);
        } catch (error) {
          this.logger.error('Error in state observer', { key, error: error.message });
        }
      });
    }

    // Notificar observadores globales
    const globalObservers = this.observers.get('*');
    if (globalObservers) {
      globalObservers.forEach(callback => {
        try {
          callback(this.state, { [key]: { from: oldValue, to: newValue } });
        } catch (error) {
          this.logger.error('Error in global state observer', { error: error.message });
        }
      });
    }
  }

  /**
   * Agrega middleware
   */
  addMiddleware(middleware) {
    if (typeof middleware === 'function') {
      this.middleware.push(middleware);
    }
  }

  /**
   * Agrega entrada al historial
   */
  addToHistory(action, data) {
    // FIX: Usar deepCopy para guardar copia profunda no congelada del estado en el historial
    this.history.push({
      timestamp: Date.now(),
      action,
      data,
      state: this.deepCopy(this.state)
    });

    // Limitar tamaño del historial
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Obtiene historial
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Guarda estado en localStorage
   */
  saveToStorage() {
    try {
      const stateToSave = {
        ...this.state,
        // Excluir valores que no deben persistirse
        stream: null,
        mediaStream: null,
        recognition: null,
        deepgramConnection: null,
        micStream: null,
        micRecorder: null
      };
      localStorage.setItem(this.persistenceKey, JSON.stringify(stateToSave));
    } catch (error) {
      this.logger.warn('Error saving state to storage', { error: error.message });
    }
  }

  /**
   * Carga estado desde localStorage
   */
  loadFromStorage() {
    try {
      const saved = localStorage.getItem(this.persistenceKey);
      if (saved) {
        const parsedState = JSON.parse(saved);
        // FIX: Crear copias profundas de ambos estados antes de hacer merge
        // Esto evita problemas si el estado actual está congelado o tiene objetos anidados congelados
        const currentStateCopy = this.deepCopy(this.state);
        const parsedStateCopy = this.deepCopy(parsedState);
        const mergedState = { ...currentStateCopy, ...parsedStateCopy };
        // FIX: Congelar el estado cargado para mantener la inmutabilidad
        this.state = this.enableImmutable ? this.deepFreeze(mergedState) : mergedState;
        this.logger.info('State loaded from storage', { keys: Object.keys(parsedState) });
      }
    } catch (error) {
      this.logger.warn('Error loading state from storage', { error: error.message });
    }
  }

  /**
   * Resetea estado a valores iniciales
   */
  reset(initialState = {}) {
    // FIX: Usar deepCopy para guardar copia profunda no congelada del estado anterior
    const previousState = this.deepCopy(this.state);
    // FIX: Crear copia profunda del estado inicial y congelarlo para mantener la inmutabilidad
    const newState = this.deepCopy(initialState);
    this.state = this.enableImmutable ? this.deepFreeze(newState) : newState;
    this.notifyObservers('*', this.state, previousState);
    this.saveToStorage();
    this.logger.info('State reset');
  }

  /**
   * Valida estado antes de aplicar cambios (middleware de validación)
   */
  addValidator(validator) {
    this.addMiddleware((state, action, context) => {
      const validation = validator(state, action, context);
      if (!validation.valid) {
        this.logger.warn('State validation failed', {
          action,
          errors: validation.errors
        });
        throw new Error(`State validation failed: ${validation.errors.join(', ')}`);
      }
      return state;
    });
  }
}

// Instancia global del state manager
let globalStateManager = null;

/**
 * Factory para crear o obtener state manager
 */
function createStateManager(initialState = {}, options = {}) {
  if (!globalStateManager) {
    globalStateManager = new StateManager(initialState, options);
  }
  return globalStateManager;
}

/**
 * Obtiene el state manager global
 */
function getStateManager() {
  if (!globalStateManager) {
    // Crear con estado por defecto si no existe
    globalStateManager = createStateManager({
      model: 'qwen2.5:7b-instruct',
      mode: 'agent',
      messages: [],
      isGenerating: false,
      attachedImage: null,
      stream: null,
      config: {
        ollamaUrl: 'http://localhost:11434',
        temperature: 0.7,
        maxTokens: 4096
      },
      theme: 'dark',
      mediaStream: null,
      recognition: null,
      isListening: false,
      deepgramConnection: null,
      isRecording: false,
      recordingStartTime: null,
      recordingMaxTime: 20 * 60 * 1000,
      ttsInterval: null,
      lastTTSAt: null,
      voiceCallActive: false,
      deepgramAvailable: false,
      useAPI: true,
      micActive: false,
      micStream: null,
      micRecorder: null
    });
  }
  return globalStateManager;
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.StateManager = StateManager;
  window.createStateManager = createStateManager;
  window.getStateManager = getStateManager;
}

// Solo exportar si estamos en Node.js (no en navegador)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    StateManager,
    createStateManager,
    getStateManager
  };
}

// Exportar para uso global en el navegador
if (typeof window !== 'undefined') {
  window.StateManager = StateManager;
  window.createStateManager = createStateManager;
  window.getStateManager = getStateManager;
}
