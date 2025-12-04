/**
 * ════════════════════════════════════════════════════════════════════════════
 * INIT CHECK - Verificación de Funciones Críticas
 * Movido desde inline script para cumplir con CSP
 * ════════════════════════════════════════════════════════════════════════════
 */

/**
 * Verifica que las funciones críticas estén disponibles
 */
function checkCriticalFunctions() {
  const logger = window.logger || { info: console.log };
  
  logger.info('Script cargado. Funciones disponibles', {
    toggleModelMenu: typeof window.toggleModelMenu,
    handleKeydown: typeof window.handleKeydown,
    autoResize: typeof window.autoResize,
    sendMessage: typeof window.sendMessage,
    toggleTheme: typeof window.toggleTheme,
    stateManager: typeof window.getStateManager,
    eventManager: typeof window.getEventManager,
    apiService: typeof window.getAPIService
  });
}

// Ejecutar cuando la ventana esté cargada
window.addEventListener('load', checkCriticalFunctions);

