/**
 * ════════════════════════════════════════════════════════════════════════════
 * MCP MONITOR - Monitoreo de Salud y Flujos de Trabajo MCP
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Monitorea la salud de los servidores MCP y gestiona colas de trabajo.
 */

const http = require('http');
const EventEmitter = require('events');

class MCPMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    this.mcpServerUrl = config.mcpServerUrl || 'http://localhost:3141';
    this.healthCheckInterval = config.healthCheckInterval || 10000;
    this.queueMonitorInterval = config.queueMonitorInterval || 5000;
    this.isRunning = false;
    this.queueSize = 0;
    this.lastHealthCheck = null;
  }

  /**
   * Verifica la salud del servidor MCP
   */
  async healthCheck() {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      http.get(`${this.mcpServerUrl}/health`, (res) => {
        const latency = Date.now() - startTime;
        let data = '';
        
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          const healthy = res.statusCode === 200;
          const result = {
            healthy,
            latency,
            statusCode: res.statusCode,
            timestamp: new Date().toISOString()
          };

          this.lastHealthCheck = result;
          
          if (!healthy) {
            this.emit('unhealthy', result);
          }

          resolve(result);
        });
      }).on('error', (error) => {
        const result = {
          healthy: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        this.lastHealthCheck = result;
        this.emit('unhealthy', result);
        reject(error);
      });
    });
  }

  /**
   * Monitorea la salud periódicamente
   */
  startHealthMonitoring() {
    this.healthIntervalId = setInterval(async () => {
      try {
        const health = await this.healthCheck();
        if (health.healthy) {
          console.log(`✅ MCP Server saludable (latencia: ${health.latency}ms)`);
        } else {
          console.error(`❌ MCP Server no saludable: ${health.error || 'Status ' + health.statusCode}`);
          this.emit('healthCheck', health);
        }
      } catch (error) {
        console.error(`❌ Error en health check: ${error.message}`);
        this.emit('healthError', error);
      }
    }, this.healthCheckInterval);
  }

  /**
   * Monitorea el tamaño de la cola
   */
  async checkQueueSize() {
    try {
      // Simular verificación de cola (ajustar según implementación real)
      const response = await fetch(`${this.mcpServerUrl}/queue/size`);
      const data = await response.json();
      this.queueSize = data.size || 0;

      if (this.queueSize > 10) {
        console.warn(`⚠️  Cola MCP grande: ${this.queueSize} tareas`);
        this.emit('queueWarning', { size: this.queueSize });
      }

      return this.queueSize;
    } catch (error) {
      // Si no hay endpoint de cola, usar estimación
      return this.queueSize;
    }
  }

  /**
   * Monitorea la cola periódicamente
   */
  startQueueMonitoring() {
    this.queueIntervalId = setInterval(async () => {
      try {
        await this.checkQueueSize();
      } catch (error) {
        // Silenciar errores de cola si no está implementado
      }
    }, this.queueMonitorInterval);
  }

  /**
   * Detecta workflows bloqueados
   */
  async detectBlockedWorkflows() {
    // Implementar lógica de detección de workflows bloqueados
    // Por ahora, placeholder
    return [];
  }

  /**
   * Inicia todo el monitoreo
   */
  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('🔍 Iniciando monitoreo MCP...');
    
    this.startHealthMonitoring();
    this.startQueueMonitoring();
    
    console.log('✅ Monitor MCP iniciado\n');
  }

  /**
   * Detiene el monitoreo
   */
  stop() {
    if (this.healthIntervalId) clearInterval(this.healthIntervalId);
    if (this.queueIntervalId) clearInterval(this.queueIntervalId);
    this.isRunning = false;
    console.log('⏹️  Monitor MCP detenido');
  }

  /**
   * Obtiene estado actual
   */
  getStatus() {
    return {
      running: this.isRunning,
      lastHealthCheck: this.lastHealthCheck,
      queueSize: this.queueSize,
      mcpServerUrl: this.mcpServerUrl
    };
  }
}

module.exports = MCPMonitor;

