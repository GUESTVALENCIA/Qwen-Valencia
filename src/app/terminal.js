/**
 * ════════════════════════════════════════════════════════════════════════════
 * TERMINAL MANAGER - Gestión de Terminales Integradas Enterprise-Level
 * Soporte para Bash, PowerShell, Node y otras terminales del sistema
 * ════════════════════════════════════════════════════════════════════════════
 */

const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { LoggerFactory } = require('../utils/logger');

const logger = LoggerFactory.create({ service: 'terminal-manager' });

// Tipos de terminal disponibles
const TERMINAL_TYPES = {
  bash: {
    name: 'Bash',
    command: process.platform === 'win32' ? 'bash' : '/bin/bash',
    args: ['-i'],
    icon: '💻',
    available: false
  },
  powershell: {
    name: 'PowerShell',
    command: 'powershell.exe',
    args: ['-NoExit', '-Command'],
    icon: '⚡',
    available: false
  },
  cmd: {
    name: 'CMD',
    command: 'cmd.exe',
    args: ['/k'],
    icon: '📟',
    available: false
  },
  node: {
    name: 'Node.js REPL',
    command: 'node',
    args: [],
    icon: '🟢',
    available: false
  },
  wsl: {
    name: 'WSL',
    command: 'wsl',
    args: [],
    icon: '🐧',
    available: false
  }
};

// Ventanas de terminal activas
const terminalWindows = new Map();

/**
 * Detecta qué terminales están disponibles en el sistema
 */
function detectAvailableTerminals() {
  const platform = process.platform;
  
  // Verificar Bash
  if (platform === 'win32') {
    // En Windows, verificar si Git Bash o WSL está disponible
    TERMINAL_TYPES.bash.available = checkCommandAvailable('bash');
    TERMINAL_TYPES.wsl.available = checkCommandAvailable('wsl');
  } else {
    // En Linux/macOS, Bash debería estar disponible
    TERMINAL_TYPES.bash.available = checkCommandAvailable('/bin/bash');
  }
  
  // Verificar PowerShell (Windows y cross-platform)
  TERMINAL_TYPES.powershell.available = checkCommandAvailable('powershell') || 
                                        checkCommandAvailable('pwsh');
  
  // Verificar CMD (solo Windows)
  if (platform === 'win32') {
    TERMINAL_TYPES.cmd.available = checkCommandAvailable('cmd.exe');
  }
  
  // Verificar Node.js
  TERMINAL_TYPES.node.available = checkCommandAvailable('node');
  
  logger.info('Terminales detectadas', {
    available: Object.entries(TERMINAL_TYPES)
      .filter(([_, config]) => config.available)
      .map(([type, config]) => ({ type, name: config.name }))
  });
}

/**
 * Verifica si un comando está disponible
 */
