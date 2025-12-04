/**
 * ════════════════════════════════════════════════════════════════════════════
 * SERVICE MESH - Capabilities Básicas de Service Mesh Enterprise-Level
 * Load balancing, retry, timeout, circuit breaking y más
 * ════════════════════════════════════════════════════════════════════════════
 */

const axios = require('axios');
const http = require('http');
const https = require('https');
const { LoggerFactory } = require('../utils/logger');
const { MetricsFactory } = require('../utils/metrics');
const { circuitBreakerManager } = require('../utils/circuit-breaker');
const { retry } = require('../utils/retry');
const { globalServiceRegistry } = require('./service-registry');
const { DataLoaderFactory } = require('../utils/data-loader');
const CorrelationMiddleware = require('../middleware/correlation');

const logger = LoggerFactory.create({ service: 'service-mesh' });
const metrics = MetricsFactory.create({ service: 'service_mesh' });

/**
 * Estrategias de load balancing
 */
const LoadBalancingStrategy = {
  ROUND_ROBIN: 'round-robin',
  RANDOM: 'random',
  LEAST_CONNECTIONS: 'least-connections',
  WEIGHTED: 'weighted',
  FIRST_AVAILABLE: 'first'
};

/**
 * Service Mesh Client para comunicación entre servicios
 */
class ServiceMeshClient {
  constructor(options = {}) {
    this.defaultTimeout = options.defaultTimeout || 30000;
    this.defaultRetries = options.defaultRetries || 3;
    this.defaultRetryDelay = options.defaultRetryDelay || 1000;
    this.loadBalancingStrategy = options.loadBalancingStrategy || LoadBalancingStrategy.ROUND_ROBIN;
    this.enableCircuitBreaker = options.enableCircuitBreaker !== false;
    this.enableTracing = options.enableTracing !== false;

    // Round-robin tracking
    this.roundRobinIndex = new Map();

    // Connection pooling - Reutilizar agentes HTTP
    this.httpAgents = new Map(); // protocol -> agent

    // DataLoader para batching de requests
    this.serviceLoader = DataLoaderFactory.createServiceLoader(
      async serviceNames => {
        return Promise.all(
          serviceNames.map(async serviceName => {
            try {
              const service = globalServiceRegistry.getService(serviceName, {
                healthyOnly: true
              });
              return { serviceName, service, error: null };
            } catch (error) {
              return { serviceName, service: null, error: error.message };
            }
          })
        );
      },
      { cacheTTL: 50 } // 50ms cache para service lookups
    );

    logger.info('Service Mesh Client inicializado', {
      strategy: this.loadBalancingStrategy,
      circuitBreaker: this.enableCircuitBreaker,
      connectionPooling: true,
      dataLoader: true
    });
  }

  /**
   * Obtiene o crea un HTTP agent para connection pooling
   */
  getHttpAgent(protocol) {
    if (!this.httpAgents.has(protocol)) {
      const Agent = protocol === 'https' ? https.Agent : http.Agent;
      const agent = new Agent({
        keepAlive: true,
        keepAliveMsecs: 1000,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 60000
      });
      this.httpAgents.set(protocol, agent);
    }
    return this.httpAgents.get(protocol);
  }

  /**
   * Realiza una llamada HTTP a un servicio
   */
  async callService(serviceName, options = {}) {
    const {
      method = 'GET',
      path = '/',
      data = null,
      headers = {},
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      retryDelay = this.defaultRetryDelay,
      strategy = this.loadBalancingStrategy,
      correlationId = null
    } = options;

    // Obtener instancia del servicio (load balancing)
    const service = globalServiceRegistry.getService(serviceName, {
      healthyOnly: true,
      strategy
    });

    if (!service) {
      const error = new Error(`Servicio ${serviceName} no disponible`);
      error.code = 'SERVICE_UNAVAILABLE';
      throw error;
    }

    const url = `${service.url}${path}`;

    // Preparar headers con correlation ID
    const requestHeaders = {
      ...headers,
      'X-Service-Name': serviceName,
      'X-Service-Version': service.version
    };

    if (correlationId) {
      requestHeaders['X-Correlation-ID'] = correlationId;
    }

    // Configurar circuit breaker si está habilitado
    const breakerName = `service-${serviceName}`;
    const breaker = this.enableCircuitBreaker
      ? circuitBreakerManager.getBreaker(breakerName, {
          failureThreshold: 5,
          timeout: 30000
        })
      : null;

    // Función de llamada HTTP
    const httpCall = async () => {
      const startTime = Date.now();

      try {
        // Usar connection pooling
        const protocol = service.protocol || 'http';
        const httpAgent = this.getHttpAgent(protocol);

        const config = {
          method,
          url,
          headers: requestHeaders,
          timeout,
          data,
          httpAgent: protocol === 'http' ? httpAgent : undefined,
          httpsAgent: protocol === 'https' ? httpAgent : undefined
        };

        const response = await axios(config);

        const duration = Date.now() - startTime;

        // Registrar métricas
        metrics.increment('service_call_success', {
          service: serviceName,
          method,
          status: response.status
        });
        metrics.observe(
          'service_call_duration_ms',
          {
            service: serviceName,
            method
          },
          duration
        );

        return {
          success: true,
          data: response.data,
          status: response.status,
          headers: response.headers,
          service: {
            name: service.name,
            version: service.version,
            host: service.host,
            port: service.port
          },
          duration
        };
      } catch (error) {
        const duration = Date.now() - startTime;

        // Registrar métricas de error
        metrics.increment('service_call_error', {
          service: serviceName,
          method,
          errorType: error.code || 'UNKNOWN'
        });
        metrics.observe(
          'service_call_error_duration_ms',
          {
            service: serviceName,
            method
          },
          duration
        );

        throw error;
      }
    };

    // Ejecutar con circuit breaker si está habilitado
    if (breaker) {
      return await breaker.execute(httpCall);
    }

    // Ejecutar con retry
    return await retry(httpCall, {
      maxRetries: retries,
      retryDelay,
      onRetry: (error, attempt, delay) => {
        logger.debug('Reintentando llamada a servicio', {
          service: serviceName,
          attempt,
          delay,
          error: error.message
        });
      }
    });
  }

