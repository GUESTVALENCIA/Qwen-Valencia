/**
 * ════════════════════════════════════════════════════════════════════════════
 * QWEN-VALENCIA - PRELOAD SCRIPT
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * IPC Bridge entre renderer y main process
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al renderer
contextBridge.exposeInMainWorld('qwenValencia', {
  /**
   * Envía un mensaje al modelo (Qwen o DeepSeek)
   * Compatible con app.js: { text, attachments, model, useAPI }
   */
  routeMessage: async (params, modality = 'text', attachments = [], options = {}) => {
    // Compatibilidad con ambas firmas
    if (typeof params === 'string') {
      // Firma antigua: routeMessage(text, modality, attachments, options)
      return await ipcRenderer.invoke('route-message', { 
        text: params, 
        modality: modality || 'text', 
        attachments: attachments || [], 
        options: options || {} 
      });
    } else {
      // Firma nueva: routeMessage({ text, attachments, model, useAPI })
      return await ipcRenderer.invoke('route-message', {
        text: params.text || '',
        modality: params.modality || 'text',
        attachments: params.attachments || [],
        model: params.model,
        useAPI: params.useAPI,
        options: params.options || {}
      });
    }
  },

  /**
   * Ejecuta código
   */
  executeCode: async (language, code) => {
    return await ipcRenderer.invoke('execute-code', { language, code });
  },

  /**
   * Lee un archivo
   */
  readFile: async (filePath) => {
    return await ipcRenderer.invoke('read-file', { filePath });
  },

  /**
   * Lista archivos de un directorio
   */
  listFiles: async (dirPath) => {
    return await ipcRenderer.invoke('list-files', { dirPath });
  },

  /**
   * Generar audio con Cartesia TTS
   */
  generateSpeech: async (text, options = {}) => {
    return await ipcRenderer.invoke('generate-speech', { text, options });
  },

  /**
   * Cartesia TTS (compatible con app.js)
   */
  cartesiaTTS: async (params) => {
    return await ipcRenderer.invoke('cartesia-tts', params);
  },

  /**
   * Ejecutar código en laboratorio de IAs
   */
  executeInLab: async (language, code, options = {}) => {
    return await ipcRenderer.invoke('execute-in-lab', { language, code, options });
  },

  /**
   * Transcribir audio
   */
  transcribeAudio: async (audioData) => {
    return await ipcRenderer.invoke('transcribe-audio', audioData);
  },

  /**
   * Transcribir audio con DeepGram (compatible con app.js)
   */
  deepgramTranscribe: async (params) => {
    return await ipcRenderer.invoke('deepgram-transcribe', params);
  },

  /**
   * Iniciar DeepGram Live Transcription
   */
  deepgramStartLive: async () => {
    return await ipcRenderer.invoke('deepgram-start-live');
  },

  /**
   * Detener DeepGram Live Transcription
   */
  deepgramStopLive: async () => {
    return await ipcRenderer.invoke('deepgram-stop-live');
  },

  /**
   * Enviar audio a DeepGram Live
   */
  deepgramSendAudio: async (audioBase64) => {
    return await ipcRenderer.invoke('deepgram-send-audio', { audio: audioBase64 });
  },

  /**
   * Listener para transcripciones de DeepGram
   */
  onDeepgramTranscript: (callback) => {
    ipcRenderer.on('deepgram-transcript', (event, data) => callback(data));
  },

  /**
   * Listener para errores de DeepGram
   */
  onDeepgramError: (callback) => {
    ipcRenderer.on('deepgram-error', (event, error) => callback(error));
  },

  /**
   * Obtener token de HeyGen para avatar
   */
  getHeyGenToken: async () => {
    try {
      const response = await fetch('http://localhost:3000/api/heygen/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * Iniciar sesión de HeyGen Avatar - DESHABILITADO
   */
  heygenStartSession: async () => {
    // HeyGen deshabilitado temporalmente
    return { success: false, error: 'HeyGen Avatar deshabilitado temporalmente' };
  },

  /**
   * Detener sesión de HeyGen Avatar - DESHABILITADO
   */
  heygenStop: async () => {
    // HeyGen deshabilitado temporalmente
    return { success: false, error: 'HeyGen Avatar deshabilitado temporalmente' };
  },

  /**
   * Interrumpir avatar de HeyGen - DESHABILITADO
   */
  heygenInterrupt: async () => {
    // HeyGen deshabilitado temporalmente
    return { success: false, error: 'HeyGen Avatar deshabilitado temporalmente' };
  },

  /**
   * Crear ventana flotante para avatar
   */
  createFloatingAvatarWindow: async (videoSrc) => {
    return await ipcRenderer.invoke('create-floating-avatar-window', { videoSrc });
  },

  /**
   * Iniciar conversación
   */
  startConversation: async (mode = 'text', userId = null) => {
    return await ipcRenderer.invoke('start-conversation', { mode, userId });
  },

  /**
   * Detener conversación
   */
  stopConversation: async () => {
    return await ipcRenderer.invoke('stop-conversation');
  },

  /**
   * Enviar audio al stream de conversación
   */
  sendAudioToConversation: async (audioBuffer) => {
    return await ipcRenderer.invoke('send-audio-to-conversation', { audioBuffer });
  },

  /**
   * Listeners para eventos de conversación
   */
  onConversationTranscript: (callback) => {
    ipcRenderer.on('conversation-transcript', (event, data) => callback(data));
  },

  onConversationResponse: (callback) => {
    ipcRenderer.on('conversation-response', (event, data) => callback(data));
  },

  onConversationState: (callback) => {
    ipcRenderer.on('conversation-state', (event, data) => callback(data));
  },

  onConversationError: (callback) => {
    ipcRenderer.on('conversation-error', (event, data) => callback(data));
  },

  /**
   * MCP Master Server
   */
  startMCPMaster: async () => {
    return await ipcRenderer.invoke('start-mcp-master');
  },

  stopMCPMaster: async () => {
    return await ipcRenderer.invoke('stop-mcp-master');
  },

  getMCPMasterStatus: async () => {
    return await ipcRenderer.invoke('get-mcp-master-status');
  },

  /**
   * Obtener memoria del sistema (RAM real)
   */
  getSystemMemory: async () => {
    return await ipcRenderer.invoke('get-system-memory');
  },

  /**
   * ════════════════════════════════════════════════════════════════════════════
   * STATE SYNCHRONIZATION - Sincronización de Estado Frontend-Backend
   * ════════════════════════════════════════════════════════════════════════════
   */

  /**
   * Obtener estado compartido desde el backend
   */
  getSharedState: async () => {
    return await ipcRenderer.invoke('get-shared-state');
  },

  /**
   * Actualizar estado compartido en el backend
   */
  updateSharedState: async (updates) => {
    return await ipcRenderer.invoke('update-shared-state', updates);
  },

  /**
   * Sincronizar estado completo (bidireccional)
   */
  syncState: async (frontendState) => {
    return await ipcRenderer.invoke('sync-state', frontendState);
  },

  /**
   * Enviar cambio de estado al backend
   */
  sendStateChange: (stateUpdate) => {
    ipcRenderer.send('state-changed', stateUpdate);
  },

  /**
   * Listeners para eventos de sincronización de estado
   */
  onSharedStateUpdated: (callback) => {
    ipcRenderer.on('shared-state-updated', (event, state) => callback(state));
  },

  onStateSynced: (callback) => {
    ipcRenderer.on('state-synced', (event, state) => callback(state));
  },

  /**
   * ════════════════════════════════════════════════════════════════════════════
   * PERFORMANCE MONITORING - Métricas de Performance
   * ════════════════════════════════════════════════════════════════════════════
   */

  /**
   * Obtener métricas de performance
   */
  getPerformanceMetrics: async () => {
    return await ipcRenderer.invoke('get-performance-metrics');
  },

  /**
   * Controles de ventana
   */
  minimize: () => {
    ipcRenderer.send('window-minimize');
  },

  maximize: () => {
    ipcRenderer.send('window-maximize');
  },

  close: () => {
    ipcRenderer.send('window-close');
  },

  /**
   * ════════════════════════════════════════════════════════════════════════════
   * TERMINAL MANAGEMENT - Gestión de Terminales
   * ════════════════════════════════════════════════════════════════════════════
   */

  /**
   * Crear terminal
   */
  createTerminal: async (type = 'auto', command = null) => {
    return await ipcRenderer.invoke('create-terminal', { type, command });
  },

  /**
   * Obtener terminales disponibles
   */
  getAvailableTerminals: async () => {
    return await ipcRenderer.invoke('get-available-terminals');
  },

  /**
   * ════════════════════════════════════════════════════════════════════════════
   * MULTI-WINDOW MANAGEMENT - Gestión Multi-Ventana
   * ════════════════════════════════════════════════════════════════════════════
   */

  /**
   * Crear nueva ventana
   */
  createWindow: async (type = 'main', options = {}) => {
    return await ipcRenderer.invoke('create-window', { type, options });
  },

  /**
   * Obtener todas las ventanas
   */
  getWindows: async () => {
    return await ipcRenderer.invoke('get-windows');
  },

  /**
   * ════════════════════════════════════════════════════════════════════════════
   * LAZY LOADING - Carga Diferida de Módulos
   * ════════════════════════════════════════════════════════════════════════════
   */

  /**
   * Cargar módulo bajo demanda
   */
  loadLazyModule: async (moduleName) => {
    return await ipcRenderer.invoke('load-lazy-module', { moduleName });
  }
});

console.log('✅ Preload script cargado');

