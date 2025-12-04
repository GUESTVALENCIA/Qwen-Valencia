/**
 * ═══════════════════════════════════════════════════════════════════
 * LRU CACHE - Cache con política Least Recently Used
 * Implementación eficiente con límites estrictos para prevenir memory leaks
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Nodo para lista doblemente enlazada
 */
class CacheNode {
  constructor(key, value, ttl = null) {
    this.key = key;
    this.value = value;
    this.ttl = ttl ? Date.now() + ttl : null;
    this.prev = null;
    this.next = null;
  }

  isExpired() {
    return this.ttl && Date.now() > this.ttl;
  }
}

/**
 * Cache LRU con TTL opcional
 */
class LRUCache {
  /**
   * @param {Object} options - Opciones del cache
   * @param {number} options.maxSize - Tamaño máximo del cache (default: 100)
   * @param {number} options.ttl - Tiempo de vida en ms (default: null, sin expiración)
   * @param {Function} options.onEvict - Callback cuando se elimina un elemento
   */
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = options.ttl || null;
    this.onEvict = options.onEvict || null;
    
    // Mapa para acceso O(1)
    this.cache = new Map();
    
    // Lista doblemente enlazada para orden LRU
    this.head = new CacheNode(null, null); // Dummy head
    this.tail = new CacheNode(null, null); // Dummy tail
    this.head.next = this.tail;
    this.tail.prev = this.head;
    
    // Estadísticas
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
      gets: 0
    };
    
    // Limpiar elementos expirados periódicamente
    if (this.defaultTTL) {
      this.cleanupInterval = setInterval(() => this.cleanExpired(), Math.min(this.defaultTTL / 2, 60000));
    } else {
      this.cleanupInterval = null;
    }
  }

  /**
   * Mueve un nodo al frente (más reciente)
   */
  _moveToFront(node) {
    // Remover de posición actual
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    
    // Mover al frente
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next.prev = node;
    this.head.next = node;
  }

  /**
   * Remueve el nodo menos reciente (tail)
   */
  _removeLRU() {
    const lruNode = this.tail.prev;
    if (lruNode === this.head) return null; // Cache vacío
    
    // Remover de lista
    lruNode.prev.next = this.tail;
    this.tail.prev = lruNode.prev;
    
    // Remover de mapa
    this.cache.delete(lruNode.key);
    
    this.stats.evictions++;
    
    // Callback de evicción
    if (this.onEvict) {
      this.onEvict(lruNode.key, lruNode.value);
    }
    
    return lruNode;
  }

  /**
   * Obtiene un valor del cache
   * @param {string} key - Clave
   * @returns {*} Valor o null si no existe o expiró
   */
  get(key) {
    this.stats.gets++;
    
    const node = this.cache.get(key);
    if (!node) {
      this.stats.misses++;
      return null;
    }
    
    // Verificar expiración
    if (node.isExpired()) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Mover al frente (más reciente)
    this._moveToFront(node);
    
    this.stats.hits++;
    return node.value;
  }

  /**
   * Establece un valor en el cache
   * @param {string} key - Clave
   * @param {*} value - Valor
   * @param {number} ttl - TTL opcional en ms (sobrescribe defaultTTL)
   */
  set(key, value, ttl = null) {
    this.stats.sets++;
    
    const effectiveTTL = ttl !== null ? ttl : this.defaultTTL;
    
    // Si ya existe, actualizar
    if (this.cache.has(key)) {
      const node = this.cache.get(key);
      node.value = value;
      node.ttl = effectiveTTL ? Date.now() + effectiveTTL : null;
      this._moveToFront(node);
      return;
    }
    
    // Si el cache está lleno, remover LRU
    if (this.cache.size >= this.maxSize) {
      this._removeLRU();
    }
    
    // Crear nuevo nodo
    const newNode = new CacheNode(key, value, effectiveTTL);
    
    // Agregar al mapa
    this.cache.set(key, newNode);
    
    // Agregar al frente de la lista
    newNode.next = this.head.next;
    newNode.prev = this.head;
    this.head.next.prev = newNode;
    this.head.next = newNode;
  }

  /**
   * Elimina un elemento del cache
   * @param {string} key - Clave
   * @returns {boolean} true si se eliminó, false si no existía
   */
  delete(key) {
    const node = this.cache.get(key);
    if (!node) return false;
    
    // Remover de lista
    node.prev.next = node.next;
    node.next.prev = node.prev;
    
    // Remover de mapa
    this.cache.delete(key);
    
    return true;
  }

  /**
   * Limpia todos los elementos expirados
   */
  cleanExpired() {
    const expiredKeys = [];
    
    for (const [key, node] of this.cache.entries()) {
      if (node.isExpired()) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.delete(key));
    
    return expiredKeys.length;
  }

  /**
   * Limpia todo el cache
   */
  clear() {
    this.cache.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.stats.evictions += this.cache.size;
  }

  /**
   * Obtiene el tamaño actual del cache
   */
  size() {
    return this.cache.size;
  }

  /**
   * Obtiene estadísticas del cache
   */
  getStats() {
    const hitRate = this.stats.gets > 0 
      ? (this.stats.hits / this.stats.gets * 100).toFixed(2) 
      : 0;
    
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * Limpia recursos (intervals, etc.)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

module.exports = LRUCache;

