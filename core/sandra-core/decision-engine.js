/**
 * ════════════════════════════════════════════════════════════════════════════
 * DECISION ENGINE - Motor de Decisión de Sandra IA 8.0
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Motor inteligente que decide qué modelos y subagentes usar para cada tarea.
 * Implementa lógica de selección dinámica sin supremacía de modelos.
 */

const fs = require('fs');
const path = require('path');

// Cargar configuraciones
const MODELS_CONFIG = path.join(__dirname, '..', '..', 'config', 'models.json');
const ORCHESTRATOR_CONFIG = path.join(__dirname, '..', '..', 'config', 'sandra-orchestrator.json');

class DecisionEngine {
  constructor() {
    this.models = this.loadModels();
    this.orchestratorConfig = this.loadOrchestratorConfig();
    this.historicalContext = [];
    this.modelPerformance = {};
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
   * Carga configuración del orquestador
   */
  loadOrchestratorConfig() {
    try {
      return JSON.parse(fs.readFileSync(ORCHESTRATOR_CONFIG, 'utf-8'));
    } catch (e) {
      return { decision: { matrix: {} } };
    }
  }

  /**
   * Analiza una tarea y determina el mejor enfoque
   */
  analyzeTask(task) {
    const { prompt, type, context, requirements } = task;

    // Clasificación de tipo de tarea
    const taskType = this.classifyTaskType(prompt, type);
    
    // Análisis de complejidad
    const complexity = this.analyzeComplexity(prompt, context);
    
    // Análisis de requisitos
    const needs = this.analyzeRequirements(prompt, requirements);

    return {
      taskType,
      complexity,
      needs,
      estimatedTokens: this.estimateTokens(prompt, complexity),
      requiresMultimodal: this.requiresMultimodal(prompt),
      requiresCodeExecution: this.requiresCodeExecution(prompt)
    };
  }

  /**
   * Clasifica el tipo de tarea
   */
  classifyTaskType(prompt, explicitType) {
    if (explicitType) return explicitType;

    const lowerPrompt = prompt.toLowerCase();
    
    // Patrones de visión
    if (lowerPrompt.match(/(imagen|imágenes|ver|visualizar|analizar.*imagen|ocr|dibujo|foto|gráfico)/)) {
      return 'vision';
    }
    
    // Patrones de código
    if (lowerPrompt.match(/(código|programar|ejecutar|función|clase|script|refactorizar|debug|bug)/)) {
      return 'code';
    }
    
    // Patrones de audio
    if (lowerPrompt.match(/(audio|voz|transcribir|grabación|sonido|stt|tts|hablar)/)) {
      return 'audio';
    }
    
    // Patrones de razonamiento complejo
    if (lowerPrompt.match(/(razonar|analizar|pensar|lógica|matemática|calcular|resolver|problema)/)) {
      return 'reasoning';
    }

    // Por defecto: razonamiento general
    return 'reasoning';
  }

  /**
   * Analiza la complejidad de la tarea
   */
  analyzeComplexity(prompt, context) {
    let score = 0;

    // Longitud del prompt
    if (prompt.length > 1000) score += 2;
    else if (prompt.length > 500) score += 1;

    // Palabras clave de complejidad
    const complexKeywords = ['complejo', 'avanzado', 'optimizar', 'arquitectura', 'sistema', 'múltiple'];
    complexKeywords.forEach(keyword => {
      if (prompt.toLowerCase().includes(keyword)) score += 1;
    });

    // Contexto adicional
    if (context && Object.keys(context).length > 3) score += 1;

    // Clasificación
    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  /**
   * Analiza requisitos específicos
   */
  analyzeRequirements(prompt, explicitRequirements) {
    const needs = {
      speed: false,
      accuracy: false,
      creativity: false,
      codeExecution: false,
      multimodal: false
    };

    const lowerPrompt = prompt.toLowerCase();

    // Velocidad
    if (lowerPrompt.match(/(rápido|veloz|inmediato|urgente|tiempo real)/)) {
      needs.speed = true;
    }

    // Precisión
    if (lowerPrompt.match(/(preciso|exacto|correcto|verificar|validar|auditar)/)) {
      needs.accuracy = true;
    }

    // Creatividad
    if (lowerPrompt.match(/(creativo|innovador|nuevo|diseñar|idear|generar)/)) {
      needs.creativity = true;
    }

    // Ejecución de código
    if (lowerPrompt.match(/(ejecutar|correr|run|test|prueba|validar código)/)) {
      needs.codeExecution = true;
    }

    // Multimodal
    if (lowerPrompt.match(/(imagen|audio|video|multimodal|varios tipos)/)) {
      needs.multimodal = true;
    }

    // Combinar con requisitos explícitos
    if (explicitRequirements) {
      Object.assign(needs, explicitRequirements);
    }

    return needs;
  }

  /**
   * Estima tokens necesarios
   */
  estimateTokens(prompt, complexity) {
    const baseTokens = Math.ceil(prompt.length / 4); // Aproximación: 4 chars = 1 token
    
    const multipliers = {
      low: 1.2,
      medium: 1.5,
      high: 2.0
    };

    return Math.ceil(baseTokens * (multipliers[complexity] || 1.5));
  }

  /**
   * Determina si requiere capacidades multimodales
   */
  requiresMultimodal(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    return lowerPrompt.match(/(imagen|audio|video|multimodal|varios tipos|combinar)/) !== null;
  }

  /**
   * Determina si requiere ejecución de código
   */
  requiresCodeExecution(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    return lowerPrompt.match(/(ejecutar|correr|run|test|validar código|probar)/) !== null;
  }

  /**
   * Selecciona modelos para una tarea (SIEMPRE dual: Qwen + DeepSeek)
   */
  selectModels(taskAnalysis) {
    const { taskType, complexity, needs } = taskAnalysis;

    if (!this.models) return [];

    // Matriz de decisión base
    const modelMatrix = {
      reasoning: {
        qwen: 'qwen3-235b-a22b',
        deepseek: 'deepseek-r1'
      },
      vision: {
        qwen: 'qwen-vl-max',
        deepseek: 'deepseek-vl-7b-chat'
      },
      code: {
        qwen: 'qwen3-235b-a22b',
        deepseek: 'deepseek-coder-v2'
      },
      audio: {
        qwen: 'qwen-audio-chat',
        deepseek: null // DeepSeek no tiene modelo de audio aún
      }
    };

    const selected = modelMatrix[taskType] || modelMatrix.reasoning;
    const models = [];

    // Siempre incluir Qwen si está disponible
    if (selected.qwen) {
      const qwenModel = this.findModelConfig(selected.qwen);
      if (qwenModel) {
        models.push({
          ...qwenModel,
          role: this.determineModelRole('qwen', taskType, needs),
          executionMode: this.determineExecutionMode('qwen', complexity, needs)
        });
      }
    }

    // Siempre incluir DeepSeek si está disponible
    if (selected.deepseek) {
      const deepseekModel = this.findModelConfig(selected.deepseek);
      if (deepseekModel) {
        models.push({
          ...deepseekModel,
          role: this.determineModelRole('deepseek', taskType, needs),
          executionMode: this.determineExecutionMode('deepseek', complexity, needs)
        });
      }
    }

    return models;
  }

  /**
   * Encuentra configuración de modelo por ID
   */
  findModelConfig(modelId) {
    if (!this.models) return null;

    for (const category of Object.values(this.models.online || {})) {
      for (const provider of Object.values(category || {})) {
        if (provider.model === modelId) {
          return provider;
        }
      }
    }

    return null;
  }

  /**
   * Determina el rol de cada modelo en la tarea
   */
  determineModelRole(provider, taskType, needs) {
    // Sin supremacía: ambos modelos colaboran
    // Roles se asignan según fortalezas específicas

    if (taskType === 'code') {
      if (provider === 'qwen') {
        return needs.creativity ? 'design' : 'architecture';
      } else {
        return needs.accuracy ? 'implementation' : 'refactoring';
      }
    }

    if (taskType === 'vision') {
      if (provider === 'qwen') {
        return 'analysis';
      } else {
        return 'detection';
      }
    }

    if (taskType === 'reasoning') {
      if (provider === 'qwen') {
        return needs.creativity ? 'exploration' : 'logic';
      } else {
        return needs.accuracy ? 'verification' : 'reasoning';
      }
    }

    return 'collaborative';
  }

  /**
   * Determina el modo de ejecución
   */
  determineExecutionMode(provider, complexity, needs) {
    // Modos: parallel, sequential, consensus, fusion

    if (needs.speed && complexity === 'low') {
      return 'parallel'; // Ejecutar ambos en paralelo y tomar el primero
    }

    if (needs.accuracy && complexity === 'high') {
      return 'consensus'; // Ejecutar ambos y comparar resultados
    }

    if (complexity === 'high') {
      return 'fusion'; // Ejecutar ambos y fusionar outputs
    }

    return 'parallel'; // Por defecto: paralelo
  }

  /**
   * Selecciona subagentes apropiados
   */
  selectSubagents(taskAnalysis, availableSubagents) {
    const { taskType, complexity, needs } = taskAnalysis;
    
    if (!availableSubagents) return [];

    const selected = [];
    const categorized = availableSubagents.subagents?.categorized;

    if (!categorized) return [];

    // Selección basada en tipo de tarea
    if (taskType === 'code') {
      // Para código: corrección + mejora
      if (categorized.correction?.code) {
        selected.push(...categorized.correction.code.slice(0, 2));
      }
      if (complexity === 'high' && categorized.improvement?.architecture) {
        selected.push(...categorized.improvement.architecture.slice(0, 1));
      }
    }

    if (taskType === 'vision') {
      // Para visión: monitores + corrección
      if (categorized.monitors?.application) {
        selected.push(...categorized.monitors.application.slice(0, 2));
      }
    }

    if (needs.accuracy) {
      // Si necesita precisión: quality assurance
      if (categorized.monitors?.code) {
        selected.push(categorized.monitors.code.find(s => s.includes('quality') || s.includes('reviewer')));
      }
    }

    // Siempre incluir orquestador si está disponible
    if (categorized.orchestration?.coordinators) {
      const orchestrator = categorized.orchestration.coordinators.find(s => s.includes('orchestrator'));
      if (orchestrator && !selected.includes(orchestrator)) {
        selected.unshift(orchestrator);
      }
    }

    return selected.filter(Boolean).slice(0, 3); // Máximo 3 subagentes
  }

  /**
   * Toma decisión final completa
   */
  makeDecision(task) {
    const analysis = this.analyzeTask(task);
    const models = this.selectModels(analysis);
    
    return {
      analysis,
      models,
      executionStrategy: {
        mode: models.length > 1 ? this.determineExecutionMode('dual', analysis.complexity, analysis.needs) : 'single',
        parallel: models.length > 1 && analysis.complexity !== 'high',
        fusion: models.length > 1 && analysis.complexity === 'high'
      },
      estimatedCost: this.estimateCost(models, analysis),
      estimatedTime: this.estimateTime(models, analysis)
    };
  }

  /**
   * Estima costo de ejecución
   */
  estimateCost(models, analysis) {
    // Placeholder: implementar cálculo real basado en pricing de APIs
    const baseCost = 0.001; // $0.001 por 1K tokens
    const tokens = analysis.estimatedTokens;
    return (tokens / 1000) * baseCost * models.length;
  }

  /**
   * Estima tiempo de ejecución
   */
  estimateTime(models, analysis) {
    // Placeholder: implementar cálculo real basado en latencia histórica
    const baseLatency = 2000; // 2 segundos base
    const complexityMultiplier = {
      low: 1,
      medium: 1.5,
      high: 2.5
    };
    
    const multiplier = complexityMultiplier[analysis.complexity] || 1.5;
    const parallelTime = baseLatency * multiplier;
    const sequentialTime = baseLatency * multiplier * models.length;

    return {
      parallel: parallelTime,
      sequential: sequentialTime,
      estimated: analysis.needs.speed ? parallelTime : sequentialTime
    };
  }

  /**
   * Registra performance histórica
   */
  recordPerformance(modelId, taskType, success, latency, quality) {
    if (!this.modelPerformance[modelId]) {
      this.modelPerformance[modelId] = {};
    }
    if (!this.modelPerformance[modelId][taskType]) {
      this.modelPerformance[modelId][taskType] = {
        total: 0,
        successful: 0,
        totalLatency: 0,
        totalQuality: 0
      };
    }

    const perf = this.modelPerformance[modelId][taskType];
    perf.total++;
    if (success) perf.successful++;
    perf.totalLatency += latency;
    perf.totalQuality += quality;
  }

  /**
   * Obtiene métricas de performance
   */
  getPerformanceMetrics() {
    return this.modelPerformance;
  }
}

module.exports = DecisionEngine;

