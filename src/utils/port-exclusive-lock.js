/**
 * ════════════════════════════════════════════════════════════════════════════
 * PORT EXCLUSIVE LOCK - Sistema de Locks Exclusivos de Puertos
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Sistema de exclusividad ABSOLUTA de puertos.
 * Cada puerto tiene un lock file exclusivo. Si está en uso, ERROR FATAL.
 * NO busca alternativos, NO comparte, EXCLUSIVIDAD O ERROR.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { LoggerFactory } = require('./logger');

const logger = LoggerFactory.create({ service: 'port-exclusive-lock' });

// Directorio de locks
const LOCKS_DIR = path.join(os.tmpdir(), 'qwen-valencia-ports');

// Asegurar que el directorio existe
if (!fs.existsSync(LOCKS_DIR)) {
  fs.mkdirSync(LOCKS_DIR, { recursive: true });
}

class PortExclusiveLock {
  constructor() {
    this.acquiredLocks = new Map(); // Map<port, lockInfo>
  }

  /**
   * Adquirir lock exclusivo de un puerto
   * @param {number} port - Puerto a bloquear
   * @param {number} pid - Process ID
   * @param {string} instanceId - ID de instancia
   * @returns {boolean} - true si adquirido, false si falla
   */
  acquireExclusiveLock(port, pid, instanceId) {
    const lockFilePath = path.join(LOCKS_DIR, `port-${port}.lock.json`);

    try {
      // Verificar si el lock existe y está activo
      if (fs.existsSync(lockFilePath)) {
        const existingLock = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));

        // Verificar si el PID del lock sigue vivo
        if (this.isProcessAlive(existingLock.pid)) {
          // El puerto está en uso exclusivo por otro proceso
          throw new Error(
            `Puerto ${port} está en uso exclusivo por proceso ${existingLock.pid} (Instancia: ${existingLock.instanceId || 'desconocida'}). ` +
              `No se puede compartir puertos. Cierre la otra instancia o use una instancia diferente.`
          );
        } else {
          // El proceso está muerto, limpiar lock
          logger.warn(
            `Limpiando lock huérfano del puerto ${port} (PID muerto: ${existingLock.pid})`
          );
          fs.unlinkSync(lockFilePath);
        }
      }

      // Crear nuevo lock exclusivo
      const lockInfo = {
        port,
        pid,
        instanceId,
        timestamp: Date.now(),
        exclusive: true
      };

      fs.writeFileSync(lockFilePath, JSON.stringify(lockInfo, null, 2), 'utf-8');
      this.acquiredLocks.set(port, lockInfo);

      logger.info(`Lock exclusivo adquirido para puerto ${port}`, { pid, instanceId });
      return true;
    } catch (error) {
      if (error.message.includes('está en uso exclusivo')) {
        // Relanzar error de exclusividad
        throw error;
      }

      logger.error(`Error adquiriendo lock exclusivo del puerto ${port}`, {
        error: error.message,
        port,
        pid
      });
      return false;
    }
  }

  /**
   * Liberar lock exclusivo de un puerto
   * @param {number} port - Puerto a liberar
   */
  releaseExclusiveLock(port) {
    const lockFilePath = path.join(LOCKS_DIR, `port-${port}.lock.json`);

    try {
      if (fs.existsSync(lockFilePath)) {
        fs.unlinkSync(lockFilePath);
        this.acquiredLocks.delete(port);
        logger.info(`Lock exclusivo liberado para puerto ${port}`);
      }
    } catch (error) {
      logger.error(`Error liberando lock del puerto ${port}`, {
        error: error.message,
        port
      });
    }
  }

  /**
   * Verificar si el lock del puerto sigue siendo nuestro
   * @param {number} port - Puerto a verificar
   * @param {number} pid - Nuestro PID
   * @returns {boolean} - true si es nuestro, false si no
   */
  verifyLockOwnership(port, pid) {
    const lockFilePath = path.join(LOCKS_DIR, `port-${port}.lock.json`);

    try {
      if (!fs.existsSync(lockFilePath)) {
        return false; // Lock no existe
      }

      const lockInfo = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));

      // Verificar que el PID coincide
      if (lockInfo.pid !== pid) {
        return false; // Otro proceso tiene el lock
      }

      // Verificar que nuestro proceso sigue vivo
      if (!this.isProcessAlive(pid)) {
        return false; // Nuestro proceso está muerto
      }

      return true; // El lock es nuestro y válido
    } catch (error) {
      logger.error(`Error verificando ownership del puerto ${port}`, {
        error: error.message,
        port
      });
      return false;
    }
  }

  /**
   * Verificar si un puerto está bloqueado exclusivamente
   * @param {number} port - Puerto a verificar
   * @returns {Object|null} - Info del lock si existe, null si está libre
   */
  isPortExclusivelyLocked(port) {
    const lockFilePath = path.join(LOCKS_DIR, `port-${port}.lock.json`);

    try {
      if (!fs.existsSync(lockFilePath)) {
        return null; // Puerto libre
      }

      const lockInfo = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));

      // Verificar si el proceso del lock sigue vivo
      if (!this.isProcessAlive(lockInfo.pid)) {
        // Proceso muerto, limpiar lock
        fs.unlinkSync(lockFilePath);
        return null; // Puerto libre (lock huérfano limpiado)
      }

      return lockInfo; // Puerto bloqueado exclusivamente
    } catch (error) {
      logger.error(`Error verificando si puerto ${port} está bloqueado`, {
        error: error.message,
        port
      });
      return null; // Asumir libre en caso de error
    }
  }

  /**
   * Verificar si un proceso está vivo
   * @param {number} pid - Process ID
   * @returns {boolean} - true si está vivo
   */
  isProcessAlive(pid) {
    try {
      if (process.platform === 'win32') {
        // Windows: usar tasklist
        const { execSync } = require('child_process');
        try {
          execSync(`tasklist /FI "PID eq ${pid}" 2>nul`, { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      } else {
        // Unix: usar kill -0
        process.kill(pid, 0);
        return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * Liberar todos los locks adquiridos por esta instancia
   */
  releaseAllLocks() {
    const portsToRelease = Array.from(this.acquiredLocks.keys());

    logger.info(`Liberando todos los locks exclusivos (${portsToRelease.length} puertos)`);

    portsToRelease.forEach(port => {
      this.releaseExclusiveLock(port);
    });

    this.acquiredLocks.clear();
  }

  /**
   * Limpiar locks huérfanos (procesos muertos)
   */
  cleanupOrphanedLocks() {
    try {
      const files = fs.readdirSync(LOCKS_DIR);
      let cleaned = 0;

      files.forEach(file => {
        if (file.startsWith('port-') && file.endsWith('.lock.json')) {
          const lockFilePath = path.join(LOCKS_DIR, file);
          try {
            const lockInfo = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));

            if (!this.isProcessAlive(lockInfo.pid)) {
              fs.unlinkSync(lockFilePath);
              cleaned++;
              logger.debug(`Lock huérfano limpiado: puerto ${lockInfo.port}`);
            }
          } catch (error) {
            // Lock corrupto, eliminar
            fs.unlinkSync(lockFilePath);
            cleaned++;
          }
        }
      });

      if (cleaned > 0) {
        logger.info(`Limpieza de locks huérfanos completada: ${cleaned} locks eliminados`);
      }

      return cleaned;
    } catch (error) {
      logger.error('Error limpiando locks huérfanos', { error: error.message });
      return 0;
    }
  }
}

// Singleton global
let portLockInstance = null;

function getPortExclusiveLock() {
  if (!portLockInstance) {
    portLockInstance = new PortExclusiveLock();

    // Limpiar locks huérfanos al inicializar
    portLockInstance.cleanupOrphanedLocks();

    // Limpiar locks al cerrar proceso
    process.on('exit', () => {
      if (portLockInstance) {
        portLockInstance.releaseAllLocks();
      }
    });

    process.on('SIGINT', () => {
      if (portLockInstance) {
        portLockInstance.releaseAllLocks();
      }
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      if (portLockInstance) {
        portLockInstance.releaseAllLocks();
      }
      process.exit(0);
    });
  }

  return portLockInstance;
}

module.exports = {
  PortExclusiveLock,
  getPortExclusiveLock
};
