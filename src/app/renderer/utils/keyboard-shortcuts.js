/**
 * ════════════════════════════════════════════════════════════════════════════
 * KEYBOARD SHORTCUTS MANAGER - Sistema de Atajos de Teclado Enterprise-Level
 * Gestión centralizada de atajos de teclado con documentación
 * ════════════════════════════════════════════════════════════════════════════
 */

class KeyboardShortcutsManager {
  constructor() {
    this.shortcuts = new Map();
    this.enabled = true;
    this.modifiers = {
      ctrl: false,
      alt: false,
      shift: false,
      meta: false
    };
    
    this.init();
  }
  
  init() {
    // Detectar si estamos en Mac
    this.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    
    // Event listeners
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    
    // Registrar atajos por defecto
    this.registerDefaultShortcuts();
  }
  
  /**
   * Registra un atajo de teclado
   * @param {string} key - Tecla principal (ej: 'k', 'Enter', 'Escape')
   * @param {Object} options - Opciones
   * @param {Function} options.handler - Función a ejecutar
   * @param {boolean} options.ctrl - Requiere Ctrl (o Cmd en Mac)
   * @param {boolean} options.alt - Requiere Alt
   * @param {boolean} options.shift - Requiere Shift
   * @param {string} options.description - Descripción del atajo
   * @param {boolean} options.preventDefault - Prevenir comportamiento por defecto
   */
  register(key, { handler, ctrl = false, alt = false, shift = false, description = '', preventDefault = true }) {
    const shortcut = {
      key: key.toLowerCase(),
      ctrl,
      alt,
      shift,
      handler,
      description,
      preventDefault
    };
    
    const id = this.getShortcutId(key, ctrl, alt, shift);
    this.shortcuts.set(id, shortcut);
  }
  
  /**
   * Desregistra un atajo
   */
  unregister(key, ctrl = false, alt = false, shift = false) {
    const id = this.getShortcutId(key, ctrl, alt, shift);
    this.shortcuts.delete(id);
  }
  
  /**
   * Obtiene ID único para un atajo
   */
  getShortcutId(key, ctrl, alt, shift) {
    return `${key.toLowerCase()}-${ctrl}-${alt}-${shift}`;
  }
  
  /**
   * Maneja keydown
   */
  handleKeyDown(e) {
    if (!this.enabled) return;
    
    // Actualizar estado de modificadores
    this.modifiers.ctrl = e.ctrlKey;
    this.modifiers.alt = e.altKey;
    this.modifiers.shift = e.shiftKey;
    this.modifiers.meta = e.metaKey;
    
    // En Mac, Cmd se mapea a Ctrl
    const ctrlPressed = this.isMac ? e.metaKey : e.ctrlKey;
    
    const key = e.key.toLowerCase();
    const id = this.getShortcutId(key, ctrlPressed, e.altKey, e.shiftKey);
    
    const shortcut = this.shortcuts.get(id);
    if (shortcut) {
      if (shortcut.preventDefault) {
        e.preventDefault();
        e.stopPropagation();
      }
      shortcut.handler(e);
    }
  }
  
  /**
   * Maneja keyup
   */
  handleKeyUp(e) {
    // Resetear modificadores
    if (!e.ctrlKey && !e.metaKey) this.modifiers.ctrl = false;
    if (!e.altKey) this.modifiers.alt = false;
    if (!e.shiftKey) this.modifiers.shift = false;
    if (!e.metaKey) this.modifiers.meta = false;
  }
  
