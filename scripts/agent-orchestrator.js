/**
 * ════════════════════════════════════════════════════════════════════════════
 * AGENT ORCHESTRATOR - Sistema de Orquestación de Subagentes
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Coordinador central que gestiona monitores y especialistas para:
 * - Monitoreo continuo del sistema
 * - Detección automática de errores
 * - Invocación de subagentes especializados
 * - Corrección automática de bugs
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const { autoReview, invokeReviewAgent } = require('./auto-code-reviewer');

// Cargar configuración
const CONFIG_PATH = path.join(__dirname, '..', '.orchestrator-config.json');
let config = {
  enabled: true,
  monitors: {
    conversational: { enabled: true, interval: 30000 },
    application: { enabled: true, interval: 15000 },
    git: { enabled: true, interval: 60000 }
  },
  voltAgentTokensPath: path.join(
    'C:',
    'Users',
    'clayt',
    'Desktop',
    'VoltAgent-Composer-Workflow',
    'tokens.json'
  ),
  apiBase: 'https://api.voltagent.dev',
  logPath: path.join(__dirname, '..', '.orchestrator-logs')
};

try {
  if (fs.existsSync(CONFIG_PATH)) {
    const userConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    config = { ...config, ...userConfig };
  }
} catch (e) {
  console.warn('⚠️  Error cargando configuración, usando valores por defecto');
}

// Cargar tokens
function loadTokens() {
  try {
    if (fs.existsSync(config.voltAgentTokensPath)) {
      const tokens = JSON.parse(fs.readFileSync(config.voltAgentTokensPath, 'utf-8'));
      return tokens.tokens?.development?.token || tokens.tokens?.original?.token;
    }
  } catch (e) {
    console.warn('⚠️  No se encontraron tokens de VoltAgent');
  }
  return null;
}

const TOKEN = loadTokens();

/**
 * Clase principal del Orquestador
 */
class AgentOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.monitors = new Map();
    this.specialists = new Map();
    this.activeTasks = new Map();
    this.errorLog = [];
    this.correctionLog = [];
    this.isRunning = false;
  }

  /**
   * Inicia el orquestador
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️  Orquestador ya está en ejecución');
      return;
    }

    if (!config.enabled) {
      console.log('⚠️  Orquestador deshabilitado en configuración');
      return;
    }

    if (!TOKEN) {
      console.error('❌ No hay token de VoltAgent. El orquestador no puede funcionar.');
      return;
    }

    console.log('🚀 Iniciando Orquestador de Subagentes...\n');
    this.isRunning = true;

    // Crear directorio de logs
    if (!fs.existsSync(config.logPath)) {
      fs.mkdirSync(config.logPath, { recursive: true });
    }

    // Registrar monitores
    await this.registerMonitors();

    // Iniciar monitores
    await this.startMonitors();

    console.log('✅ Orquestador iniciado correctamente\n');
    this.emit('started');
  }

  /**
   * Registra todos los monitores usando subagentes existentes
   */
  async registerMonitors() {
    // Monitores Conversacionales - Usando subagentes existentes
    if (config.monitors.conversational.enabled) {
      const conversationalAgents = config.monitors.conversational.agents || [];
      conversationalAgents.forEach((agentId, index) => {
        this.registerMonitor(`${agentId}-monitor`, {
          type: 'conversational',
          interval: config.monitors.conversational.interval * (index + 1),
          agentId,
          specialists: ['deepgram-stt-specialist', 'frontend-audio-specialist', 'sistema-conversacional-analyst']
        });
      });
    }

    // Monitores de Aplicación - Usando subagentes existentes
    if (config.monitors.application.enabled) {
      const applicationAgents = config.monitors.application.agents || [];
      applicationAgents.forEach((agentId, index) => {
        this.registerMonitor(`${agentId}-monitor`, {
          type: 'application',
          interval: config.monitors.application.interval * (index + 1),
          agentId,
          specialists: ['claude-code', 'frontend-audio-specialist', 'conversational-code-reviewer']
        });
      });
    }

    // Monitores de Git/Repo - Usando subagentes existentes
    if (config.monitors.git.enabled) {
      const gitAgents = config.monitors.git.agents || [];
      gitAgents.forEach((agentId, index) => {
        this.registerMonitor(`${agentId}-git-monitor`, {
          type: 'git',
          interval: config.monitors.git.interval * (index + 1),
          agentId,
          specialists: ['claude-code', 'conversational-code-reviewer']
        });
      });
    }
  }

  /**
   * Registra un monitor
   */
  registerMonitor(id, options) {
    this.monitors.set(id, {
      id,
      ...options,
      intervalId: null,
      lastCheck: null,
      errorCount: 0,
      correctionCount: 0
    });
    console.log(`📋 Monitor registrado: ${id}`);
  }

  /**
   * Inicia todos los monitores
   */
  async startMonitors() {
    for (const [id, monitor] of this.monitors) {
      if (monitor.interval > 0) {
        // Monitor periódico
        monitor.intervalId = setInterval(() => {
          this.runMonitor(id);
        }, monitor.interval);
        console.log(`▶️  Monitor iniciado: ${id} (cada ${monitor.interval}ms)`);
      } else {
        // Monitor event-driven (se configura externamente)
        console.log(`▶️  Monitor registrado (event-driven): ${id}`);
      }
    }

    // Ejecutar primera verificación inmediata
    for (const [id] of this.monitors) {
      await this.runMonitor(id);
    }
  }

  /**
   * Ejecuta un monitor específico usando el subagente asignado
   */
  async runMonitor(monitorId) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) return;

    try {
      monitor.lastCheck = new Date();
      const agentId = monitor.agentId || monitorId.replace('-monitor', '');
      console.log(`\n🔍 [${monitorId}] Ejecutando verificación con ${agentId}...`);

      // Ejecutar verificación según tipo usando el subagente
      let errors = [];
      switch (monitor.type) {
        case 'conversational':
          errors = await this.checkConversationalSystem(monitorId, agentId);
          break;
        case 'application':
          errors = await this.checkApplication(monitorId, agentId);
          break;
        case 'git':
          errors = await this.checkGitRepo(monitorId, agentId);
          break;
      }

      // Procesar errores encontrados
      if (errors.length > 0) {
        console.log(`⚠️  [${monitorId}] Encontrados ${errors.length} errores`);
        for (const error of errors) {
          await this.handleError(monitorId, error);
        }
      } else {
        console.log(`✅ [${monitorId}] Sin errores detectados`);
      }

      this.emit('monitor-complete', { monitorId, errors: errors.length });
    } catch (error) {
      console.error(`❌ [${monitorId}] Error en monitor:`, error.message);
      this.logError(monitorId, error);
    }
  }

  /**
   * Verifica el sistema conversacional usando subagente
   */
  async checkConversationalSystem(_monitorId, _agentId) {
    const errors = [];
    
    // Verificar funciones globales necesarias
    const requiredFunctions = [
      'startVoiceCall',
      'toggleDictation',
      'sendMessage',
      'setMode'
    ];

    // Verificar archivos clave
    const keyFiles = [
      'src/app/renderer/components/app.js',
      'src/app/renderer/utils/event-listeners.js',
      'src/services/deepgram-service.js'
    ];

    for (const file of keyFiles) {
      const filePath = path.join(__dirname, '..', file);
      if (!fs.existsSync(filePath)) {
        errors.push({
          type: 'missing-file',
          severity: 'HIGH',
          file,
          message: `Archivo requerido no encontrado: ${file}`
        });
      }
    }

    // Verificar funciones globales (requiere análisis de código)
    const appJsPath = path.join(__dirname, '..', 'src/app/renderer/components/app.js');
    if (fs.existsSync(appJsPath)) {
      const content = fs.readFileSync(appJsPath, 'utf-8');
      for (const func of requiredFunctions) {
        if (!content.includes(`window.${func}`) && !content.includes(`function ${func}`)) {
          errors.push({
            type: 'missing-function',
            severity: 'CRITICAL',
            function: func,
            message: `Función global requerida no encontrada: ${func}`
          });
        }
      }
    }

    return errors;
  }

  /**
   * Verifica la aplicación completa usando subagente
   */
  async checkApplication(_monitorId, _agentId) {
    const errors = [];

    // Verificar archivo HTML principal
    const htmlPath = path.join(__dirname, '..', 'src/app/renderer/index.html');
    if (fs.existsSync(htmlPath)) {
      const content = fs.readFileSync(htmlPath, 'utf-8');
      
      // Verificar funciones onclick que pueden no estar definidas
      const onclickPattern = /onclick="([^"]+)"/g;
      const matches = [...content.matchAll(onclickPattern)];
      
      for (const match of matches) {
        const funcCall = match[1];
        const funcName = funcCall.split('(')[0].trim();
        
        // Verificar si la función está definida en app.js
        const appJsPath = path.join(__dirname, '..', 'src/app/renderer/components/app.js');
        if (fs.existsSync(appJsPath)) {
          const appJsContent = fs.readFileSync(appJsPath, 'utf-8');
          if (!appJsContent.includes(`window.${funcName}`) && 
              !appJsContent.includes(`function ${funcName}`) &&
              !appJsContent.includes(`${funcName}:`)) {
            errors.push({
              type: 'undefined-function',
              severity: 'CRITICAL',
              function: funcName,
              file: 'src/app/renderer/index.html',
              line: this.getLineNumber(content, match.index),
              message: `Función onclick no definida: ${funcName}`
            });
          }
        }
      }

      // Verificar botones críticos
      const criticalButtons = [
        { id: 'modeAgentBtn', func: 'setMode' },
        { id: 'autoToggle', func: 'toggleAutoMode' },
        { id: 'modelMenuBtn', func: 'toggleModelMenu' }
      ];

      for (const btn of criticalButtons) {
        if (content.includes(`id="${btn.id}"`)) {
          // Verificar que tiene event listener o función asociada
          if (!content.includes(`onclick="${btn.func}`) && 
              !content.includes(`addEventListener`)) {
            errors.push({
              type: 'button-not-working',
              severity: 'CRITICAL',
              button: btn.id,
              file: 'src/app/renderer/index.html',
              message: `Botón ${btn.id} no tiene handler configurado`
            });
          }
        }
      }
    }

    return errors;
  }

  /**
   * Verifica el repositorio Git usando subagente
   */
  async checkGitRepo(_monitorId, _agentId) {
    const errors = [];
    
    // Usar el sistema de revisión automática
    try {
      const reviewResult = await autoReview({ force: true });
      if (reviewResult) {
        // Parsear resultados y convertir a errores
        // (simplificado, en producción se parsearía mejor)
        errors.push({
          type: 'code-review',
          severity: 'MEDIUM',
          message: 'Revisión de código completada',
          details: reviewResult
        });
      }
    } catch (error) {
      errors.push({
        type: 'review-error',
        severity: 'LOW',
        message: `Error en revisión: ${error.message}`
      });
    }

    return errors;
  }

  /**
   * Maneja un error detectado
   */
  async handleError(monitorId, error) {
    console.log(`\n🔧 [${monitorId}] Procesando error: ${error.message}`);
    
    // Determinar especialista apropiado
    const monitor = this.monitors.get(monitorId);
    const specialist = this.selectSpecialist(monitor, error);
    
    if (specialist) {
      await this.invokeSpecialist(specialist, error, monitorId);
    } else {
      console.log(`⚠️  No se encontró especialista para: ${error.type}`);
    }

    // Registrar error
    this.logError(monitorId, error);
  }

  /**
   * Selecciona el especialista apropiado para un error
   */
  selectSpecialist(monitor, error) {
    // Mapeo de tipos de error a especialistas
    const errorSpecialistMap = {
      'missing-function': 'frontend-specialist',
      'undefined-function': 'event-handler-specialist',
      'button-not-working': 'ui-specialist',
      'missing-file': 'backend-specialist',
      'code-review': 'code-reviewer',
      'performance': 'performance-specialist',
      'memory': 'memory-specialist'
    };

    // Buscar en el mapa
    if (errorSpecialistMap[error.type]) {
      return errorSpecialistMap[error.type];
    }

    // Buscar en especialistas del monitor
    if (monitor.specialists && monitor.specialists.length > 0) {
      return monitor.specialists[0]; // Usar el primero como fallback
    }

    return 'code-reviewer'; // Fallback general
  }

  /**
   * Invoca un especialista para corregir un error
   */
  async invokeSpecialist(specialistId, error, monitorId) {
    const taskId = `${specialistId}-${Date.now()}`;
    this.activeTasks.set(taskId, { specialistId, error, monitorId, startTime: new Date() });

    console.log(`\n🎯 Invocando especialista: ${specialistId}`);
    console.log(`   Error: ${error.message}`);
    console.log(`   Severidad: ${error.severity}`);

    try {
      const prompt = this.buildSpecialistPrompt(error, monitorId);
      const response = await invokeReviewAgent(specialistId, prompt);

      if (response) {
        console.log(`✅ Especialista ${specialistId} respondió`);
        
        // Procesar respuesta y aplicar correcciones
        await this.processSpecialistResponse(specialistId, error, response);
        
        this.correctionLog.push({
          taskId,
          specialistId,
          error,
          response,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error(`❌ Error invocando especialista ${specialistId}:`, error.message);
    } finally {
      this.activeTasks.delete(taskId);
    }
  }

  /**
   * Construye el prompt para el especialista
   */
  buildSpecialistPrompt(error, _monitorId) {
    return `Corrige el siguiente error detectado en el sistema:

TIPO: ${error.type}
SEVERIDAD: ${error.severity}
ARCHIVO: ${error.file || 'N/A'}
LÍNEA: ${error.line || 'N/A'}
FUNCIÓN: ${error.function || 'N/A'}
MENSAJE: ${error.message}

CONTEXTO:
- Proyecto: Electron/Node.js
- Frontend: HTML/JavaScript
- Backend: Main Process Electron

REQUISITOS:
1. Proporciona código corregido específico
2. Explica la causa del error
3. Asegúrate de que la corrección no rompa funcionalidad existente
4. Respeta la arquitectura actual del proyecto

Proporciona la solución completa y lista para aplicar.`;
  }

  /**
   * Procesa la respuesta del especialista
   */
  async processSpecialistResponse(specialistId, error, response) {
    // En una implementación completa, aquí se parsearía la respuesta
    // y se aplicarían las correcciones automáticamente
    console.log(`\n📝 Respuesta del especialista procesada`);
    console.log(`   Se requiere revisión manual para aplicar correcciones`);
    
    // Guardar respuesta en log
    const logFile = path.join(config.logPath, `correction-${Date.now()}.json`);
    fs.writeFileSync(logFile, JSON.stringify({
      specialistId,
      error,
      response,
      timestamp: new Date().toISOString()
    }, null, 2));
  }

  /**
   * Obtiene el número de línea de un índice en un texto
   */
  getLineNumber(text, index) {
    return text.substring(0, index).split('\n').length;
  }

  /**
   * Registra un error
   */
  logError(monitorId, error) {
    this.errorLog.push({
      monitorId,
      error,
      timestamp: new Date()
    });

    // Guardar en archivo
    const logFile = path.join(config.logPath, 'errors.json');
    const logs = fs.existsSync(logFile) 
      ? JSON.parse(fs.readFileSync(logFile, 'utf-8'))
      : [];
    logs.push({ monitorId, error, timestamp: new Date().toISOString() });
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  }

  /**
   * Detiene el orquestador
   */
  stop() {
    if (!this.isRunning) return;

    console.log('\n🛑 Deteniendo Orquestador...');
    
    // Detener todos los monitores
    for (const [id, monitor] of this.monitors) {
      if (monitor.intervalId) {
        clearInterval(monitor.intervalId);
        console.log(`⏹️  Monitor detenido: ${id}`);
      }
    }

    this.isRunning = false;
    this.emit('stopped');
    console.log('✅ Orquestador detenido\n');
  }

  /**
   * Obtiene estadísticas
   */
  getStats() {
    return {
      monitors: this.monitors.size,
      activeTasks: this.activeTasks.size,
      errorsDetected: this.errorLog.length,
      correctionsApplied: this.correctionLog.length,
      isRunning: this.isRunning
    };
  }
}

// Exportar singleton
let orchestratorInstance = null;

function getOrchestrator() {
  if (!orchestratorInstance) {
    orchestratorInstance = new AgentOrchestrator();
  }
  return orchestratorInstance;
}

// Si se ejecuta directamente
if (require.main === module) {
  const orchestrator = getOrchestrator();
  
  orchestrator.on('started', () => {
    console.log('\n✅ Orquestador en ejecución. Presiona Ctrl+C para detener.\n');
  });

orchestrator.on('monitor-complete', ({ monitorId: _monitorId, errors: _errors }) => {
  // Log silencioso, ya se imprime en runMonitor
});

  orchestrator.start().catch(console.error);

  // Manejar cierre
  process.on('SIGINT', () => {
    orchestrator.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    orchestrator.stop();
    process.exit(0);
  });
}

module.exports = { AgentOrchestrator, getOrchestrator };