  /**
   * GET request a un servicio
   */
  async get(serviceName, path, options = {}) {
    return this.callService(serviceName, {
      method: 'GET',
      path,
      ...options
    });
  }

  /**
   * POST request a un servicio
   */
  async post(serviceName, path, data, options = {}) {
    return this.callService(serviceName, {
      method: 'POST',
      path,
      data,
      ...options
    });
  }

  /**
   * PUT request a un servicio
   */
  async put(serviceName, path, data, options = {}) {
    return this.callService(serviceName, {
      method: 'PUT',
      path,
      data,
      ...options
    });
  }

  /**
   * DELETE request a un servicio
   */
  async delete(serviceName, path, options = {}) {
    return this.callService(serviceName, {
      method: 'DELETE',
      path,
      ...options
    });
  }

  /**
   * Health check de un servicio
   */
  async healthCheck(serviceName) {
    try {
      // Obtener servicio del registro
      const service = globalServiceRegistry.getService(serviceName);
      if (!service) {
        return {
          healthy: false,
          error: 'Service not found in registry'
        };
      }

      // Usar healthEndpoint del servicio, o '/health' como default
      const healthPath = service.healthEndpoint || '/health';

      const result = await this.get(serviceName, healthPath, {
        timeout: 5000,
        retries: 1
      });
      return {
        healthy: result.status >= 200 && result.status < 400,
        status: result.status,
        data: result.data
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Batch GET - Obtiene múltiples servicios en una llamada
   * @param {Array<{serviceName: string, path: string, options?: Object}>} requests - Array de requests
   * @returns {Promise<Array>} Array de resultados
   */
  async batchGet(requests) {
    const startTime = Date.now();

    try {
      // Ejecutar todos los requests en paralelo
      const results = await Promise.allSettled(
        requests.map(({ serviceName, path, options = {} }) =>
          this.get(serviceName, path, options).catch(error => ({
            success: false,
            error: error.message,
            serviceName
          }))
        )
      );

      const duration = Date.now() - startTime;

      // Procesar resultados
      const processedResults = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            success: false,
            error: result.reason?.message || 'Unknown error',
            serviceName: requests[index].serviceName
          };
        }
      });

      // Registrar métricas
      metrics.increment('batch_get_total', {
        count: requests.length
      });
      metrics.observe('batch_get_duration_ms', {}, duration);

      return {
        success: true,
        results: processedResults,
        duration,
        count: requests.length
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Error en batchGet', {
        error: error.message,
        count: requests.length
      });

      metrics.increment('batch_get_errors', {});

      throw error;
    }
  }

  /**
   * Health check batch - Verifica salud de múltiples servicios en paralelo
   * @param {Array<string>} serviceNames - Array de nombres de servicios
   * @returns {Promise<Array>} Array de resultados de health check
   */
  async batchHealthCheck(serviceNames) {
    const startTime = Date.now();

    try {
      const results = await Promise.allSettled(
        serviceNames.map(serviceName => this.healthCheck(serviceName))
      );

      const duration = Date.now() - startTime;

      const processedResults = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return {
            serviceName: serviceNames[index],
            ...result.value
          };
        } else {
          return {
            serviceName: serviceNames[index],
            healthy: false,
            error: result.reason?.message || 'Unknown error'
          };
        }
      });

      // Registrar métricas
      metrics.increment('batch_health_check_total', {
        count: serviceNames.length
      });
      metrics.observe('batch_health_check_duration_ms', {}, duration);

      return {
        success: true,
        results: processedResults,
        duration,
        count: serviceNames.length
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Error en batchHealthCheck', {
        error: error.message,
        count: serviceNames.length
      });

      metrics.increment('batch_health_check_errors', {});

      throw error;
    }
  }

  /**
   * Bulkhead isolation - Limita concurrencia por servicio
   */
  async callWithBulkhead(serviceName, maxConcurrency, fn) {
    // Implementación simple de bulkhead usando semáforo
    if (!this.bulkheadSemaphores) {
      this.bulkheadSemaphores = new Map();
    }

    if (!this.bulkheadSemaphores.has(serviceName)) {
      this.bulkheadSemaphores.set(serviceName, {
        current: 0,
        max: maxConcurrency,
        queue: []
      });
    }

    const semaphore = this.bulkheadSemaphores.get(serviceName);

    return new Promise((resolve, reject) => {
      const execute = async () => {
        if (semaphore.current >= semaphore.max) {
          semaphore.queue.push({ execute, resolve, reject });
          return;
        }

        semaphore.current++;

        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          semaphore.current--;

          // Procesar siguiente en la cola
          if (semaphore.queue.length > 0) {
            const next = semaphore.queue.shift();
            next.execute();
          }
        }
      };

      execute();
    });
  }
}

// Instancia global del service mesh client
const globalServiceMesh = new ServiceMeshClient();

module.exports = {
  ServiceMeshClient,
  LoadBalancingStrategy,
  globalServiceMesh
};