function checkCommandAvailable(command) {
  try {
    const { execSync } = require('child_process');
    if (process.platform === 'win32') {
      execSync(`where ${command}`, { stdio: 'ignore' });
    } else {
      execSync(`which ${command}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Crea una ventana de terminal
 */
function createTerminalWindow(terminalType = 'auto', initialCommand = null) {
  // Detectar terminal automáticamente si es 'auto'
  if (terminalType === 'auto') {
    terminalType = getBestTerminalForPlatform();
  }
  
  const terminalConfig = TERMINAL_TYPES[terminalType];
  if (!terminalConfig || !terminalConfig.available) {
    logger.warn(`Terminal ${terminalType} no disponible, usando alternativa`);
    terminalType = getBestTerminalForPlatform();
  }
  
  const terminalId = `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const terminalWindow = new BrowserWindow({
    width: 900,
    height: 600,
    title: `${terminalConfig.name} - Qwen-Valencia`,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'terminal-preload.js'),
      sandbox: false
    },
    icon: path.join(__dirname, '..', '..', 'assets', 'icon.png')
  });
  
  // Cargar interfaz de terminal
  terminalWindow.loadFile(path.join(__dirname, 'renderer', 'terminal.html'), {
    query: {
      terminalType,
      terminalId,
      initialCommand: initialCommand || ''
    }
  });
  
  // Inicializar proceso de terminal
  const terminalProcess = initializeTerminalProcess(terminalType, terminalId, initialCommand);
  
  // Guardar referencia
  terminalWindows.set(terminalId, {
    window: terminalWindow,
    process: terminalProcess,
    type: terminalType,
    config: terminalConfig
  });
  
  // Limpiar cuando se cierra
  terminalWindow.on('closed', () => {
    if (terminalProcess && !terminalProcess.killed) {
      terminalProcess.kill();
    }
    terminalWindows.delete(terminalId);
    logger.info('Terminal cerrada', { terminalId, type: terminalType });
  });
  
  logger.info('Terminal creada', { terminalId, type: terminalType });
  
  return terminalId;
}

/**
 * Inicializa el proceso de terminal
 */
function initializeTerminalProcess(terminalType, terminalId, initialCommand) {
  const config = TERMINAL_TYPES[terminalType];
  if (!config) {
    throw new Error(`Tipo de terminal no válido: ${terminalType}`);
  }
  
  const args = [...config.args];
  if (initialCommand) {
    if (terminalType === 'powershell') {
      args.push(initialCommand);
    } else if (terminalType === 'node') {
      args.push('-e', initialCommand);
    } else {
      args.push('-c', initialCommand);
    }
  }
  
  // Para terminales interactivas, necesitamos shell: true en Windows
  // En Linux/macOS, podemos usar shell: false pero necesitamos un pseudo-terminal
  const useShell = process.platform === 'win32' || terminalType === 'node';
  
  const terminalProcess = spawn(config.command, args, {
    cwd: process.cwd(),
    env: { ...process.env },
    shell: useShell,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // Manejar salida
  terminalProcess.stdout.on('data', (data) => {
    const terminalData = terminalWindows.get(terminalId);
    if (terminalData && terminalData.window && !terminalData.window.isDestroyed()) {
      terminalData.window.webContents.send('terminal-output', {
        type: 'stdout',
        data: data.toString()
      });
    }
  });
  
  terminalProcess.stderr.on('data', (data) => {
    const terminalData = terminalWindows.get(terminalId);
    if (terminalData && terminalData.window && !terminalData.window.isDestroyed()) {
      terminalData.window.webContents.send('terminal-output', {
        type: 'stderr',
        data: data.toString()
      });
    }
  });
  
  terminalProcess.on('exit', (code) => {
    const terminalData = terminalWindows.get(terminalId);
    if (terminalData && terminalData.window && !terminalData.window.isDestroyed()) {
      terminalData.window.webContents.send('terminal-exit', { code });
    }
    logger.info('Proceso de terminal terminado', { terminalId, code });
  });
  
  terminalProcess.on('error', (error) => {
    logger.error('Error en proceso de terminal', { terminalId, error: error.message });
    const terminalData = terminalWindows.get(terminalId);
    if (terminalData && terminalData.window && !terminalData.window.isDestroyed()) {
      terminalData.window.webContents.send('terminal-error', { error: error.message });
    }
  });
  
  return terminalProcess;
}

/**
 * Obtiene el mejor terminal para la plataforma actual
 */
function getBestTerminalForPlatform() {
  const platform = process.platform;
  
  if (platform === 'win32') {
    if (TERMINAL_TYPES.powershell.available) return 'powershell';
    if (TERMINAL_TYPES.cmd.available) return 'cmd';
    if (TERMINAL_TYPES.wsl.available) return 'wsl';
    if (TERMINAL_TYPES.bash.available) return 'bash';
  } else {
    if (TERMINAL_TYPES.bash.available) return 'bash';
  }
  
  // Fallback a Node si está disponible
  if (TERMINAL_TYPES.node.available) return 'node';
  
  return 'bash'; // Último recurso
}

/**
 * Envía comando a una terminal
 */
function sendCommandToTerminal(terminalId, command) {
  const terminalData = terminalWindows.get(terminalId);
  if (!terminalData || !terminalData.process) {
    throw new Error(`Terminal ${terminalId} no encontrada`);
  }
  
  terminalData.process.stdin.write(command + '\n');
  logger.debug('Comando enviado a terminal', { terminalId, command });
}

/**
 * Obtiene lista de terminales disponibles
 */
function getAvailableTerminals() {
  return Object.entries(TERMINAL_TYPES)
    .filter(([_, config]) => config.available)
    .map(([type, config]) => ({
      type,
      name: config.name,
      icon: config.icon
    }));
}

/**
 * Cierra una terminal específica
 */
function closeTerminal(terminalId) {
  const terminalData = terminalWindows.get(terminalId);
  if (terminalData) {
    if (terminalData.window && !terminalData.window.isDestroyed()) {
      terminalData.window.close();
    }
    if (terminalData.process && !terminalData.process.killed) {
      terminalData.process.kill();
    }
    terminalWindows.delete(terminalId);
    logger.info('Terminal cerrada', { terminalId });
  }
}

/**
 * Cierra todas las terminales
 */
function closeAllTerminals() {
  for (const [terminalId] of terminalWindows) {
    closeTerminal(terminalId);
  }
}

// Detectar terminales disponibles al cargar
detectAvailableTerminals();

module.exports = {
  createTerminalWindow,
  sendCommandToTerminal,
  getAvailableTerminals,
  closeTerminal,
  closeAllTerminals,
  getBestTerminalForPlatform,
  TERMINAL_TYPES
};

