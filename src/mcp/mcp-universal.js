/**
 * ════════════════════════════════════════════════════════════════════════════
 * MCP UNIVERSAL SERVER - QWEN-VALENCIA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Servidor MCP simplificado y limpio para Qwen + DeepSeek
 * Sin contaminación descriptiva - Solo ejecución real
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const { getServiceConfig, getServicePortPool } = require('../config');
const { LoggerFactory } = require('../utils/logger');
const { MetricsFactory } = require('../utils/metrics');
const SecurityMiddleware = require('../middleware/security');
const CorrelationMiddleware = require('../middleware/correlation');
const ValidatorMiddleware = require('../middleware/validator');
const { setupSwagger } = require('../utils/swagger-setup');
const { PortPoolManager } = require('../utils/port-pool-manager');
const { getPortShieldManager } = require('../utils/port-shield');
const { getInstanceManager } = require('../utils/instance-manager');

const execAsync = promisify(exec);

class MCPUniversal {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    // Cargar configuración centralizada
    const serviceConfig = getServiceConfig('mcp-universal');

    // Obtener pool de puertos exclusivos
    const portPool = getServicePortPool('mcp-universal');
    const instanceManager = getInstanceManager();

    // Logger y métricas
    this.logger = LoggerFactory.create('mcp-universal');
    this.metrics = MetricsFactory.create('mcp_universal');

    this.wsClients = new Set();
    this.portPoolManager = null;
    this.port = null; // Se asignará al adquirir del pool
    this.shield = null;

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupSwagger();

    this.logger.info('MCP Universal Server inicializado', {
      portPool,
      instanceId: instanceManager.instanceId || 'pending'
    });
  }

  /**
   * Configurar Swagger UI para documentación OpenAPI
   */
  setupSwagger() {
    try {
      setupSwagger(this.app);
      this.logger.info('Swagger UI configurado en /api/docs');
    } catch (error) {
      this.logger.warn('No se pudo configurar Swagger UI', { error: error.message });
    }
  }

  setupMiddleware() {
    const serviceConfig = getServiceConfig('mcp-universal');

    // Body parser
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.text({ limit: '50mb' }));

    // Correlation IDs
    const correlationMiddleware = CorrelationMiddleware.create();
    this.app.use(correlationMiddleware.middleware());

    // Security middleware
    const securityMiddleware = SecurityMiddleware.create({
      enableHelmet: serviceConfig.security?.enableHelmet !== false,
      corsOrigin: serviceConfig.security?.corsOrigin || '*',
      corsCredentials: serviceConfig.security?.corsCredentials !== false,
      corsMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      corsHeaders: [
        'Content-Type',
        'Authorization',
        'mcp-secret',
        'X-Requested-With',
        'X-Correlation-ID'
      ],
      trustProxy: serviceConfig.security?.trustProxy || false
    });
    this.app.use(securityMiddleware.middleware());

    // Validator middleware
    this.validator = ValidatorMiddleware.create();

    // Middleware de autenticación
    this.app.use((req, res, next) => {
      if (
        req.path === '/health' ||
        req.path === '/mcp/health' ||
        req.path === '/health/ready' ||
        req.path === '/health/live'
      ) {
        return next();
      }

      const secret =
        req.headers['mcp-secret'] || req.headers['authorization']?.replace('Bearer ', '');
      const expectedSecret = serviceConfig.secretKey || 'qwen_valencia_mcp_secure_2025';

      if (secret !== expectedSecret) {
        const { APIError } = require('../utils/api-error');
        const error = APIError.authRequired('MCP_SECRET_KEY requerido');
        return res.status(error.statusCode).json(error.toJSON());
      }
      next();
    });

    // Logging de requests con correlation ID
    this.app.use((req, res, next) => {
      const correlationId = req.correlationId || 'unknown';
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        this.logger.info('Request procesado', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          correlationId
        });

        // Métricas
        this.metrics.recordRequest(req.method, req.path, res.statusCode, duration);
      });

      next();
    });
  }

  setupRoutes() {
    // Health check (liveness)
    this.app.get('/health', (req, res) => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();

      res.json({
        status: 'healthy',
        protocol: 'mcp-universal',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        capabilities: {
          execute_code: true,
          read_file: true,
          write_file: true,
          list_files: true,
          execute_command: true
        },
        system: {
          memory: {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
          },
          cpu: {
            user: `${cpuUsage.user / 1000}ms`,
            system: `${cpuUsage.system / 1000}ms`
          },
          platform: process.platform,
          nodeVersion: process.version
        },
        websockets: {
          activeConnections: this.wsClients.size
        }
      });
    });

    this.app.get('/mcp/health', (req, res) => {
      res.json({ status: 'healthy', port: this.port });
    });

    // Health check (readiness)
    this.app.get('/health/ready', (req, res) => {
      const isReady = this.server && this.server.listening;
      res.status(isReady ? 200 : 503).json({
        ready: isReady,
        service: 'mcp-universal',
        checks: {
          server: this.server && this.server.listening,
          websocket: this.wss && this.wss.clients
        }
      });
    });

    // Health check (liveness)
    this.app.get('/health/live', (req, res) => {
      res.json({
        alive: true,
        service: 'mcp-universal',
        pid: process.pid
      });
    });

    // ==================== PROXY A SERVIDORES DEDICADOS ====================

    // Proxy para Ollama MCP Server
    this.app.use('/mcp/ollama', async (req, res, next) => {
      try {
        const axios = require('axios');
        const ollamaMcpUrl = process.env.OLLAMA_MCP_URL || 'http://localhost:6002';
        const targetUrl = `${ollamaMcpUrl}${req.path.replace('/mcp/ollama', '')}`;

        const response = await axios({
          method: req.method,
          url: targetUrl,
          data: req.body,
          params: req.query,
          headers: {
            ...req.headers,
            host: undefined
          },
          timeout: 300000,
          responseType: req.method === 'GET' ? 'json' : 'stream'
        });

        if (response.data.pipe) {
          response.data.pipe(res);
        } else {
          res.json(response.data);
        }
      } catch (error) {
        res.status(error.response?.status || 500).json({
          error: error.message || 'Error en proxy Ollama'
        });
      }
    });

    // Proxy para Groq API Server
    this.app.use('/mcp/groq', async (req, res, next) => {
      try {
        const axios = require('axios');
        const groqApiUrl = process.env.GROQ_API_URL || 'http://localhost:6003';
        const targetUrl = `${groqApiUrl}${req.path.replace('/mcp/groq', '')}`;

        const response = await axios({
          method: req.method,
          url: targetUrl,
          data: req.body,
          params: req.query,
          headers: {
            ...req.headers,
            host: undefined
          },
          timeout: 30000
        });

        res.json(response.data);
      } catch (error) {
        res.status(error.response?.status || 500).json({
          error: error.message || 'Error en proxy Groq'
        });
      }
    });

    // ==================== CODE EXECUTION ====================
    this.app.post('/mcp/execute_code', async (req, res) => {
      try {
        const { language, code, cwd } = req.body;

        if (!language || !code) {
          const { APIError } = require('../utils/api-error');
          const error = APIError.invalidRequest('language y code son requeridos', {
            missing: !language ? ['language'] : ['code']
          });
          return res.status(error.statusCode).json(error.toJSON());
        }

        let command;
        const workDir = cwd || process.cwd();

        switch (language.toLowerCase()) {
          case 'python':
          case 'py':
            command = `python -c "${code.replace(/"/g, '\\"')}"`;
            break;
          case 'javascript':
          case 'js':
          case 'node':
            command = `node -e "${code.replace(/"/g, '\\"')}"`;
            break;
          case 'powershell':
          case 'ps1':
            command = `powershell -Command "${code.replace(/"/g, '\\"')}"`;
            break;
          case 'bash':
          case 'sh':
            command = code;
            break;
          case 'cmd':
            command = code;
            break;
          default: {
            const { APIError } = require('../utils/api-error');
            const error = APIError.invalidRequest(`Lenguaje no soportado: ${language}`, {
              language,
              supported: ['python', 'javascript', 'bash', 'powershell', 'cmd']
            });
            return res.status(error.statusCode).json(error.toJSON());
          }
        }

        this.logger.debug('Ejecutando código', { language, codePreview: code.substring(0, 100) });

        const { stdout, stderr } = await execAsync(command, {
          cwd: workDir,
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024 // 10MB
        });

        res.json({
          success: true,
          language,
          stdout,
          stderr,
          exitCode: 0
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          stdout: error.stdout || '',
          stderr: error.stderr || '',
          exitCode: error.code || 1
        });
      }
    });

    // ==================== FILE OPERATIONS ====================
    this.app.post('/mcp/read_file', async (req, res) => {
      try {
        const { filePath } = req.body;

        if (!filePath) {
          const { APIError } = require('../utils/api-error');
          const error = APIError.invalidRequest('filePath es requerido', { missing: ['filePath'] });
          return res.status(error.statusCode).json(error.toJSON());
        }

        const resolvedPath = this.resolvePath(filePath);

        // Verificar que el archivo existe
        try {
          await fs.access(resolvedPath);
        } catch (accessError) {
          return res.status(404).json({
            success: false,
            error: `Archivo no encontrado: ${resolvedPath}`,
            requestedPath: filePath,
            resolvedPath
          });
        }

        const content = await fs.readFile(resolvedPath, 'utf-8');
        const stats = await fs.stat(resolvedPath);

        res.json({
          success: true,
          filePath: resolvedPath,
          content,
          size: stats.size,
          modified: stats.mtime.toISOString()
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.post('/mcp/write_file', async (req, res) => {
      try {
        const { filePath, content } = req.body;

        if (!filePath || content === undefined) {
          const { APIError } = require('../utils/api-error');
          const error = APIError.invalidRequest('filePath y content son requeridos', {
            missing: !req.body.filePath ? ['filePath'] : ['content']
          });
          return res.status(error.statusCode).json(error.toJSON());
        }

        const resolvedPath = this.resolvePath(filePath);
        const dir = path.dirname(resolvedPath);

        // Crear directorio si no existe
        await fs.mkdir(dir, { recursive: true });

        await fs.writeFile(resolvedPath, content, 'utf-8');

        res.json({
          success: true,
          filePath: resolvedPath,
          message: 'Archivo escrito exitosamente'
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.post('/mcp/list_files', async (req, res) => {
      try {
        const { dirPath } = req.body;
        const targetPath = dirPath ? this.resolvePath(dirPath) : process.cwd();

        const items = await fs.readdir(targetPath, { withFileTypes: true });
        const files = items.map(item => ({
          name: item.name,
          type: item.isDirectory() ? 'directory' : 'file',
          path: path.join(targetPath, item.name)
        }));

        res.json({
          success: true,
          dirPath: targetPath,
          files
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // ==================== COMMAND EXECUTION ====================
    this.app.post('/mcp/execute_command', async (req, res) => {
      try {
        const { command, cwd } = req.body;

        if (!command) {
          const { APIError } = require('../utils/api-error');
          const error = APIError.invalidRequest('command es requerido', { missing: ['command'] });
          return res.status(error.statusCode).json(error.toJSON());
        }

        const workDir = cwd || process.cwd();

        this.logger.debug('Ejecutando comando', { command });

        const { stdout, stderr } = await execAsync(command, {
          cwd: workDir,
          timeout: 60000,
          maxBuffer: 10 * 1024 * 1024
        });

        res.json({
          success: true,
          command,
          stdout,
          stderr,
          exitCode: 0
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message,
          stdout: error.stdout || '',
          stderr: error.stderr || '',
          exitCode: error.code || 1
        });
      }
    });
  }

  setupWebSocket() {
    this.wss.on('connection', ws => {
      this.wsClients.add(ws);
      this.logger.info('Cliente WebSocket conectado');

      ws.on('close', () => {
        this.wsClients.delete(ws);
        this.logger.info('Cliente WebSocket desconectado');
      });

      ws.on('error', error => {
        this.logger.error('Error WebSocket', { error: error.message });
      });
    });
  }

  /**
   * Resuelve la ruta de un archivo
   */
  resolvePath(filePath) {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    // Intentar desde el directorio del proyecto
    const projectRoot = path.resolve(__dirname, '..', '..');
    const resolved = path.resolve(projectRoot, filePath);

    return resolved;
  }

  /**
   * Método para detener el servidor y liberar recursos
   */
  async stop() {
    this.logger.info('Deteniendo MCP Universal Server...');

    // Cerrar WebSocket server
    if (this.wss) {
      this.wss.clients.forEach(client => {
        if (client.readyState === 1) {
          // OPEN
          client.close();
        }
      });
      this.wss.close();
    }

    // Cerrar servidor HTTP
    if (this.server) {
      return new Promise(resolve => {
        this.server.close(() => {
          this.logger.info('Servidor HTTP cerrado');

          // Liberar shield
          if (this.shield && this.port) {
            const shieldManager = getPortShieldManager();
            shieldManager.removeShield(this.port);
          }

          // Liberar puerto del pool
          if (this.portPoolManager) {
            this.portPoolManager.releasePort();
            this.logger.info(`Puerto ${this.port} liberado del pool`);
          }

          this.wsClients.clear();
          resolve();
        });
      });
    }

    // Liberar recursos incluso si el servidor no estaba corriendo
    if (this.shield && this.port) {
      const shieldManager = getPortShieldManager();
      shieldManager.removeShield(this.port);
    }

    if (this.portPoolManager) {
      this.portPoolManager.releasePort();
    }
  }

  /**
   * Inicia el servidor usando pool de puertos exclusivos con rotación automática
   */
  async start() {
    try {
      // Obtener pool de puertos y crear pool manager
      const portPool = getServicePortPool('mcp-universal');
      const instanceManager = getInstanceManager();

      if (!instanceManager || !instanceManager.instanceNumber) {
        throw new Error(
          'Instance manager no inicializado. La aplicación debe inicializarse primero.'
        );
      }

      this.portPoolManager = new PortPoolManager(
        'mcp-universal',
        portPool,
        process.pid,
        instanceManager.instanceId
      );

      // Adquirir puerto del pool con rotación automática
      this.port = await this.portPoolManager.acquirePortFromPool();

      if (!this.port) {
        const acquisitionInfo = this.portPoolManager.getAcquisitionInfo();
        this.logger.error('ERROR FATAL: No se pudo adquirir ningún puerto del pool', {
          service: 'mcp-universal',
          portPool,
          attemptedPorts: acquisitionInfo.attemptedPorts,
          instanceId: instanceManager.instanceId
        });

        throw new Error(
          `No se pudo adquirir ningún puerto del pool de MCP Universal. ` +
            `Pool: [${portPool.join(', ')}]. ` +
            `Todos los puertos están bloqueados exclusivamente. ` +
            `Cierre otras instancias o use una instancia diferente.`
        );
      }

      // Activar shield de protección del puerto
      const shieldManager = getPortShieldManager();
      this.shield = shieldManager.createShield(
        this.port,
        process.pid,
        instanceManager.instanceId,
        port => {
          this.logger.error(
            `SHIELD PERDIDO: Puerto ${port} ya no está bajo nuestro control. Cerrando servidor.`
          );
          this.stop();
        }
      );

      // Iniciar servidor en el puerto adquirido
      return new Promise((resolve, reject) => {
        this.server.listen(this.port, () => {
          this.logger.info(`✅ MCP Universal Server corriendo en http://localhost:${this.port}`, {
            port: this.port,
            portPool,
            instanceId: instanceManager.instanceId
          });
          this.logger.info(`Health check: http://localhost:${this.port}/health`);
          this.setupGracefulShutdown();
          resolve(true);
        });

        this.server.on('error', error => {
          if (error.code === 'EADDRINUSE') {
            this.logger.error(
              `ERROR FATAL: Puerto ${this.port} está en uso después de adquirir lock`,
              {
                port: this.port,
                error: error.message
              }
            );
            // Liberar lock y shield
            if (this.portPoolManager) {
              this.portPoolManager.releasePort();
            }
            if (this.shield) {
              const shieldManager = getPortShieldManager();
              shieldManager.removeShield(this.port);
            }
            reject(new Error(`Puerto ${this.port} está en uso. Conflicto detectado.`));
          } else {
            reject(error);
          }
        });
      });
    } catch (error) {
      this.logger.error('Error iniciando MCP Universal Server', {
        error: error.message,
        stack: error.stack
      });

      // Liberar recursos en caso de error
      if (this.portPoolManager && this.port) {
        this.portPoolManager.releasePort();
      }
      if (this.shield && this.port) {
        const shieldManager = getPortShieldManager();
        shieldManager.removeShield(this.port);
      }

      throw error;
    }
  }

  /**
   * Configurar graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = async signal => {
      this.logger.info(`Recibida señal ${signal}, iniciando cierre graceful...`);

      // Usar método stop() para liberar todos los recursos
      await this.stop();

      this.logger.info('Cierre graceful completado');

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Si se ejecuta directamente, iniciar el servidor
if (require.main === module) {
  const mcp = new MCPUniversal();
  mcp.start().catch(error => {
    const logger = LoggerFactory.create('mcp-universal');
    logger.error('Error iniciando servidor', { error: error.message, stack: error.stack });
    process.exit(1);
  });
}

module.exports = MCPUniversal;
