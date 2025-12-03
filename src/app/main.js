/**
 * ════════════════════════════════════════════════════════════════════════════
 * QWEN-VALENCIA - ELECTRON MAIN PROCESS
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Aplicación Electron básica y limpia para Qwen + DeepSeek
 * Sin contaminación descriptiva - Solo ejecución real
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const express = require('express');
const os = require('os');
const ModelRouter = require('../orchestrator/model-router');
const MCPUniversal = require('../mcp/mcp-universal');
const OllamaMCPServer = require('../mcp/ollama-mcp-server');
const GroqAPIServer = require('../mcp/groq-api-server');
const variablesLoader = require('../utils/variables-loader');
const HeyGenTokenService = require('../services/heygen-token-service');
const { LoggerFactory } = require('../utils/logger');

// Inicializar logger estructurado
const logger = LoggerFactory.create({ service: 'electron-main' });

// Cargar variables desde qwen-valencia.env (archivo único, sin conflictos)
logger.info('Cargando variables desde qwen-valencia.env');
variablesLoader.load();

let mainWindow;
let mcpServer;
let modelRouter;
let ollamaMcpServer;
let groqApiServer;
let apiServer; // Aplicación Express para endpoints de API
let apiHttpServer; // Servidor HTTP (retornado por listen())
let heygenTokenService;
let conversationService; // Servicio de conversación
let deepgramService; // Instancia global de DeepgramService

/**
 * Verifica si un servidor está corriendo
 */
