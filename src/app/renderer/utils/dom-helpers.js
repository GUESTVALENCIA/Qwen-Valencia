// ═══════════════════════════════════════════════════════════════════
// DOM HELPERS - Validación Defensiva
// Prevención de errores Null/Undefined Access
// ═══════════════════════════════════════════════════════════════════

/**
 * Obtiene un elemento del DOM de forma segura con retry logic
 * @param {string} id - ID del elemento
 * @param {Object} options - Opciones de retry
 * @param {number} options.maxRetries - Número máximo de intentos (default: 5)
 * @param {number} options.retryDelay - Delay entre intentos en ms (default: 100)
 * @returns {HTMLElement|null} - Elemento encontrado o null
 */
function safeGetElement(id, options = {}) {
    const { maxRetries = 5, retryDelay = 100 } = options;
    
    // Intento inmediato
    let element = document.getElementById(id);
    if (element) return element;
    
    // Si el DOM no está listo, esperar
    if (document.readyState === 'loading') {
        return new Promise((resolve) => {
            let attempts = 0;
            const tryGet = () => {
                attempts++;
                const el = document.getElementById(id);
                if (el) {
                    resolve(el);
                } else if (attempts < maxRetries) {
                    setTimeout(tryGet, retryDelay);
                } else {
                    console.warn(`⚠️ Elemento no encontrado después de ${maxRetries} intentos: ${id}`);
                    resolve(null);
                }
            };
            document.addEventListener('DOMContentLoaded', tryGet);
            // También intentar inmediatamente por si ya está listo
            tryGet();
        });
    }
    
    return null;
}

/**
 * Obtiene un elemento del DOM de forma síncrona (sin retry)
 * @param {string} id - ID del elemento
 * @returns {HTMLElement|null} - Elemento encontrado o null
 */
function getElement(id) {
    try {
        return document.getElementById(id);
    } catch (e) {
        console.warn(`⚠️ Error obteniendo elemento ${id}:`, e);
        return null;
    }
}

/**
 * Obtiene elementos por querySelector de forma segura
 * @param {string} selector - Selector CSS
 * @param {HTMLElement} context - Contexto (default: document)
 * @returns {HTMLElement|null} - Primer elemento encontrado o null
 */
function safeQuerySelector(selector, context = document) {
    try {
        return context.querySelector(selector);
    } catch (e) {
        console.warn(`⚠️ Error en querySelector "${selector}":`, e);
        return null;
    }
}

/**
 * Obtiene todos los elementos por querySelectorAll de forma segura
 * @param {string} selector - Selector CSS
 * @param {HTMLElement} context - Contexto (default: document)
 * @returns {NodeList|Array} - Lista de elementos o array vacío
 */
function safeQuerySelectorAll(selector, context = document) {
    try {
        return context.querySelectorAll(selector);
    } catch (e) {
        console.warn(`⚠️ Error en querySelectorAll "${selector}":`, e);
        return [];
    }
}

/**
 * Ejecuta una función solo si el elemento existe
 * @param {string} id - ID del elemento
 * @param {Function} callback - Función a ejecutar con el elemento
 * @param {*} defaultValue - Valor por defecto si el elemento no existe
 * @returns {*} - Resultado de callback o defaultValue
 */
function withElement(id, callback, defaultValue = null) {
    const element = getElement(id);
    if (element && typeof callback === 'function') {
        try {
            return callback(element);
        } catch (e) {
            console.error(`⚠️ Error ejecutando callback para elemento ${id}:`, e);
            return defaultValue;
        }
    }
    return defaultValue;
}

/**
 * Verifica si un elemento existe antes de acceder a sus propiedades
 * @param {HTMLElement|null} element - Elemento a verificar
 * @param {Function} callback - Función a ejecutar si existe
 * @param {*} defaultValue - Valor por defecto si no existe
 * @returns {*} - Resultado de callback o defaultValue
 */
function safeElementAccess(element, callback, defaultValue = null) {
    if (element && typeof callback === 'function') {
        try {
            return callback(element);
        } catch (e) {
            console.error('⚠️ Error accediendo a elemento:', e);
            return defaultValue;
        }
    }
    return defaultValue;
}

/**
 * Espera a que un elemento esté disponible en el DOM
 * @param {string} selector - Selector CSS o ID
 * @param {Object} options - Opciones
 * @param {number} options.timeout - Timeout en ms (default: 5000)
 * @param {number} options.interval - Intervalo de verificación en ms (default: 100)
 * @returns {Promise<HTMLElement|null>} - Elemento encontrado o null si timeout
 */
function waitForElement(selector, options = {}) {
    const { timeout = 5000, interval = 100 } = options;
    
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        const check = () => {
            const element = selector.startsWith('#') 
                ? document.getElementById(selector.slice(1))
                : document.querySelector(selector);
            
            if (element) {
                resolve(element);
            } else if (Date.now() - startTime < timeout) {
                setTimeout(check, interval);
            } else {
                console.warn(`⚠️ Timeout esperando elemento: ${selector}`);
                resolve(null);
            }
        };
        
        // Si el DOM ya está listo, verificar inmediatamente
        if (document.readyState !== 'loading') {
            check();
        } else {
            document.addEventListener('DOMContentLoaded', check);
        }
    });
}

// Exportar funciones para uso global si es necesario
if (typeof window !== 'undefined') {
    window.safeGetElement = safeGetElement;
    window.getElement = getElement;
    window.safeQuerySelector = safeQuerySelector;
    window.safeQuerySelectorAll = safeQuerySelectorAll;
    window.withElement = withElement;
    window.safeElementAccess = safeElementAccess;
    window.waitForElement = waitForElement;
}

