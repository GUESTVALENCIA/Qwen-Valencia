/**
 * ════════════════════════════════════════════════════════════════════════════
 * SERVICE REGISTRY - Registro y Descubrimiento de Servicios Enterprise-Level
 * Patrón Service Discovery para arquitectura de microservicios
 * ════════════════════════════════════════════════════════════════════════════
 */

const EventEmitter = require('events');
const axios = require('axios');
const { LoggerFactory } = require('../utils/logger');
const { MetricsFactory } = require('../utils/metrics');

const logger = LoggerFactory.create({ service: 'service-registry' });
const metrics = MetricsFactory.create({ service: 'service_registry' });

/**
 * Service Registry para descubrimiento automático de servicios
 */
class ServiceRegistry extends EventEmitter {
  constructor(options = {}) {
    super();

    this.services = new Map(); // serviceName -> ServiceInfo[]
    this.healthCheckInterval = options.healthCheckInterval || 30000; // 30 segundos
    this.serviceTTL = options.serviceTTL || 60000; // 60 segundos
    this.healthCheckTimeout = options.healthCheckTimeout || 5000;

    // Intervalos de health check por servicio
    this.healthCheckIntervals = new Map();

    // Lock para prevenir race conditions en health checks
    this.healthCheckLocks = new Map(); // serviceId -> Promise

    // Round-robin tracking
    this.roundRobinIndex = new Map();

    // Estadísticas
    this.stats = {
      totalServices: 0,
      activeServices: 0,
      failedHealthChecks: 0,
      successfulHealthChecks: 0
    };

    logger.info('Service Registry inicializado');
  }

  /**
   * Registra un servicio
   */
  register(serviceInfo) {
    const {
      name,
      version = '1.0.0',
      host = 'localhost',
      port,
      protocol = 'http',
      healthEndpoint = '/health',
      metadata = {},
      tags = []
    } = serviceInfo;

    if (!name || !port) {
      throw new Error('Service name and port are required');
    }

    const serviceId = `${name}-${version}-${host}-${port}`;
    const service = {
      id: serviceId,
      name,
      version,
      host,
      port,
      protocol,
      url: `${protocol}://${host}:${port}`,
      healthEndpoint,
      metadata,
      tags,
      registeredAt: Date.now(),
      lastHealthCheck: null,
      healthStatus: 'unknown',
      isHealthy: false
    };

    // Agregar o actualizar servicio
    if (!this.services.has(name)) {
      this.services.set(name, []);
    }

    const serviceList = this.services.get(name);
    const existingIndex = serviceList.findIndex(s => s.id === serviceId);

    if (existingIndex >= 0) {
      // Actualizar servicio existente
      serviceList[existingIndex] = service;
      logger.info('Servicio actualizado', { name, version, host, port });
    } else {
      // Nuevo servicio
      serviceList.push(service);
      this.stats.totalServices++;
      logger.info('Servicio registrado', { name, version, host, port });
    }

    // Iniciar health check
    this.startHealthCheck(service);

    // Emitir evento
    this.emit('service-registered', service);

    // Actualizar métricas
    this.updateStats();

    return service;
  }

  /**
   * Desregistra un servicio
   */
  unregister(serviceId) {
    for (const [name, serviceList] of this.services.entries()) {
      const index = serviceList.findIndex(s => s.id === serviceId);
      if (index >= 0) {
        const service = serviceList[index];

        // Detener health check
        this.stopHealthCheck(serviceId);

        // Remover servicio
        serviceList.splice(index, 1);

        // Si no hay más servicios con este nombre, remover la entrada
        if (serviceList.length === 0) {
          this.services.delete(name);
        }

        this.stats.totalServices--;
        logger.info('Servicio desregistrado', { name, serviceId });

        // Emitir evento
        this.emit('service-unregistered', service);

        // Actualizar métricas
        this.updateStats();

        return service;
      }
    }

    return null;
  }

