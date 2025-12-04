/**
 * ════════════════════════════════════════════════════════════════════════════
 * SANDRA ORCHESTRATOR - Orquestador Maestro de Sandra IA 8.0
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Orquestador central que coordina todos los componentes del sistema.
 * Sandra es el cerebro que decide qué modelo usar, qué subagente invocar,
 * y cómo ejecutar cada tarea.
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const DecisionEngine = require('./decision-engine');
const ModelInvoker = require('./model-invoker');

// Cargar configuraciones
const IDENTITY_CONFIG = path.join(__dirname, '..', '..', 'config', 'sandra-orchestrator.json');
const MODELS_CONFIG = path.join(__dirname, '..', '..', 'config', 'models.json');
const SUBAGENTS_CONFIG = path.join(__dirname, '..', '..', 'config', 'subagents-sandra.json');

class SandraOrchestrator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.identity = this.loadIdentity();
    this.models = this.loadModels();
    this.subagents = this.loadSubagents();
    this.decisionEngine = new DecisionEngine();
    this.modelInvoker = new ModelInvoker({
      groqApiKey: config.groqApiKey || process.env.GROQ_API_KEY,
      timeout: config.timeout || 30000
    });
    this.activeTasks = new Map();
    this.metrics = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      modelUsage: {},
      subagentUsage: {}
    };
  }

  /**
   * Carga identidad de Sandra
   */
  loadIdentity() {
    try {
      const config = JSON.parse(fs.readFileSync(IDENTITY_CONFIG, 'utf-8'));
      return config.identity;
    } catch (e) {
      return {
        name: "Sandra IA 8.0",
        description: "un agente de inteligencia artificial modelo multimodal",
        creator: "Clay",
        response: "Hola, soy Sandra IA 8.0, un agente de inteligencia artificial modelo multimodal, creado por Clay. ¿En qué puedo ayudarte?"
      };
    }
  }

  /**
   * Carga configuración de modelos
   */
  loadModels() {
    try {
      return JSON.parse(fs.readFileSync(MODELS_CONFIG, 'utf-8'));
    } catch (e) {
      console.warn('⚠️  No se pudo cargar configuración de modelos');
      return null;
    }
  }

  /**
   * Carga configuración de subagentes
   */
  loadSubagents() {
    try {
      return JSON.parse(fs.readFileSync(SUBAGENTS_CONFIG, 'utf-8'));
    } catch (e) {
      console.warn('⚠️  No se pudo cargar configuración de subagentes');
      return null;
    }
  }

  /**
   * Analiza una tarea y determina qué recursos usar
   */
  analyzeTask(task) {
    const { type, prompt } = task;

    // Clasificación básica
    let taskType = 'reasoning';
    if (type) {
      taskType = type;
    } else if (prompt) {
      const lowerPrompt = prompt.toLowerCase();
      if (lowerPrompt.includes('imagen') || lowerPrompt.includes('ver') || lowerPrompt.includes('analizar imagen')) {
        taskType = 'vision';
      } else if (lowerPrompt.includes('código') || lowerPrompt.includes('programar') || lowerPrompt.includes('ejecutar')) {
        taskType = 'code';
      } else if (lowerPrompt.includes('audio') || lowerPrompt.includes('voz') || lowerPrompt.includes('transcribir')) {
        taskType = 'audio';
      }
    }

    return {
      taskType,
      requiresSubagent: this.shouldInvokeSubagent(taskType, prompt),
      models: this.selectModels(taskType),
      subagents: this.selectSubagents(taskType)
    };
  }

  /**
   * Selecciona modelos apropiados (siempre dual: Qwen + DeepSeek)
   */
  selectModels(taskType) {
    if (!this.models) return [];

    const modelMap = {
      'reasoning': ['qwen3-235b-a22b', 'deepseek-r1'],
      'vision': ['qwen-vl-max', 'deepseek-vl-7b-chat'],
      'code': ['qwen3-235b-a22b', 'deepseek-coder-v2'],
      'audio': ['qwen-audio-chat']
    };

    const modelIds = modelMap[taskType] || modelMap['reasoning'];
    
    // Mapear a configuración completa
    return modelIds.map(id => {
      // Buscar en configuración
      for (const category of Object.values(this.models.online || {})) {
        for (const provider of Object.values(category || {})) {
          if (provider.model === id) {
            return provider;
          }
        }
      }
      return { model: id, provider: 'groq' };
    });
  }

  /**
   * Selecciona subagentes apropiados
   */
  selectSubagents(taskType) {
    if (!this.subagents) return [];

    const categorized = this.subagents.subagents?.categorized;
    if (!categorized) return [];

    // Mapeo de tipos de tarea a categorías de subagentes
    const categoryMap = {
      'reasoning': ['monitors', 'orchestration'],
      'vision': ['monitors', 'correction'],
      'code': ['correction', 'improvement'],
      'audio': ['correction']
    };

    const categories = categoryMap[taskType] || ['monitors'];
    const selected = [];

    categories.forEach(cat => {
      if (categorized[cat]) {
        Object.values(categorized[cat]).forEach(agents => {
          if (Array.isArray(agents)) {
            selected.push(...agents);
          }
        });
      }
    });

    return selected.slice(0, 3); // Máximo 3 subagentes por tarea
  }

  /**
   * Determina si se debe invocar un subagente
   */
  shouldInvokeSubagent(taskType, prompt) {
    // Invocar subagente si la tarea es compleja o requiere especialización
    const complexKeywords = ['revisar', 'corregir', 'mejorar', 'optimizar', 'analizar', 'auditar'];
    const hasComplexKeyword = complexKeywords.some(keyword => 
      prompt && prompt.toLowerCase().includes(keyword)
    );

    return hasComplexKeyword || taskType === 'code' || taskType === 'vision';
  }

  /**
   * Orquesta una tarea completa
   */
  async orchestrateTask(task) {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.activeTasks.set(taskId, { task, startTime: Date.now() });
    this.metrics.totalTasks++;

    console.log(`\n🎯 Orquestando tarea: ${taskId}`);
    console.log(`   Tipo: ${task.type || 'reasoning'}`);
    console.log(`   Prompt: ${task.prompt?.substring(0, 100)}...`);

    try {
      // Fase 1: Decisión (análisis y selección de recursos)
      const decision = this.decisionEngine.makeDecision(task);
      console.log(`   Modelos seleccionados: ${decision.models.length}`);
      console.log(`   Modo de ejecución: ${decision.executionStrategy.mode}`);

      // Fase 2: Ejecución de modelos
      let modelResults = null;
      if (decision.models.length > 0) {
        console.log(`   Invocando modelos...`);
        modelResults = await this.modelInvoker.invoke(
          decision.models,
          task.prompt,
          decision.executionStrategy.mode,
          {
            temperature: decision.models[0].temperature || 0.7,
            max_tokens: decision.analysis.estimatedTokens || 8192
          }
        );
        console.log(`   ✅ Modelos ejecutados (latencia: ${modelResults.latency}ms)`);
      }

      // Fase 3: Ejecución de subagentes (si es necesario)
      let subagentResults = null;
      const selectedSubagents = this.decisionEngine.selectSubagents(
        decision.analysis,
        this.subagents
      );

      if (selectedSubagents.length > 0 && decision.analysis.needs.accuracy) {
        console.log(`   Invocando ${selectedSubagents.length} subagente(s)...`);
        // Importar dinámicamente para evitar dependencia circular
        const { invokeSubagent } = require('../../scripts/invoke-sandra-subagent');
        
        const subagentPromises = selectedSubagents.map(async (agentId) => {
          try {
            const response = await invokeSubagent(
              agentId,
              `Analiza y valida esta respuesta: ${modelResults?.fused || modelResults?.fastestResponse?.content || task.prompt}`
            );
            return { agentId, success: true, response };
          } catch (error) {
            return { agentId, success: false, error: error.message };
          }
        });

        subagentResults = await Promise.all(subagentPromises);
        console.log(`   ✅ Subagentes ejecutados`);
      }

      // Fase 4: Construcción de resultado final
      const finalResponse = this.buildFinalResponse(modelResults, subagentResults, decision);

      const result = {
        taskId,
        decision,
        modelResults,
        subagentResults,
        finalResponse,
        success: true,
        timestamp: new Date().toISOString(),
        latency: Date.now() - this.activeTasks.get(taskId).startTime
      };

      // Actualizar métricas
      this.metrics.successfulTasks++;
      if (modelResults) {
        modelResults.results?.forEach(r => {
          if (r.success && r.model) {
            this.metrics.modelUsage[r.model] = (this.metrics.modelUsage[r.model] || 0) + 1;
          }
        });
      }
      if (subagentResults) {
        subagentResults.forEach(r => {
          if (r.success) {
            this.metrics.subagentUsage[r.agentId] = (this.metrics.subagentUsage[r.agentId] || 0) + 1;
          }
        });
      }

      this.activeTasks.delete(taskId);
      this.emit('taskCompleted', result);

      return result;

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      this.metrics.failedTasks++;
      this.activeTasks.delete(taskId);
      this.emit('taskFailed', { taskId, error: error.message });
      throw error;
    }
  }

  /**
   * Construye respuesta final combinando resultados
   */
  buildFinalResponse(modelResults, subagentResults, _decision) {
    let content = '';

    // Contenido principal de modelos
    if (modelResults) {
      if (modelResults.mode === 'fusion' && modelResults.fused) {
        content = modelResults.fused;
      } else if (modelResults.fastestResponse) {
        content = modelResults.fastestResponse.content;
      } else if (modelResults.results && modelResults.results.length > 0) {
        const firstSuccess = modelResults.results.find(r => r.success);
        if (firstSuccess && firstSuccess.response) {
          content = firstSuccess.response.content;
        }
      }
    }

    // Validación de subagentes
    if (subagentResults && subagentResults.length > 0) {
      const validations = subagentResults
        .filter(r => r.success)
        .map(r => `[${r.agentId}]: Validado`)
        .join(', ');
      
      if (validations) {
        content += `\n\n[Validado por: ${validations}]`;
      }
    }

    return {
      content: content || 'No se pudo generar respuesta',
      sources: {
        models: modelResults?.results?.length || 0,
        subagents: subagentResults?.length || 0
      },
      mode: modelResults?.mode || 'unknown'
    };
  }

  /**
   * Obtiene identidad de Sandra
   */
  getIdentity() {
    return this.identity;
  }

  /**
   * Obtiene métricas
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeTasks: this.activeTasks.size,
      successRate: this.metrics.totalTasks > 0 
        ? (this.metrics.successfulTasks / this.metrics.totalTasks * 100).toFixed(2) + '%'
        : '0%'
    };
  }
}

module.exports = SandraOrchestrator;

