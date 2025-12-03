// ═══════════════════════════════════════════════════════════════════
// JSON HELPERS - Parsing Seguro
// Prevención de errores JSON.parse
// ═══════════════════════════════════════════════════════════════════

/**
 * Parsea JSON de forma segura con manejo de errores
 * @param {string} str - String JSON a parsear
 * @param {*} defaultValue - Valor por defecto si falla (default: null)
 * @param {boolean} logError - Si debe loggear el error (default: true)
 * @returns {*} - Objeto parseado o defaultValue
 */
function safeJSONParse(str, defaultValue = null, logError = true) {
    if (str === null || str === undefined || str === '') {
        return defaultValue;
    }
    
    // Si ya es un objeto, retornarlo directamente
    if (typeof str === 'object') {
        return str;
    }
    
    // Si no es string, intentar convertir
    if (typeof str !== 'string') {
        try {
            str = String(str);
        } catch (e) {
            if (logError) {
                console.warn('⚠️ Error convirtiendo a string para JSON.parse:', e);
            }
            return defaultValue;
        }
    }
    
    try {
        const parsed = JSON.parse(str);
        return parsed;
    } catch (e) {
        if (logError) {
            console.warn('⚠️ Error parsing JSON:', {
                error: e.message,
                input: str.length > 100 ? str.substring(0, 100) + '...' : str,
                inputLength: str.length
            });
        }
        return defaultValue;
    }
}

/**
 * Convierte un objeto a JSON string de forma segura
 * @param {*} obj - Objeto a convertir
 * @param {string} defaultValue - Valor por defecto si falla (default: '{}')
 * @param {boolean} logError - Si debe loggear el error (default: true)
 * @returns {string} - JSON string o defaultValue
 */
function safeJSONStringify(obj, defaultValue = '{}', logError = true) {
    if (obj === null || obj === undefined) {
        return defaultValue;
    }
    
    try {
        return JSON.stringify(obj);
    } catch (e) {
        if (logError) {
            console.warn('⚠️ Error stringifying JSON:', {
                error: e.message,
                objectType: typeof obj
            });
        }
        return defaultValue;
    }
}

/**
 * Parsea múltiples líneas de JSON (útil para streaming)
 * @param {string} text - Texto con múltiples líneas JSON
 * @param {Function} onLine - Callback para cada línea parseada
 * @param {*} defaultValue - Valor por defecto para líneas fallidas
 * @returns {Array} - Array de objetos parseados
 */
function safeJSONParseLines(text, onLine = null, defaultValue = null) {
    const results = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
        const parsed = safeJSONParse(line, defaultValue, false);
        if (parsed !== defaultValue) {
            results.push(parsed);
            if (typeof onLine === 'function') {
                try {
                    onLine(parsed);
                } catch (e) {
                    console.warn('⚠️ Error en callback onLine:', e);
                }
            }
        }
    }
    
    return results;
}

/**
 * Valida si un string es JSON válido
 * @param {string} str - String a validar
 * @returns {boolean} - true si es JSON válido
 */
function isValidJSON(str) {
    if (typeof str !== 'string' || str.trim() === '') {
        return false;
    }
    
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}

// Exportar funciones para uso global si es necesario
if (typeof window !== 'undefined') {
    window.safeJSONParse = safeJSONParse;
    window.safeJSONStringify = safeJSONStringify;
    window.safeJSONParseLines = safeJSONParseLines;
    window.isValidJSON = isValidJSON;
}

