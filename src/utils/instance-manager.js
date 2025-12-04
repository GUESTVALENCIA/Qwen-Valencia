/**
 * ════════════════════════════════════════════════════════════════════════════
 * INSTANCE MANAGER - Gestión de Instancias y Cálculo de Pools de Puertos
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Detecta número de instancia y calcula pools de puertos exclusivos.
 * Cada instancia tiene sus propios pools numerados.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { LoggerFactory } = require('./logger');
const { getPortExclusiveLock } = require('./port-exclusive-lock');

const logger = LoggerFactory.create({ service: 'instance-manager' });

// Directorio de instancias
const INSTANCES_DIR = path.join(os.tmpdir(), 'qwen-valencia-instances');

// Asegurar que el directorio existe
if (!fs.existsSync(INSTANCES_DIR)) {
  fs.mkdirSync(INSTANCES_DIR, { recursive: true });
}

class InstanceManager {
  constructor() {
    this.instanceNumber = null;
    this.instanceId = null;
    this.pid = process.pid;
    this.portPools = {};
    this.lockFile = null;
  }

  /**
   * Detectar o asignar número de instancia
   * @returns {number} - Número de instancia (1, 2, 3, etc.)
   */
  detectInstanceNumber() {
    // Limpiar instancias muertas primero
    this.cleanupDeadInstances();

    // Buscar siguiente número de instancia disponible
    let instanceNumber = 1;
    const maxInstances = 100; // Límite razonable

    while (instanceNumber <= maxInstances) {
      const instanceLockFile = path.join(INSTANCES_DIR, `instance-${instanceNumber}.lock.json`);

      if (!fs.existsSync(instanceLockFile)) {
        // Esta instancia está libre
        this.instanceNumber = instanceNumber;
        this.instanceId = `instance-${instanceNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.createInstanceLock(instanceNumber);
        return instanceNumber;
      }

      // Verificar si la instancia registrada está viva
      try {
        const lockInfo = JSON.parse(fs.readFileSync(instanceLockFile, 'utf-8'));

        if (!this.isProcessAlive(lockInfo.pid)) {
          // Instancia muerta, reutilizar número
          logger.warn(
            `Reutilizando número de instancia ${instanceNumber} (instancia anterior muerta)`,
            {
              oldPid: lockInfo.pid
            }
          );
          this.instanceNumber = instanceNumber;
          this.instanceId = `instance-${instanceNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          this.createInstanceLock(instanceNumber);
          return instanceNumber;
        }
      } catch (error) {
        // Lock corrupto, reutilizar
        logger.warn(`Reutilizando número de instancia ${instanceNumber} (lock corrupto)`);
        this.instanceNumber = instanceNumber;
        this.instanceId = `instance-${instanceNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.createInstanceLock(instanceNumber);
        return instanceNumber;
      }

      instanceNumber++;
    }

    // No hay instancias disponibles
    throw new Error(`No hay números de instancia disponibles (máximo ${maxInstances} instancias)`);
  }

  /**
   * Crear lock file de instancia
   * @param {number} instanceNumber - Número de instancia
   */
  createInstanceLock(instanceNumber) {
    const lockFile = path.join(INSTANCES_DIR, `instance-${instanceNumber}.lock.json`);

    const lockInfo = {
      instanceNumber,
      instanceId: this.instanceId,
      pid: this.pid,
      startedAt: Date.now(),
      lastHeartbeat: Date.now()
    };

    fs.writeFileSync(lockFile, JSON.stringify(lockInfo, null, 2), 'utf-8');
    this.lockFile = lockFile;

    logger.info(`Instancia ${instanceNumber} registrada`, {
      instanceNumber,
      instanceId: this.instanceId,
      pid: this.pid
    });
  }

  /**
   * Actualizar heartbeat de la instancia
   */
  updateHeartbeat() {
    if (!this.lockFile || !fs.existsSync(this.lockFile)) {
      return;
    }

    try {
      const lockInfo = JSON.parse(fs.readFileSync(this.lockFile, 'utf-8'));
      lockInfo.lastHeartbeat = Date.now();
      fs.writeFileSync(this.lockFile, JSON.stringify(lockInfo, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Error actualizando heartbeat', { error: error.message });
    }
  }

  /**
   * Calcular pools de puertos para esta instancia
   * @returns {Object} - Pools de puertos por servicio
   */
  calculatePortPools() {
    if (!this.instanceNumber) {
      throw new Error('Debe detectar número de instancia primero');
    }

    const basePort = 6000 + (this.instanceNumber - 1) * 100;
    const baseApiPort = 9000 + (this.instanceNumber - 1) * 100;
    const baseConversationalPort = 7000 + (this.instanceNumber - 1) * 100;

    // Configuración de pools por servicio
    this.portPools = {
      'mcp-universal': {
        pool: [basePort, basePort + 1, basePort + 2],
        description: 'MCP Universal Server'
      },
      'ollama-mcp': {
        pool: [basePort + 10, basePort + 11, basePort + 12],
        description: 'Ollama MCP Server'
      },
      'groq-api': {
        pool: [basePort + 20, basePort + 21, basePort + 22],
        description: 'Groq API Server'
      },
      'sandra-ia': {
        pool: [basePort + 30, basePort + 31, basePort + 32, basePort + 33],
        description: 'Sandra IA Server'
      },
      conversational: {
        pool: [
          baseConversationalPort,
          baseConversationalPort + 1,
          baseConversationalPort + 2,
          baseConversationalPort + 3,
          baseConversationalPort + 4
        ],
        description: 'Sistema Conversacional/Llamada'
      },
      'api-server': {
        pool: [baseApiPort, baseApiPort + 1, baseApiPort + 2],
        description: 'API Server'
      }
    };

    logger.info(`Pools de puertos calculados para instancia ${this.instanceNumber}`, {
      instanceNumber: this.instanceNumber,
      basePort,
      pools: Object.entries(this.portPools).reduce((acc, [key, value]) => {
        acc[key] = value.pool;
        return acc;
      }, {})
    });

    return this.portPools;
  }

  /**
   * Obtener pool de puertos para un servicio
   * @param {string} serviceName - Nombre del servicio
   * @returns {Array<number>} - Pool de puertos
   */
  getPortPool(serviceName) {
    if (!this.portPools[serviceName]) {
      throw new Error(`Pool de puertos no definido para servicio: ${serviceName}`);
    }
    return this.portPools[serviceName].pool;
  }

  /**
   * Limpiar instancias muertas
   */
  cleanupDeadInstances() {
    try {
      const files = fs.readdirSync(INSTANCES_DIR);
      let cleaned = 0;
      const timeout = 5 * 60 * 1000; // 5 minutos sin heartbeat = muerta

      files.forEach(file => {
        if (file.startsWith('instance-') && file.endsWith('.lock.json')) {
          const lockFilePath = path.join(INSTANCES_DIR, file);
          try {
            const lockInfo = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));

            // Verificar si el proceso está muerto o timeout de heartbeat
            const isDead = !this.isProcessAlive(lockInfo.pid);
            const heartbeatTimeout = Date.now() - lockInfo.lastHeartbeat > timeout;

            if (isDead || heartbeatTimeout) {
              fs.unlinkSync(lockFilePath);
              cleaned++;
              logger.debug(
                `Instancia muerta limpiada: ${lockInfo.instanceNumber} (PID: ${lockInfo.pid})`
              );
            }
          } catch (error) {
            // Lock corrupto, eliminar
            fs.unlinkSync(lockFilePath);
            cleaned++;
          }
        }
      });

      if (cleaned > 0) {
        logger.info(`Limpieza de instancias muertas completada: ${cleaned} instancias eliminadas`);
      }

      return cleaned;
    } catch (error) {
      logger.error('Error limpiando instancias muertas', { error: error.message });
      return 0;
    }
  }

  /**
   * Verificar si un proceso está vivo
   * @param {number} pid - Process ID
   * @returns {boolean}
   */
  isProcessAlive(pid) {
    try {
      if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        try {
          execSync(`tasklist /FI "PID eq ${pid}" 2>nul`, { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      } else {
        process.kill(pid, 0);
        return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * Liberar instancia al cerrar
   */
  releaseInstance() {
    if (this.lockFile && fs.existsSync(this.lockFile)) {
      try {
        fs.unlinkSync(this.lockFile);
        logger.info(`Instancia ${this.instanceNumber} liberada`, {
          instanceNumber: this.instanceNumber,
          instanceId: this.instanceId
        });
      } catch (error) {
        logger.error('Error liberando instancia', { error: error.message });
      }
    }
  }

  /**
   * Iniciar heartbeat automático
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.updateHeartbeat();
    }, 30000); // Cada 30 segundos
  }

  /**
   * Detener heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

// Singleton global
let instanceManager = null;

function getInstanceManager() {
  if (!instanceManager) {
    instanceManager = new InstanceManager();

    // Limpiar al cerrar
    process.on('exit', () => {
      if (instanceManager) {
        instanceManager.stopHeartbeat();
        instanceManager.releaseInstance();
      }
    });

    process.on('SIGINT', () => {
      if (instanceManager) {
        instanceManager.stopHeartbeat();
        instanceManager.releaseInstance();
      }
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      if (instanceManager) {
        instanceManager.stopHeartbeat();
        instanceManager.releaseInstance();
      }
      process.exit(0);
    });
  }

  return instanceManager;
}

module.exports = {
  InstanceManager,
  getInstanceManager
};
