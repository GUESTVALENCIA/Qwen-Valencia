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
const { getServiceConfig } = require('../config');
const { LoggerFactory } = require('../utils/logger');
const { MetricsFactory } = require('../utils/metrics');
const SecurityMiddleware = require('../middleware/security');
const CorrelationMiddleware = require('../middleware/correlation');
const ValidatorMiddleware = require('../middleware/validator');
const { setupSwagger } = require('../utils/swagger-setup');

const execAsync = promisify(exec);

class MCPUniversal {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    
    // Cargar configuración centralizada
    const serviceConfig = getServiceConfig('mcp-universal');
    this.port = serviceConfig.port || 6000;
    
    // Logger y métricas
    this.logger = LoggerFactory.create('mcp-universal');
    this.metrics = MetricsFactory.create('mcp_universal');
    
    this.wsClients = new Set();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupSwagger();
    
    this.logger.info('MCP Universal Server inicializado', { port: this.port });
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
      corsHeaders: ['Content-Type', 'Authorization', 'mcp-secret', 'X-Requested-With', 'X-Correlation-ID'],
      trustProxy: serviceConfig.security?.trustProxy || false
    });
    this.app.use(securityMiddleware.middleware());
    
    // Validator middleware
    this.validator = ValidatorMiddleware.create();
    
    // Middleware de autenticación
    this.app.use((req, res, next) => {
      if (req.path === '/health' || req.path === '/mcp/health' || 
          req.path === '/health/ready' || req.path === '/health/live') {
        return next();
      }
      
      const secret = req.headers['mcp-secret'] || req.headers['authorization']?.replace('Bearer ', '');
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
          return res.status(400).json({ error: 'language y code son requeridos' });
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
          default:
            return res.status(400).json({ error: `Lenguaje no soportado: ${language}` });
        }
        
        console.log(`⚡ [MCP] Ejecutando código ${language}:`, code.substring(0, 100));
        
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
          return res.status(400).json({ error: 'filePath es requerido' });
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
            resolvedPath: resolvedPath
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
          return res.status(400).json({ error: 'filePath y content son requeridos' });
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
          return res.status(400).json({ error: 'command es requerido' });
        }
        
        const workDir = cwd || process.cwd();
        
        console.log(`⚡ [MCP] Ejecutando comando: ${command}`);
        
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
    this.wss.on('connection', (ws) => {
      this.wsClients.add(ws);
      console.log('✅ Cliente WebSocket conectado');
      
      ws.on('close', () => {
        this.wsClients.delete(ws);
        console.log('❌ Cliente WebSocket desconectado');
      });
      
      ws.on('error', (error) => {
        console.error('❌ Error WebSocket:', error);
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
   * Verifica si el puerto está disponible
   */
  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = require('net').createServer();
      
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(true);
        }
      });
      
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      
      server.listen(port);
    });
  }

  /**
   * Intenta matar proceso en puerto 3001 si existe (migración)
   */
  async killProcessOnPort3001() {
    if (this.port === 6000) {
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        // Windows: encontrar PID en puerto 3001
        if (process.platform === 'win32') {
          try {
            const { stdout } = await execAsync('netstat -ano | findstr :3001 | findstr LISTENING');
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              if (pid && !isNaN(pid)) {
                console.log(`⚠️ Detectado proceso en puerto 3001 (PID: ${pid}), intentando detener...`);
                try {
                  await execAsync(`taskkill /PID ${pid} /F`);
                  console.log(`✅ Proceso ${pid} detenido`);
                } catch (e) {
                  console.warn(`⚠️ No se pudo detener proceso ${pid}:`, e.message);
                }
              }
            }
          } catch (e) {
            // No hay proceso en puerto 3001, está bien
          }
        }
      } catch (error) {
        // Ignorar errores al intentar matar proceso
      }
    }
  }

  /**
   * Inicia el servidor
   */
  async start() {
    // Intentar matar proceso en puerto 3001 si estamos usando 6000 (migración)
    await this.killProcessOnPort3001();
    
    // Verificar si el puerto está disponible
    const available = await this.isPortAvailable(this.port);
    
    if (!available) {
      console.error(`❌ Puerto ${this.port} ya está en uso`);
      console.log(`💡 Intenta detener el proceso que usa el puerto ${this.port}`);
      console.log(`💡 O ejecuta: DETENER_TODO.bat`);
      return false;
    }
    
    this.server.listen(this.port, () => {
      this.logger.info(`MCP Universal Server corriendo en http://localhost:${this.port}`);
      this.logger.info(`Health check: http://localhost:${this.port}/health`);
      this.setupGracefulShutdown();
    });
    
    return true;
  }
  
  /**
   * Configurar graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      this.logger.info(`Recibida señal ${signal}, iniciando cierre graceful...`);
      
      // Cerrar WebSocket server
      if (this.wss) {
        this.wss.clients.forEach(client => {
          if (client.readyState === 1) { // OPEN
            client.close();
          }
        });
        this.wss.close(() => {
          this.logger.info('WebSocket server cerrado');
        });
      }
      
      // Detener aceptar nuevas conexiones HTTP
      if (this.server) {
        this.server.close(() => {
          this.logger.info('Servidor HTTP cerrado');
        });
      }
      
      // Limpiar recursos
      this.wsClients.clear();
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
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  });
}

module.exports = MCPUniversal;

