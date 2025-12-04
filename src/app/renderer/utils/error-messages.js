/**
 * ════════════════════════════════════════════════════════════════════════════
 * ERROR MESSAGES - Mensajes de Error User-Friendly
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Centraliza la generación de mensajes de error amigables para el usuario
 */

/**
 * Mapeo de códigos de error a mensajes user-friendly
 */
const ERROR_MESSAGES = {
  'Invalid character in header': {
    title: 'Error de autenticación con Groq API',
    message: 'La API key contiene caracteres inválidos. Verifica que GROQ_API_KEY en qwen-valencia.env esté correctamente configurada sin espacios ni caracteres especiales.',
    toast: 'Error de autenticación - Verifica GROQ_API_KEY',
    type: 'error'
  },
  'groq-404': {
    title: 'Error conectando con Groq API (404)',
    message: 'Verifica que:\n1. GROQ_API_KEY esté correcta en qwen-valencia.env\n2. La API key tenga el formato correcto (debe empezar con "gsk_")\n3. No haya espacios o caracteres especiales en la key',
    toast: 'Error 404 - Verifica GROQ_API_KEY',
    type: 'error'
  },
  'rate-limit-429': {
    title: 'Límite de rate limit alcanzado',
    message: 'Has excedido el límite de requests de Groq. Espera unos momentos e intenta de nuevo.',
    toast: 'Rate limit alcanzado - Espera un momento',
    type: 'warning'
  },
  'ollama-404': {
    title: 'Modelo de Ollama no encontrado',
    message: (modelName) => `Soluciones:\n1. Verifica que Ollama esté corriendo: \`ollama serve\`\n2. Descarga el modelo: \`ollama pull ${modelName || 'qwen2.5:7b-instruct'}\`\n3. Verifica que el nombre del modelo sea correcto`,
    toast: 'Modelo Ollama no encontrado',
    type: 'warning'
  },
  'api-key-error': {
    title: 'Error de API Key',
    message: (errorMsg) => `${errorMsg}\n\nSolución: Verifica que GROQ_API_KEY esté correctamente configurada en qwen-valencia.env sin espacios ni caracteres especiales.`,
    toast: 'Error de API Key - Verifica qwen-valencia.env',
    type: 'error'
  },
  'generic-error': {
    title: 'Error al procesar mensaje',
    message: (errorMsg) => `${errorMsg}\n\nSi el problema persiste, verifica la configuración en qwen-valencia.env`,
    toast: 'Error al procesar mensaje',
    type: 'error'
  }
};

/**
 * Analiza un error y retorna información user-friendly
 * @param {Error|string} error - Error a analizar
 * @param {Object} context - Contexto adicional (modelName, etc.)
 * @returns {Object} Objeto con title, message, toast, type
 */
function getErrorMessage(error, context = {}) {
  const errorMessage = error?.message ?? String(error ?? 'Error desconocido');
  const { modelName } = context;
  
  // Invalid character in header
  if (errorMessage.includes('Invalid character in header')) {
    const errorInfo = ERROR_MESSAGES['Invalid character in header'];
    return {
      title: `⚠️ ${errorInfo.title}`,
      message: `\n\n💡 ${errorInfo.message}`,
      toast: errorInfo.toast,
      type: errorInfo.type
    };
  }
  
  // Groq 404
  if (errorMessage.includes('404') && errorMessage.includes('Groq')) {
    const errorInfo = ERROR_MESSAGES['groq-404'];
    return {
      title: `⚠️ ${errorInfo.title}`,
      message: `\n\n💡 ${errorInfo.message}`,
      toast: errorInfo.toast,
      type: errorInfo.type
    };
  }
  
  // Rate limit 429
  if (errorMessage.includes('429')) {
    const errorInfo = ERROR_MESSAGES['rate-limit-429'];
    return {
      title: `⚠️ ${errorInfo.title}`,
      message: `\n\n💡 ${errorInfo.message}`,
      toast: errorInfo.toast,
      type: errorInfo.type
    };
  }
  
  // Ollama 404
  if (errorMessage.includes('Ollama') && errorMessage.includes('404')) {
    const errorInfo = ERROR_MESSAGES['ollama-404'];
    const message = typeof errorInfo.message === 'function' 
      ? errorInfo.message(modelName) 
      : errorInfo.message;
    return {
      title: `⚠️ ${errorInfo.title}`,
      message: `\n\n💡 ${message}`,
      toast: errorInfo.toast,
      type: errorInfo.type
    };
  }
  
  // API Key errors
  if (errorMessage.includes('API Key') || errorMessage.includes('GROQ_API_KEY')) {
    const errorInfo = ERROR_MESSAGES['api-key-error'];
    const message = typeof errorInfo.message === 'function' 
      ? errorInfo.message(errorMessage) 
      : errorInfo.message;
    return {
      title: `⚠️ ${errorInfo.title}`,
      message: `\n\n💡 ${message}`,
      toast: errorInfo.toast,
      type: errorInfo.type
    };
  }
  
  // Generic error
  const errorInfo = ERROR_MESSAGES['generic-error'];
  const message = typeof errorInfo.message === 'function' 
    ? errorInfo.message(errorMessage) 
    : errorInfo.message;
  return {
    title: `⚠️ ${errorInfo.title}`,
    message: `\n\n💡 ${message}`,
    toast: errorInfo.toast,
    type: errorInfo.type
  };
}

if (typeof window !== 'undefined') {
  window.getErrorMessage = getErrorMessage;
}

