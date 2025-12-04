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

const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const express = require('express');
const os = require('os');
const Store = require('electron-store');
const ModelRouter = require('../orchestrator/model-router');
const MCPUniversal = require('../mcp/mcp-universal');
const OllamaMCPServer = require('../mcp/ollama-mcp-server');
const GroqAPIServer = require('../mcp/groq-api-server');
const SandraIAMCPServer = require('../mcp/sandra-ia-mcp-server');
const variablesLoader = require('../utils/variables-loader');
const HeyGenTokenService = require('../services/heygen-token-service');
const { LoggerFactory } = require('../utils/logger');
const { MetricsFactory, globalMetrics } = require('../utils/metrics');
const { validateIPC } = require('./ipc-validator');
const { initializeTray, updateTrayMenu, showNotification, destroyTray } = require('./tray');
const { configureUpdater, startAutoUpdateCheck, checkForUpdates } = require('./updater');
const terminalManager = require('./terminal');
const { globalServiceRegistry } = require('../services/service-registry');
const { globalHealthAggregator } = require('../services/health-aggregator');
const { globalTracer } = require('../services/distributed-tracing');
const { getServiceReconnectionManager } = require('../services/service-reconnection');

// Inicializar logger estructurado
const logger = LoggerFactory.create({ service: 'electron-main' });

// Inicializar métricas
const metrics = MetricsFactory.create({ service: 'electron-main' });

// Cargar variables desde qwen-valencia.env (archivo único, sin conflictos)
logger.info('Cargando variables desde qwen-valencia.env');
variablesLoader.load();

// Store para persistencia de estado
const store = new Store({
  name: 'qwen-valencia-config',
  defaults: {
    windowBounds: { width: 1200, height: 800, x: undefined, y: undefined },
    windowMaximized: false
  }
});

let mainWindow;
const windows = new Map(); // Gestión multi-ventana
let mcpServer;
let modelRouter;
let ollamaMcpServer;
let groqApiServer;
let sandraIaMcpServer;
let apiServer; // Aplicación Express para endpoints de API
let apiHttpServer; // Servidor HTTP (retornado por listen())
let heygenTokenService;
let conversationService; // Servicio de conversación
let deepgramService; // Instancia global de DeepgramService
let tray = null;

// Módulos cargados bajo demanda (lazy loading)
const lazyModules = {
  mcpServer: null,
  ollamaMcpServer: null,
  groqApiServer: null,
  sandraIaMcpServer: null,
  conversationService: null,
  deepgramService: null
};

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
 * Inicia servidores dedicados si no están corriendo (lazy loading)
 */
async function startDedicatedServers(lazy = false) {
  // Si es lazy loading, solo verificar, no iniciar automáticamente
  if (lazy) {
    const ollamaRunning = await checkServerHealth('http://localhost:6002/ollama/health');
    const groqRunning = await checkServerHealth('http://localhost:6003/groq/health');
    const sandraRunning = await checkServerHealth('http://localhost:6004/health');
    return { ollamaRunning, groqRunning, sandraRunning };
  }

  // Verificar Ollama MCP Server (puerto 6002)
  const ollamaRunning = await checkServerHealth('http://localhost:6002/ollama/health');
  if (!ollamaRunning) {
    try {
      logger.info('Iniciando Ollama MCP Server');
      ollamaMcpServer = new OllamaMCPServer();
      await ollamaMcpServer.start();
      logger.info('Ollama MCP Server iniciado exitosamente');

      // Registrar servicio en service registry
      globalServiceRegistry.register({
        name: 'ollama-mcp-server',
        version: '1.0.0',
        host: 'localhost',
        port: 6002,
        protocol: 'http',
        healthEndpoint: '/ollama/health',
        metadata: {
          type: 'mcp-server',
          provider: 'ollama',
          capabilities: ['local-models', 'streaming']
        },
        tags: ['mcp', 'ollama', 'local']
      });
    } catch (error) {
      logger.warn('Ollama MCP Server no pudo iniciar', { error: error.message });
      logger.warn('Algunas funciones pueden no estar disponibles');
    }
  } else {
    logger.info('Ollama MCP Server ya está corriendo');

    // Registrar servicio existente
    globalServiceRegistry.register({
      name: 'ollama-mcp-server',
      version: '1.0.0',
      host: 'localhost',
      port: 6002,
      protocol: 'http',
      healthEndpoint: '/ollama/health',
      metadata: {
        type: 'mcp-server',
        provider: 'ollama',
        capabilities: ['local-models', 'streaming']
      },
      tags: ['mcp', 'ollama', 'local']
    });
  }

  // Verificar Groq API Server (puerto 6003)
  const groqRunning = await checkServerHealth('http://localhost:6003/groq/health');
  if (!groqRunning) {
    try {
      logger.info('Iniciando Groq API Server');
      groqApiServer = new GroqAPIServer();
      await groqApiServer.start();
      logger.info('Groq API Server iniciado exitosamente');

      // Registrar servicio en service registry
      globalServiceRegistry.register({
        name: 'groq-api-server',
        version: '1.0.0',
        host: 'localhost',
        port: 6003,
        protocol: 'http',
        healthEndpoint: '/groq/health',
        metadata: {
          type: 'api-server',
          provider: 'groq',
          capabilities: ['qwen-models', 'deepseek-models', 'api-keys-rotation']
        },
        tags: ['api', 'groq', 'cloud']
      });
    } catch (error) {
      logger.warn('Groq API Server no pudo iniciar', { error: error.message });
      logger.warn('Algunas funciones pueden no estar disponibles');
    }
  } else {
    logger.info('Groq API Server ya está corriendo');

    // Registrar servicio existente
    globalServiceRegistry.register({
      name: 'groq-api-server',
      version: '1.0.0',
      host: 'localhost',
      port: 6003,
      protocol: 'http',
      healthEndpoint: '/groq/health',
      metadata: {
        type: 'api-server',
        provider: 'groq',
        capabilities: ['qwen-models', 'deepseek-models', 'api-keys-rotation']
      },
      tags: ['api', 'groq', 'cloud']
    });
  }

  // Verificar Sandra IA MCP Server (puerto 6004)
  const sandraRunning = await checkServerHealth('http://localhost:6004/health');
  if (!sandraRunning) {
    try {
      logger.info('Iniciando Sandra IA MCP Server');
      sandraIaMcpServer = new SandraIAMCPServer();
      await sandraIaMcpServer.start();
      logger.info('Sandra IA MCP Server iniciado exitosamente');

      // Registrar servicio en service registry
      globalServiceRegistry.register({
        name: 'sandra-ia-mcp-server',
        version: '8.0.0',
        host: 'localhost',
        port: 6004,
        protocol: 'http',
        healthEndpoint: '/health',
        metadata: {
          type: 'mcp-server',
          provider: 'sandra-ia',
          capabilities: ['orchestration', 'multimodal', 'subagents']
        },
        tags: ['mcp', 'sandra', 'orchestration']
      });
    } catch (error) {
      logger.warn('Sandra IA MCP Server no pudo iniciar', { error: error.message });
      logger.warn('Sandra IA no estará disponible, pero la aplicación continuará');
    }
  } else {
    logger.info('Sandra IA MCP Server ya está corriendo');

    // Registrar servicio existente
    globalServiceRegistry.register({
      name: 'sandra-ia-mcp-server',
      version: '8.0.0',
      host: 'localhost',
      port: 6004,
      protocol: 'http',
      healthEndpoint: '/health',
      metadata: {
        type: 'mcp-server',
        provider: 'sandra-ia',
        capabilities: ['orchestration', 'multimodal', 'subagents']
      },
      tags: ['mcp', 'sandra', 'orchestration']
    });
  }
}

