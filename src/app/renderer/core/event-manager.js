// ═══════════════════════════════════════════════════════════════════
// EVENT MANAGER - Gestión Centralizada de Eventos Enterprise-Level
// Delegación de eventos, cleanup automático, eventos personalizados
// ═══════════════════════════════════════════════════════════════════

const { defaultLogger } = require('../utils/logger');

/**
 * Event Manager centralizado
 */
class EventManager {
  constructor() {
    this.listeners = new Map();
    this.delegatedListeners = new Map();
    this.customEvents = new Map();
    this.logger = defaultLogger;
  }

  /**
   * Agrega un event listener
   */
  on(element, event, handler, options = {}) {
    if (!element) {
      this.logger.warn('EventManager.on: element is null or undefined', { event });
      return () => {};
    }

    const key = `${event}-${Date.now()}-${Math.random()}`;
    const wrappedHandler = (e) => {
      try {
        handler(e);
      } catch (error) {
        this.logger.error('Error in event handler', { 
          event, 
          error: error.message,
          correlationId: this.logger.getCorrelationId()
        });
      }
    };

    element.addEventListener(event, wrappedHandler, options);
    
    if (!this.listeners.has(element)) {
      this.listeners.set(element, new Map());
    }
    this.listeners.get(element).set(key, { event, handler: wrappedHandler, options });

    // Retornar función de cleanup
    return () => {
      this.off(element, key);
    };
  }

  /**
   * Remueve un event listener
   */
  off(element, key) {
    if (!element || !this.listeners.has(element)) {
      return;
    }

    const elementListeners = this.listeners.get(element);
    const listener = elementListeners.get(key);
    
    if (listener) {
      element.removeEventListener(listener.event, listener.handler, listener.options);
      elementListeners.delete(key);
      
      if (elementListeners.size === 0) {
        this.listeners.delete(element);
      }
    }
  }

  /**
   * Agrega event listener que se remueve automáticamente después de ejecutarse
   */
  once(element, event, handler, options = {}) {
    return this.on(element, event, (e) => {
      handler(e);
      this.off(element, event);
    }, options);
  }

  /**
   * Delegación de eventos (event delegation)
   */
  delegate(parent, selector, event, handler, options = {}) {
    if (!parent) {
      this.logger.warn('EventManager.delegate: parent element is null', { event, selector });
      return () => {};
    }

    const key = `${event}-${selector}-${Date.now()}`;
    const delegatedHandler = (e) => {
      const target = e.target.closest(selector);
      if (target) {
        try {
          handler.call(target, e);
        } catch (error) {
          this.logger.error('Error in delegated event handler', { 
            event, 
            selector,
            error: error.message 
          });
        }
      }
    };

    parent.addEventListener(event, delegatedHandler, options);
    
    if (!this.delegatedListeners.has(parent)) {
      this.delegatedListeners.set(parent, new Map());
    }
    this.delegatedListeners.get(parent).set(key, { 
      selector, 
      event, 
      handler: delegatedHandler, 
      options 
    });

    // Retornar función de cleanup
    return () => {
      this.undelegate(parent, key);
    };
  }

  /**
   * Remueve delegación de eventos
   */
  undelegate(parent, key) {
    if (!parent || !this.delegatedListeners.has(parent)) {
      return;
    }

    const parentDelegations = this.delegatedListeners.get(parent);
    const delegation = parentDelegations.get(key);
    
    if (delegation) {
      parent.removeEventListener(delegation.event, delegation.handler, delegation.options);
      parentDelegations.delete(key);
      
      if (parentDelegations.size === 0) {
        this.delegatedListeners.delete(parent);
      }
    }
  }

  /**
   * Crea y dispara evento personalizado
   */
  emit(element, eventName, detail = {}) {
    if (!element) {
      this.logger.warn('EventManager.emit: element is null', { eventName });
      return;
    }

    const event = new CustomEvent(eventName, {
      detail,
      bubbles: true,
      cancelable: true
    });

    element.dispatchEvent(event);
    this.logger.debug('Custom event emitted', { eventName, element: element.tagName });
  }

