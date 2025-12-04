/**
 * ════════════════════════════════════════════════════════════════════════════
 * PORT POOL MANAGER - Gestión de Pools de Puertos con Rotación Automática
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Gestiona pools de puertos exclusivos por servicio.
 * Rotación automática: si un puerto falla, intenta el siguiente del pool.
 * Todos los puertos del pool están protegidos exclusivamente.
 */

const { getPortExclusiveLock } = require('./port-exclusive-lock');
const { LoggerFactory } = require('./logger');
const net = require('net');

const logger = LoggerFactory.create({ service: 'port-pool-manager' });

class PortPoolManager {
  constructor(serviceName, portPool, pid, instanceId) {
    this.serviceName = serviceName;
    this.portPool = Array.isArray(portPool) ? portPool : [portPool]; // Asegurar array
    this.pid = pid;
    this.instanceId = instanceId;
    this.acquiredPort = null;
    this.portLock = getPortExclusiveLock();
    this.attemptedPorts = [];
  }

  /**
   * Adquirir un puerto del pool con rotación automática
   * @returns {number|null} - Puerto adquirido o null si todos fallan
   */
  async acquirePortFromPool() {
    this.attemptedPorts = [];

    // Limpiar locks huérfanos primero
    this.portLock.cleanupOrphanedLocks();

    // Intentar cada puerto del pool en orden
    for (const port of this.portPool) {
      try {
        // Verificar si puerto está bloqueado exclusivamente
        const existingLock = this.portLock.isPortExclusivelyLocked(port);

        if (existingLock) {
          // Puerto bloqueado por otro proceso activo
          this.attemptedPorts.push({
            port,
            reason: `Bloqueado exclusivamente por proceso ${existingLock.pid} (Instancia: ${existingLock.instanceId || 'desconocida'})`
          });
          logger.warn(
            `Puerto ${port} del pool de ${this.serviceName} está bloqueado exclusivamente`,
            {
              port,
              blockingPid: existingLock.pid,
              blockingInstance: existingLock.instanceId
            }
          );
          continue; // Intentar siguiente puerto
        }

        // Verificar si el puerto está técnicamente disponible (net.listen)
        const portAvailable = await this.checkPortAvailability(port);

        if (!portAvailable) {
          this.attemptedPorts.push({
            port,
            reason: 'Puerto técnicamente ocupado (no se puede hacer bind)'
          });
          logger.warn(
            `Puerto ${port} del pool de ${this.serviceName} no está disponible técnicamente`,
            { port }
          );
          continue; // Intentar siguiente puerto
        }

        // Adquirir lock exclusivo
        try {
          const acquired = this.portLock.acquireExclusiveLock(port, this.pid, this.instanceId);

          if (acquired) {
            this.acquiredPort = port;
            logger.info(`Puerto ${port} adquirido del pool de ${this.serviceName}`, {
              service: this.serviceName,
              port,
              pool: this.portPool,
              instanceId: this.instanceId
            });
            return port;
          }
        } catch (lockError) {
          // Error al adquirir lock (puerto en uso exclusivo)
          this.attemptedPorts.push({
            port,
            reason: lockError.message
          });
          logger.warn(`No se pudo adquirir lock exclusivo del puerto ${port}`, {
            port,
            error: lockError.message
          });
          continue; // Intentar siguiente puerto
        }
      } catch (error) {
        this.attemptedPorts.push({
          port,
          reason: `Error: ${error.message}`
        });
        logger.error(`Error verificando puerto ${port} del pool`, {
          port,
          error: error.message
        });
        continue; // Intentar siguiente puerto
      }
    }

    // Si llegamos aquí, todos los puertos del pool fallaron
    logger.error(`ERROR FATAL: No se pudo adquirir ningún puerto del pool de ${this.serviceName}`, {
      service: this.serviceName,
      pool: this.portPool,
      attemptedPorts: this.attemptedPorts,
      instanceId: this.instanceId
    });

    return null; // Todos los puertos fallaron
  }

  /**
   * Verificar disponibilidad técnica de un puerto (net.listen)
   * @param {number} port - Puerto a verificar
   * @returns {Promise<boolean>} - true si está disponible
   */
  checkPortAvailability(port) {
    return new Promise(resolve => {
      const server = net.createServer();

      server.listen(port, () => {
        server.once('close', () => resolve(true));
        server.close();
      });

      server.on('error', () => {
        resolve(false);
      });

      // Timeout de seguridad
      setTimeout(() => {
        try {
          server.close();
        } catch (e) {
          // Ignorar
        }
        resolve(false);
      }, 1000);
    });
  }

  /**
   * Liberar el puerto adquirido
   */
  releasePort() {
    if (this.acquiredPort !== null) {
      this.portLock.releaseExclusiveLock(this.acquiredPort);
      logger.info(`Puerto ${this.acquiredPort} liberado del pool de ${this.serviceName}`, {
        service: this.serviceName,
        port: this.acquiredPort
      });
      this.acquiredPort = null;
    }
  }

  /**
   * Verificar que el puerto adquirido sigue siendo nuestro
   * @returns {boolean} - true si sigue siendo nuestro
   */
  verifyPortOwnership() {
    if (this.acquiredPort === null) {
      return false;
    }

    return this.portLock.verifyLockOwnership(this.acquiredPort, this.pid);
  }

  /**
   * Obtener información del intento de adquisición
   * @returns {Object} - Info de intentos y puerto adquirido
   */
  getAcquisitionInfo() {
    return {
      serviceName: this.serviceName,
      portPool: this.portPool,
      acquiredPort: this.acquiredPort,
      attemptedPorts: this.attemptedPorts,
      success: this.acquiredPort !== null,
      instanceId: this.instanceId
    };
  }
}

module.exports = {
  PortPoolManager
};