  /**
   * Obtiene un servicio por nombre (load balancing round-robin)
   * FIX: Agregado lock para prevenir race condition cuando health check está en progreso
   */
  getService(name, options = {}) {
    const serviceList = this.services.get(name);
    if (!serviceList || serviceList.length === 0) {
      return null;
    }

    // Filtrar solo servicios saludables si se requiere
    let availableServices = serviceList;
    if (options.healthyOnly !== false) {
      // Filtrar servicios saludables, pero también incluir aquellos con health check reciente
      // (menos de 5 segundos) para evitar race condition
      const now = Date.now();
      availableServices = serviceList.filter(s => {
        if (s.isHealthy) return true;
        // Si el health check fue reciente (menos de 5s), considerar saludable temporalmente
        if (s.lastHealthCheck && now - s.lastHealthCheck < 5000) {
          return s.healthStatus === 'healthy';
        }
        return false;
      });
    }

    if (availableServices.length === 0) {
      return null;
    }

    // Round-robin simple (mejorado para tracking real)
    if (options.strategy === 'round-robin' || !options.strategy) {
      if (!this.roundRobinIndex) {
        this.roundRobinIndex = new Map();
      }
      const currentIndex = this.roundRobinIndex.get(name) || 0;
      const selected = availableServices[currentIndex % availableServices.length];
      this.roundRobinIndex.set(name, (currentIndex + 1) % availableServices.length);
      return selected;
    }

    // Random
    if (options.strategy === 'random') {
      const index = Math.floor(Math.random() * availableServices.length);
      return availableServices[index];
    }

    // First available
    if (options.strategy === 'first') {
      return availableServices[0];
    }

    return availableServices[0];
  }

  /**
   * Obtiene todos los servicios con un nombre
   */
  getServices(name, options = {}) {
    const serviceList = this.services.get(name);
    if (!serviceList) {
      return [];
    }

    if (options.healthyOnly) {
      return serviceList.filter(s => s.isHealthy);
    }

    return [...serviceList];
  }

  /**
   * Lista todos los servicios registrados
   */
  listAllServices() {
    const allServices = [];
    for (const [name, serviceList] of this.services.entries()) {
      allServices.push(...serviceList);
    }
    return allServices;
  }

  /**
   * Inicia health check para un servicio
   */
  startHealthCheck(service) {
    // Detener health check existente si hay
    this.stopHealthCheck(service.id);

    // Realizar health check inmediato
    this.performHealthCheck(service);

    // Configurar health check periódico
    const interval = setInterval(() => {
      this.performHealthCheck(service);
    }, this.healthCheckInterval);

    this.healthCheckIntervals.set(service.id, interval);
  }

