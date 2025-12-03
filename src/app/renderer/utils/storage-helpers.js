// ═══════════════════════════════════════════════════════════════════
// STORAGE HELPERS - localStorage/sessionStorage Seguro
// Prevención de errores en modo incógnito y políticas restrictivas
// ═══════════════════════════════════════════════════════════════════

/**
 * Verifica si localStorage está disponible
 * @returns {boolean} - true si está disponible
 */
function isLocalStorageAvailable() {
    try {
        if (typeof Storage === 'undefined') {
            return false;
        }
        
        const test = '__localStorage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Verifica si sessionStorage está disponible
 * @returns {boolean} - true si está disponible
 */
function isSessionStorageAvailable() {
    try {
        if (typeof Storage === 'undefined') {
            return false;
        }
        
        const test = '__sessionStorage_test__';
        sessionStorage.setItem(test, test);
        sessionStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Obtiene un valor de localStorage de forma segura
 * @param {string} key - Clave
 * @param {*} defaultValue - Valor por defecto si no existe o falla
 * @returns {*} - Valor obtenido o defaultValue
 */
function safeLocalStorageGet(key, defaultValue = null) {
    if (!isLocalStorageAvailable()) {
        console.warn(`⚠️ localStorage no disponible, usando defaultValue para: ${key}`);
        return defaultValue;
    }
    
    try {
        const value = localStorage.getItem(key);
        return value !== null ? value : defaultValue;
    } catch (e) {
        console.warn(`⚠️ Error obteniendo de localStorage (${key}):`, e);
        return defaultValue;
    }
}

/**
 * Guarda un valor en localStorage de forma segura
 * @param {string} key - Clave
 * @param {*} value - Valor a guardar (será convertido a string)
 * @returns {boolean} - true si se guardó correctamente
 */
function safeLocalStorageSet(key, value) {
    if (!isLocalStorageAvailable()) {
        console.warn(`⚠️ localStorage no disponible, no se puede guardar: ${key}`);
        return false;
    }
    
    try {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(key, stringValue);
        return true;
    } catch (e) {
        console.warn(`⚠️ Error guardando en localStorage (${key}):`, e);
        // Si es error de cuota excedida, intentar limpiar espacio
        if (e.name === 'QuotaExceededError') {
            console.warn('⚠️ Cuota de localStorage excedida, intentando limpiar...');
            // Opcional: implementar limpieza de claves antiguas
        }
        return false;
    }
}

/**
 * Elimina un valor de localStorage de forma segura
 * @param {string} key - Clave
 * @returns {boolean} - true si se eliminó correctamente
 */
function safeLocalStorageRemove(key) {
    if (!isLocalStorageAvailable()) {
        return false;
    }
    
    try {
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.warn(`⚠️ Error eliminando de localStorage (${key}):`, e);
        return false;
    }
}

/**
 * Obtiene y parsea JSON de localStorage de forma segura
 * @param {string} key - Clave
 * @param {*} defaultValue - Valor por defecto si no existe o falla
 * @returns {*} - Objeto parseado o defaultValue
 */
function safeLocalStorageGetJSON(key, defaultValue = null) {
    const value = safeLocalStorageGet(key, null);
    if (value === null) {
        return defaultValue;
    }
    
    // Usar safeJSONParse del módulo json-helpers
    if (typeof window !== 'undefined' && window.safeJSONParse) {
        return window.safeJSONParse(value, defaultValue);
    }
    
    // Fallback si json-helpers no está disponible
    try {
        return JSON.parse(value);
    } catch (e) {
        console.warn(`⚠️ Error parsing JSON de localStorage (${key}):`, e);
        return defaultValue;
    }
}

/**
 * Guarda un objeto como JSON en localStorage de forma segura
 * @param {string} key - Clave
 * @param {*} value - Objeto a guardar
 * @returns {boolean} - true si se guardó correctamente
 */
function safeLocalStorageSetJSON(key, value) {
    // Usar safeJSONStringify del módulo json-helpers
    if (typeof window !== 'undefined' && window.safeJSONStringify) {
        const jsonString = window.safeJSONStringify(value, '{}');
        return safeLocalStorageSet(key, jsonString);
    }
    
    // Fallback si json-helpers no está disponible
    try {
        const jsonString = JSON.stringify(value);
        return safeLocalStorageSet(key, jsonString);
    } catch (e) {
        console.warn(`⚠️ Error stringifying JSON para localStorage (${key}):`, e);
        return false;
    }
}

/**
 * Limpia todo el localStorage de forma segura
 * @returns {boolean} - true si se limpió correctamente
 */
function safeLocalStorageClear() {
    if (!isLocalStorageAvailable()) {
        return false;
    }
    
    try {
        localStorage.clear();
        return true;
    } catch (e) {
        console.warn('⚠️ Error limpiando localStorage:', e);
        return false;
    }
}

/**
 * Obtiene todas las claves de localStorage
 * @returns {Array<string>} - Array de claves
 */
function safeLocalStorageKeys() {
    if (!isLocalStorageAvailable()) {
        return [];
    }
    
    try {
        return Object.keys(localStorage);
    } catch (e) {
        console.warn('⚠️ Error obteniendo claves de localStorage:', e);
        return [];
    }
}

// Funciones para sessionStorage (mismo patrón)
function safeSessionStorageGet(key, defaultValue = null) {
    if (!isSessionStorageAvailable()) {
        return defaultValue;
    }
    
    try {
        const value = sessionStorage.getItem(key);
        return value !== null ? value : defaultValue;
    } catch (e) {
        console.warn(`⚠️ Error obteniendo de sessionStorage (${key}):`, e);
        return defaultValue;
    }
}

function safeSessionStorageSet(key, value) {
    if (!isSessionStorageAvailable()) {
        return false;
    }
    
    try {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        sessionStorage.setItem(key, stringValue);
        return true;
    } catch (e) {
        console.warn(`⚠️ Error guardando en sessionStorage (${key}):`, e);
        return false;
    }
}

// Exportar funciones para uso global si es necesario
if (typeof window !== 'undefined') {
    window.isLocalStorageAvailable = isLocalStorageAvailable;
    window.isSessionStorageAvailable = isSessionStorageAvailable;
    window.safeLocalStorageGet = safeLocalStorageGet;
    window.safeLocalStorageSet = safeLocalStorageSet;
    window.safeLocalStorageRemove = safeLocalStorageRemove;
    window.safeLocalStorageGetJSON = safeLocalStorageGetJSON;
    window.safeLocalStorageSetJSON = safeLocalStorageSetJSON;
    window.safeLocalStorageClear = safeLocalStorageClear;
    window.safeLocalStorageKeys = safeLocalStorageKeys;
    window.safeSessionStorageGet = safeSessionStorageGet;
    window.safeSessionStorageSet = safeSessionStorageSet;
}