/**
 * Inicia el servidor MCP Universal con mejor manejo de puertos
 */
async function startMCPServer() {
  try {
    // Asegurar que el puerto esté disponible
    const port = await ensureMCPServerPort();

    mcpServer = new MCPUniversal();
    const started = await mcpServer.start();

    if (started) {
      logger.info('MCP Server iniciado exitosamente', { port });

      // Registrar servicio en service registry
      globalServiceRegistry.register({
        name: 'mcp-universal',
        version: '1.0.0',
        host: 'localhost',
        port,
        protocol: 'http',
        healthEndpoint: '/health',
        metadata: {
          type: 'mcp-server',
          capabilities: ['execute_code', 'read_file', 'write_file', 'list_files', 'execute_command']
        },
        tags: ['mcp', 'universal', 'core']
      });
    } else {
      logger.warn('MCP Server no pudo iniciar (puerto ocupado)');
      logger.warn('La aplicación continuará, pero algunas funciones pueden no estar disponibles');

      // Intentar con puerto alternativo
      const altPort = await findAvailablePort(port + 1);
      if (altPort) {
        logger.info(`Intentando iniciar MCP Server en puerto alternativo ${altPort}`);
        process.env.MCP_PORT = altPort.toString();
        // No reintentar automáticamente para evitar loops infinitos
      }
    }
  } catch (error) {
    logger.error('Error iniciando MCP Server', { error: error.message, stack: error.stack });
    logger.warn('La aplicación continuará, pero algunas funciones pueden no estar disponibles');
  }
}

/**
 * Crea la ventana principal con persistencia de estado
 */
function createWindow() {
  // Restaurar posición y tamaño guardados
  const windowBounds = store.get('windowBounds');
  const wasMaximized = store.get('windowMaximized');

  mainWindow = new BrowserWindow({
    width: windowBounds.width || 1200,
    height: windowBounds.height || 800,
    x: windowBounds.x,
    y: windowBounds.y,
    frame: false, // Eliminar barra nativa de Windows (usamos titlebar custom)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: false // Necesario para algunas funcionalidades
    },
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    show: false // No mostrar hasta que esté listo
  });

  // Restaurar maximizado si estaba maximizado
  if (wasMaximized) {
    mainWindow.maximize();
  }

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Mostrar ventana cuando esté lista
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Enfocar la ventana
    if (process.platform === 'darwin') {
      app.dock.show();
    }
  });

  // Guardar posición y tamaño cuando cambien
  mainWindow.on('moved', () => {
    if (!mainWindow.isMaximized()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  });

  mainWindow.on('resized', () => {
    if (!mainWindow.isMaximized()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
    store.set('windowMaximized', mainWindow.isMaximized());
  });

  mainWindow.on('maximize', () => {
    store.set('windowMaximized', true);
  });

  mainWindow.on('unmaximize', () => {
    store.set('windowMaximized', false);
    store.set('windowBounds', mainWindow.getBounds());
  });

  // Abrir DevTools en desarrollo
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevenir cierre si hay trabajo pendiente (opcional)
  mainWindow.on('close', event => {
    // En macOS, mantener la app corriendo aunque se cierre la ventana
    if (process.platform === 'darwin') {
      if (!app.isQuiting) {
        event.preventDefault();
        mainWindow.hide();
        return;
      }
    }
  });
}

/**
 * Crea menús nativos del OS
 */
function createApplicationMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Nueva Conversación',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-new-chat');
            }
          }
        },
        {
          label: 'Abrir...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-open-chat');
            }
          }
        },
        {
          label: 'Guardar',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-save-chat');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exportar...',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-export-chat');
            }
          }
        },
        { type: 'separator' },
        {
          label: process.platform === 'darwin' ? 'Salir' : 'Cerrar',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        {
          label: 'Alternar Tema',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-toggle-theme');
            }
          }
        },
        {
          label: 'Mostrar/Ocultar Sidebar',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-toggle-sidebar');
            }
          }
        },
        { type: 'separator' },
        { role: 'reload', label: 'Recargar' },
        { role: 'forceReload', label: 'Forzar Recarga' },
        { role: 'toggleDevTools', label: 'Herramientas de Desarrollador' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom Normal' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla Completa' }
      ]
    },
    {
      label: 'Ejecutar',
      submenu: [
        {
          label: 'Ejecutar Código',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-execute-code');
            }
          }
        },
        {
          label: 'Ejecutar Comando',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-execute-command');
            }
          }
        }
      ]
    },
    {
      label: 'Terminal',
      submenu: [
        {
          label: 'Abrir Terminal',
          submenu: [
            {
              label: 'Bash',
              click: () => {
                terminalManager.createTerminalWindow('bash');
              }
            },
            {
              label: 'PowerShell',
              click: () => {
                terminalManager.createTerminalWindow('powershell');
              }
            },
            {
              label: 'CMD',
              click: () => {
                terminalManager.createTerminalWindow('cmd');
              }
            },
            {
              label: 'Node.js REPL',
              click: () => {
                terminalManager.createTerminalWindow('node');
              }
            },
            { type: 'separator' },
            {
              label: 'Auto (Mejor para sistema)',
              accelerator: 'CmdOrCtrl+Shift+T',
              click: () => {
                terminalManager.createTerminalWindow('auto');
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Cerrar Todas las Terminales',
          click: () => {
            terminalManager.closeAllTerminals();
          }
        }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de Qwen-Valencia',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-show-about');
            }
          }
        },
        {
          label: 'Verificar Actualizaciones',
          click: async () => {
            try {
              await checkForUpdates();
              showNotification('Actualizaciones', 'Verificando actualizaciones...');
            } catch (error) {
              logger.error('Error verificando actualizaciones', { error: error.message });
            }
          }
        }
      ]
    }
  ];

  // macOS: Agregar menú de aplicación
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about', label: `Acerca de ${app.getName()}` },
        { type: 'separator' },
        { role: 'services', label: 'Servicios' },
        { type: 'separator' },
        { role: 'hide', label: `Ocultar ${app.getName()}` },
        { role: 'hideOthers', label: 'Ocultar Otros' },
        { role: 'unhide', label: 'Mostrar Todo' },
        { type: 'separator' },
        { role: 'quit', label: `Salir de ${app.getName()}` }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  logger.info('Menús nativos creados');
}

