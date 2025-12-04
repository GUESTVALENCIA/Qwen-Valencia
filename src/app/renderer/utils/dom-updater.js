/**
 * ═══════════════════════════════════════════════════════════════════
 * DOM UPDATER - Actualizaciones Incrementales del DOM
 * Optimiza rendimiento evitando reconstrucciones completas
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * Actualiza una lista de elementos de forma incremental
 * Solo actualiza los elementos que cambiaron, preserva los que no
 * @param {HTMLElement} container - Contenedor de la lista
 * @param {Array} items - Array de items a renderizar
 * @param {Function} renderItem - Función que renderiza un item (retorna HTMLElement)
 * @param {Function} getItemKey - Función que retorna la clave única de un item
 * @param {Object} options - Opciones
 * @param {string} options.itemSelector - Selector CSS para items existentes (default: '[data-key]')
 * @param {string} options.keyAttribute - Atributo que contiene la clave (default: 'data-key')
 * @param {boolean} options.preserveOrder - Si true, mantiene el orden de items (default: true)
 */
function updateListIncremental(container, items, renderItem, getItemKey, options = {}) {
    if (!container || !Array.isArray(items)) {
        console.warn('⚠️ updateListIncremental: parámetros inválidos');
        // FIX: Retornar objeto con estructura esperada para evitar TypeError en callers
        return {
            added: 0,
            updated: 0,
            removed: 0,
            total: 0
        };
    }

    const {
        itemSelector = '[data-key]',
        keyAttribute = 'data-key',
        preserveOrder = true
    } = options;

    // Crear mapa de items existentes por clave
    const existingItems = new Map();
    const existingElements = container.querySelectorAll(itemSelector);
    
    existingElements.forEach(el => {
        const key = el.getAttribute(keyAttribute);
        if (key) {
            existingItems.set(key, el);
        }
    });

    // Crear mapa de items nuevos por clave
    const newItems = new Map();
    items.forEach(item => {
        const key = getItemKey(item);
        newItems.set(key, item);
    });

    // Identificar items a agregar, actualizar y remover
    const toAdd = [];
    const toUpdate = [];
    const toRemove = [];

    // Items a agregar o actualizar
    items.forEach(item => {
        const key = getItemKey(item);
        const existing = existingItems.get(key);
        
        if (!existing) {
            toAdd.push({ key, item });
        } else {
            toUpdate.push({ key, item, element: existing });
        }
    });

    // Items a remover (existen en DOM pero no en nueva lista)
    existingItems.forEach((element, key) => {
        if (!newItems.has(key)) {
            toRemove.push({ key, element });
        }
    });

    // Usar DocumentFragment para mejor rendimiento
    const fragment = document.createDocumentFragment();
    const updatedElements = new Map();

    // Procesar items en orden
    if (preserveOrder) {
        items.forEach(item => {
            const key = getItemKey(item);
            const existing = existingItems.get(key);
            
            if (existing) {
                // Actualizar elemento existente
                const newElement = renderItem(item);
                if (newElement && newElement !== existing) {
                    existing.replaceWith(newElement);
                    updatedElements.set(key, newElement);
                } else {
                    updatedElements.set(key, existing);
                }
            } else {
                // Agregar nuevo elemento
                const newElement = renderItem(item);
                if (newElement) {
                    fragment.appendChild(newElement);
                    updatedElements.set(key, newElement);
                }
            }
        });
    } else {
        // Actualizar elementos existentes
        toUpdate.forEach(({ key, item, element }) => {
            const newElement = renderItem(item);
            if (newElement && newElement !== element) {
                element.replaceWith(newElement);
                updatedElements.set(key, newElement);
            } else {
                updatedElements.set(key, element);
            }
        });

        // Agregar nuevos elementos
        toAdd.forEach(({ key, item }) => {
            const newElement = renderItem(item);
            if (newElement) {
                fragment.appendChild(newElement);
                updatedElements.set(key, newElement);
            }
        });
    }

    // Agregar fragmento al contenedor
    if (fragment.hasChildNodes()) {
        container.appendChild(fragment);
    }

    // Remover elementos que ya no existen
    toRemove.forEach(({ element }) => {
        if (element && element.parentNode) {
            element.remove();
        }
    });

    return {
        added: toAdd.length,
        updated: toUpdate.length,
        removed: toRemove.length,
        total: updatedElements.size
    };
}