  /**
   * Registra atajos por defecto
   */
  registerDefaultShortcuts() {
    // Nuevo chat: Ctrl/Cmd + N
    this.register('n', {
      handler: () => {
        if (typeof window.newChat === 'function') {
          window.newChat();
        }
      },
      ctrl: true,
      description: 'Nuevo chat',
      preventDefault: true
    });
    
    // Guardar: Ctrl/Cmd + S
    this.register('s', {
      handler: () => {
        if (typeof window.saveChat === 'function') {
          window.saveChat();
        }
      },
      ctrl: true,
      description: 'Guardar chat',
      preventDefault: true
    });
    
    // Abrir: Ctrl/Cmd + O
    this.register('o', {
      handler: () => {
        if (typeof window.openChat === 'function') {
          window.openChat();
        }
      },
      ctrl: true,
      description: 'Abrir chat',
      preventDefault: true
    });
    
    // Enviar mensaje: Enter (sin Shift)
    this.register('Enter', {
      handler: (e) => {
        if (!e.shiftKey) {
          const chatInput = document.getElementById('chatInput');
          if (chatInput && chatInput === document.activeElement) {
            if (typeof window.sendMessage === 'function') {
              window.sendMessage();
            }
          }
        }
      },
      description: 'Enviar mensaje',
      preventDefault: false
    });
    
    // Nueva línea: Shift + Enter
    this.register('Enter', {
      handler: () => {
        // Permitir comportamiento por defecto (nueva línea)
      },
      shift: true,
      description: 'Nueva línea',
      preventDefault: false
    });
    
    // Toggle sidebar: Ctrl/Cmd + B
    this.register('b', {
      handler: () => {
        if (typeof window.toggleSidebar === 'function') {
          window.toggleSidebar();
        }
      },
      ctrl: true,
      description: 'Mostrar/Ocultar sidebar',
      preventDefault: true
    });
    
    // Toggle tema: Ctrl/Cmd + Shift + T
    this.register('t', {
      handler: () => {
        if (typeof window.toggleTheme === 'function') {
          window.toggleTheme();
        }
      },
      ctrl: true,
      shift: true,
      description: 'Alternar tema',
      preventDefault: true
    });
    
    // Abrir configuración: Ctrl/Cmd + ,
    this.register(',', {
      handler: () => {
        if (typeof window.openSettings === 'function') {
          window.openSettings();
        }
      },
      ctrl: true,
      description: 'Abrir configuración',
      preventDefault: true
    });
    
    // Cerrar modales/menús: Escape
    this.register('Escape', {
      handler: () => {
        // Cerrar menú de modelos
        const modelMenu = document.getElementById('modelMenu');
        if (modelMenu && modelMenu.classList.contains('show')) {
          modelMenu.classList.remove('show');
        }
        
        // Cerrar modales
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach(modal => {
          if (typeof window.closeSettings === 'function' && modal.id === 'settingsModal') {
            window.closeSettings();
          }
          if (typeof window.closeCamera === 'function' && modal.id === 'cameraModal') {
            window.closeCamera();
          }
        });
        
        // Cerrar menú contextual
        const contextMenu = document.getElementById('contextMenu');
        if (contextMenu && contextMenu.classList.contains('show')) {
          contextMenu.classList.remove('show');
        }
      },
      description: 'Cerrar menús/modales',
      preventDefault: false
    });
    
    // Focus en input: Ctrl/Cmd + L
    this.register('l', {
      handler: () => {
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
          chatInput.focus();
        }
      },
      ctrl: true,
      description: 'Focus en input de chat',
      preventDefault: true
    });
  }
  
  /**
   * Obtiene todos los atajos registrados
   */
  getAllShortcuts() {
    return Array.from(this.shortcuts.values());
  }
  
  /**
   * Obtiene representación legible de un atajo
   */
  getShortcutDisplay(shortcut) {
    const parts = [];
    
    if (shortcut.ctrl) {
      parts.push(this.isMac ? '⌘' : 'Ctrl');
    }
    if (shortcut.alt) {
      parts.push(this.isMac ? '⌥' : 'Alt');
    }
    if (shortcut.shift) {
      parts.push('⇧');
    }
    
    const keyDisplay = shortcut.key === 'enter' ? 'Enter' :
                      shortcut.key === 'escape' ? 'Esc' :
                      shortcut.key === ' ' ? 'Space' :
                      shortcut.key.toUpperCase();
    parts.push(keyDisplay);
    
    return parts.join(' + ');
  }
  
  /**
   * Habilita/deshabilita atajos
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

// Instancia global
const keyboardShortcuts = new KeyboardShortcutsManager();

// Exponer globalmente
window.KeyboardShortcutsManager = KeyboardShortcutsManager;
window.keyboardShortcuts = keyboardShortcuts;

