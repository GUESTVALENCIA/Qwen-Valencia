/**
 * ════════════════════════════════════════════════════════════════════════════
 * HEALTH AGGREGATOR - Agregación de Health Checks Enterprise-Level
 * Health check centralizado de todos los servicios del sistema
 * ════════════════════════════════════════════════════════════════════════════
 */

const EventEmitter = require('events');
const { LoggerFactory } = require('../utils/logger');
const { MetricsFactory } = require('../utils/metrics');
const { globalServiceRegistry } = require('./service-registry');
const { globalServiceMesh } = require('./service-mesh');

const logger = LoggerFactory.create({ service: 'health-aggregator' });
const metrics = MetricsFactory.create({ service: 'health_aggregator' });

/**
 * Health Aggregator - Agrega health checks de todos los servicios
 */
class HealthAggregator extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.checkInterval = options.checkInterval || 30000; // 30 segundos
    this.checkTimeout = options.checkTimeout || 5000;
    this.aggregationInterval = null;
    
    // Estado agregado
    this.aggregatedHealth = {
      overall: 'unknown',
      services: {},
      timestamp: null,
      checks: {
        total: 0,
        healthy: 0,
        unhealthy: 0,
        unknown: 0
      }
    };
    
    logger.info('Health Aggregator inicializado');
  }
  
  /**
   * Inicia agregación periódica
   */
  start() {
    if (this.aggregationInterval) {
      logger.warn('Health Aggregator ya está corriendo');
      return;
    }
    
    // Realizar check inmediato
    this.aggregateHealth();
    
    // Configurar check periódico
    this.aggregationInterval = setInterval(() => {
      this.aggregateHealth();
    }, this.checkInterval);
    
    logger.info('Health Aggregator iniciado', { interval: this.checkInterval });
  }
  
  /**
   * Detiene agregación
   */
  stop() {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = null;
      logger.info('Health Aggregator detenido');
    }
  }
  
  /**
   * Agrega health checks de todos los servicios
   */
  async aggregateHealth() {
    const startTime = Date.now();
    const services = globalServiceRegistry.listAllServices();
    
    const healthPromises = services.map(service => 
      this.checkServiceHealth(service)
    );
    
    const results = await Promise.allSettled(healthPromises);
    
    const aggregated = {
      overall: 'healthy',
      services: {},
      timestamp: new Date().toISOString(),
      checks: {
        total: services.length,
        healthy: 0,
        unhealthy: 0,
        unknown: 0
      },
      duration: Date.now() - startTime
    };
    
    // Procesar resultados
    for (let i = 0; i < results.length; i++) {
      const service = services[i];
      const result = results[i];
      
      let healthStatus = 'unknown';
      let details = null;
      
      if (result.status === 'fulfilled') {
        healthStatus = result.value.healthy ? 'healthy' : 'unhealthy';
        details = result.value;
      } else {
        healthStatus = 'unhealthy';
        details = {
          healthy: false,
          error: result.reason?.message || 'Unknown error'
        };
      }
      
      aggregated.services[service.name] = {
        id: service.id,
        version: service.version,
        host: service.host,
        port: service.port,
        status: healthStatus,
        details
      };
      
      aggregated.checks[healthStatus === 'healthy' ? 'healthy' : 
                        healthStatus === 'unhealthy' ? 'unhealthy' : 'unknown']++;
    }
    
    // Determinar estado overall
    if (aggregated.checks.unhealthy > 0) {
      aggregated.overall = aggregated.checks.healthy === 0 ? 'unhealthy' : 'degraded';
    } else if (aggregated.checks.healthy > 0) {
      aggregated.overall = 'healthy';
    } else {
      aggregated.overall = 'unknown';
    }
    
    // Actualizar estado agregado
    const previousOverall = this.aggregatedHealth.overall;
    this.aggregatedHealth = aggregated;
    
    // Emitir evento si cambió el estado overall
    if (previousOverall !== aggregated.overall) {
      this.emit('health-changed', {
        previous: previousOverall,
        current: aggregated.overall,
        aggregated
      });
      
      logger.info('Estado de salud overall cambió', {
        previous: previousOverall,
        current: aggregated.overall,
        healthy: aggregated.checks.healthy,
        unhealthy: aggregated.checks.unhealthy
      });
    }
    
    // Registrar métricas
    metrics.setGauge('health_overall', {}, aggregated.overall === 'healthy' ? 1 : 0);
    metrics.setGauge('health_services_healthy', {}, aggregated.checks.healthy);
    metrics.setGauge('health_services_unhealthy', {}, aggregated.checks.unhealthy);
    metrics.observe('health_aggregation_duration_ms', {}, aggregated.duration);
    
    return aggregated;
  }
  
  /**
   * Verifica salud de un servicio específico
   */
  async checkServiceHealth(service) {
    try {
      const result = await globalServiceMesh.healthCheck(service.name);
      return {
        healthy: result.healthy,
        status: result.status,
        data: result.data,
        service: service.name,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        service: service.name,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Obtiene estado agregado actual
   */
  getAggregatedHealth() {
    return { ...this.aggregatedHealth };
  }
  
  /**
   * Obtiene health de un servicio específico
   */
  getServiceHealth(serviceName) {
    return this.aggregatedHealth.services[serviceName] || null;
  }
  
  /**
   * Verifica si el sistema está saludable
   */
  isSystemHealthy() {
    return this.aggregatedHealth.overall === 'healthy';
  }
}

// Instancia global del health aggregator
const globalHealthAggregator = new HealthAggregator();

module.exports = {
  HealthAggregator,
  globalHealthAggregator
};