  /**
   * Suscribe a evento personalizado
   */
  subscribe(element, eventName, handler) {
    if (!element) {
      this.logger.warn('EventManager.subscribe: element is null', { eventName });
      return () => {};
    }

    const wrappedHandler = (e) => {
      try {
        handler(e.detail, e);
      } catch (error) {
        this.logger.error('Error in custom event handler', { 
          eventName, 
          error: error.message 
        });
      }
    };

    element.addEventListener(eventName, wrappedHandler);
    
    if (!this.customEvents.has(element)) {
      this.customEvents.set(element, new Map());
    }
    this.customEvents.get(element).set(eventName, wrappedHandler);

    // Retornar función de cleanup
    return () => {
      this.unsubscribe(element, eventName);
    };
  }

  /**
   * Desuscribe de evento personalizado
   */
  unsubscribe(element, eventName) {
    if (!element || !this.customEvents.has(element)) {
      return;
    }

    const elementEvents = this.customEvents.get(element);
    const handler = elementEvents.get(eventName);
    
    if (handler) {
      element.removeEventListener(eventName, handler);
      elementEvents.delete(eventName);
      
      if (elementEvents.size === 0) {
        this.customEvents.delete(element);
      }
    }
  }

  /**
   * Limpia todos los listeners de un elemento
   */
  cleanup(element) {
    // Limpiar listeners normales
    if (this.listeners.has(element)) {
      const elementListeners = this.listeners.get(element);
      for (const [key, listener] of elementListeners.entries()) {
        element.removeEventListener(listener.event, listener.handler, listener.options);
      }
      this.listeners.delete(element);
    }

    // Limpiar delegaciones
    if (this.delegatedListeners.has(element)) {
      const delegations = this.delegatedListeners.get(element);
      for (const [key, delegation] of delegations.entries()) {
        element.removeEventListener(delegation.event, delegation.handler, delegation.options);
      }
      this.delegatedListeners.delete(element);
    }

    // Limpiar eventos personalizados
    if (this.customEvents.has(element)) {
      const customEvents = this.customEvents.get(element);
      for (const [eventName, handler] of customEvents.entries()) {
        element.removeEventListener(eventName, handler);
      }
      this.customEvents.delete(element);
    }
  }

  /**
   * Limpia todos los listeners
   */
  cleanupAll() {
    // Limpiar todos los listeners normales
    for (const [element, listeners] of this.listeners.entries()) {
      for (const [key, listener] of listeners.entries()) {
        element.removeEventListener(listener.event, listener.handler, listener.options);
      }
    }
    this.listeners.clear();

    // Limpiar todas las delegaciones
    for (const [element, delegations] of this.delegatedListeners.entries()) {
      for (const [key, delegation] of delegations.entries()) {
        element.removeEventListener(delegation.event, delegation.handler, delegation.options);
      }
    }
    this.delegatedListeners.clear();

    // Limpiar todos los eventos personalizados
    for (const [element, customEvents] of this.customEvents.entries()) {
      for (const [eventName, handler] of customEvents.entries()) {
        element.removeEventListener(eventName, handler);
      }
    }
    this.customEvents.clear();

    this.logger.info('All event listeners cleaned up');
  }
}

// Instancia global del event manager
let globalEventManager = null;

/**
 * Factory para crear o obtener event manager
 */
function createEventManager() {
  if (!globalEventManager) {
    globalEventManager = new EventManager();
  }
  return globalEventManager;
}

/**
 * Obtiene el event manager global
 */
function getEventManager() {
  if (!globalEventManager) {
    globalEventManager = createEventManager();
  }
  return globalEventManager;
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.EventManager = EventManager;
  window.createEventManager = createEventManager;
  window.getEventManager = getEventManager;
}

module.exports = {
  EventManager,
  createEventManager,
  getEventManager
};

