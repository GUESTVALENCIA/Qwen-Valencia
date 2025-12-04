/**
 * ════════════════════════════════════════════════════════════════════════════
 * MODEL SELECTION - Lógica de Selección de Modelos
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Extrae la lógica de selección de modelos para reducir complejidad
 */

/**
 * Determina qué modelos usar basado en el estado y mensaje
 * @param {Object} options - Opciones de selección
 * @param {boolean} options.multiModel - Si está activo modo multi-modelo
 * @param {Array<string>} options.selectedModels - Modelos seleccionados
 * @param {boolean} options.autoMode - Si está activo modo auto
 * @param {string} options.currentModel - Modelo actual
 * @param {string} options.message - Mensaje del usuario
 * @param {boolean} options.hasImage - Si hay imagen adjunta
 * @param {boolean} options.maxMode - Si está activo modo max
 * @param {string} options.autoModeMaxModel - Modelo max para auto mode
 * @param {Function} options.getAutoModel - Función para obtener modelo auto
 * @returns {Array<string>} Array de IDs de modelos a usar
 */
function selectModelsToUse(options) {
  const {
    multiModel,
    selectedModels,
    autoMode,
    currentModel,
    message,
    hasImage,
    maxMode,
    autoModeMaxModel,
    getAutoModel
  } = options;
  
  // Modo multi-modelo
  if (multiModel && selectedModels.length > 0) {
    return selectedModels;
  }
  
  // Modo auto
  if (autoMode) {
    let autoModel = getAutoModel(message, hasImage);
    
    // Aplicar max mode si está activo y no hay imagen
    if (maxMode && autoModeMaxModel && !hasImage) {
      autoModel = autoModeMaxModel;
    }
    
    return [autoModel];
  }
  
  // Modelo específico
  return [currentModel];
}

/**
 * Determina si se debe cambiar a modelo visual cuando hay imagen
 * @param {Object} options - Opciones
 * @param {boolean} options.hasImage - Si hay imagen
 * @param {string} options.currentModel - Modelo actual
 * @returns {Object} { shouldChange: boolean, newModel: string|null }
 */
function shouldSwitchToVisionModel(options) {
  const { hasImage, currentModel } = options;
  
  if (!hasImage) {
    return { shouldChange: false, newModel: null };
  }
  
  // Si ya es modelo visual, no cambiar
  if (currentModel?.includes('vl') || currentModel?.includes('vision')) {
    return { shouldChange: false, newModel: null };
  }
  
  // Cambiar a modelo visual
  return {
    shouldChange: true,
    newModel: 'qwen2.5vl:3b'
  };
}

if (typeof window !== 'undefined') {
  window.selectModelsToUse = selectModelsToUse;
  window.shouldSwitchToVisionModel = shouldSwitchToVisionModel;
}