  /**
   * Detiene health check para un servicio
   */
  stopHealthCheck(serviceId) {
    const interval = this.healthCheckIntervals.get(serviceId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serviceId);
    }
  }

  /**
   * Realiza health check de un servicio
   * FIX: Agregado lock para prevenir race conditions
   */
  async performHealthCheck(service) {
    // Verificar si hay un health check en progreso para este servicio
    const existingLock = this.healthCheckLocks.get(service.id);
    if (existingLock) {
      // Esperar a que termine el health check en progreso
      try {
        await existingLock;
      } catch (error) {
        // Ignorar errores del lock anterior
      }
      return;
    }

    // Crear lock para este health check
    const healthCheckPromise = this._doPerformHealthCheck(service);
    this.healthCheckLocks.set(service.id, healthCheckPromise);

    try {
      await healthCheckPromise;
    } finally {
      // Remover lock cuando termine
      if (this.healthCheckLocks.get(service.id) === healthCheckPromise) {
        this.healthCheckLocks.delete(service.id);
      }
    }
  }

  /**
   * Realiza el health check real (método privado)
   */
  async _doPerformHealthCheck(service) {
    const healthUrl = `${service.url}${service.healthEndpoint}`;

    try {
      const startTime = Date.now();
      const response = await axios.get(healthUrl, {
        timeout: this.healthCheckTimeout,
        validateStatus: status => status < 500 // Aceptar 2xx, 3xx, 4xx
      });

      const duration = Date.now() - startTime;

      const wasHealthy = service.isHealthy;
      service.isHealthy = response.status >= 200 && response.status < 400;
      service.healthStatus = service.isHealthy ? 'healthy' : 'unhealthy';
      service.lastHealthCheck = Date.now();
      service.lastResponseTime = duration;

      if (service.isHealthy) {
        this.stats.successfulHealthChecks++;
        metrics.increment('health_check_success', { service: service.name });
        metrics.observe('health_check_duration_ms', { service: service.name }, duration);
      } else {
        this.stats.failedHealthChecks++;
        metrics.increment('health_check_failure', { service: service.name });
      }

      // Emitir evento si cambió el estado
      if (wasHealthy !== service.isHealthy) {
        this.emit('service-health-changed', {
          service,
          wasHealthy,
          isHealthy: service.isHealthy
        });

        logger.info('Estado de salud del servicio cambió', {
          name: service.name,
          wasHealthy,
          isHealthy: service.isHealthy
        });
      }
    } catch (error) {
      const wasHealthy = service.isHealthy;
      service.isHealthy = false;
      service.healthStatus = 'unreachable';
      service.lastHealthCheck = Date.now();
      service.lastError = error.message;

      this.stats.failedHealthChecks++;
      metrics.increment('health_check_error', { service: service.name });

      // Emitir evento si cambió el estado
      if (wasHealthy !== service.isHealthy) {
        this.emit('service-health-changed', {
          service,
          wasHealthy,
          isHealthy: false
        });

        logger.warn('Servicio no alcanzable', {
          name: service.name,
          url: healthUrl,
          error: error.message
        });
      }
    }

    // Actualizar estadísticas
    this.updateStats();
  }

  /**
   * Actualiza estadísticas
   */
  updateStats() {
    let activeCount = 0;
    for (const serviceList of this.services.values()) {
      activeCount += serviceList.filter(s => s.isHealthy).length;
    }
    this.stats.activeServices = activeCount;
  }

  /**
   * Obtiene estadísticas del registry
   */
  getStats() {
    return {
      ...this.stats,
      servicesByStatus: {
        healthy: this.listAllServices().filter(s => s.isHealthy).length,
        unhealthy: this.listAllServices().filter(s => !s.isHealthy).length,
        unknown: this.listAllServices().filter(s => s.healthStatus === 'unknown').length
      },
      servicesByName: Object.fromEntries(
        Array.from(this.services.entries()).map(([name, list]) => [
          name,
          {
            total: list.length,
            healthy: list.filter(s => s.isHealthy).length,
            instances: list.map(s => ({
              id: s.id,
              version: s.version,
              host: s.host,
              port: s.port,
              healthStatus: s.healthStatus,
              lastHealthCheck: s.lastHealthCheck
            }))
          }
        ])
      )
    };
  }

  /**
   * Limpia servicios que no han respondido (TTL expirado)
   */
  cleanupExpiredServices() {
    const now = Date.now();
    const expiredServices = [];

    for (const [name, serviceList] of this.services.entries()) {
      for (const service of serviceList) {
        if (service.lastHealthCheck && now - service.lastHealthCheck > this.serviceTTL) {
          expiredServices.push(service);
        }
      }
    }

    for (const service of expiredServices) {
      logger.warn('Servicio expirado, desregistrando', { name: service.name, id: service.id });
      this.unregister(service.id);
    }

    return expiredServices.length;
  }

  /**
   * Detiene el registry y limpia recursos
   */
  shutdown() {
    // Detener todos los health checks
    for (const serviceId of this.healthCheckIntervals.keys()) {
      this.stopHealthCheck(serviceId);
    }

    // Limpiar servicios
    this.services.clear();
    this.healthCheckIntervals.clear();

    logger.info('Service Registry detenido');
  }
}

// Instancia global del registry
const globalServiceRegistry = new ServiceRegistry();

module.exports = {
  ServiceRegistry,
  globalServiceRegistry
};
