/**
 * ═══════════════════════════════════════════════════════════════════
 * HTML SANITIZER - Prevención de XSS
 * Sanitización segura de HTML para prevenir ataques XSS
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Lista de tags HTML permitidos (whitelist approach)
 */
const ALLOWED_TAGS = new Set([
  'div', 'span', 'p', 'br', 'strong', 'em', 'b', 'i', 'u',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'code', 'pre', 'blockquote',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td'
]);

/**
 * Atributos permitidos por tag
 */
const ALLOWED_ATTRIBUTES = {
  'a': ['href', 'title', 'target'],
  'img': ['src', 'alt', 'title', 'width', 'height'],
  'code': ['class'],
  'pre': ['class'],
  '*': ['class', 'id', 'data-*']
};

/**
 * Sanitiza una cadena HTML eliminando scripts y contenido peligroso
 * @param {string} html - HTML a sanitizar
 * @param {Object} options - Opciones de sanitización
 * @param {boolean} options.allowImages - Permitir imágenes (default: true)
 * @param {boolean} options.allowLinks - Permitir enlaces (default: true)
 * @returns {string} - HTML sanitizado
 */
function sanitizeHTML(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Crear un elemento temporal para parsear HTML
  const temp = document.createElement('div');
  temp.textContent = html; // Esto escapa automáticamente todo el HTML
  
  // Si necesitamos preservar formato básico, usar un enfoque más sofisticado
  // Por ahora, retornamos el texto escapado (más seguro)
  return temp.innerHTML;
}

/**
 * Sanitiza HTML preservando tags básicos permitidos
 * @param {string} html - HTML a sanitizar
 * @returns {string} - HTML sanitizado con tags permitidos
 */
function sanitizeHTMLWithTags(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Crear elemento temporal
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Remover scripts y eventos
  const scripts = temp.querySelectorAll('script, style, iframe, object, embed, form');
  scripts.forEach(el => el.remove());

  // Remover atributos de eventos (onclick, onerror, etc.)
  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    // Remover todos los atributos que empiezan con 'on'
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on') || attr.name === 'javascript:' || attr.name.startsWith('data:')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return temp.innerHTML;
}

/**
 * Crea un elemento de forma segura con contenido sanitizado
 * @param {string} tagName - Nombre del tag
 * @param {Object} attributes - Atributos del elemento
 * @param {string} content - Contenido (será sanitizado)
 * @returns {HTMLElement} - Elemento creado
 */
function createSafeElement(tagName, attributes = {}, content = '') {
  const element = document.createElement(tagName);
  
  // Agregar atributos de forma segura
  Object.entries(attributes).forEach(([key, value]) => {
    // Solo permitir atributos que no sean eventos
    if (!key.startsWith('on') && typeof value === 'string') {
      // Sanitizar valor de atributo
      const sanitizedValue = value.replace(/[<>"']/g, '');
      element.setAttribute(key, sanitizedValue);
    }
  });
  
  // Agregar contenido sanitizado
  if (content) {
    element.textContent = content; // Usar textContent en lugar de innerHTML
  }
  
  return element;
}

/**
 * Inserta HTML de forma segura en un elemento
 * @param {HTMLElement} element - Elemento destino
 * @param {string} html - HTML a insertar (será sanitizado)
 * @param {boolean} append - Si es true, agrega al contenido existente
 */
function setSafeHTML(element, html, append = false) {
  if (!element || !(element instanceof HTMLElement)) {
    console.warn('⚠️ setSafeHTML: elemento inválido');
    return;
  }

  const sanitized = sanitizeHTMLWithTags(html);
  
  if (append) {
    const temp = document.createElement('div');
    temp.innerHTML = sanitized;
    while (temp.firstChild) {
      element.appendChild(temp.firstChild);
    }
  } else {
    element.innerHTML = sanitized;
  }
}

/**
 * Escapa HTML para prevenir XSS
 * @param {string} text - Texto a escapar
 * @returns {string} - Texto escapado
 */
function escapeHTML(text) {
  if (typeof text !== 'string') {
    return String(text);
  }
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Exportar funciones
if (typeof window !== 'undefined') {
  window.sanitizeHTML = sanitizeHTML;
  window.sanitizeHTMLWithTags = sanitizeHTMLWithTags;
  window.createSafeElement = createSafeElement;
  window.setSafeHTML = setSafeHTML;
  window.escapeHTML = escapeHTML;
}