/**
 * Actualiza un elemento específico sin reconstruir todo
 * @param {HTMLElement} element - Elemento a actualizar
 * @param {Object} data - Datos para actualizar
 * @param {Function} updateFn - Función que actualiza el elemento
 */
function updateElementIncremental(element, data, updateFn) {
    if (!element || !updateFn) {
        console.warn('⚠️ updateElementIncremental: parámetros inválidos');
        return;
    }

    try {
        updateFn(element, data);
    } catch (error) {
        console.error('⚠️ Error actualizando elemento:', error);
    }
}

/**
 * Crea un elemento de forma eficiente usando DocumentFragment
 * @param {string} tagName - Nombre del tag
 * @param {Object} attributes - Atributos del elemento
 * @param {Array|HTMLElement|string} children - Hijos del elemento
 * @returns {HTMLElement} Elemento creado
 */
function createElementEfficient(tagName, attributes = {}, children = []) {
    const element = document.createElement(tagName);
    
    // Agregar atributos
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'dataset') {
            Object.entries(value).forEach(([dataKey, dataValue]) => {
                element.dataset[dataKey] = dataValue;
            });
        } else if (key.startsWith('on')) {
            // Event listeners se agregan después
            element[key] = value;
        } else {
            element.setAttribute(key, value);
        }
    });
    
    // Agregar hijos
    if (typeof children === 'string') {
        element.textContent = children;
    } else if (children instanceof HTMLElement) {
        element.appendChild(children);
    } else if (Array.isArray(children)) {
        const fragment = document.createDocumentFragment();
        children.forEach(child => {
            if (child instanceof HTMLElement) {
                fragment.appendChild(child);
            } else if (typeof child === 'string') {
                fragment.appendChild(document.createTextNode(child));
            }
        });
        element.appendChild(fragment);
    }
    
    return element;
}

/**
 * Batch DOM updates para mejor rendimiento
 * Agrupa múltiples actualizaciones en un solo batch
 */
class DOMUpdateBatcher {
    constructor() {
        this.pendingUpdates = [];
        this.batchTimeout = null;
        this.batchDelay = 16; // ~60fps
    }

    /**
     * Agrega una actualización al batch
     * @param {Function} updateFn - Función que realiza la actualización
     * @param {*} context - Contexto adicional
     */
    add(updateFn, context = null) {
        this.pendingUpdates.push({ updateFn, context });
        
        if (!this.batchTimeout) {
            this.batchTimeout = requestAnimationFrame(() => {
                this.flush();
            });
        }
    }

    /**
     * Ejecuta todas las actualizaciones pendientes
     */
    flush() {
        if (this.batchTimeout) {
            cancelAnimationFrame(this.batchTimeout);
            this.batchTimeout = null;
        }

        const updates = this.pendingUpdates.slice();
        this.pendingUpdates = [];

        // Ejecutar todas las actualizaciones
        updates.forEach(({ updateFn, context }) => {
            try {
                updateFn(context);
            } catch (error) {
                console.error('⚠️ Error en batch update:', error);
            }
        });
    }

    /**
     * Limpia el batch sin ejecutar
     */
    clear() {
        if (this.batchTimeout) {
            cancelAnimationFrame(this.batchTimeout);
            this.batchTimeout = null;
        }
        this.pendingUpdates = [];
    }
}

// Instancia global del batcher
const globalBatcher = new DOMUpdateBatcher();

// Exportar funciones
if (typeof window !== 'undefined') {
    window.updateListIncremental = updateListIncremental;
    window.updateElementIncremental = updateElementIncremental;
    window.createElementEfficient = createElementEfficient;
    window.DOMUpdateBatcher = DOMUpdateBatcher;
    window.domBatcher = globalBatcher;
}

