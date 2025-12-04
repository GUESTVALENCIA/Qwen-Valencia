/**
 * ════════════════════════════════════════════════════════════════════════════
 * DEVICE MANAGER - Gestión Enterprise-Level de Dispositivos IoT
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Gestiona dispositivos multimedia (cámara, micrófono) con:
 * - Estado centralizado
 * - Auto-reconexión
 * - Health monitoring
 * - Resource management
 * - Event-driven architecture
 */

const EventEmitter = require('events');
const { LoggerFactory } = require('../utils/logger');
const { MetricsFactory } = require('../utils/metrics');

const logger = LoggerFactory.create({ service: 'device-manager' });
const metrics = MetricsFactory.create({ service: 'device_manager' });

/**
 * Estados de dispositivos
 */
const DeviceState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
  SUSPENDED: 'suspended'
};

/**
 * Tipos de dispositivos
 */
const DeviceType = {
  CAMERA: 'camera',
  MICROPHONE: 'microphone',
  SPEAKER: 'speaker',
  DISPLAY: 'display'
};

/**
 * Device Manager - Gestión centralizada de dispositivos
 */
class DeviceManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.devices = new Map(); // deviceId -> DeviceInfo
    this.reconnectAttempts = new Map(); // deviceId -> attempt count
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this.reconnectDelay = options.reconnectDelay ?? 2000;
    this.healthCheckInterval = options.healthCheckInterval ?? 30000; // 30s
    this.healthCheckTimeout = null;
    
    logger.info('Device Manager inicializado');
  }
  
  /**
   * Registra un dispositivo
   * @param {string} deviceId - ID único del dispositivo
   * @param {string} type - Tipo de dispositivo (DeviceType)
   * @param {Object} options - Opciones del dispositivo
   * @returns {Object} Device info
   */
  registerDevice(deviceId, type, options = {}) {
    const deviceInfo = {
      id: deviceId,
      type,
      state: DeviceState.DISCONNECTED,
      stream: null,
      constraints: options.constraints ?? {},
      metadata: options.metadata ?? {},
      connectedAt: null,
      lastHealthCheck: null,
      errorCount: 0,
      reconnectAttempts: 0,
      stats: {
        totalConnections: 0,
        totalDisconnections: 0,
        totalErrors: 0,
        uptime: 0
      }
    };
    
    this.devices.set(deviceId, deviceInfo);
    this.reconnectAttempts.set(deviceId, 0);
    
    logger.info('Dispositivo registrado', { deviceId, type });
    this.emit('device-registered', deviceInfo);
    
    return deviceInfo;
  }
  
  /**
   * Conecta un dispositivo
   * @param {string} deviceId - ID del dispositivo
   * @param {Object} constraints - Constraints de getUserMedia
   * @returns {Promise<MediaStream>} Stream del dispositivo
   */
  async connectDevice(deviceId, constraints = {}) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Dispositivo ${deviceId} no registrado`);
    }
    
    // Si ya está conectado, retornar stream existente
    if (device.state === DeviceState.CONNECTED && device.stream) {
      logger.debug('Dispositivo ya conectado', { deviceId });
      return device.stream;
    }
    
    device.state = DeviceState.CONNECTING;
    this.emit('device-connecting', device);
    
    try {
      let stream;
      
      if (device.type === DeviceType.CAMERA) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: constraints.video ?? true,
          audio: constraints.audio ?? false
        });
      } else if (device.type === DeviceType.MICROPHONE) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: constraints.audio ?? {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true
          },
          video: false
        });
      } else {
        throw new Error(`Tipo de dispositivo no soportado: ${device.type}`);
      }
      
      // Configurar listeners del stream
      stream.getTracks().forEach(track => {
        track.onended = () => {
          logger.warn('Track finalizado', { deviceId, trackId: track.id });
          this.handleDeviceDisconnection(deviceId, 'track-ended');
        };
        
        track.onmute = () => {
          logger.warn('Track silenciado', { deviceId, trackId: track.id });
          this.emit('device-muted', { deviceId, trackId: track.id });
        };
        
        track.onunmute = () => {
          logger.info('Track desilenciado', { deviceId, trackId: track.id });
          this.emit('device-unmuted', { deviceId, trackId: track.id });
        };
      });
      
      device.stream = stream;
      device.state = DeviceState.CONNECTED;
      device.connectedAt = new Date();
      device.lastHealthCheck = new Date();
      device.errorCount = 0;
      device.reconnectAttempts = 0;
      device.stats.totalConnections++;
      
      this.reconnectAttempts.set(deviceId, 0);
      
      logger.info('Dispositivo conectado', { deviceId, type: device.type });
      this.emit('device-connected', device);
      
      metrics.increment('device.connected', { deviceId, type: device.type });
      
      return stream;
    } catch (error) {
      device.state = DeviceState.ERROR;
      device.errorCount++;
      device.stats.totalErrors++;
      
      logger.error('Error conectando dispositivo', {
        deviceId,
        error: error.message,
        errorCount: device.errorCount
      });
      
      this.emit('device-error', { device, error });
      metrics.increment('device.connection_error', { deviceId, type: device.type });
      
      // Intentar reconexión automática
      if (device.reconnectAttempts < this.maxReconnectAttempts) {
        await this.scheduleReconnect(deviceId);
      } else {
        logger.error('Máximo de intentos de reconexión alcanzado', { deviceId });
        this.emit('device-max-reconnect', device);
      }
      
      throw error;
    }
  }
  
  /**
   * Desconecta un dispositivo
   * @param {string} deviceId - ID del dispositivo
   * @param {string} reason - Razón de desconexión
   */
  disconnectDevice(deviceId, reason = 'manual') {
    const device = this.devices.get(deviceId);
    if (!device) {
      logger.warn('Intento de desconectar dispositivo no registrado', { deviceId });
      return;
    }
    
    if (device.stream) {
      device.stream.getTracks().forEach(track => {
        track.stop();
      });
      device.stream = null;
    }
    
    device.state = DeviceState.DISCONNECTED;
    device.connectedAt = null;
    device.stats.totalDisconnections++;
    
    // Calcular uptime
    if (device.connectedAt) {
      const uptime = Date.now() - device.connectedAt.getTime();
      device.stats.uptime += uptime;
    }
    
    logger.info('Dispositivo desconectado', { deviceId, reason });
    this.emit('device-disconnected', { device, reason });
    
    metrics.increment('device.disconnected', { deviceId, type: device.type });
  }
  
  /**
   * Obtiene estado de un dispositivo
   * @param {string} deviceId - ID del dispositivo
   * @returns {Object} Estado del dispositivo
   */
  getDeviceState(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) {
      return null;
    }
    
    return {
      id: device.id,
      type: device.type,
      state: device.state,
      connected: device.state === DeviceState.CONNECTED,
      connectedAt: device.connectedAt,
      lastHealthCheck: device.lastHealthCheck,
      errorCount: device.errorCount,
      stats: { ...device.stats }
    };
  }
  
  /**
   * Lista todos los dispositivos
   * @returns {Array} Lista de dispositivos
   */
  listDevices() {
    return Array.from(this.devices.values()).map(device => ({
      id: device.id,
      type: device.type,
      state: device.state,
      connected: device.state === DeviceState.CONNECTED
    }));
  }
  
  /**
   * Programa reconexión automática
   * @param {string} deviceId - ID del dispositivo
   */
  async scheduleReconnect(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) return;
    
    device.reconnectAttempts++;
    const attempts = this.reconnectAttempts.get(deviceId) ?? 0;
    this.reconnectAttempts.set(deviceId, attempts + 1);
    
    const delay = this.reconnectDelay * Math.pow(2, attempts); // Exponential backoff
    logger.info('Programando reconexión', { deviceId, delay, attempt: device.reconnectAttempts });
    
    setTimeout(async () => {
      try {
        await this.connectDevice(deviceId, device.constraints);
      } catch (error) {
        logger.error('Reconexión fallida', { deviceId, error: error.message });
      }
    }, delay);
  }
  
  /**
   * Maneja desconexión de dispositivo
   * @param {string} deviceId - ID del dispositivo
   * @param {string} reason - Razón
   */
  handleDeviceDisconnection(deviceId, reason) {
    const device = this.devices.get(deviceId);
    if (!device) return;
    
    this.disconnectDevice(deviceId, reason);
    
    // Intentar reconexión automática si estaba conectado
    if (device.state === DeviceState.CONNECTED && device.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnect(deviceId);
    }
  }
  
  /**
   * Health check de un dispositivo
   * @param {string} deviceId - ID del dispositivo
   * @returns {Promise<boolean>} Si el dispositivo está saludable
   */
  async checkDeviceHealth(deviceId) {
    const device = this.devices.get(deviceId);
    if (!device) {
      return false;
    }
    
    if (device.state !== DeviceState.CONNECTED || !device.stream) {
      return false;
    }
    
    // Verificar que los tracks estén activos
    const activeTracks = device.stream.getTracks().filter(track => 
      track.readyState === 'live' && !track.muted && track.enabled
    );
    
    const isHealthy = activeTracks.length > 0;
    device.lastHealthCheck = new Date();
    
    if (!isHealthy) {
      logger.warn('Dispositivo no saludable', { deviceId, activeTracks: activeTracks.length });
      this.handleDeviceDisconnection(deviceId, 'health-check-failed');
    }
    
    return isHealthy;
  }
  
  /**
   * Inicia health checks periódicos
   */
  startHealthChecks() {
    if (this.healthCheckTimeout) {
      logger.warn('Health checks ya están corriendo');
      return;
    }
    
    this.healthCheckTimeout = setInterval(() => {
      this.devices.forEach((device, deviceId) => {
        if (device.state === DeviceState.CONNECTED) {
          this.checkDeviceHealth(deviceId).catch(error => {
            logger.error('Error en health check', { deviceId, error: error.message });
          });
        }
      });
    }, this.healthCheckInterval);
    
    logger.info('Health checks iniciados', { interval: this.healthCheckInterval });
  }
  
  /**
   * Detiene health checks
   */
  stopHealthChecks() {
    if (this.healthCheckTimeout) {
      clearInterval(this.healthCheckTimeout);
      this.healthCheckTimeout = null;
      logger.info('Health checks detenidos');
    }
  }
  
  /**
   * Limpia todos los dispositivos
   */
  cleanup() {
    this.devices.forEach((device, deviceId) => {
      this.disconnectDevice(deviceId, 'cleanup');
    });
    
    this.stopHealthChecks();
    this.devices.clear();
    this.reconnectAttempts.clear();
    
    logger.info('Device Manager limpiado');
  }
  
  /**
   * Obtiene estadísticas agregadas
   * @returns {Object} Estadísticas
   */
  getStats() {
    const devices = Array.from(this.devices.values());
    
    return {
      total: devices.length,
      connected: devices.filter(d => d.state === DeviceState.CONNECTED).length,
      disconnected: devices.filter(d => d.state === DeviceState.DISCONNECTED).length,
      error: devices.filter(d => d.state === DeviceState.ERROR).length,
      totalConnections: devices.reduce((sum, d) => sum + d.stats.totalConnections, 0),
      totalErrors: devices.reduce((sum, d) => sum + d.stats.totalErrors, 0),
      avgUptime: devices.length > 0 
        ? devices.reduce((sum, d) => sum + d.stats.uptime, 0) / devices.length 
        : 0
    };
  }
}

// Instancia global
let globalDeviceManager = null;

function getDeviceManager() {
  if (!globalDeviceManager) {
    globalDeviceManager = new DeviceManager();
  }
  return globalDeviceManager;
}

module.exports = {
  DeviceManager,
  DeviceState,
  DeviceType,
  getDeviceManager
};

