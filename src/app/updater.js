/**
 * ════════════════════════════════════════════════════════════════════════════
 * AUTO-UPDATER - Sistema de Actualización Automática Enterprise-Level
 * Verificación de actualizaciones, descarga y instalación automática
 * ════════════════════════════════════════════════════════════════════════════
 */

const { autoUpdater } = require('electron-updater');
const { LoggerFactory } = require('../utils/logger');
const { showNotification } = require('./tray');

const logger = LoggerFactory.create({ service: 'auto-updater' });

let updateCheckInterval = null;
let updateAvailable = false;

/**
 * Configura el auto-updater
 */
function configureUpdater(options = {}) {
  // Configuración básica
  autoUpdater.autoDownload = options.autoDownload !== false;
  autoUpdater.autoInstallOnAppQuit = options.autoInstallOnAppQuit !== false;
  
  // URL del servidor de actualizaciones (configurable)
  if (options.updateServerUrl) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: options.updateServerUrl
    });
  }
  
  // Event listeners
  autoUpdater.on('checking-for-update', () => {
    logger.info('Verificando actualizaciones...');
  });
  
  autoUpdater.on('update-available', (info) => {
    updateAvailable = true;
    logger.info('Actualización disponible', { version: info.version });
    
    if (options.onUpdateAvailable) {
      options.onUpdateAvailable(info);
    } else {
      showNotification(
        'Actualización disponible',
        `Versión ${info.version} está disponible. Se descargará automáticamente.`
      );
    }
  });
  
  autoUpdater.on('update-not-available', (info) => {
    updateAvailable = false;
    logger.info('No hay actualizaciones disponibles', { version: info.version });
  });
  
  autoUpdater.on('error', (error) => {
    logger.error('Error en auto-updater', { error: error.message, stack: error.stack });
    
    if (options.onError) {
      options.onError(error);
    }
  });
  
  autoUpdater.on('download-progress', (progress) => {
    logger.debug('Progreso de descarga', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total
    });
    
    if (options.onDownloadProgress) {
      options.onDownloadProgress(progress);
    }
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    logger.info('Actualización descargada', { version: info.version });
    
    if (options.onUpdateDownloaded) {
      options.onUpdateDownloaded(info);
    } else {
      showNotification(
        'Actualización descargada',
        'La actualización se instalará al reiniciar la aplicación.'
      );
    }
  });
}

/**
 * Verifica actualizaciones manualmente
 */
async function checkForUpdates() {
  try {
    logger.info('Verificando actualizaciones...');
    await autoUpdater.checkForUpdates();
  } catch (error) {
    logger.error('Error verificando actualizaciones', { error: error.message });
    throw error;
  }
}

/**
 * Inicia verificación automática de actualizaciones
 */
function startAutoUpdateCheck(intervalMinutes = 60) {
  if (updateCheckInterval) {
    logger.warn('Auto-update check ya está activo');
    return;
  }
  
  // Verificar inmediatamente
  checkForUpdates().catch(error => {
    logger.warn('Error en verificación inicial de actualizaciones', { error: error.message });
  });
  
  // Verificar periódicamente
  const intervalMs = intervalMinutes * 60 * 1000;
  updateCheckInterval = setInterval(() => {
    checkForUpdates().catch(error => {
      logger.warn('Error en verificación periódica de actualizaciones', { error: error.message });
    });
  }, intervalMs);
  
  logger.info('Auto-update check iniciado', { intervalMinutes });
}

/**
 * Detiene verificación automática
 */
function stopAutoUpdateCheck() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
    logger.info('Auto-update check detenido');
  }
}

/**
 * Instala actualización y reinicia
 */
function quitAndInstall() {
  if (updateAvailable) {
    logger.info('Instalando actualización y reiniciando...');
    autoUpdater.quitAndInstall(false, true);
  } else {
    logger.warn('No hay actualización disponible para instalar');
  }
}

/**
 * Obtiene información de la actualización disponible
 */
function getUpdateInfo() {
  return {
    available: updateAvailable,
    currentVersion: autoUpdater.currentVersion?.version || 'unknown',
    updateVersion: autoUpdater.updateInfo?.version || null
  };
}

module.exports = {
  configureUpdater,
  checkForUpdates,
  startAutoUpdateCheck,
  stopAutoUpdateCheck,
  quitAndInstall,
  getUpdateInfo
};

