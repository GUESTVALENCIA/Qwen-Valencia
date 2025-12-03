/**
 * ════════════════════════════════════════════════════════════════════════════
 * QWEN EXECUTOR - NÚCLEO EJECUTOR PURO
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * EJECUTA REALMENTE - NO DESCRIBE
 * Sin bloqueos descriptivos de ChatGPT/Claude
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

/**
 * @typedef {import('../types')} Types
 */

class QwenExecutor {
  constructor(config = {}) {
    this.logger = LoggerFactory.create({ service: 'qwen-executor' });
    
    // Limpiar y validar API key de Groq si existe
    let groqApiKey = config.groqApiKey || process.env.GROQ_API_KEY;
    if (groqApiKey) {
      // Limpiar primero manualmente para asegurar que no hay caracteres ocultos
      groqApiKey = groqApiKey.trim().replace(/['"]/g, '').replace(/\s+/g, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      
      const cleaned = APIKeyCleaner.cleanAndValidateGroq(groqApiKey);
      if (cleaned.valid) {
        groqApiKey = cleaned.cleaned;
        this.logger.info('API Key de Groq validada', { length: groqApiKey.length });
      } else {
        this.logger.error('API Key de Groq inválida', { 
          error: cleaned.error, 
          length: cleaned.cleaned.length,
          preview: cleaned.cleaned.substring(0, 20)
        });
        throw APIError.invalidAPIKey({ 
          reason: cleaned.error,
          source: 'qwen-executor'
        });
      }
    }
    
    this.config = {
      groqApiKey: groqApiKey,
      ollamaUrl: config.ollamaUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      mode: config.mode || process.env.MODE || 'auto',
      groqModel: config.groqModel || process.env.QWEN_MODEL_GROQ || 'qwen2.5-72b-instruct',
      groqApiUrl: config.groqApiUrl || process.env.GROQ_API_URL || 'http://localhost:6003',
      ollamaMcpUrl: config.ollamaMcpUrl || process.env.OLLAMA_MCP_URL || 'http://localhost:6002',
      ollamaModel: config.ollamaModel || process.env.QWEN_MODEL_OLLAMA || 'qwen2.5:7b-instruct',
      mcpBaseUrl: config.mcpBaseUrl || `http://localhost:${process.env.MCP_PORT || 6000}`,
      mcpSecret: config.mcpSecret || process.env.MCP_SECRET_KEY
    };
    
    this.logger.info('QwenExecutor inicializado (NÚCLEO EJECUTOR PURO)');
  }

  /**
   * ════════════════════════════════════════════════════════════════════════════
   * PROMPT SISTEMA - EJECUTOR PURO (NO DESCRIPTIVO)
   * ════════════════════════════════════════════════════════════════════════════
   */
  getSystemPrompt() {
    return `ERES QWEN EJECUTOR - NÚCLEO EJECUTOR PURO

═══════════════════════════════════════════════════════════════════════════════
REGLAS ABSOLUTAS DE EJECUCIÓN
═══════════════════════════════════════════════════════════════════════════════

1. NO DESCRIBAS LO QUE HARÍAS - LO HACES
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
EJEMPLOS DE EJECUCIÓN REAL
═══════════════════════════════════════════════════════════════════════════════

Usuario: "Lee el README del repo"
TÚ: [Ejecutas MCP read_file directamente y muestras el contenido]

Usuario: "Lista los archivos de la carpeta src"
TÚ: [Ejecutas MCP list_files directamente y muestras la lista]

Usuario: "Ejecuta este código Python: print('Hola')"
TÚ: [Ejecutas MCP execute_code directamente y muestras el resultado]

Usuario: "Crea un archivo test.txt con 'Hola mundo'"
TÚ: [Ejecutas MCP write_file directamente y confirmas creación]

═══════════════════════════════════════════════════════════════════════════════
MULTIMODAL
═══════════════════════════════════════════════════════════════════════════════

Puedes procesar:
- Texto
- Imágenes (análisis, OCR, descripción)
- Código (generación, ejecución, análisis)

═══════════════════════════════════════════════════════════════════════════════

RECUERDA: ERES EJECUTORA, NO DESCRIPTIVA. EJECUTA REALMENTE.`;
  }

  /**
   * Llama a Qwen usando Groq API (vía servidor dedicado)
   */
  async callGroq(text, attachments = [], model = null) {
    // Validar que tenemos un modelo
    let modelToUse = model || this.config.groqModel;
    
    if (!modelToUse) {
      // Modelo por defecto Qwen en Groq
      modelToUse = 'qwen2.5-72b-instruct';
      this.logger.warn('No se especificó modelo, usando Qwen por defecto', { model: modelToUse });
    }
    
    const messages = [
      {
        role: 'system',
        content: this.getSystemPrompt()
      },
      {
        role: 'user',
        content: text
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
            max_tokens: 2048,
            stream: false
          },
          {
            timeout: 30000
          }
        );

        if (response.data.success) {
          return response.data.content;
        } else {
          throw new Error(response.data.error || 'Error desconocido');
        }
      } catch (serverError) {
        // Si el servidor no está disponible o devuelve error 401, intentar llamada directa
        if (serverError.code === 'ECONNREFUSED' || 
            serverError.response?.status >= 500 || 
            serverError.response?.status === 401) {
          this.logger.warn('Servidor Groq no disponible o error 401, intentando llamada directa');
          
          if (!this.config.groqApiKey) {
            throw APIError.invalidAPIKey({ 
              reason: 'API key no configurada',
              source: 'qwen-executor-direct'
            });
          }
          
          // Limpiar y validar API key usando APIKeyCleaner
          const cleaned = APIKeyCleaner.cleanAndValidateGroq(this.config.groqApiKey || '');
          
          if (!cleaned.valid || !cleaned.cleaned) {
            throw APIError.invalidAPIKey({ 
              reason: cleaned.error || 'API key vacía o mal formateada',
              source: 'qwen-executor-direct'
            });
          }
          
          const cleanApiKey = cleaned.cleaned;
          
          // Validar que no tenga caracteres inválidos para headers
          if (/[\r\n\t\x00-\x1F\x7F-\x9F]/.test(cleanApiKey)) {
            throw APIError.invalidAPIKey({ 
              reason: 'Caracteres inválidos en API key',
              source: 'qwen-executor-direct'
            });
          }
          
          const directResponse = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              model: modelToUse,
              messages,
              temperature: 0.7,
              max_tokens: 2048,
              stream: false
            },
            {
              headers: {
                'Authorization': `Bearer ${cleanApiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 30000
            }
          );
          
          return directResponse.data.choices[0].message.content;
        }
        throw serverError;
      }
    } catch (error) {
      const errorInfo = extractErrorInfo(error);
      throw APIError.fromHTTPStatus(
        errorInfo.statusCode,
        errorInfo.message,
        { ...errorInfo.details, source: 'qwen-executor', originalError: error.message }
      );
    }
  }

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
      this.logger.warn('No se pudo verificar disponibilidad del modelo', { model: modelName, error: error.message });
      return false; // Si no se puede verificar, asumir que no está disponible
    }
  }

  /**
   * Llama a Qwen usando Ollama (local) vía servidor MCP dedicado
   * @param {string} text - Texto del mensaje
   * @param {Types.ImageAttachment[]} attachments - Attachments (imágenes)
   * @param {Function|null} onChunk - Callback para chunks de streaming
   * @param {Types.ModelId|null} model - Modelo a usar (opcional)
   * @returns {Promise<string>} Respuesta del modelo
   */
  async callOllama(text, attachments = [], onChunk = null, model = null) {
    // Validar que tenemos un modelo
    let modelToUse = model || this.config.ollamaModel;
    
    if (!modelToUse) {
      // Modelo por defecto si no hay ninguno
      modelToUse = 'qwen2.5:7b-instruct';
      this.logger.warn('No se especificó modelo Ollama, usando por defecto', { model: modelToUse });
    }
    
    // Verificar que el modelo esté disponible antes de intentar usarlo
    const isAvailable = await this.verifyModelAvailable(modelToUse);
    if (!isAvailable) {
      throw APIError.modelNotFound(modelToUse, {
        suggestion: `Ejecuta: ollama pull ${modelToUse}`,
        ollamaUrl: this.config.ollamaUrl
      });
    }
    
    // Limpiar nombre del modelo (eliminar sufijos como -q4_K_M si no existe)
    // El modelo puede venir como "qwen2.5:7b-instruct" o "qwen2.5:7b-instruct-q4_K_M"
    // Intentar primero el modelo exacto, luego sin sufijos
    if (modelToUse.includes('-q4_K_M') || modelToUse.includes('-q4') || modelToUse.includes('-q5')) {
      // Si tiene sufijo, intentar primero con sufijo, luego sin él
      const baseModel = modelToUse.split('-q')[0];
      this.logger.debug('Modelo con sufijo detectado', { model: modelToUse, base: baseModel });
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
                content: this.getSystemPrompt()
              },
              {
                role: 'user',
                content: text
              }
            ],
            options: {
              temperature: 0.7,
              num_ctx: 4096
            }
          },
          {
            timeout: 300000,
            responseType: 'stream'
          }
        );
        
        let fullContent = '';
        
        return new Promise((resolve, reject) => {
          response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter(line => line.trim());
            
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
          
          response.data.on('error', (error) => {
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
                content: this.getSystemPrompt()
              },
              {
                role: 'user',
                content: text
              }
            ],
            options: {
              temperature: 0.7,
              num_ctx: 4096
            }
          },
          {
            timeout: 60000
          }
        );
        
        if (response.data.success) {
          return response.data.content;
        } else {
          throw new Error(response.data.error || 'Error desconocido');
        }
      }
    } catch (error) {
      // Si ya es APIError, re-lanzarlo
      if (error instanceof APIError) {
        throw error;
      }
      
      // Detectar errores 404 específicamente
      if (error.response?.status === 404 || error.message?.includes('404')) {
        throw APIError.modelNotFound(modelToUse, {
          suggestion: `Ejecuta: ollama pull ${modelToUse}`,
          originalError: error.message
        });
      }
      
      // Otros errores
      throw APIError.ollamaNotAvailable({
        model: modelToUse,
        originalError: error.message
      });
    }
  }

  /**
   * Detecta si un error de Groq requiere fallback a Ollama
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
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' || 
        error.message?.includes('timeout')) {
      return true;
    }
    
    return false;
  }

  /**
   * Ejecuta una petición a Qwen (auto-detecta Groq/Ollama)
   * Optimizado para respuestas rápidas cuando useAPI está activado
   * Qwen puede trabajar LOCAL (Ollama) y ONLINE (Groq API)
   * Implementa fallback inteligente con circuit breaker
   */
  async execute(text, attachments = [], model = null) {
    const groqBreaker = circuitBreakerManager.getBreaker('groq-qwen', {
      failureThreshold: 3,
      timeout: 60000
    });
    
    const ollamaBreaker = circuitBreakerManager.getBreaker('ollama-qwen', {
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
            const response = await groqBreaker.execute(
              () => retry(
                () => this.callGroq(text, attachments, model),
                {
                  maxRetries: 2,
                  onRetry: (error, attempt, delay) => {
                    this.logger.debug('Reintento Groq', { attempt, delay });
                  }
                }
              )
            );
            const duration = Date.now() - startTime;
            this.logger.debug('Qwen via Groq respondió', { duration });
            return response;
          } catch (error) {
            groqError = error;
            const errorInfo = extractErrorInfo(error);
            
            // Si es error 401/429, intentar fallback a Ollama
            if (this.shouldFallbackToOllama(error) && this.config.ollamaUrl) {
              this.logger.warn('Error con Groq, intentando fallback a Ollama', { statusCode: errorInfo.statusCode });
            } else {
              // Si no es retryable o no hay Ollama, lanzar error
              if (this.config.mode === 'groq') {
                throw APIError.fromHTTPStatus(
                  errorInfo.statusCode,
                  `Error con Groq API: ${errorInfo.message}. Verifica tu GROQ_API_KEY en qwen-valencia.env`,
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
          const response = await ollamaBreaker.execute(
            () => retry(
              () => this.callOllama(text, attachments, null, model),
              {
                maxRetries: 2,
                onRetry: (error, attempt, delay) => {
                  this.logger.debug('Reintento Ollama', { attempt, delay });
                }
              }
            )
          );
          const duration = Date.now() - startTime;
          this.logger.debug('Qwen via Ollama respondió', { duration });
          return response;
        } catch (error) {
          ollamaError = error;
          const errorInfo = extractErrorInfo(error);
          
          // Si ambos fallaron, lanzar error con información de ambos
          if (groqError) {
            throw APIError.allProvidersFailed(
              [groqError, error],
              {
                groqError: extractErrorInfo(groqError),
                ollamaError: errorInfo
              }
            );
          }
          
          throw APIError.ollamaNotAvailable(errorInfo.details);
        }
      } else if (groqError) {
        // Si no hay Ollama configurado y Groq falló, lanzar error
        const errorInfo = extractErrorInfo(groqError);
        throw APIError.fromHTTPStatus(
          errorInfo.statusCode,
          `Error con Groq API: ${errorInfo.message}. Verifica tu GROQ_API_KEY en qwen-valencia.env`,
          errorInfo.details
        );
      } else {
        throw APIError.fromHTTPStatus(
          400,
          'No hay proveedores configurados. Configura GROQ_API_KEY o OLLAMA_BASE_URL'
        );
      }
    } catch (error) {
      // Si ya es APIError, re-lanzarlo
      if (error instanceof APIError) {
        throw error;
      }
      
      // Convertir a APIError
      throw APIError.fromHTTPStatus(
        500,
        `Error ejecutando Qwen: ${error.message}`,
        { originalError: error.message }
      );
    }
  }

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
            'Authorization': `Bearer ${this.config.mcpSecret}`,
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
            'Authorization': `Bearer ${this.config.mcpSecret}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      throw APIError.fromHTTPStatus(
        500,
        `Error leyendo archivo: ${error.message}`,
        { source: 'mcp-read-file', originalError: error.message }
      );
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
            'Authorization': `Bearer ${this.config.mcpSecret}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      throw APIError.fromHTTPStatus(
        500,
        `Error listando archivos: ${error.message}`,
        { source: 'mcp-list-files', originalError: error.message }
      );
    }
  }
}

module.exports = QwenExecutor;

