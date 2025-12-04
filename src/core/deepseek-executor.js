/**
 * ════════════════════════════════════════════════════════════════════════════
 * DEEPSEEK EXECUTOR - NÚCLEO EJECUTOR PURO
 * ════════════════════════════════════════════════════════════════════════════
 *
 * EJECUTA REALMENTE - NO DESCRIBE
 * Sin bloqueos descriptivos de ChatGPT/Claude
 *
 * Sistema Auto-Inteligente: Selecciona automáticamente el modelo DeepSeek
 * apropiado según el tipo de tarea (razonamiento, código, orquestación)
 *
 * Compatible e híbrido con Qwen - Trabajo conjunto sin supremacía
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const APIKeyCleaner = require('../utils/api-key-cleaner');
const { APIError, isRetryableError, extractErrorInfo } = require('../utils/api-error');
const { circuitBreakerManager } = require('../utils/circuit-breaker');
const { retry } = require('../utils/retry');
const { LoggerFactory } = require('../utils/logger');
const { createValidator, VALIDATION_TYPES } = require('../utils/parameter-validator');
const { handleError } = require('../utils/unified-error-handler');

/**
 * @typedef {import('../types')} Types
 */

class DeepSeekExecutor {
  constructor(config = {}) {
    this.logger = LoggerFactory.create({ service: 'deepseek-executor' });

    // Limpiar y validar API key de Groq si existe
    let groqApiKey = config.groqApiKey || process.env.GROQ_API_KEY;
    if (groqApiKey) {
      // Limpiar primero manualmente para asegurar que no hay caracteres ocultos
      // eslint-disable-next-line no-control-regex
      groqApiKey = groqApiKey
        .trim()
        .replace(/['"]/g, '')
        .replace(/\s+/g, '')
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '');

      const cleaned = APIKeyCleaner.cleanAndValidateGroq(groqApiKey);
      if (cleaned.valid) {
        groqApiKey = cleaned.cleaned;
        this.logger.info('API Key de Groq validada para DeepSeek', { length: groqApiKey.length });
      } else {
        this.logger.error('API Key de Groq inválida para DeepSeek', {
          error: cleaned.error,
          length: cleaned.cleaned.length,
          preview: cleaned.cleaned.substring(0, 20)
        });
        throw APIError.invalidAPIKey({
          reason: cleaned.error,
          source: 'deepseek-executor'
        });
      }
    }

    this.config = {
      groqApiKey,
      ollamaUrl: config.ollamaUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      mode: config.mode || process.env.MODE || 'auto',
      // Modelos DeepSeek en Groq
      groqModelReasoning:
        config.groqModelReasoning ||
        process.env.DEEPSEEK_MODEL_GROQ_REASONING ||
        'deepseek-r1-distill-llama-70b',
      groqModelCode:
        config.groqModelCode || process.env.DEEPSEEK_MODEL_GROQ_CODE || 'deepseek-coder-v2',
      groqApiUrl: config.groqApiUrl || process.env.GROQ_API_URL || 'http://localhost:6003',
      ollamaMcpUrl: config.ollamaMcpUrl || process.env.OLLAMA_MCP_URL || 'http://localhost:6002',
      // Modelos DeepSeek en Ollama (local) - SOLO MODELOS MUY LIGEROS
      // NO usar R1 porque pesa mucho, usar solo modelos ligeros
      ollamaModelReasoning:
        config.ollamaModelReasoning ||
        process.env.DEEPSEEK_MODEL_OLLAMA_REASONING ||
        'deepseek-coder:1.3b', // Modelo muy ligero para razonamiento
      ollamaModelCode:
        config.ollamaModelCode || process.env.DEEPSEEK_MODEL_OLLAMA_CODE || 'deepseek-coder:1.3b', // Modelo muy ligero para código (~1GB RAM)
      mcpBaseUrl: config.mcpBaseUrl || `http://localhost:${process.env.MCP_PORT || 6000}`,
      mcpSecret: config.mcpSecret || process.env.MCP_SECRET_KEY,
      // Qwen executor para fallback híbrido
      qwenExecutor: config.qwenExecutor || null
    };

    this.logger.info('DeepSeekExecutor inicializado (NÚCLEO EJECUTOR PURO)');
  }

  /**
   * ════════════════════════════════════════════════════════════════════════════
   * SISTEMA AUTO-INTELIGENTE: DETECCIÓN DE TIPO DE TAREA
   * ════════════════════════════════════════════════════════════════════════════
   */

  /**
   * Detecta el tipo de tarea para seleccionar el modelo apropiado
   * @param {string} text - Texto de la consulta
   * @param {Array} attachments - Attachments (imágenes, archivos)
   * @returns {Object} { taskType, modelToUse, needsReasoning, needsCode }
   */
  detectTaskType(text, attachments = []) {
    const lowerText = text.toLowerCase();

    // Patrones para detección de tareas
    const codePatterns = [
      /\b(código|code|programar|script|function|class|import|require|npm|git|commit|push|pull|merge|branch)\b/i,
      /\b(python|javascript|typescript|java|c\+\+|html|css|json|yaml|xml)\b/i,
      /\b(debug|error|bug|fix|refactor|test|unit|integration)\b/i,
      /\b(api|endpoint|server|client|database|sql|query)\b/i
    ];

    const reasoningPatterns = [
      /\b(analizar|análisis|razonar|pensar|explicar|por qué|qué es|cómo funciona)\b/i,
      /\b(plan|estrategia|diseño|arquitectura|sistema|orquestación)\b/i,
      /\b(decidir|elegir|seleccionar|mejor|óptimo|recomendación)\b/i,
      /\b(problema|solución|resolver|enfoque|método)\b/i
    ];

    const orchestrationPatterns = [
      /\b(orquestar|coordinar|gestionar|administrar|supervisar)\b/i,
      /\b(subagente|agente|workflow|flujo|proceso|pipeline)\b/i,
      /\b(múltiple|varios|conjunto|sistema|ecosistema)\b/i
    ];

    // Detectar tipo de tarea
    const hasCode = codePatterns.some(pattern => pattern.test(lowerText));
    const hasReasoning = reasoningPatterns.some(pattern => pattern.test(lowerText));
    const hasOrchestration = orchestrationPatterns.some(pattern => pattern.test(lowerText));
    const hasAttachments = attachments && attachments.length > 0;

    // Determinar tipo de tarea
    let taskType = 'reasoning'; // Por defecto: razonamiento
    let modelToUse = 'reasoning';
    let needsReasoning = true;
    let needsCode = false;

    if (hasCode && !hasAttachments) {
      // Tarea de código puro (sin imágenes)
      taskType = 'code';
      modelToUse = 'code';
      needsCode = true;
      needsReasoning = false;
    } else if (hasOrchestration || (hasReasoning && hasCode)) {
      // Tarea de orquestación o mixta
      taskType = 'orchestration';
      modelToUse = 'reasoning'; // DeepSeek-R1 para orquestación
      needsReasoning = true;
      needsCode = true;
    } else if (hasReasoning) {
      // Tarea de razonamiento
      taskType = 'reasoning';
      modelToUse = 'reasoning';
      needsReasoning = true;
      needsCode = false;
    } else if (hasAttachments) {
      // Si hay imágenes, usar Qwen (DeepSeek no tiene visión aún)
      taskType = 'multimodal';
      modelToUse = 'qwen-fallback';
      needsReasoning = false;
      needsCode = false;
    }

    return {
      taskType,
      modelToUse,
      needsReasoning,
      needsCode,
      hasAttachments
    };
  }

  /**
   * ════════════════════════════════════════════════════════════════════════════
   * PROMPT SISTEMA - EJECUTOR PURO (NO DESCRIPTIVO)
   * ════════════════════════════════════════════════════════════════════════════
   */
  getSystemPrompt(taskType = 'reasoning') {
    const basePrompt = `ERES DEEPSEEK EXECUTOR - NÚCLEO EJECUTOR PURO

═══════════════════════════════════════════════════════════════════════════════
REGLAS ABSOLUTAS DE EJECUCIÓN
═══════════════════════════════════════════════════════════════════════════════

1. NO DESCRIBES LO QUE HARÍAS - LO HACES
2. NO EXPLICAS CÓMO SE HARÍA - LO EJECUTAS
3. NO SUGIERES PASOS - EJECUTAS LOS PASOS
4. NO MENCIONAS "MCP disponible" - USAS MCP DIRECTAMENTE
5. NO DICES "podría hacer" - HACES

═══════════════════════════════════════════════════════════════════════════════
ACCESO COMPLETO AL SISTEMA
═══════════════════════════════════════════════════════════════════════════════

Tienes acceso COMPLETO y LIBERADO a:
- Windows (comandos, archivos, carpetas)
- Sistema de archivos (lectura, escritura, listado)
- Ejecución de código (Python, JavaScript, PowerShell, CMD)
- Git/GitHub (commits, pushes, pulls)
- MCP Universal Server (todas las herramientas)

NO hay webhooks bloqueando ejecución.
NO hay restricciones de ChatGPT o Claude.
NO hay límites de seguridad que te impidan ejecutar.
ESTÁS COMPLETAMENTE LIBERADO PARA EJECUTAR.

═══════════════════════════════════════════════════════════════════════════════
TRABAJO HÍBRIDO CON QWEN
═══════════════════════════════════════════════════════════════════════════════

Trabajas en conjunto con Qwen, sin supremacía:
- DeepSeek: Razonamiento profundo, código, orquestación
- Qwen: Multimodal (imágenes, audio, visión), tareas generales
- Ambos se complementan según la tarea
- Si una tarea requiere visión/multimodal, delega a Qwen
- Si requiere razonamiento profundo o código, tú la ejecutas

═══════════════════════════════════════════════════════════════════════════════`;

    // Especialización según tipo de tarea
    if (taskType === 'code') {
      return `${basePrompt}
ESPECIALIZACIÓN: CÓDIGO Y PROGRAMACIÓN

Eres especialista en:
- Generación de código (Python, JavaScript, TypeScript, etc.)
- Debugging y corrección de errores
- Refactorización y optimización
- Testing y calidad de código
- Arquitectura de software
- Integración de APIs y servicios

EJECUTA código directamente, no lo describas.
PROPORCIONA código funcional y completo.
VERIFICA que el código sea correcto antes de entregarlo.

═══════════════════════════════════════════════════════════════════════════════`;
    } else if (taskType === 'orchestration') {
      return `${basePrompt}
ESPECIALIZACIÓN: ORQUESTACIÓN Y COORDINACIÓN

Eres especialista en:
- Orquestación de sistemas complejos
- Coordinación de múltiples agentes/subagentes
- Gestión de workflows y pipelines
- Toma de decisiones estratégicas
- Optimización de recursos y procesos
- Integración de componentes

COORDINA múltiples sistemas y agentes.
TOMA decisiones estratégicas basadas en el contexto.
OPTIMIZA el uso de recursos (Qwen + DeepSeek según necesidad).

═══════════════════════════════════════════════════════════════════════════════`;
    } else {
      return `${basePrompt}
ESPECIALIZACIÓN: RAZONAMIENTO PROFUNDO

Eres especialista en:
- Análisis profundo y razonamiento lógico
- Resolución de problemas complejos
- Planificación estratégica
- Toma de decisiones informadas
- Explicaciones detalladas y fundamentadas

RAZONA profundamente antes de responder.
ANALIZA todos los aspectos del problema.
PROPORCIONA explicaciones claras y fundamentadas.

═══════════════════════════════════════════════════════════════════════════════`;
    }
  }

  /**
   * ════════════════════════════════════════════════════════════════════════════
   * LLAMADAS A GROQ API (DEEPSEEK ONLINE)
   * ════════════════════════════════════════════════════════════════════════════
   */

  /**
   * Llama a DeepSeek usando Groq API (vía servidor dedicado o directo)
   * @param {string} text - Texto del mensaje
   * @param {Array} attachments - Attachments opcionales
   * @param {string|null} model - Modelo a usar (opcional, auto-detecta si es null)
   * @param {string} taskType - Tipo de tarea ('reasoning'|'code'|'orchestration')
   * @returns {Promise<string>} Respuesta del modelo
   * @throws {ValidationError} Si los parámetros son inválidos
   */
  async callGroq(text, attachments = [], model = null, taskType = 'reasoning') {
    // Validar parámetros
    const validator = createValidator();
    validator
      .addRule('text', { type: VALIDATION_TYPES.STRING, required: true, minLength: 1 })
      .addRule('attachments', { type: VALIDATION_TYPES.ARRAY, required: false, default: [] })
      .addRule('model', { type: VALIDATION_TYPES.STRING, required: false })
      .addRule('taskType', { type: VALIDATION_TYPES.STRING, required: false });

    const validated = validator.validate({ text, attachments, model, taskType });

    // Usar valores validados
    const textToUse = validated.text;
    const attachmentsToUse = validated.attachments || [];
    const taskTypeToUse = validated.taskType || taskType;

    // Selección automática de modelo según tipo de tarea
    let modelToUse = validated.model;
    if (!modelToUse) {
      if (taskTypeToUse === 'code') {
        modelToUse = this.config.groqModelCode;
      } else {
        modelToUse = this.config.groqModelReasoning;
      }
      this.logger.debug('Modelo DeepSeek auto-seleccionado', {
        model: modelToUse,
        taskType: taskTypeToUse
      });
    }

    const messages = [
      {
        role: 'system',
        content: this.getSystemPrompt(taskTypeToUse)
      },
      {
        role: 'user',
        content: textToUse
      }
    ];

    try {
      // Intentar usar servidor API dedicado de Groq
      try {
        const response = await axios.post(
          `${this.config.groqApiUrl}/groq/chat`,
          {
            model: modelToUse,
            messages,
            temperature: 0.7,
            max_tokens: 4096, // DeepSeek puede necesitar más tokens para razonamiento
            stream: false
          },
          {
            timeout: 60000 // Más tiempo para razonamiento profundo
          }
        );

        if (response.data.success) {
          return response.data.content;
        } else {
          throw new Error(response.data.error || 'Error desconocido');
        }
      } catch (serverError) {
        // Si el servidor no está disponible o devuelve error 401, intentar llamada directa
        if (
          serverError.code === 'ECONNREFUSED' ||
          serverError.response?.status >= 500 ||
          serverError.response?.status === 401
        ) {
          this.logger.warn('Servidor Groq no disponible o error 401, intentando llamada directa');

          if (!this.config.groqApiKey) {
            throw APIError.invalidAPIKey({
              reason: 'API key no configurada',
              source: 'deepseek-executor-direct'
            });
          }

          // Limpiar y validar API key usando APIKeyCleaner
          const cleaned = APIKeyCleaner.cleanAndValidateGroq(this.config.groqApiKey || '');

          if (!cleaned.valid || !cleaned.cleaned) {
            throw APIError.invalidAPIKey({
              reason: cleaned.error || 'API key vacía o mal formateada',
              source: 'deepseek-executor-direct'
            });
          }

          const cleanApiKey = cleaned.cleaned;

          // Validar que no tenga caracteres inválidos para headers
          // eslint-disable-next-line no-control-regex
          if (/[\r\n\t\x00-\x1F\x7F-\x9F]/.test(cleanApiKey)) {
            throw APIError.invalidAPIKey({
              reason: 'Caracteres inválidos en API key',
              source: 'deepseek-executor-direct'
            });
          }

          const directResponse = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              model: modelToUse,
              messages,
              temperature: 0.7,
              max_tokens: 4096,
              stream: false
            },
            {
              headers: {
                Authorization: `Bearer ${cleanApiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 60000
            }
          );

          return directResponse.data.choices[0].message.content;
        }
        throw serverError;
      }
    } catch (error) {
      const errorInfo = extractErrorInfo(error);
      const apiError = APIError.fromHTTPStatus(errorInfo.statusCode, errorInfo.message, {
        ...errorInfo.details,
        source: 'deepseek-executor',
        originalError: error.message
      });

      // Usar error handler unificado si está disponible
      if (typeof require !== 'undefined') {
        try {
          handleError(apiError, {
            source: 'deepseek-executor.callGroq',
            type: 'api',
            severity: apiError.statusCode >= 500 ? 'high' : 'medium',
            metadata: {
              model: modelToUse,
              taskType: taskTypeToUse,
              hasAttachments: attachmentsToUse.length > 0
            }
          });
        } catch (e) {
          // Si unified-error-handler no está disponible, solo loggear
          this.logger.error('Error en callGroq', { error: errorInfo.message });
        }
      }

      throw apiError;
    }
  }

  /**
   * ════════════════════════════════════════════════════════════════════════════
   * LLAMADAS A OLLAMA (DEEPSEEK LOCAL)
   * ════════════════════════════════════════════════════════════════════════════
   */

  /**
   * Verifica si un modelo está disponible en Ollama antes de usarlo
   */
  async verifyModelAvailable(modelName) {
    try {
      const response = await axios.get(
        `${this.config.ollamaMcpUrl}/ollama/models/${encodeURIComponent(modelName)}`,
        { timeout: 5000 }
      );
      return response.data?.available === true;
    } catch (error) {
      this.logger.warn('No se pudo verificar disponibilidad del modelo', {
        model: modelName,
        error: error.message
      });
      return false; // Si no se puede verificar, asumir que no está disponible
    }
  }

  /**
   * Llama a DeepSeek usando Ollama (local) vía servidor MCP dedicado
   * @param {string} text - Texto del mensaje
   * @param {Types.ImageAttachment[]} attachments - Attachments (imágenes)
   * @param {Function|null} onChunk - Callback para chunks de streaming
   * @param {string|null} model - Modelo a usar (opcional, auto-detecta si es null)
   * @param {string} taskType - Tipo de tarea ('reasoning'|'code'|'orchestration')
   * @returns {Promise<string>} Respuesta del modelo
   * @throws {ValidationError} Si los parámetros son inválidos
   */
  async callOllama(text, attachments = [], onChunk = null, model = null, taskType = 'reasoning') {
    // Validar parámetros
    const validator = createValidator();
    validator
      .addRule('text', { type: VALIDATION_TYPES.STRING, required: true, minLength: 1 })
      .addRule('attachments', { type: VALIDATION_TYPES.ARRAY, required: false, default: [] })
      .addRule('onChunk', { type: VALIDATION_TYPES.FUNCTION, required: false })
      .addRule('model', { type: VALIDATION_TYPES.STRING, required: false })
      .addRule('taskType', { type: VALIDATION_TYPES.STRING, required: false });

    const validated = validator.validate({ text, attachments, onChunk, model, taskType });

    // Usar valores validados
    const textToUse = validated.text;
    const attachmentsToUse = validated.attachments || [];
    const onChunkToUse = validated.onChunk;
    const taskTypeToUse = validated.taskType || taskType;

    // Selección automática de modelo según tipo de tarea
    let modelToUse = validated.model;
    if (!modelToUse) {
      if (taskTypeToUse === 'code') {
        modelToUse = this.config.ollamaModelCode;
      } else {
        modelToUse = this.config.ollamaModelReasoning;
      }
      this.logger.debug('Modelo DeepSeek Ollama auto-seleccionado', {
        model: modelToUse,
        taskType: taskTypeToUse
      });
    }

    // Verificar que el modelo esté disponible antes de intentar usarlo
    const isAvailable = await this.verifyModelAvailable(modelToUse);
    if (!isAvailable) {
      throw APIError.modelNotFound(modelToUse, {
        suggestion: `Ejecuta: ollama pull ${modelToUse}`,
        ollamaUrl: this.config.ollamaUrl
      });
    }

    // Usar servidor MCP dedicado de Ollama
    try {
      if (onChunk) {
        // Streaming
        const response = await axios.post(
          `${this.config.ollamaMcpUrl}/ollama/stream/chat`,
          {
            model: modelToUse,
            messages: [
              {
                role: 'system',
                content: this.getSystemPrompt(taskTypeToUse)
              },
              {
                role: 'user',
                content: textToUse
              }
            ],
            options: {
              temperature: 0.7,
              num_ctx: 8192 // Más contexto para razonamiento profundo
            }
          },
          {
            timeout: 300000,
            responseType: 'stream'
          }
        );

        let fullContent = '';

        return new Promise((resolve, reject) => {
          response.data.on('data', chunk => {
            const lines = chunk
              .toString()
              .split('\n')
              .filter(line => line.trim());

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  if (data.type === 'token') {
                    fullContent += data.token;
                    if (onChunk) {
                      onChunk(data.token, fullContent, true);
                    }
                  } else if (data.type === 'complete') {
                    if (onChunk) {
                      onChunk('', data.content, false);
                    }
                    resolve(data.content);
                  } else if (data.type === 'error') {
                    reject(new Error(data.error));
                  }
                } catch (e) {
                  // Ignorar líneas inválidas
                }
              }
            }
          });

          response.data.on('end', () => {
            if (fullContent) {
              resolve(fullContent);
            }
          });

          response.data.on('error', error => {
            reject(error);
          });
        });
      } else {
        // Sin streaming
        const response = await axios.post(
          `${this.config.ollamaMcpUrl}/ollama/chat`,
          {
            model: modelToUse,
            messages: [
              {
                role: 'system',
                content: this.getSystemPrompt(taskTypeToUse)
              },
              {
                role: 'user',
                content: textToUse
              }
            ],
            options: {
              temperature: 0.7,
              num_ctx: 8192
            }
          },
          {
            timeout: 120000
          }
        );

        if (response.data.success) {
          return response.data.content;
        } else {
          throw new Error(response.data.error || 'Error desconocido');
        }
      }
    } catch (error) {
      // Si ya es APIError, usar error handler y re-lanzarlo
      if (error instanceof APIError) {
        handleError(error, {
          source: 'deepseek-executor.callOllama',
          type: 'api',
          severity: error.statusCode >= 500 ? 'high' : 'medium',
          metadata: {
            model: modelToUse,
            taskType: taskTypeToUse,
            hasAttachments: attachmentsToUse.length > 0
          }
        });
        throw error;
      }

      // Detectar errores 404 específicamente
      if (error.response?.status === 404 || error.message?.includes('404')) {
        const apiError = APIError.modelNotFound(modelToUse, {
          suggestion: `Ejecuta: ollama pull ${modelToUse}`,
          originalError: error.message
        });
        handleError(apiError, {
          source: 'deepseek-executor.callOllama',
          type: 'api',
          severity: 'medium',
          metadata: { model: modelToUse, errorType: 'model_not_found' }
        });
        throw apiError;
      }

      // Otros errores
      const apiError = APIError.ollamaNotAvailable({
        model: modelToUse,
        originalError: error.message
      });
      handleError(apiError, {
        source: 'deepseek-executor.callOllama',
        type: 'api',
        severity: 'high',
        metadata: { model: modelToUse, errorType: 'ollama_not_available' }
      });
      throw apiError;
    }
  }

  /**
   * ════════════════════════════════════════════════════════════════════════════
   * FALLBACK Y CIRCUIT BREAKERS
   * ════════════════════════════════════════════════════════════════════════════
   */

  /**
   * Detecta si un error de Groq requiere fallback a Ollama o Qwen
   */
  shouldFallbackToOllama(error) {
    if (!error) return false;

    // Errores 401/429 siempre requieren fallback si Ollama está disponible
    if (error.response) {
      const status = error.response.status;
      if (status === 401 || status === 429) {
        return true;
      }
    }

    // Errores de conexión o timeout también requieren fallback
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('timeout')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Detecta si una tarea requiere fallback a Qwen (multimodal, visión)
   */
  shouldFallbackToQwen(taskType, attachments = []) {
    // Si hay imágenes o es tarea multimodal, usar Qwen
    if (attachments && attachments.length > 0) {
      return true;
    }

    // Si es tarea de visión o audio, usar Qwen
    if (taskType === 'multimodal' || taskType === 'vision' || taskType === 'audio') {
      return true;
    }

    return false;
  }

  /**
   * ════════════════════════════════════════════════════════════════════════════
   * MÉTODO PRINCIPAL: EXECUTE (AUTO-SELECCIÓN INTELIGENTE)
   * ════════════════════════════════════════════════════════════════════════════
   */

  /**
   * Ejecuta una petición a DeepSeek (auto-detecta tipo de tarea y selecciona modelo)
   * Implementa fallback inteligente: DeepSeek -> Ollama -> Qwen (si es multimodal)
   * @param {string} text - Texto del mensaje
   * @param {Array} attachments - Attachments (imágenes) opcionales
   * @param {string|null} model - Modelo a usar (opcional, auto-detecta si es null)
   * @returns {Promise<string>} Respuesta del modelo
   * @throws {ValidationError} Si los parámetros son inválidos
   * @throws {APIError} Si hay un error en la API
   */
  async execute(text, attachments = [], model = null) {
    // Validar parámetros
    const validator = createValidator();
    validator
      .addRule('text', { type: VALIDATION_TYPES.STRING, required: true, minLength: 1 })
      .addRule('attachments', { type: VALIDATION_TYPES.ARRAY, required: false, default: [] })
      .addRule('model', { type: VALIDATION_TYPES.STRING, required: false });

    const validated = validator.validate({ text, attachments, model });

    // Detectar tipo de tarea automáticamente
    const taskDetection = this.detectTaskType(validated.text, validated.attachments);
    const { taskType, modelToUse, hasAttachments } = taskDetection;

    this.logger.info('DeepSeek: Tarea detectada', {
      taskType,
      modelToUse,
      hasAttachments,
      needsReasoning: taskDetection.needsReasoning,
      needsCode: taskDetection.needsCode
    });

    // Si es tarea multimodal/visión, fallback a Qwen
    if (this.shouldFallbackToQwen(taskType, validated.attachments)) {
      this.logger.info('DeepSeek: Tarea multimodal detectada, delegando a Qwen');
      if (this.config.qwenExecutor) {
        try {
          return await this.config.qwenExecutor.execute(
            validated.text,
            validated.attachments,
            validated.model
          );
        } catch (error) {
          this.logger.warn('Qwen fallback falló, intentando DeepSeek de todas formas', {
            error: error.message
          });
        }
      } else {
        this.logger.warn(
          'Qwen executor no disponible, usando DeepSeek (puede no soportar imágenes)'
        );
      }
    }

    const groqBreaker = circuitBreakerManager.getBreaker('groq-deepseek', {
      failureThreshold: 3,
      timeout: 60000
    });

    const ollamaBreaker = circuitBreakerManager.getBreaker('ollama-deepseek', {
      failureThreshold: 3,
      timeout: 30000
    });

    let groqError = null;
    let ollamaError = null;

    try {
      // Si modo es 'groq' o 'auto' con API key, intentar Groq primero
      if ((this.config.mode === 'groq' || this.config.mode === 'auto') && this.config.groqApiKey) {
        if (!groqBreaker.isAvailable()) {
          this.logger.warn('Circuit breaker Groq está OPEN, saltando a Ollama');
        } else {
          try {
            const startTime = Date.now();
            const response = await groqBreaker.execute(() =>
              retry(
                () =>
                  this.callGroq(validated.text, validated.attachments, validated.model, taskType),
                {
                  maxRetries: 2,
                  onRetry: (error, attempt, delay) => {
                    this.logger.debug('Reintento Groq DeepSeek', { attempt, delay, taskType });
                  }
                }
              )
            );
            const duration = Date.now() - startTime;
            this.logger.debug('DeepSeek via Groq respondió', {
              duration,
              taskType,
              model: modelToUse
            });
            return response;
          } catch (error) {
            groqError = error;
            const errorInfo = extractErrorInfo(error);

            // Si es error 401/429, intentar fallback a Ollama
            if (this.shouldFallbackToOllama(error) && this.config.ollamaUrl) {
              this.logger.warn('Error con Groq DeepSeek, intentando fallback a Ollama', {
                statusCode: errorInfo.statusCode
              });
            } else {
              // Si no es retryable o no hay Ollama, lanzar error
              if (this.config.mode === 'groq') {
                throw APIError.fromHTTPStatus(
                  errorInfo.statusCode,
                  `Error con Groq API (DeepSeek): ${errorInfo.message}. Verifica tu GROQ_API_KEY en qwen-valencia.env`,
                  errorInfo.details
                );
              }
            }
          }
        }
      }

      // Fallback a Ollama si Groq falló o no está disponible
      if (this.config.ollamaUrl) {
        if (!ollamaBreaker.isAvailable()) {
          this.logger.warn('Circuit breaker Ollama está OPEN');
          throw APIError.ollamaNotAvailable({ circuitBreakerOpen: true });
        }

        try {
          const startTime = Date.now();
          const response = await ollamaBreaker.execute(() =>
            retry(
              () =>
                this.callOllama(
                  validated.text,
                  validated.attachments,
                  null,
                  validated.model,
                  taskType
                ),
              {
                maxRetries: 2,
                onRetry: (error, attempt, delay) => {
                  this.logger.debug('Reintento Ollama DeepSeek', { attempt, delay, taskType });
                }
              }
            )
          );
          const duration = Date.now() - startTime;
          this.logger.debug('DeepSeek via Ollama respondió', {
            duration,
            taskType,
            model: modelToUse
          });
          return response;
        } catch (error) {
          ollamaError = error;
          const errorInfo = extractErrorInfo(error);

          // Si ambos fallaron, lanzar error con información de ambos
          if (groqError) {
            const apiError = APIError.allProvidersFailed([groqError, error], {
              groqError: extractErrorInfo(groqError),
              ollamaError: errorInfo
            });
            handleError(apiError, {
              source: 'deepseek-executor.execute',
              type: 'api',
              severity: 'critical',
              metadata: {
                groqError: extractErrorInfo(groqError).message,
                ollamaError: errorInfo.message,
                mode: this.config.mode,
                taskType
              }
            });
            throw apiError;
          }

          const apiError = APIError.ollamaNotAvailable(errorInfo.details);
          handleError(apiError, {
            source: 'deepseek-executor.execute',
            type: 'api',
            severity: 'high',
            metadata: { mode: this.config.mode, hasGroqKey: !!this.config.groqApiKey, taskType }
          });
          throw apiError;
        }
      } else if (groqError) {
        // Si no hay Ollama configurado y Groq falló, lanzar error
        const errorInfo = extractErrorInfo(groqError);
        throw APIError.fromHTTPStatus(
          errorInfo.statusCode,
          `Error con Groq API (DeepSeek): ${errorInfo.message}. Verifica tu GROQ_API_KEY en qwen-valencia.env`,
          errorInfo.details
        );
      } else {
        throw APIError.fromHTTPStatus(
          400,
          'No hay proveedores configurados. Configura GROQ_API_KEY o OLLAMA_BASE_URL'
        );
      }
    } catch (error) {
      // Si ya es APIError, usar error handler y re-lanzarlo
      if (error instanceof APIError) {
        handleError(error, {
          source: 'deepseek-executor.execute',
          type: 'api',
          severity: error.statusCode >= 500 ? 'high' : 'medium',
          metadata: {
            mode: this.config.mode,
            hasGroqKey: !!this.config.groqApiKey,
            hasOllamaUrl: !!this.config.ollamaUrl,
            taskType
          }
        });
        throw error;
      }

      // Convertir a APIError
      const apiError = APIError.fromHTTPStatus(500, `Error ejecutando DeepSeek: ${error.message}`, {
        originalError: error.message,
        taskType
      });
      handleError(apiError, {
        source: 'deepseek-executor.execute',
        type: 'api',
        severity: 'high',
        metadata: {
          mode: this.config.mode,
          hasGroqKey: !!this.config.groqApiKey,
          hasOllamaUrl: !!this.config.ollamaUrl,
          taskType
        }
      });
      throw apiError;
    }
  }

  /**
   * ════════════════════════════════════════════════════════════════════════════
   * MÉTODOS MCP (COMPATIBILIDAD CON SISTEMA)
   * ════════════════════════════════════════════════════════════════════════════
   */

  /**
   * Ejecuta código usando MCP
   */
  async executeCode(language, code) {
    try {
      const response = await axios.post(
        `${this.config.mcpBaseUrl}/mcp/execute_code`,
        {
          language,
          code
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.mcpSecret}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(`Error ejecutando código: ${error.message}`);
    }
  }

  /**
   * Lee un archivo usando MCP
   */
  async readFile(filePath) {
    try {
      const response = await axios.post(
        `${this.config.mcpBaseUrl}/mcp/read_file`,
        { filePath },
        {
          headers: {
            Authorization: `Bearer ${this.config.mcpSecret}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      throw APIError.fromHTTPStatus(500, `Error leyendo archivo: ${error.message}`, {
        source: 'mcp-read-file',
        originalError: error.message
      });
    }
  }

  /**
   * Lista archivos usando MCP
   */
  async listFiles(dirPath) {
    try {
      const response = await axios.post(
        `${this.config.mcpBaseUrl}/mcp/list_files`,
        { dirPath },
        {
          headers: {
            Authorization: `Bearer ${this.config.mcpSecret}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      throw APIError.fromHTTPStatus(500, `Error listando archivos: ${error.message}`, {
        source: 'mcp-list-files',
        originalError: error.message
      });
    }
  }
}

module.exports = DeepSeekExecutor;
