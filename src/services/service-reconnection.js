/**
 * ════════════════════════════════════════════════════════════════════════════
 * SERVICE RECONNECTION - Auto-Reconexión Enterprise-Level para Servicios
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Sistema de reconexión automática para servicios MCP y APIs con:
 * - Exponential backoff
 * - Circuit breaker integration
 * - Health check integration
 * - Event-driven reconnection
 */

const EventEmitter = require('events');
const { LoggerFactory } = require('../utils/logger');
const { MetricsFactory } = require('../utils/metrics');

const logger = LoggerFactory.create({ service: 'service-reconnection' });
const metrics = MetricsFactory.create({ service: 'service_reconnection' });

/**
 * Service Reconnection Manager
 */
class ServiceReconnectionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.services = new Map(); // serviceId -> ServiceInfo
    this.reconnectTimers = new Map(); // serviceId -> timeout
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.baseReconnectDelay = options.baseReconnectDelay ?? 1000;
    this.maxReconnectDelay = options.maxReconnectDelay ?? 60000; // 1 minuto
    this.healthCheckInterval = options.healthCheckInterval ?? 30000; // 30s
    this.healthCheckTimeout = null;
    
    logger.info('Service Reconnection Manager inicializado');
  }
  
  /**
   * Registra un servicio para reconexión automática
   * @param {string} serviceId - ID único del servicio
   * @param {Object} config - Configuración del servicio
   * @param {Function} connectFn - Función async para conectar
   * @param {Function} healthCheckFn - Función async para health check
   */
  registerService(serviceId, config, connectFn, healthCheckFn) {
    const serviceInfo = {
      id: serviceId,
      name: config.name ?? serviceId,
      url: config.url,
      connectFn,
      healthCheckFn,
      state: 'disconnected',
      reconnectAttempts: 0,
      lastConnectionAttempt: null,
      lastSuccessfulConnection: null,
      lastError: null,
      stats: {
        totalConnections: 0,
        totalDisconnections: 0,
        totalReconnections: 0,
        totalErrors: 0
      }
    };
    
    this.services.set(serviceId, serviceInfo);
    
    logger.info('Servicio registrado para reconexión', { serviceId, name: serviceInfo.name });
    this.emit('service-registered', serviceInfo);
    
    return serviceInfo;
  }
  
  /**
   * Conecta un servicio
   * @param {string} serviceId - ID del servicio
   * @returns {Promise<boolean>} Si la conexión fue exitosa
   */
  async connectService(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Servicio ${serviceId} no registrado`);
    }
    
    // Si ya está conectado, verificar health
    if (service.state === 'connected') {
      const isHealthy = await this.checkServiceHealth(serviceId);
      if (isHealthy) {
        return true;
      }
      // Si no está saludable, forzar reconexión
      service.state = 'disconnected';
    }
    
    service.state = 'connecting';
    service.lastConnectionAttempt = new Date();
    this.emit('service-connecting', service);
    
    try {
      await service.connectFn();
      
      service.state = 'connected';
      service.lastSuccessfulConnection = new Date();
      service.reconnectAttempts = 0;
      service.lastError = null;
      service.stats.totalConnections++;
      
      // Limpiar timer de reconexión
      if (this.reconnectTimers.has(serviceId)) {
        clearTimeout(this.reconnectTimers.get(serviceId));
        this.reconnectTimers.delete(serviceId);
      }
      
      logger.info('Servicio conectado', { serviceId, name: service.name });
      this.emit('service-connected', service);
      
      metrics.increment('service.connected', { serviceId, name: service.name });
      
      return true;
    } catch (error) {
      service.state = 'error';
      service.lastError = error;
      service.stats.totalErrors++;
      
      logger.error('Error conectando servicio', {
        serviceId,
        name: service.name,
        error: error.message,
        attempts: service.reconnectAttempts
      });
      
      this.emit('service-error', { service, error });
      metrics.increment('service.connection_error', { serviceId, name: service.name });
      
      // Programar reconexión
      if (service.reconnectAttempts < this.maxReconnectAttempts) {
        await this.scheduleReconnect(serviceId);
      } else {
        logger.error('Máximo de intentos de reconexión alcanzado', { serviceId });
        this.emit('service-max-reconnect', service);
      }
      
      return false;
    }
  }
  
  /**
   * Desconecta un servicio
   * @param {string} serviceId - ID del servicio
   * @param {string} reason - Razón de desconexión
   */
  disconnectService(serviceId, reason = 'manual') {
    const service = this.services.get(serviceId);
    if (!service) return;
    
    service.state = 'disconnected';
    service.stats.totalDisconnections++;
    
    // Limpiar timer de reconexión
    if (this.reconnectTimers.has(serviceId)) {
      clearTimeout(this.reconnectTimers.get(serviceId));
      this.reconnectTimers.delete(serviceId);
    }
    
    logger.info('Servicio desconectado', { serviceId, name: service.name, reason });
    this.emit('service-disconnected', { service, reason });
    
    metrics.increment('service.disconnected', { serviceId, name: service.name });
  }
  
  /**
   * Programa reconexión con exponential backoff
   * @param {string} serviceId - ID del servicio
   */
  async scheduleReconnect(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) return;
    
    service.reconnectAttempts++;
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, service.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    
    // Agregar jitter (variación aleatoria)
    const jitter = Math.random() * 0.3 * delay;
    const finalDelay = Math.floor(delay + jitter);
    
    logger.info('Programando reconexión', {
      serviceId,
      name: service.name,
      delay: finalDelay,
      attempt: service.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts
    });
    
    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(serviceId);
      service.stats.totalReconnections++;
      await this.connectService(serviceId);
    }, finalDelay);
    
    this.reconnectTimers.set(serviceId, timer);
    this.emit('service-reconnect-scheduled', { service, delay: finalDelay });
  }
  
  /**
   * Health check de un servicio
   * @param {string} serviceId - ID del servicio
   * @returns {Promise<boolean>} Si el servicio está saludable
   */
  async checkServiceHealth(serviceId) {
    const service = this.services.get(serviceId);
    if (!service || !service.healthCheckFn) {
      return false;
    }
    
    try {
      const isHealthy = await Promise.race([
        service.healthCheckFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        )
      ]);
      
      if (!isHealthy && service.state === 'connected') {
        logger.warn('Servicio no saludable, forzando reconexión', {
          serviceId,
          name: service.name
        });
        service.state = 'disconnected';
        await this.scheduleReconnect(serviceId);
      }
      
      return isHealthy;
    } catch (error) {
      logger.warn('Error en health check', {
        serviceId,
        name: service.name,
        error: error.message
      });
      
      if (service.state === 'connected') {
        service.state = 'disconnected';
        await this.scheduleReconnect(serviceId);
      }
      
      return false;
    }
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
      this.services.forEach((service, serviceId) => {
        if (service.state === 'connected') {
          this.checkServiceHealth(serviceId).catch(error => {
            logger.error('Error en health check periódico', {
              serviceId,
              error: error.message
            });
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
   * Obtiene estado de un servicio
   * @param {string} serviceId - ID del servicio
   * @returns {Object} Estado del servicio
   */
  getServiceState(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) {
      return null;
    }
    
    return {
      id: service.id,
      name: service.name,
      state: service.state,
      connected: service.state === 'connected',
      reconnectAttempts: service.reconnectAttempts,
      lastConnectionAttempt: service.lastConnectionAttempt,
      lastSuccessfulConnection: service.lastSuccessfulConnection,
      lastError: service.lastError?.message,
      stats: { ...service.stats }
    };
  }
  
  /**
   * Lista todos los servicios
   * @returns {Array} Lista de servicios
   */
  listServices() {
    return Array.from(this.services.values()).map(service => ({
      id: service.id,
      name: service.name,
      state: service.state,
      connected: service.state === 'connected'
    }));
  }
  
  /**
   * Limpia todos los servicios
   */
  cleanup() {
    // Limpiar timers
    this.reconnectTimers.forEach(timer => clearTimeout(timer));
    this.reconnectTimers.clear();
    
    this.stopHealthChecks();
    this.services.clear();
    
    logger.info('Service Reconnection Manager limpiado');
  }
  
  /**
   * Obtiene estadísticas agregadas
   * @returns {Object} Estadísticas
   */
  getStats() {
    const services = Array.from(this.services.values());
    
    return {
      total: services.length,
      connected: services.filter(s => s.state === 'connected').length,
      disconnected: services.filter(s => s.state === 'disconnected').length,
      error: services.filter(s => s.state === 'error').length,
      totalConnections: services.reduce((sum, s) => sum + s.stats.totalConnections, 0),
      totalReconnections: services.reduce((sum, s) => sum + s.stats.totalReconnections, 0),
      totalErrors: services.reduce((sum, s) => sum + s.stats.totalErrors, 0)
    };
  }
}

// Instancia global
let globalServiceReconnectionManager = null;

function getServiceReconnectionManager() {
  if (!globalServiceReconnectionManager) {
    globalServiceReconnectionManager = new ServiceReconnectionManager();
  }
  return globalServiceReconnectionManager;
}

module.exports = {
  ServiceReconnectionManager,
  getServiceReconnectionManager
};

