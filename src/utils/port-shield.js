/**
 * ════════════════════════════════════════════════════════════════════════════
 * PORT SHIELD - Protección Activa de Puertos
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Shield activo que protege el puerto en uso.
 * Monitoreo continuo del lock. Si pierde lock, ERROR FATAL y cerrar aplicación.
 */

const { getPortExclusiveLock } = require('./port-exclusive-lock');
const { LoggerFactory } = require('./logger');

const logger = LoggerFactory.create({ service: 'port-shield' });

class PortShield {
  constructor(port, pid, instanceId, onLockLost) {
    this.port = port;
    this.pid = pid;
    this.instanceId = instanceId;
    this.onLockLost =
      onLockLost ||
      (() => {
        logger.error(
          `SHIELD PERDIDO: Puerto ${port} ya no está bajo nuestro control exclusivo. Cerrando aplicación.`
        );
        process.exit(1);
      });
    this.monitoringInterval = null;
    this.heartbeatInterval = null;
    this.portLock = getPortExclusiveLock();
    this.isActive = false;
  }

  /**
   * Activar shield del puerto
   */
  activate() {
    if (this.isActive) {
      logger.warn(`Shield del puerto ${this.port} ya está activo`);
      return;
    }

    this.isActive = true;

    // Monitoreo cada 10 segundos
    this.monitoringInterval = setInterval(() => {
      this.monitorLock();
    }, 10000);

    // Heartbeat cada 30 segundos (el lock se actualiza automáticamente)
    this.heartbeatInterval = setInterval(() => {
      this.updateHeartbeat();
    }, 30000);

    logger.info(`Shield activado para puerto ${this.port}`, {
      port: this.port,
      pid: this.pid,
      instanceId: this.instanceId
    });
  }

  /**
   * Monitorear que el lock sigue siendo nuestro
   */
  monitorLock() {
    if (!this.isActive) {
      return;
    }

    const isOurs = this.portLock.verifyLockOwnership(this.port, this.pid);

    if (!isOurs) {
      logger.error(
        `SHIELD PERDIDO: Puerto ${this.port} ya no está bajo nuestro control exclusivo`,
        {
          port: this.port,
          pid: this.pid,
          instanceId: this.instanceId
        }
      );

      this.deactivate();
      this.onLockLost(this.port);
    }
  }

  /**
   * Actualizar heartbeat del lock
   */
  updateHeartbeat() {
    if (!this.isActive) {
      return;
    }

    // Verificar que el lock sigue siendo nuestro
    const isOurs = this.portLock.verifyLockOwnership(this.port, this.pid);

    if (!isOurs) {
      logger.error(`HEARTBEAT FALLIDO: Puerto ${this.port} perdido durante heartbeat`, {
        port: this.port
      });
      this.deactivate();
      this.onLockLost(this.port);
    }
  }

  /**
   * Desactivar shield
   */
  deactivate() {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    logger.info(`Shield desactivado para puerto ${this.port}`, {
      port: this.port
    });
  }

  /**
   * Verificar estado del shield
   * @returns {boolean} - true si está activo y protegido
   */
  isProtected() {
    if (!this.isActive) {
      return false;
    }

    return this.portLock.verifyLockOwnership(this.port, this.pid);
  }
}

class PortShieldManager {
  constructor() {
    this.shields = new Map(); // Map<port, PortShield>
  }

  /**
   * Crear y activar shield para un puerto
   * @param {number} port - Puerto a proteger
   * @param {number} pid - Process ID
   * @param {string} instanceId - ID de instancia
   * @param {Function} onLockLost - Callback cuando se pierde lock
   * @returns {PortShield} - Shield creado
   */
  createShield(port, pid, instanceId, onLockLost) {
    if (this.shields.has(port)) {
      logger.warn(`Shield ya existe para puerto ${port}, reutilizando`);
      return this.shields.get(port);
    }

    const shield = new PortShield(port, pid, instanceId, onLockLost);
    shield.activate();
    this.shields.set(port, shield);

    return shield;
  }

  /**
   * Desactivar shield de un puerto
   * @param {number} port - Puerto
   */
  removeShield(port) {
    const shield = this.shields.get(port);
    if (shield) {
      shield.deactivate();
      this.shields.delete(port);
    }
  }

  /**
   * Desactivar todos los shields
   */
  removeAllShields() {
    logger.info(`Desactivando todos los shields (${this.shields.size} puertos)`);

    this.shields.forEach((shield, port) => {
      shield.deactivate();
    });

    this.shields.clear();
  }

  /**
   * Verificar que todos los shields siguen activos
   * @returns {Array<number>} - Puertos que perdieron protección
   */
  verifyAllShields() {
    const lostPorts = [];

    this.shields.forEach((shield, port) => {
      if (!shield.isProtected()) {
        lostPorts.push(port);
      }
    });

    return lostPorts;
  }
}

// Singleton global
let shieldManager = null;

function getPortShieldManager() {
  if (!shieldManager) {
    shieldManager = new PortShieldManager();

    // Limpiar al cerrar
    process.on('exit', () => {
      if (shieldManager) {
        shieldManager.removeAllShields();
      }
    });

    process.on('SIGINT', () => {
      if (shieldManager) {
        shieldManager.removeAllShields();
      }
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      if (shieldManager) {
        shieldManager.removeAllShields();
      }
      process.exit(0);
    });
  }

  return shieldManager;
}

module.exports = {
  PortShield,
  PortShieldManager,
  getPortShieldManager
};