async function checkServerHealth(url, timeout = 3000) {
  try {
    const response = await axios.get(`${url}/health`, { timeout });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Inicia servidores dedicados si no están corriendo
 */
async function startDedicatedServers() {
  // Verificar Ollama MCP Server (puerto 6002)
  const ollamaRunning = await checkServerHealth('http://localhost:6002/ollama/health');
  if (!ollamaRunning) {
    try {
      logger.info('Iniciando Ollama MCP Server');
      ollamaMcpServer = new OllamaMCPServer();
      await ollamaMcpServer.start();
      logger.info('Ollama MCP Server iniciado exitosamente');
    } catch (error) {
      logger.warn('Ollama MCP Server no pudo iniciar', { error: error.message });
      logger.warn('Algunas funciones pueden no estar disponibles');
    }
  } else {
    logger.info('Ollama MCP Server ya está corriendo');
  }
  
  // Verificar Groq API Server (puerto 6003)
  const groqRunning = await checkServerHealth('http://localhost:6003/groq/health');
  if (!groqRunning) {
    try {
      logger.info('Iniciando Groq API Server');
      groqApiServer = new GroqAPIServer();
      await groqApiServer.start();
      logger.info('Groq API Server iniciado exitosamente');
    } catch (error) {
      logger.warn('Groq API Server no pudo iniciar', { error: error.message });
      logger.warn('Algunas funciones pueden no estar disponibles');
    }
  } else {
    logger.info('Groq API Server ya está corriendo');
  }
}

/**
 * Inicia el servidor MCP Universal
 */
async function startMCPServer() {
  try {
    mcpServer = new MCPUniversal();
    const started = await mcpServer.start();
    
    if (started) {
      logger.info('MCP Server iniciado exitosamente');
    } else {
      logger.warn('MCP Server no pudo iniciar (puerto ocupado)');
      logger.warn('La aplicación continuará, pero algunas funciones pueden no estar disponibles');
    }
  } catch (error) {
    logger.error('Error iniciando MCP Server', { error: error.message, stack: error.stack });
    logger.warn('La aplicación continuará, pero algunas funciones pueden no estar disponibles');
  }
}

/**
 * Crea la ventana principal
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png') // Opcional
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Abrir DevTools en desarrollo
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Inicializa el Model Router
 */
function initializeModelRouter() {
  // Obtener y limpiar API key de Groq
  let groqApiKey = variablesLoader.get('GROQ_API_KEY') || process.env.GROQ_API_KEY;
  if (groqApiKey) {
    // Limpiar API key: eliminar espacios, comillas, saltos de línea, caracteres de control
    groqApiKey = groqApiKey.trim().replace(/['"]/g, '').replace(/\s+/g, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    
    // Validar formato básico
    if (groqApiKey.length < 20) {
      logger.error('GROQ_API_KEY demasiado corta', { 
        length: groqApiKey.length, 
        preview: groqApiKey.substring(0, 20) 
      });
    } else if (!groqApiKey.startsWith('gsk_')) {
      logger.error('GROQ_API_KEY no tiene el formato correcto', { 
        preview: groqApiKey.substring(0, 10) 
      });
    } else {
      logger.info('API Key de Groq cargada y limpiada', { length: groqApiKey.length });
    }
  } else {
    logger.warn('GROQ_API_KEY no encontrada');
  }
  
  modelRouter = new ModelRouter({
    groqApiKey: groqApiKey,
    ollamaUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    mode: process.env.MODE || 'auto',
    mcpBaseUrl: `http://localhost:${process.env.MCP_PORT || 6000}`,
    mcpSecret: process.env.MCP_SECRET_KEY || 'qwen_valencia_mcp_secure_2025'
  });
  
  logger.info('Model Router inicializado');
}

/**
 * Inicia servidor Express para endpoints de API (HeyGen token, etc.)
 */
function startAPIServer() {
  try {
    apiServer = express();
    apiServer.use(express.json());
    
    // CORS para permitir requests desde el renderer
    apiServer.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // Inicializar HeyGen Token Service - DESHABILITADO
    // heygenTokenService = new HeyGenTokenService();
    heygenTokenService = null; // Deshabilitado temporalmente

    // Endpoint para obtener token de HeyGen - DESHABILITADO
    apiServer.post('/api/heygen/token', async (req, res) => {
      // HeyGen deshabilitado temporalmente
      res.status(503).json({
        success: false,
        error: 'HeyGen Avatar deshabilitado temporalmente'
      });
    });

    // Health check
    apiServer.get('/api/health', (req, res) => {
      res.json({ status: 'ok', service: 'qwen-valencia-api' });
    });

    const port = 3000; // Puerto para el servidor de API
    apiHttpServer = apiServer.listen(port, () => {
      logger.info('API Server escuchando', { port });
    });
  } catch (error) {
    logger.error('Error iniciando API Server', { error: error.message, stack: error.stack });
    logger.warn('Algunas funciones pueden no estar disponibles');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// IPC HANDLERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Handler para routing de mensajes
 */
ipcMain.handle('route-message', async (event, params) => {
  try {
    if (!modelRouter) {
      throw new Error('Model Router no inicializado');
    }
    
    // Compatibilidad con ambas firmas
    const text = params.text || params;
    const modality = params.modality || 'text';
    const attachments = params.attachments || [];
    const model = params.model;
    const useAPI = params.useAPI !== undefined ? params.useAPI : true;
    const options = params.options || {};
    
    // Si se especifica un modelo, agregarlo a options
    if (model) {
      options.model = model;
      options.useAPI = useAPI;
    }
    
    const result = await modelRouter.route(text, modality, attachments, options);
    return result;
  } catch (error) {
    logger.error('Error en route-message', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para ejecutar código
 */
ipcMain.handle('execute-code', async (event, { language, code }) => {
  try {
    if (!modelRouter) {
      throw new Error('Model Router no inicializado');
    }
    
    const result = await modelRouter.executeCode(language, code);
    return result;
  } catch (error) {
    logger.error('Error ejecutando código', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para leer archivo
 */
ipcMain.handle('read-file', async (event, { filePath }) => {
  try {
    if (!modelRouter) {
      throw new Error('Model Router no inicializado');
    }
    
    const result = await modelRouter.readFile(filePath);
    return result;
  } catch (error) {
    logger.error('Error leyendo archivo', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para listar archivos
 */
ipcMain.handle('list-files', async (event, { dirPath }) => {
  try {
    if (!modelRouter) {
      throw new Error('Model Router no inicializado');
    }
    
    const result = await modelRouter.listFiles(dirPath);
    return result;
  } catch (error) {
    logger.error('Error listando archivos', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para generar audio con Cartesia TTS
 */
ipcMain.handle('generate-speech', async (event, { text, options = {} }) => {
  try {
    const CartesiaService = require('../services/cartesia-service');
    const cartesia = new CartesiaService();
    
    const result = await cartesia.generateSpeech(text, {
      voiceId: process.env.CARTESIA_VOICE_ID || options.voiceId,
      speed: options.speed || 0.78,
      emotion: options.emotion || [{ id: 'warm', strength: 0.6 }]
    });
    
    if (result.success && result.audioBuffer) {
      // Convertir buffer a base64 para enviar al renderer
      return {
        success: true,
        audioBuffer: result.audioBuffer.buffer // ArrayBuffer para transferencia
      };
    }
    
    return {
      success: false,
      error: 'No se pudo generar audio'
    };
  } catch (error) {
    logger.error('Error generando speech', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para Cartesia TTS (compatible con app.js)
 */
ipcMain.handle('cartesia-tts', async (event, params) => {
  try {
    const CartesiaService = require('../services/cartesia-service');
    const cartesia = new CartesiaService();
    
    const text = params.text || '';
    const voiceId = params.voiceId || process.env.CARTESIA_VOICE_ID;
    
    const result = await cartesia.generateSpeech(text, {
      voiceId: voiceId,
      speed: 0.78,
      emotion: [{ id: 'warm', strength: 0.6 }]
    });
    
    if (result.success && result.audioBuffer) {
      // Convertir a base64
      const base64 = result.audioBuffer.toString('base64');
      return {
        success: true,
        audio: base64,
        format: 'wav'
      };
    }
    
    return {
      success: false,
      error: 'No se pudo generar audio'
    };
  } catch (error) {
    logger.error('Error en cartesia-tts', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para ejecutar código en laboratorio de IAs
 */
ipcMain.handle('execute-in-lab', async (event, { language, code, options = {} }) => {
  try {
    const AILab = require('../lab/ai-lab');
    const lab = new AILab();
    
    const result = await lab.executeCode(language, code, options);
    return result;
  } catch (error) {
    logger.error('Error ejecutando en laboratorio', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para transcribir audio
 */
ipcMain.handle('transcribe-audio', async (event, { audio, mimeType }) => {
  try {
    // Intentar usar Web Speech API si está disponible
    // Por ahora, retornar error para que el frontend use Web Speech API directamente
    return {
      success: false,
      error: 'Backend de transcripción no implementado. Usando Web Speech API.'
    };
  } catch (error) {
    logger.error('Error transcribiendo audio', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para transcribir audio con DeepGram
 */
ipcMain.handle('deepgram-transcribe', async (event, params) => {
  try {
    if (!deepgramService) {
      const DeepgramService = require('../services/deepgram-service');
      deepgramService = new DeepgramService();
    }
    
    const audio = params.audio;
    const mimeType = params.mimeType || 'audio/webm';
    
    // Convertir base64 a buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    
    const result = await deepgramService.transcribeBuffer(audioBuffer, mimeType);
    
    return {
      success: true,
      transcript: result.transcript || ''
    };
  } catch (error) {
    logger.error('Error en deepgram-transcribe', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para iniciar DeepGram Live Transcription
 */
ipcMain.handle('deepgram-start-live', async (event) => {
  try {
    if (!deepgramService) {
      const DeepgramService = require('../services/deepgram-service');
      deepgramService = new DeepgramService();
    }
    
    // Si ya hay una conexión activa, detenerla primero
    if (deepgramService.isConnected) {
      deepgramService.stopLiveTranscription();
    }
    
    // Iniciar transcripción en vivo (solo si está habilitado)
    if (!deepgramService.enabled) {
      return {
        success: false,
        error: 'Deepgram no está habilitado. Verifica DEEPGRAM_API_KEY en qwen-valencia.env'
      };
    }
    
    const result = await deepgramService.startLiveTranscription((data) => {
      if (mainWindow) {
        mainWindow.webContents.send('deepgram-transcript', data);
      }
    }, (error) => {
      if (mainWindow) {
        mainWindow.webContents.send('deepgram-error', error);
      }
    });
    
    return {
      success: true,
      connectionId: result.connectionId
    };
  } catch (error) {
    logger.error('Error iniciando DeepGram Live', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para detener DeepGram Live Transcription
 */
ipcMain.handle('deepgram-stop-live', async (event) => {
  try {
    if (deepgramService) {
      deepgramService.stopLiveTranscription();
    }
    
    return {
      success: true
    };
  } catch (error) {
    logger.error('Error deteniendo DeepGram Live', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para enviar audio a DeepGram Live
 */
ipcMain.handle('deepgram-send-audio', async (event, { audio }) => {
  try {
    if (!deepgramService) {
      return {
        success: false,
        error: 'DeepGram Live no está iniciado'
      };
    }
    
    if (!deepgramService.isConnected) {
      return {
        success: false,
        error: 'DeepGram Live no está conectado'
      };
    }
    
    // Convertir base64 a buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    
    // Usar el método sendAudio del servicio
    deepgramService.sendAudio(audioBuffer);
    
    return {
      success: true
    };
  } catch (error) {
    logger.error('Error enviando audio a DeepGram', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para iniciar conversación
 */
ipcMain.handle('start-conversation', async (event, { mode = 'text', userId = null }) => {
  try {
    if (!modelRouter) {
      throw new Error('Model Router no inicializado');
    }

    const ConversationService = require('../services/conversation-service');
    conversationService = new ConversationService(modelRouter);

    const result = await conversationService.startConversation({
      mode,
      userId,
      callbacks: {
        onTranscriptUpdate: (data) => {
          if (mainWindow) {
            mainWindow.webContents.send('conversation-transcript', data);
          }
        },
        onResponseReady: (data) => {
          if (mainWindow) {
            mainWindow.webContents.send('conversation-response', data);
          }
        },
        onSessionState: (state) => {
          if (mainWindow) {
            mainWindow.webContents.send('conversation-state', state);
          }
        },
        onError: (error) => {
          if (mainWindow) {
            mainWindow.webContents.send('conversation-error', { error: error.message });
          }
        }
      }
    });

    return result;
  } catch (error) {
    logger.error('Error iniciando conversación', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para detener conversación
 */
ipcMain.handle('stop-conversation', async (event) => {
  try {
    if (conversationService) {
      await conversationService.stopConversation();
      conversationService = null;
    }
    return { success: true };
  } catch (error) {
    logger.error('Error deteniendo conversación', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para enviar audio al stream de conversación
 */
ipcMain.handle('send-audio-to-conversation', async (event, { audioBuffer }) => {
  try {
    if (conversationService) {
      conversationService.sendAudio(Buffer.from(audioBuffer));
      return { success: true };
    }
    return {
      success: false,
      error: 'Conversación no activa'
    };
  } catch (error) {
    logger.error('Error enviando audio', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para iniciar sesión de HeyGen Avatar - DESHABILITADO
 */
ipcMain.handle('heygen-start-session', async (event) => {
  // HeyGen deshabilitado temporalmente
  return {
    success: false,
    error: 'HeyGen Avatar deshabilitado temporalmente'
  };
});

/**
 * Handler para detener sesión de HeyGen Avatar - DESHABILITADO
 */
ipcMain.handle('heygen-stop', async (event) => {
  return { success: false, error: 'HeyGen Avatar deshabilitado temporalmente' };
});

/**
 * Handler para interrumpir avatar de HeyGen - DESHABILITADO
 */
ipcMain.handle('heygen-interrupt', async (event) => {
  return { success: false, error: 'HeyGen Avatar deshabilitado temporalmente' };
});

/**
 * Handler para crear ventana flotante de avatar
 */
ipcMain.handle('create-floating-avatar-window', async (event, { videoSrc }) => {
  try {
    // Crear ventana flotante para avatar
    const { BrowserWindow } = require('electron');
    
    const avatarWindow = new BrowserWindow({
      width: 400,
      height: 600,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    avatarWindow.loadURL(`data:text/html,<html><body style="margin:0;background:transparent;"><video src="${videoSrc}" autoplay playsinline style="width:100%;height:100%;object-fit:contain;"></video></body></html>`);
    
    return {
      success: true,
      windowId: avatarWindow.id
    };
  } catch (error) {
    logger.error('Error creando ventana flotante', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para iniciar MCP Master Server
 */
ipcMain.handle('start-mcp-master', async (event) => {
  try {
    if (mcpServer) {
      return {
        success: true,
        message: 'MCP Server ya está corriendo'
      };
    }
    
    await startMCPServer();
    
    return {
      success: true,
      message: 'MCP Server iniciado'
    };
  } catch (error) {
    logger.error('Error iniciando MCP Master', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para detener MCP Master Server
 */
ipcMain.handle('stop-mcp-master', async (event) => {
  try {
    if (mcpServer && mcpServer.server) {
      mcpServer.server.close();
      mcpServer = null;
    }
    
    return {
      success: true,
      message: 'MCP Server detenido'
    };
  } catch (error) {
    logger.error('Error deteniendo MCP Master', { error: error.message, stack: error.stack });
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Handler para obtener estado de MCP Master Server
 */
ipcMain.handle('get-mcp-master-status', async (event) => {
  try {
    return {
      running: mcpServer !== null && mcpServer.server !== null,
      port: mcpServer ? mcpServer.port : null
    };
  } catch (error) {
    logger.error('Error obteniendo estado MCP', { error: error.message, stack: error.stack });
    return {
      running: false,
      error: error.message
    };
  }
});

/**
 * Handler para obtener memoria del sistema (RAM real)
 */
ipcMain.handle('get-system-memory', async (event) => {
  try {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = totalBytes - freeBytes;
    
    return {
      total: totalBytes / (1024 * 1024), // MB
      free: freeBytes / (1024 * 1024),   // MB
      used: usedBytes / (1024 * 1024),   // MB
      available: freeBytes / (1024 * 1024), // MB (alias de free)
      percentage: (usedBytes / totalBytes) * 100
    };
  } catch (error) {
    logger.error('Error obteniendo memoria del sistema', { error: error.message, stack: error.stack });
    return null;
  }
});

/**
 * Handlers para controles de ventana
 */
ipcMain.on('window-minimize', (event) => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('window-maximize', (event) => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', (event) => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// ════════════════════════════════════════════════════════════════════════════
// APP LIFECYCLE
// ════════════════════════════════════════════════════════════════════════════

app.whenReady().then(async () => {
  // Iniciar servidor de API (para endpoints como HeyGen token)
  startAPIServer();
  
  // Iniciar servidores dedicados primero
  await startDedicatedServers();
  
  // Iniciar MCP Server
  startMCPServer();
  
  // Inicializar Model Router
  initializeModelRouter();
  
  // Crear ventana
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Cerrar servidores si es necesario
  if (apiHttpServer) {
    apiHttpServer.close(() => {
      logger.info('API Server cerrado');
    });
  }
  if (mcpServer && mcpServer.server) {
    mcpServer.server.close();
  }
  if (ollamaMcpServer) {
    ollamaMcpServer.stop();
  }
  if (groqApiServer) {
    groqApiServer.stop();
  }
});

