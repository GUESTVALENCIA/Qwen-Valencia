/**
 * ════════════════════════════════════════════════════════════════════════════
 * FOCUS MANAGER - Gestión de Foco Enterprise-Level
 * Gestión de foco para accesibilidad y mejor UX
 * ════════════════════════════════════════════════════════════════════════════
 */

class FocusManager {
  constructor() {
    this.focusHistory = [];
    this.trapStack = [];
    this.isKeyboardNavigation = false;
    
    this.init();
  }
  
  init() {
    // Detectar navegación por teclado
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        this.isKeyboardNavigation = true;
        document.body.classList.add('keyboard-navigation');
        document.body.classList.remove('mouse-navigation');
      }
    });
    
    // Detectar navegación por mouse
    document.addEventListener('mousedown', () => {
      this.isKeyboardNavigation = false;
      document.body.classList.add('mouse-navigation');
      document.body.classList.remove('keyboard-navigation');
    });
    
    // Agregar skip link
    this.addSkipLink();
  }
  
  /**
   * Agrega skip link para accesibilidad
   */
  addSkipLink() {
    if (document.getElementById('skip-to-main')) return;
    
    const skipLink = document.createElement('a');
    skipLink.id = 'skip-to-main';
    skipLink.className = 'skip-to-main';
    skipLink.href = '#main-content';
    skipLink.textContent = 'Saltar al contenido principal';
    skipLink.setAttribute('aria-label', 'Saltar al contenido principal');
    document.body.insertBefore(skipLink, document.body.firstChild);
    
    // Agregar ID al main content si no existe
    const mainContent = document.querySelector('.main-content');
    if (mainContent && !mainContent.id) {
      mainContent.id = 'main-content';
    }
  }
  
  /**
   * Guarda el elemento con foco actual
   */
  saveFocus() {
    const activeElement = document.activeElement;
    if (activeElement && activeElement !== document.body) {
      this.focusHistory.push(activeElement);
    }
  }
  
  /**
   * Restaura el foco al último elemento guardado
   */
  restoreFocus() {
    if (this.focusHistory.length > 0) {
      const lastElement = this.focusHistory.pop();
      if (lastElement && document.body.contains(lastElement)) {
        lastElement.focus();
      }
    }
  }
  
  /**
   * Atrapa el foco dentro de un contenedor (para modales)
   */
  trapFocus(container, options = {}) {
    const {
      initialFocus = null,
      returnFocus = true
    } = options;
    
    // Guardar elemento con foco actual
    if (returnFocus) {
      this.saveFocus();
    }
    
    // Obtener elementos enfocables
    const focusableElements = this.getFocusableElements(container);
    
    if (focusableElements.length === 0) return;
    
    // Focus inicial
    const firstElement = initialFocus || focusableElements[0];
    firstElement.focus();
    
    // Handler para Tab
    const handleTab = (e) => {
      if (e.key !== 'Tab') return;
      
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      
      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    
    container.addEventListener('keydown', handleTab);
    
    // Guardar en stack para poder remover
    this.trapStack.push({
      container,
      handler: handleTab
    });
  }
  
  /**
   * Libera el trap de foco
   */
  releaseFocus(container) {
    const trap = this.trapStack.find(t => t.container === container);
    if (trap) {
      container.removeEventListener('keydown', trap.handler);
      this.trapStack = this.trapStack.filter(t => t !== trap);
      
      // Restaurar foco
      this.restoreFocus();
    }
  }
  
  /**
   * Obtiene elementos enfocables dentro de un contenedor
   */
  getFocusableElements(container) {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ');
    
    return Array.from(container.querySelectorAll(selector))
      .filter(el => {
        // Filtrar elementos ocultos
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0';
      });
  }
  
  /**
   * Focus en el siguiente elemento enfocable
   */
  focusNext(currentElement) {
    const allFocusable = this.getFocusableElements(document.body);
    const currentIndex = allFocusable.indexOf(currentElement);
    
    if (currentIndex < allFocusable.length - 1) {
      allFocusable[currentIndex + 1].focus();
    } else {
      allFocusable[0].focus();
    }
  }
  
  /**
   * Focus en el elemento anterior enfocable
   */
  focusPrevious(currentElement) {
    const allFocusable = this.getFocusableElements(document.body);
    const currentIndex = allFocusable.indexOf(currentElement);
    
    if (currentIndex > 0) {
      allFocusable[currentIndex - 1].focus();
    } else {
      allFocusable[allFocusable.length - 1].focus();
    }
  }
  
  /**
   * Focus en un elemento específico de forma segura
   */
  focusElement(element, options = {}) {
    if (!element) return false;
    
    const {
      preventScroll = false,
      delay = 0
    } = options;
    
    const focus = () => {
      try {
        if (element.focus) {
          element.focus({ preventScroll });
          return true;
        }
      } catch (e) {
        console.warn('Error al hacer focus:', e);
      }
      return false;
    };
    
    if (delay > 0) {
      setTimeout(focus, delay);
    } else {
      return focus();
    }
  }
  
  /**
   * Verifica si un elemento tiene foco
   */
  hasFocus(element) {
    return document.activeElement === element;
  }
  
  /**
   * Obtiene el elemento con foco actual
   */
  getCurrentFocus() {
    return document.activeElement;
  }
}

// Instancia global
const focusManager = new FocusManager();

// Exponer globalmente
window.FocusManager = FocusManager;
window.focusManager = focusManager;

