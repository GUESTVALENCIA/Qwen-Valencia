/**
 * ════════════════════════════════════════════════════════════════════════════
 * NOTIFICATIONS MANAGER - Sistema de Notificaciones Enterprise-Level
 * Gestión centralizada de notificaciones toast
 * ════════════════════════════════════════════════════════════════════════════
 */

class NotificationManager {
  constructor() {
    this.container = null;
    this.notifications = new Map();
    this.defaultDuration = 5000; // 5 segundos
    this.maxNotifications = 5;
    
    this.init();
  }
  
  init() {
    // Crear contenedor si no existe
    if (!document.getElementById('notification-container')) {
      this.container = document.createElement('div');
      this.container.id = 'notification-container';
      this.container.className = 'notification-container';
      this.container.setAttribute('role', 'region');
      this.container.setAttribute('aria-label', 'Notificaciones');
      this.container.setAttribute('aria-live', 'polite');
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById('notification-container');
    }
  }
  
  /**
   * Muestra una notificación
   * @param {Object} options - Opciones de la notificación
   * @param {string} options.type - Tipo: 'success', 'error', 'warning', 'info'
   * @param {string} options.title - Título de la notificación
   * @param {string} options.message - Mensaje de la notificación
   * @param {number} options.duration - Duración en ms (0 = no auto-dismiss)
   * @param {Function} options.onClose - Callback al cerrar
   * @returns {string} ID de la notificación
   */
  show({ type = 'info', title = '', message = '', duration = this.defaultDuration, onClose = null }) {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Limitar número de notificaciones
    if (this.notifications.size >= this.maxNotifications) {
      const firstId = Array.from(this.notifications.keys())[0];
      this.remove(firstId);
    }
    
    const notification = this.createNotification(id, type, title, message, duration, onClose);
    this.container.appendChild(notification);
    this.notifications.set(id, { element: notification, timeout: null });
    
    // Auto-dismiss si duration > 0
    if (duration > 0) {
      const timeout = setTimeout(() => {
        this.remove(id);
      }, duration);
      this.notifications.get(id).timeout = timeout;
    }
    
    // Anunciar a screen readers
    this.announceToScreenReader(title, message, type);
    
    return id;
  }
  
  /**
   * Crea el elemento de notificación
   */
  createNotification(id, type, title, message, duration, onClose) {
    const notification = document.createElement('div');
    notification.id = id;
    notification.className = `notification notification-${type}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    
    // Icono
    const icon = document.createElement('div');
    icon.className = 'notification-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = this.getIcon(type);
    notification.appendChild(icon);
    
    // Contenido
    const content = document.createElement('div');
    content.className = 'notification-content';
    
    if (title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'notification-title';
      titleEl.textContent = title;
      content.appendChild(titleEl);
    }
    
    if (message) {
      const messageEl = document.createElement('div');
      messageEl.className = 'notification-message';
      messageEl.textContent = message;
      content.appendChild(messageEl);
    }
    
    notification.appendChild(content);
    
    // Botón cerrar
    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.setAttribute('aria-label', 'Cerrar notificación');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => {
      this.remove(id);
      if (onClose) onClose();
    };
    notification.appendChild(closeBtn);
    
    // Progress bar para auto-dismiss
    if (duration > 0) {
      const progress = document.createElement('div');
      progress.className = 'notification-progress';
      progress.style.animationDuration = `${duration}ms`;
      notification.appendChild(progress);
    }
    
    return notification;
  }
  
  /**
   * Obtiene el icono según el tipo
   */
  getIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || icons.info;
  }
  
  /**
   * Remueve una notificación
   */
  remove(id) {
    const notification = this.notifications.get(id);
    if (!notification) return;
    
    // Limpiar timeout
    if (notification.timeout) {
      clearTimeout(notification.timeout);
    }
    
    // Animación de salida
    notification.element.classList.add('closing');
    
    setTimeout(() => {
      if (notification.element.parentNode) {
        notification.element.parentNode.removeChild(notification.element);
      }
      this.notifications.delete(id);
    }, 200);
  }
  
  /**
   * Remueve todas las notificaciones
   */
  clear() {
    Array.from(this.notifications.keys()).forEach(id => {
      this.remove(id);
    });
  }
  
  /**
   * Anuncia a screen readers
   */
  announceToScreenReader(title, message, type) {
    // Crear región ARIA live si no existe
    let liveRegion = document.getElementById('aria-live-region');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'aria-live-region';
      liveRegion.className = 'aria-live-region';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      document.body.appendChild(liveRegion);
    }
    
    // Actualizar contenido
    const text = title ? `${title}: ${message}` : message;
    liveRegion.textContent = text;
    
    // Limpiar después de un momento
    setTimeout(() => {
      liveRegion.textContent = '';
    }, 1000);
  }
  
  /**
   * Métodos de conveniencia
   */
  success(title, message, duration = this.defaultDuration) {
    return this.show({ type: 'success', title, message, duration });
  }
  
  error(title, message, duration = this.defaultDuration) {
    return this.show({ type: 'error', title, message, duration });
  }
  
  warning(title, message, duration = this.defaultDuration) {
    return this.show({ type: 'warning', title, message, duration });
  }
  
  info(title, message, duration = this.defaultDuration) {
    return this.show({ type: 'info', title, message, duration });
  }
}

// Instancia global
const notificationManager = new NotificationManager();

// Exponer globalmente
window.NotificationManager = NotificationManager;
window.notifications = notificationManager;

// Métodos de conveniencia globales
window.showNotification = (type, title, message, duration) => {
  return notificationManager.show({ type, title, message, duration });
};

window.showSuccess = (title, message, duration) => {
  return notificationManager.success(title, message, duration);
};

window.showError = (title, message, duration) => {
  return notificationManager.error(title, message, duration);
};

window.showWarning = (title, message, duration) => {
  return notificationManager.warning(title, message, duration);
};

window.showInfo = (title, message, duration) => {
  return notificationManager.info(title, message, duration);
};