/**
 * Mejora la detección y manejo de puertos ocupados
 */
async function findAvailablePort(startPort, maxAttempts = 10) {
  const net = require('net');

  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    const available = await new Promise(resolve => {
      const server = net.createServer();
      server.listen(port, () => {
        server.once('close', () => resolve(true));
        server.close();
      });
      server.on('error', () => resolve(false));
    });

    if (available) {
      return port;
    }
  }

  return null;
}

/**
 * Verifica y corrige puerto MCP
 */
async function ensureMCPServerPort() {
  const configuredPort = parseInt(process.env.MCP_PORT || '6000', 10);

  // Verificar si el puerto está ocupado
  const availablePort = await findAvailablePort(configuredPort);

  if (availablePort !== configuredPort) {
    logger.warn(`Puerto MCP ${configuredPort} ocupado, usando puerto ${availablePort}`);
    process.env.MCP_PORT = availablePort.toString();
  }

  return availablePort || configuredPort;
}

/**
 * Inicializa el Model Router
 */
function initializeModelRouter() {
  // Obtener y limpiar API key de Groq
  let groqApiKey = variablesLoader.get('GROQ_API_KEY') || process.env.GROQ_API_KEY;
  if (groqApiKey) {
    // Limpiar API key: eliminar espacios, comillas, saltos de línea, caracteres de control
    // Remover caracteres de control sin usar regex con control chars (para evitar error ESLint)
    groqApiKey = groqApiKey.trim().replace(/['"]/g, '').replace(/\s+/g, '');
    // Filtrar caracteres de control (0x00-0x1F y 0x7F-0x9F) sin usar regex
    groqApiKey = groqApiKey
      .split('')
      .filter(char => {
        const code = char.charCodeAt(0);
        return !((code >= 0 && code <= 31) || (code >= 127 && code <= 159));
      })
      .join('');

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
    groqApiKey,
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

    // CORS mejorado - Enterprise Level (solo permitir orígenes específicos)
    const allowedOrigins =
      process.env.NODE_ENV === 'development' ? ['http://localhost:*', 'file://*'] : ['file://*'];

    apiServer.use((req, res, next) => {
      const origin = req.headers.origin;
      // En desarrollo, permitir localhost; en producción solo file://
      if (process.env.NODE_ENV === 'development' || !origin || origin.startsWith('file://')) {
        res.header('Access-Control-Allow-Origin', origin || '*');
      } else {
        res.header('Access-Control-Allow-Origin', 'file://');
      }
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Credentials', 'true');
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

    // API Gateway - Service Registry endpoints
    apiServer.get('/api/services', (req, res) => {
      const stats = globalServiceRegistry.getStats();
      res.json(stats);
    });

    apiServer.get('/api/services/:name', (req, res) => {
      const { name } = req.params;
      const services = globalServiceRegistry.getServices(name, { healthyOnly: false });
      if (services.length === 0) {
        return res.status(404).json({ error: `Servicio ${name} no encontrado` });
      }
      res.json(services);
    });

    // API Gateway - Health Aggregator endpoints
    apiServer.get('/api/health/aggregated', async (req, res) => {
      const health = await globalHealthAggregator.aggregateHealth();
      res.json(health);
    });

    apiServer.get('/api/health/services', (req, res) => {
      const health = globalHealthAggregator.getAggregatedHealth();
      res.json(health);
    });

    // API Gateway - Distributed Tracing endpoints
    apiServer.get('/api/tracing/stats', (req, res) => {
      const stats = globalTracer.getStats();
      res.json(stats);
    });

    apiServer.get('/api/tracing/spans', (req, res) => {
      const limit = parseInt(req.query.limit || '100', 10);
      const spans = globalTracer.getCompletedSpans(limit);
      res.json(spans);
    });

    // API Gateway - Endpoint agregado (modelo + estado + health en una llamada)
    apiServer.get('/api/v1/aggregated', async (req, res) => {
      try {
        const startTime = Date.now();

        // Obtener todos los datos en paralelo
        const [servicesStats, healthData, tracerStats] = await Promise.all([
          Promise.resolve(globalServiceRegistry.getStats()),
          globalHealthAggregator.aggregateHealth(),
          Promise.resolve(globalTracer.getStats())
        ]);

        const duration = Date.now() - startTime;

        // Respuesta agregada
        const aggregated = {
          success: true,
          timestamp: new Date().toISOString(),
          duration,
          data: {
            services: servicesStats,
            health: healthData,
            tracing: tracerStats
          }
        };

        res.json(aggregated);
      } catch (error) {
        logger.error('Error en endpoint agregado', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    const port = 3000; // Puerto para el servidor de API
    apiHttpServer = apiServer.listen(port, () => {
      logger.info('API Server escuchando', { port });

      // Registrar API Server en service registry
      globalServiceRegistry.register({
        name: 'qwen-valencia-api',
        version: '1.0.0',
        host: 'localhost',
        port,
        protocol: 'http',
        healthEndpoint: '/api/health',
        metadata: {
          type: 'api-gateway',
          capabilities: ['heygen-token', 'service-registry', 'health-aggregation', 'tracing']
        },
        tags: ['api', 'gateway', 'core']
      });
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
 * Handler para routing de mensajes (con validación IPC)
 */
ipcMain.handle(
  'route-message',
  validateIPC('route-message', async (event, params) => {
    const startTime = Date.now();
    const model = params.model || params.options?.model || 'unknown';
    const useAPI = params.useAPI !== undefined ? params.useAPI : true;

    try {
      if (!modelRouter) {
        throw new Error('Model Router no inicializado');
      }

      // Compatibilidad con ambas firmas
      const text = params.text || params;
      const modality = params.modality || 'text';
      const attachments = params.attachments || [];
      const options = params.options || {};

      // Si se especifica un modelo, agregarlo a options
      if (model) {
        options.model = model;
        options.useAPI = useAPI;
      }

      const result = await modelRouter.route(text, modality, attachments, options);

      // Registrar métricas de éxito
      const duration = Date.now() - startTime;
      metrics.increment('route_message_success', { model, useAPI: useAPI.toString(), modality });
      metrics.observe('route_message_duration_ms', { model, useAPI: useAPI.toString() }, duration);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Error en route-message', { error: error.message, stack: error.stack });

      // Registrar métricas de error
      metrics.increment('route_message_errors', { model, useAPI: useAPI.toString() });
      metrics.observe('route_message_error_duration_ms', { model }, duration);

      return {
        success: false,
        error: error.message
      };
    }
  })
);

/**
 * Handler para ejecutar código (con validación IPC)
 */
ipcMain.handle(
  'execute-code',
  validateIPC('execute-code', async (event, { language, code }) => {
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
  })
);

/**
 * Handler para leer archivo (con validación IPC)
 */
ipcMain.handle(
  'read-file',
  validateIPC('read-file', async (event, { filePath }) => {
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
  })
);

/**
 * Handler para listar archivos (con validación IPC)
 */
ipcMain.handle(
  'list-files',
  validateIPC('list-files', async (event, { dirPath }) => {
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
  })
);

/**
 * Handler para generar audio con Cartesia TTS (con validación IPC)
 */
ipcMain.handle(
  'generate-speech',
  validateIPC('generate-speech', async (event, { text, options = {} }) => {
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
  })
);

/**
 * Handler para Cartesia TTS (compatible con app.js) (con validación IPC)
 */
ipcMain.handle(
  'cartesia-tts',
  validateIPC('cartesia-tts', async (event, params) => {
    try {
      const CartesiaService = require('../services/cartesia-service');
      const cartesia = new CartesiaService();

      const text = params.text || '';
      const voiceId = params.voiceId || process.env.CARTESIA_VOICE_ID;

      const result = await cartesia.generateSpeech(text, {
        voiceId,
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
  })
);

/**
 * Handler para ejecutar código en laboratorio de IAs (con validación IPC)
 */
ipcMain.handle(
  'execute-in-lab',
  validateIPC('execute-in-lab', async (event, { language, code, options = {} }) => {
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
  })
);

/**
 * Handler para transcribir audio (con validación IPC)
 */
ipcMain.handle(
  'transcribe-audio',
  validateIPC('transcribe-audio', async (event, { audio, mimeType }) => {
    // Intentar usar Web Speech API si está disponible
    // Por ahora, retornar error para que el frontend use Web Speech API directamente
    return {
      success: false,
      error: 'Backend de transcripción no implementado. Usando Web Speech API.'
    };
  })
);

/**
 * Handler para transcribir audio con DeepGram
 */
ipcMain.handle(
  'deepgram-transcribe',
  validateIPC('deepgram-transcribe', async (event, params) => {
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
  })
);

/**
 * Handler para iniciar DeepGram Live Transcription
 */
ipcMain.handle(
  'deepgram-start-live',
  validateIPC('deepgram-start-live', async event => {
    try {
      // Lazy loading de deepgramService
      if (!deepgramService) {
        await loadLazyModule('deepgramService');
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

      const result = await deepgramService.startLiveTranscription(
        data => {
          if (mainWindow) {
            mainWindow.webContents.send('deepgram-transcript', data);
          }
        },
        error => {
          if (mainWindow) {
            mainWindow.webContents.send('deepgram-error', error);
          }
        }
      );

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
  })
);

/**
 * Handler para detener DeepGram Live Transcription
 */
ipcMain.handle(
  'deepgram-stop-live',
  validateIPC('deepgram-stop-live', async event => {
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
  })
);

/**
 * Handler para enviar audio a DeepGram Live
 */
ipcMain.handle(
  'deepgram-send-audio',
  validateIPC('deepgram-send-audio', async (event, { audio }) => {
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
  })
);

/**
 * Handler para iniciar conversación
 */
ipcMain.handle(
  'start-conversation',
  validateIPC('start-conversation', async (event, { mode = 'text', userId = null }) => {
    try {
      if (!modelRouter) {
        throw new Error('Model Router no inicializado');
      }

      // Lazy loading de conversationService
      if (!conversationService) {
        await loadLazyModule('conversationService');
      }

      const result = await conversationService.startConversation({
        mode,
        userId,
        callbacks: {
          onTranscriptUpdate: data => {
            if (mainWindow) {
              mainWindow.webContents.send('conversation-transcript', data);
            }
          },
          onResponseReady: data => {
            if (mainWindow) {
              mainWindow.webContents.send('conversation-response', data);
            }
          },
          onSessionState: state => {
            if (mainWindow) {
              mainWindow.webContents.send('conversation-state', state);
            }
          },
          onError: error => {
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
  })
);

/**
 * Handler para detener conversación (con validación IPC)
 */
ipcMain.handle(
  'stop-conversation',
  validateIPC('stop-conversation', async event => {
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
  })
);

/**
 * Handler para enviar audio al stream de conversación (con validación IPC)
 */
ipcMain.handle(
  'send-audio-to-conversation',
  validateIPC('send-audio-to-conversation', async (event, { audioBuffer }) => {
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
  })
);

/**
 * Handler para iniciar sesión de HeyGen Avatar - DESHABILITADO
 */
ipcMain.handle(
  'heygen-start-session',
  validateIPC('heygen-start-session', async event => {
    // HeyGen deshabilitado temporalmente
    return {
      success: false,
      error: 'HeyGen Avatar deshabilitado temporalmente'
    };
  })
);

/**
 * Handler para detener sesión de HeyGen Avatar - DESHABILITADO
 */
ipcMain.handle(
  'heygen-stop',
  validateIPC('heygen-stop', async event => {
    return { success: false, error: 'HeyGen Avatar deshabilitado temporalmente' };
  })
);

/**
 * Handler para interrumpir avatar de HeyGen - DESHABILITADO
 */
ipcMain.handle(
  'heygen-interrupt',
  validateIPC('heygen-interrupt', async event => {
    return { success: false, error: 'HeyGen Avatar deshabilitado temporalmente' };
  })
);

/**
 * Handler para crear ventana flotante de avatar
 */
ipcMain.handle(
  'create-floating-avatar-window',
  validateIPC('create-floating-avatar-window', async (event, { videoSrc }) => {
    try {
      // Validar videoSrc para prevenir XSS
      if (!videoSrc || typeof videoSrc !== 'string') {
        throw new Error('videoSrc debe ser una cadena válida');
      }

      // Sanitizar videoSrc (solo permitir URLs data: o http/https)
      if (
        !videoSrc.startsWith('data:') &&
        !videoSrc.startsWith('http://') &&
        !videoSrc.startsWith('https://')
      ) {
        throw new Error('videoSrc debe ser una URL válida');
      }

      // FIX: Validar patrones peligrosos ANTES de crear la ventana
      // Esto previene que se creen ventanas huérfanas si la validación falla
      const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i, // Event handlers como onclick, onerror, etc.
        /<iframe/i,
        /<object/i,
        /<embed/i,
        /data:text\/html/i, // Prevenir data URLs anidadas
        /vbscript:/i
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(videoSrc)) {
          throw new Error('videoSrc contiene contenido peligroso');
        }
      }

      // Crear ventana flotante para avatar (solo después de todas las validaciones)
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
      
      // FIX: Construir el HTML de forma segura sin doble encoding
      // Escapar comillas simples en videoSrc para prevenir inyección en atributo HTML
      // Luego codificar TODO el HTML con encodeURIComponent (incluyendo el videoSrc escapado)
      // Esto evita doble encoding: primero escapamos comillas, luego codificamos todo el HTML
      const escapedVideoSrc = videoSrc.replace(/'/g, '&#039;');
      
      const htmlContent = 
        '<html><body style="margin:0;background:transparent;">' +
        `<video src='${escapedVideoSrc}' autoplay playsinline ` +
        'style="width:100%;height:100%;object-fit:contain;"></video>' +
        '</body></html>';
      
      // FIX: Agregar charset=UTF-8 al data URL como requiere Electron
      // Codificar TODO el HTML (incluyendo el videoSrc) con encodeURIComponent
      // Esto codifica el videoSrc una sola vez, evitando doble encoding
      const safeHTML = `data:text/html;charset=UTF-8,${encodeURIComponent(htmlContent)}`;
      
      avatarWindow.loadURL(safeHTML);

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
  })
);

/**
 * Handler para iniciar MCP Master Server
 */
ipcMain.handle(
  'start-mcp-master',
  validateIPC('start-mcp-master', async event => {
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
  })
);

/**
 * Handler para detener MCP Master Server
 */
ipcMain.handle(
  'stop-mcp-master',
  validateIPC('stop-mcp-master', async event => {
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
  })
);

/**
 * Handler para obtener estado de MCP Master Server
 */
ipcMain.handle(
  'get-mcp-master-status',
  validateIPC('get-mcp-master-status', async event => {
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
  })
);

/**
 * Handler para obtener memoria del sistema (RAM real)
 */
ipcMain.handle(
  'get-system-memory',
  validateIPC('get-system-memory', async event => {
    const startTime = Date.now();
    try {
      const totalBytes = os.totalmem();
      const freeBytes = os.freemem();
      const usedBytes = totalBytes - freeBytes;

      const memoryInfo = {
        total: totalBytes / (1024 * 1024), // MB
        free: freeBytes / (1024 * 1024), // MB
        used: usedBytes / (1024 * 1024), // MB
        available: freeBytes / (1024 * 1024), // MB (alias de free)
        percentage: (usedBytes / totalBytes) * 100
      };

      // Registrar métrica
      metrics.observe('system_memory_used_mb', {}, memoryInfo.used);
      metrics.observe('system_memory_percentage', {}, memoryInfo.percentage);
      metrics.increment('system_memory_requests', {});

      return memoryInfo;
    } catch (error) {
      logger.error('Error obteniendo memoria del sistema', {
        error: error.message,
        stack: error.stack
      });
      metrics.increment('system_memory_errors', {});
      return null;
    } finally {
      const duration = Date.now() - startTime;
      metrics.observe('system_memory_request_duration_ms', {}, duration);
    }
  })
);

/**
 * Handler para obtener métricas de performance
 */
ipcMain.handle(
  'get-performance-metrics',
  validateIPC('get-performance-metrics', async event => {
    try {
      const metricsData = {
        counters: {},
        gauges: {},
        histograms: {},
        uptime: (Date.now() - metrics.startTime) / 1000,
        timestamp: Date.now()
      };

      // Obtener métricas del collector global
      const jsonMetrics = globalMetrics.getJSONFormat();
      return {
        success: true,
        metrics: jsonMetrics,
        prometheus: globalMetrics.getPrometheusFormat()
      };
    } catch (error) {
      logger.error('Error obteniendo métricas de performance', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  })
);

// ════════════════════════════════════════════════════════════════════════════
// STATE SYNCHRONIZATION - Sincronización de Estado Frontend-Backend
// ════════════════════════════════════════════════════════════════════════════

// Estado compartido entre frontend y backend
let sharedState = {
  model: null,
  useAPI: true,
  mode: 'auto',
  lastUpdate: Date.now(),
  version: '1.0.0'
};

/**
 * Handler para obtener estado compartido desde el backend
 */
ipcMain.handle(
  'get-shared-state',
  validateIPC('get-shared-state', async event => {
    try {
      return {
        success: true,
        state: { ...sharedState },
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('Error obteniendo estado compartido', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  })
);

/**
 * Handler para actualizar estado compartido desde el frontend
 */
ipcMain.handle(
  'update-shared-state',
  validateIPC('update-shared-state', async (event, updates) => {
    try {
      if (!updates || typeof updates !== 'object') {
        throw new Error('Updates debe ser un objeto');
      }

      // Actualizar estado compartido
      sharedState = {
        ...sharedState,
        ...updates,
        lastUpdate: Date.now()
      };

      // Notificar a otros procesos si es necesario
      if (mainWindow) {
        mainWindow.webContents.send('shared-state-updated', sharedState);
      }

      logger.debug('Estado compartido actualizado', { updates, state: sharedState });

      return {
        success: true,
        state: { ...sharedState }
      };
    } catch (error) {
      logger.error('Error actualizando estado compartido', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  })
);

/**
 * Handler para sincronizar estado completo (bidireccional)
 */
ipcMain.handle(
  'sync-state',
  validateIPC('sync-state', async (event, frontendState) => {
    try {
      // Merge inteligente: backend tiene prioridad para ciertos campos
      const mergedState = {
        ...frontendState,
        ...sharedState,
        // Mantener valores del backend para campos críticos
        model: sharedState.model || frontendState?.model,
        useAPI: sharedState.useAPI !== undefined ? sharedState.useAPI : frontendState?.useAPI,
        lastUpdate: Date.now()
      };

      // Actualizar estado compartido
      sharedState = mergedState;

      // Notificar al frontend
      if (mainWindow) {
        mainWindow.webContents.send('state-synced', mergedState);
      }

      return {
        success: true,
        state: { ...mergedState }
      };
    } catch (error) {
      logger.error('Error sincronizando estado', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  })
);

/**
 * Listener para cambios de estado desde el frontend
 */
ipcMain.on('state-changed', (event, stateUpdate) => {
  try {
    sharedState = {
      ...sharedState,
      ...stateUpdate,
      lastUpdate: Date.now()
    };

    logger.debug('Estado actualizado desde frontend', { update: stateUpdate });
  } catch (error) {
    logger.error('Error procesando cambio de estado', { error: error.message });
  }
});

/**
 * Handlers para controles de ventana
 */
ipcMain.on('window-minimize', event => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('window-maximize', event => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', event => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// ════════════════════════════════════════════════════════════════════════════
// TERMINAL HANDLERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Handler para crear terminal
 */
ipcMain.handle(
  'create-terminal',
  validateIPC('create-terminal', async (event, { type = 'auto', command = null }) => {
    try {
      const terminalId = terminalManager.createTerminalWindow(type, command);
      return {
        success: true,
        terminalId
      };
    } catch (error) {
      logger.error('Error creando terminal', { error: error.message, stack: error.stack });
      return {
        success: false,
        error: error.message
      };
    }
  })
);

/**
 * Handler para enviar comando a terminal
 */
ipcMain.on('terminal-command', (event, { terminalId, command }) => {
  try {
    terminalManager.sendCommandToTerminal(terminalId, command);
  } catch (error) {
    logger.error('Error enviando comando a terminal', { terminalId, error: error.message });
  }
});

/**
 * Handler para cerrar terminal
 */
ipcMain.on('terminal-close', (event, terminalId) => {
  try {
    if (terminalId) {
      terminalManager.closeTerminal(terminalId);
    }
  } catch (error) {
    logger.error('Error cerrando terminal', { terminalId, error: error.message });
  }
});

/**
 * Handler para obtener terminales disponibles
 */
ipcMain.handle(
  'get-available-terminals',
  validateIPC('get-available-terminals', async event => {
    try {
      const terminals = terminalManager.getAvailableTerminals();
      return {
        success: true,
        terminals
      };
    } catch (error) {
      logger.error('Error obteniendo terminales', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  })
);

// ════════════════════════════════════════════════════════════════════════════
// MULTI-WINDOW MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════

/**
 * Crea una nueva ventana
 */
function createNewWindow(windowType = 'main', options = {}) {
  const windowId = `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const windowOptions = {
    width: options.width || 1200,
    height: options.height || 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: false
    },
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
    show: false,
    ...options
  };

  const newWindow = new BrowserWindow(windowOptions);

  // Cargar contenido según tipo
  if (windowType === 'main') {
    newWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  } else if (windowType === 'settings') {
    // Ventana de configuración (si existe)
    newWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  }

  // Guardar referencia
  windows.set(windowId, {
    window: newWindow,
    type: windowType,
    id: windowId
  });

  // Mostrar cuando esté listo
  newWindow.once('ready-to-show', () => {
    newWindow.show();
  });

  // Limpiar al cerrar
  newWindow.on('closed', () => {
    windows.delete(windowId);
    logger.info('Ventana cerrada', { windowId, type: windowType });
  });

  logger.info('Nueva ventana creada', { windowId, type: windowType });
  return windowId;
}

/**
 * Handler para crear nueva ventana
 */
ipcMain.handle(
  'create-window',
  validateIPC('create-window', async (event, { type = 'main', options = {} }) => {
    try {
      const windowId = createNewWindow(type, options);
      return {
        success: true,
        windowId
      };
    } catch (error) {
      logger.error('Error creando ventana', { error: error.message, stack: error.stack });
      return {
        success: false,
        error: error.message
      };
    }
  })
);

/**
 * Handler para obtener todas las ventanas
 */
ipcMain.handle(
  'get-windows',
  validateIPC('get-windows', async event => {
    try {
      const windowList = Array.from(windows.entries()).map(([id, data]) => ({
        id,
        type: data.type,
        isVisible: data.window.isVisible(),
        isFocused: data.window.isFocused()
      }));

      return {
        success: true,
        windows: windowList
      };
    } catch (error) {
      logger.error('Error obteniendo ventanas', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  })
);

// ════════════════════════════════════════════════════════════════════════════
// LAZY LOADING - Carga diferida de módulos pesados
// ════════════════════════════════════════════════════════════════════════════

/**
 * Carga un módulo bajo demanda
 * @param {string} moduleName - Nombre del módulo a cargar
 * @param {boolean} forceReload - Si es true, fuerza la recarga del módulo incluso si ya está cargado
 * @returns {Promise<*>} Módulo cargado
 */
async function loadLazyModule(moduleName, forceReload = false) {
  // FIX: Si forceReload es true, limpiar el módulo del cache antes de cargar
  if (forceReload && lazyModules[moduleName]) {
    logger.info(`Forzando recarga del módulo: ${moduleName}`);
    // Limpiar referencias según el tipo de módulo
    switch (moduleName) {
      case 'mcpServer':
        if (mcpServer) {
          try {
            await mcpServer.stop();
            mcpServer = null;
            lazyModules.mcpServer = null;
          } catch (e) {
            logger.error('Error crítico deteniendo mcpServer, abortando recarga', { 
              error: e.message,
              stack: e.stack
            });
            // FIX: Si falla al detener, NO limpiar referencias para evitar instancias duplicadas
            // Lanzar error para que el caller sepa que la recarga falló
            throw new Error(`No se puede recargar mcpServer: error al detener servidor existente: ${e.message}`);
          }
        } else {
          lazyModules.mcpServer = null;
        }
        break;
      case 'ollamaMcpServer':
        if (ollamaMcpServer) {
          try {
            await ollamaMcpServer.stop();
            ollamaMcpServer = null;
            lazyModules.ollamaMcpServer = null;
          } catch (e) {
            logger.error('Error crítico deteniendo ollamaMcpServer, abortando recarga', { 
              error: e.message,
              stack: e.stack
            });
            // FIX: Si falla al detener, NO limpiar referencias para evitar instancias duplicadas
            throw new Error(`No se puede recargar ollamaMcpServer: error al detener servidor existente: ${e.message}`);
          }
        } else {
          lazyModules.ollamaMcpServer = null;
        }
        break;
      case 'groqApiServer':
        if (groqApiServer) {
          try {
            await groqApiServer.stop();
            groqApiServer = null;
            lazyModules.groqApiServer = null;
          } catch (e) {
            logger.error('Error crítico deteniendo groqApiServer, abortando recarga', { 
              error: e.message,
              stack: e.stack
            });
            // FIX: Si falla al detener, NO limpiar referencias para evitar instancias duplicadas
            throw new Error(`No se puede recargar groqApiServer: error al detener servidor existente: ${e.message}`);
          }
        } else {
          lazyModules.groqApiServer = null;
        }
        break;
      case 'conversationService':
        conversationService = null;
        lazyModules.conversationService = null;
        break;
      case 'deepgramService':
        deepgramService = null;
        lazyModules.deepgramService = null;
        break;
    }
  }
  
  if (lazyModules[moduleName] && !forceReload) {
    return lazyModules[moduleName];
  }

  logger.info(`Cargando módulo bajo demanda: ${moduleName}`);
  const startTime = Date.now();

  try {
    switch (moduleName) {
      case 'mcpServer':
        if (!mcpServer) {
          await startMCPServer();
        }
        lazyModules.mcpServer = mcpServer;
        break;

      case 'ollamaMcpServer':
        if (!ollamaMcpServer) {
          await startDedicatedServers();
        }
        lazyModules.ollamaMcpServer = ollamaMcpServer;
        break;

      case 'groqApiServer':
        if (!groqApiServer) {
          await startDedicatedServers();
        }
        lazyModules.groqApiServer = groqApiServer;
        break;

      case 'conversationService':
        if (!conversationService && modelRouter) {
          const ConversationService = require('../services/conversation-service');
          conversationService = new ConversationService(modelRouter);
          lazyModules.conversationService = conversationService;
        }
        break;

      case 'deepgramService':
        if (!deepgramService) {
          const DeepgramService = require('../services/deepgram-service');
          deepgramService = new DeepgramService();
          lazyModules.deepgramService = deepgramService;
        }
        break;

      default:
        throw new Error(`Módulo desconocido: ${moduleName}`);
    }

    const duration = Date.now() - startTime;
    logger.info(`Módulo ${moduleName} cargado`, { duration: `${duration}ms` });

    return lazyModules[moduleName];
  } catch (error) {
    logger.error(`Error cargando módulo ${moduleName}`, {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Handler para cargar módulo bajo demanda (mejorado con LazyLoader)
 * @param {Object} event - Evento IPC
 * @param {Object} params - Parámetros
 * @param {string} params.moduleName - Nombre del módulo a cargar
 * @param {boolean} params.forceReload - Forzar recarga
 * @returns {Promise<Object>} Resultado de la carga
 */
ipcMain.handle(
  'load-lazy-module',
  validateIPC('load-lazy-module', async (event, { moduleName, forceReload = false }) => {
    try {
      // FIX: Usar la función local loadLazyModule() que maneja nombres de módulos,
      // no LazyLoader.loadLazyModule() que espera rutas de archivo
      // Pasar forceReload para permitir recarga forzada de módulos
      const module = await loadLazyModule(moduleName, forceReload);

      return {
        success: true,
        moduleName,
        module: module ? 'loaded' : 'not found',
        forceReload
      };
    } catch (error) {
      logger.error('Error en load-lazy-module', {
        moduleName,
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        error: error.message
      };
    }
  })
);

// ════════════════════════════════════════════════════════════════════════════
// APP LIFECYCLE
// ════════════════════════════════════════════════════════════════════════════

app.whenReady().then(async () => {
  // Crear menús nativos del OS
  createApplicationMenu();

  // Iniciar servidor de API (para endpoints como HeyGen token)
  startAPIServer();

  // Inicializar Model Router (crítico, cargar primero)
  initializeModelRouter();

  // Iniciar Health Aggregator para monitoreo de servicios
  globalHealthAggregator.start();
  logger.info('Health Aggregator iniciado');

  // Inicializar Service Reconnection Manager
  const serviceReconnectionManager = getServiceReconnectionManager();

  // Registrar servicios MCP para reconexión automática
  serviceReconnectionManager.registerService(
    'ollama-mcp-server',
    {
      name: 'Ollama MCP Server',
      url: 'http://localhost:6002'
    },
    async () => {
      const ollamaRunning = await checkServerHealth('http://localhost:6002/ollama/health');
      if (!ollamaRunning) {
        logger.info('Reconectando Ollama MCP Server');
        ollamaMcpServer = new OllamaMCPServer();
        await ollamaMcpServer.start();
        logger.info('Ollama MCP Server reconectado');
      }
    },
    async () => {
      return await checkServerHealth('http://localhost:6002/ollama/health', 3000);
    }
  );

  serviceReconnectionManager.registerService(
    'groq-api-server',
    {
      name: 'Groq API Server',
      url: 'http://localhost:6003'
    },
    async () => {
      const groqRunning = await checkServerHealth('http://localhost:6003/groq/health');
      if (!groqRunning) {
        logger.info('Reconectando Groq API Server');
        groqApiServer = new GroqAPIServer();
        await groqApiServer.start();
        logger.info('Groq API Server reconectado');
      }
    },
    async () => {
      return await checkServerHealth('http://localhost:6003/groq/health', 3000);
    }
  );

  // Iniciar health checks de reconexión
  serviceReconnectionManager.startHealthChecks();
  logger.info('Service Reconnection Manager iniciado');

  // Crear ventana principal (cargar UI primero para mejor UX)
  createWindow();

  // Cargar servidores en segundo plano (lazy loading mejorado)
  // Solo verificar si están corriendo, no iniciar automáticamente
  startDedicatedServers(true)
    .then(async ({ ollamaRunning, groqRunning }) => {
      // Si no están corriendo, intentar conectar con reconexión automática
      if (!ollamaRunning) {
        logger.info('Ollama MCP Server no está corriendo, intentando conectar...');
        await serviceReconnectionManager.connectService('ollama-mcp-server');
      }
      if (!groqRunning) {
        logger.info('Groq API Server no está corriendo, intentando conectar...');
        await serviceReconnectionManager.connectService('groq-api-server');
      }
    })
    .catch(error => {
      logger.warn('Error verificando servidores dedicados', { error: error.message });
    });

  // MCP Server también se puede cargar bajo demanda
  // Solo iniciar si es necesario para funcionalidad básica
  if (process.env.AUTO_START_MCP !== 'false') {
    startMCPServer().catch(error => {
      logger.warn('MCP Server se cargará bajo demanda', { error: error.message });
    });
  }

  // Inicializar system tray
  if (mainWindow) {
    tray = initializeTray(mainWindow);
  }

  // Configurar auto-updater (solo en producción)
  if (process.env.NODE_ENV !== 'development' && !process.env.DISABLE_AUTO_UPDATE) {
    try {
      configureUpdater({
        autoDownload: true,
        autoInstallOnAppQuit: true,
        onUpdateAvailable: info => {
          showNotification('Actualización disponible', `Versión ${info.version} disponible`);
        },
        onUpdateDownloaded: info => {
          showNotification('Actualización lista', 'Se instalará al reiniciar');
        }
      });

      // Verificar actualizaciones cada hora
      startAutoUpdateCheck(60);
    } catch (error) {
      logger.warn('Auto-updater no disponible', { error: error.message });
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (mainWindow && !tray) {
        tray = initializeTray(mainWindow);
      }
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;

  // FIX: Cerrar todas las ventanas antes de salir para prevenir memory leaks
  // Esto asegura que todas las ventanas (incluyendo flotantes) se cierren correctamente
  windows.forEach((window, id) => {
    if (window && !window.isDestroyed()) {
      logger.info(`Cerrando ventana: ${id}`);
      window.destroy();
    }
  });
  windows.clear();

  // Destruir system tray
  if (tray) {
    destroyTray();
  }

  // Detener health aggregator
  globalHealthAggregator.stop();

  // Detener service reconnection manager
  const serviceReconnectionManager = getServiceReconnectionManager();
  serviceReconnectionManager.cleanup();

  // Cerrar service registry
  globalServiceRegistry.shutdown();

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