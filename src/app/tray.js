/**
 * ════════════════════════════════════════════════════════════════════════════
 * SYSTEM TRAY - Integración con Bandeja del Sistema Enterprise-Level
 * Icono en system tray, menú contextual y notificaciones nativas
 * ════════════════════════════════════════════════════════════════════════════
 */

const { app, Tray, Menu, nativeImage, BrowserWindow } = require('electron');
const path = require('path');
const { LoggerFactory } = require('../utils/logger');

const logger = LoggerFactory.create({ service: 'system-tray' });

let tray = null;

/**
 * Crea el icono del system tray
 */
function createTrayIcon() {
  // Intentar cargar icono desde assets
  const iconPath = path.join(__dirname, '..', '..', 'assets', 'tray-icon.png');
  
  try {
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) {
      // Ajustar tamaño para diferentes plataformas
      if (process.platform === 'darwin') {
        image.setTemplateImage(true); // macOS usa imágenes template
      }
      return image;
    }
  } catch (error) {
    logger.warn('No se pudo cargar icono del tray, usando icono por defecto', { error: error.message });
  }
  
  // Crear icono simple si no existe el archivo
  const size = process.platform === 'darwin' ? 22 : 16;
  const image = nativeImage.createEmpty();
  // Por ahora, usar el icono de la app si existe
  try {
    const appIcon = path.join(__dirname, '..', '..', 'assets', 'icon.png');
    return nativeImage.createFromPath(appIcon);
  } catch {
    return image;
  }
}

/**
 * Crea el menú contextual del tray
 */
function createTrayMenu(mainWindow) {
  const isVisible = mainWindow && mainWindow.isVisible();
  
  return Menu.buildFromTemplate([
    {
      label: 'Mostrar Qwen-Valencia',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.show();
          mainWindow.focus();
        }
      },
      enabled: !isVisible || mainWindow.isMinimized()
    },
    {
      label: 'Ocultar',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      },
      enabled: isVisible && !mainWindow.isMinimized()
    },
    { type: 'separator' },
    {
      label: 'Nueva Conversación',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('tray-new-chat');
        }
      }
    },
    {
      label: 'Configuración',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('tray-open-settings');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Acerca de',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.webContents.send('tray-show-about');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        app.quit();
      }
    }
  ]);
}

/**
 * Inicializa el system tray
 */
function initializeTray(mainWindow) {
  if (tray) {
    logger.warn('System tray ya está inicializado');
    return tray;
  }
  
  try {
    const icon = createTrayIcon();
    tray = new Tray(icon);
    
    // Tooltip
    tray.setToolTip('Qwen-Valencia');
    
    // Menú contextual
    tray.setContextMenu(createTrayMenu(mainWindow));
    
    // Click en el icono (comportamiento varía por plataforma)
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          if (process.platform === 'darwin') {
            // macOS: click muestra/oculta
            mainWindow.hide();
          } else {
            // Windows/Linux: click muestra y enfoca
            mainWindow.show();
            mainWindow.focus();
          }
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
    
    // Double click (Windows/Linux)
    if (process.platform !== 'darwin') {
      tray.on('double-click', () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      });
    }
    
    // Actualizar menú cuando cambia el estado de la ventana
    if (mainWindow) {
      mainWindow.on('show', () => {
        tray.setContextMenu(createTrayMenu(mainWindow));
      });
      
      mainWindow.on('hide', () => {
        tray.setContextMenu(createTrayMenu(mainWindow));
      });
    }
    
    logger.info('System tray inicializado');
    return tray;
  } catch (error) {
    logger.error('Error inicializando system tray', { error: error.message, stack: error.stack });
    return null;
  }
}

/**
 * Actualiza el menú del tray
 */
function updateTrayMenu(mainWindow) {
  if (tray && mainWindow) {
    tray.setContextMenu(createTrayMenu(mainWindow));
  }
}

/**
 * Muestra notificación nativa
 */
function showNotification(title, body, options = {}) {
  if (!tray) {
    logger.warn('System tray no inicializado, no se puede mostrar notificación');
    return;
  }
  
  // Usar notificaciones nativas de Electron
  if (process.platform === 'darwin') {
    // macOS usa notificaciones del sistema
    const { Notification } = require('electron');
    if (Notification.isSupported()) {
      new Notification({
        title: title || 'Qwen-Valencia',
        body: body,
        icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
        ...options
      }).show();
    }
  } else {
    // Windows/Linux: usar tooltip o balloon
    tray.displayBalloon({
      icon: path.join(__dirname, '..', '..', 'assets', 'icon.png'),
      title: title || 'Qwen-Valencia',
      content: body
    });
  }
}

/**
 * Destruye el system tray
 */
function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
    logger.info('System tray destruido');
  }
}

module.exports = {
  initializeTray,
  updateTrayMenu,
  showNotification,
  destroyTray
};

