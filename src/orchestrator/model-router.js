/**
 * ════════════════════════════════════════════════════════════════════════════
 * MODEL ROUTER - ROUTING INTELIGENTE QWEN + DEEPSEEK
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Selecciona automáticamente el modelo apropiado:
 * - Qwen2.5-VL: Multimodal (texto + imágenes) + Ejecutor
 * - DeepSeek Coder: Especializado en código
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

const QwenExecutor = require('../core/qwen-executor');
const DeepSeekExecutor = require('../core/deepseek-executor');

/**
 * @typedef {import('../types')} Types
 */

class ModelRouter {
  constructor(config = {}) {
    this.qwen = new QwenExecutor(config);
    this.deepseek = new DeepSeekExecutor(config);
    
    console.log('✅ ModelRouter inicializado');
  }

  /**
   * Detecta el tipo de tarea según el contenido
   */
  detectTaskType(text, modality, attachments = []) {
    const textLower = text.toLowerCase();
    
    // Si hay imágenes, es multimodal
    if (attachments.length > 0 || modality === 'image' || modality === 'vision') {
      return 'multimodal';
    }
    
    // Detectar si es tarea de código
    const codeKeywords = [
      'código', 'code', 'script', 'función', 'function',
      'programa', 'program', 'ejecuta', 'execute',
      'python', 'javascript', 'typescript', 'java',
      'debug', 'refactor', 'optimizar', 'optimize'
    ];
    
    if (codeKeywords.some(keyword => textLower.includes(keyword))) {
      return 'code';
    }
    
    // Default: multimodal (Qwen puede manejar todo)
    return 'multimodal';
  }

  /**
   * Selecciona el modelo apropiado
   */
  selectModel(taskType, modality, attachments = []) {
    // Si es tarea de código puro (sin imágenes)
    if (taskType === 'code' && attachments.length === 0) {
      return 'deepseek';
    }
    
    // Si es multimodal (imágenes) o requiere visión
    if (taskType === 'multimodal' || attachments.length > 0 || modality === 'image' || modality === 'vision') {
      return 'qwen';
    }
    
    // Default: Qwen (más versátil)
    return 'qwen';
  }

  /**
   * Ejecuta una petición usando el modelo apropiado
   * @param {string} text - Texto del mensaje
   * @param {string} modality - Modalidad ('text'|'image'|'vision')
   * @param {Types.ImageAttachment[]} attachments - Attachments (imágenes)
   * @param {Object} options - Opciones adicionales
   * @param {Types.ModelId} [options.model] - Modelo específico a usar
   * @param {boolean} [options.useAPI] - Si usar API o local
   * @returns {Promise<Types.MessageResponse>} Respuesta del modelo
   */
  async route(text, modality = 'text', attachments = [], options = {}) {
    try {
      // Verificar si se solicita Sandra IA
      const modelToUse = options.model || null;
      
      if (modelToUse === 'sandra-ia-8.0' || modelToUse === 'sandra' || options.provider === 'sandra') {
        // Enrutar a Sandra IA MCP Server
        return await this.routeToSandraIA(text, modality, attachments, options);
      }
      
      // Detectar tipo de tarea
      const taskType = this.detectTaskType(text, modality, attachments);
      
      // Seleccionar modelo
      const model = this.selectModel(taskType, modality, attachments);
      
      // Determinar modo basado en provider del modelo seleccionado o useAPI
      const useAPI = options.useAPI !== false; // Por defecto true
      let finalMode = useAPI ? 'groq' : 'ollama';
      
      let parsedModel = null;
      
      if (modelToUse) {
        // Verificar si el modelo es de Groq (modelos API)
        // Modelos API de Qwen: qwen-2.5-XXb-instruct (con guiones, sin :)
        // Modelos API de DeepSeek: deepseek-r1-distill-* (con guiones, sin :)
        const isGroqModel = modelToUse.includes('groq') || 
                           modelToUse.includes('distill') || 
                           modelToUse.includes('llama-3') ||
                           modelToUse.includes('mixtral') ||
                           modelToUse.includes('qwen-2.5') || // Todos los modelos Qwen API
                           modelToUse.includes('deepseek-r1-distill') ||
                           (modelToUse.startsWith('qwen') && modelToUse.includes('-') && !modelToUse.includes(':')) ||
                           (modelToUse.startsWith('deepseek') && modelToUse.includes('-') && !modelToUse.includes(':'));
        
        // Verificar si el modelo es de Ollama (tiene ":" y no es Groq)
        const isOllamaModel = modelToUse.includes(':') && !isGroqModel;
        
        if (isGroqModel) {
          finalMode = 'groq';
          // Para modelos Groq, usar el nombre completo
          parsedModel = modelToUse;
        } else if (isOllamaModel) {
          finalMode = 'ollama';
          // Para modelos Ollama, parsear el nombre (ej: "qwen2.5:7b-instruct" -> "qwen2.5:7b-instruct")
          parsedModel = modelToUse;
        } else {
          // Modelo sin provider explícito, usar useAPI
          parsedModel = modelToUse;
        }
        
        console.log(`🎯 Modelo detectado: ${modelToUse} → Provider: ${isGroqModel ? 'Groq' : isOllamaModel ? 'Ollama' : 'Auto'}`);
      }
      
      if (finalMode === 'groq') {
        console.log(`⚡ Modo API activado - Usando Groq (rápido)`);
        this.qwen.config.mode = 'groq';
        this.deepseek.config.mode = 'groq';
      } else {
        console.log(`🔄 Modo Local activado - Usando Ollama`);
        this.qwen.config.mode = 'ollama';
        this.deepseek.config.mode = 'ollama';
      }
      
      console.log(`🎯 Routing: ${taskType} → ${model} (${finalMode === 'groq' ? 'API' : 'Local'})`);
      
      // Ejecutar con el modelo apropiado
      let response;
      
      if (parsedModel) {
        console.log(`🎯 Router usando modelo: ${parsedModel}`);
      }
      
      if (model === 'deepseek') {
        response = await this.deepseek.execute(text, [], parsedModel);
      } else {
        response = await this.qwen.execute(text, attachments, parsedModel);
      }
      
      return {
        success: true,
        model,
        taskType,
        response,
        modality
      };
    } catch (error) {
      console.error('❌ Error en routing:', error);
      
      // Fallback inteligente: cambiar a modo 'auto' y intentar con Qwen
      try {
        console.log('🔄 Intentando fallback a Qwen con modo auto...');
        
        // Cambiar temporalmente a modo 'auto' para permitir fallback Groq → Ollama
        const originalQwenMode = this.qwen.config.mode;
        const originalDeepseekMode = this.deepseek.config.mode;
        
        this.qwen.config.mode = 'auto';
        this.deepseek.config.mode = 'auto';
        
        try {
          const fallbackResponse = await this.qwen.execute(text, attachments);
          
          return {
            success: true,
            model: 'qwen',
            taskType: 'fallback',
            response: fallbackResponse,
            modality,
            warning: 'Fallback activado debido a error'
          };
        } finally {
          // Restaurar modos originales
          this.qwen.config.mode = originalQwenMode;
          this.deepseek.config.mode = originalDeepseekMode;
        }
      } catch (fallbackError) {
        return {
          success: false,
          error: error.message,
          fallbackError: fallbackError.message,
          allProvidersFailed: true
        };
      }
    }
  }

  /**
   * Ejecuta código directamente (usando DeepSeek)
   */
  async executeCode(language, code) {
    return await this.deepseek.executeCode(language, code);
  }

  /**
   * Lee un archivo (usando Qwen)
   */
  async readFile(filePath) {
    return await this.qwen.readFile(filePath);
  }

  /**
   * Lista archivos (usando Qwen)
   */
  async listFiles(dirPath) {
    return await this.qwen.listFiles(dirPath);
  }

  /**
   * Enruta mensaje a Sandra IA 8.0
   */
  async routeToSandraIA(text, modality = 'text', attachments = [], options = {}) {
    try {
      const axios = require('axios');
      
      // Llamar a Sandra IA MCP Server
      const response = await axios.post('http://localhost:6004/route-message', {
        text,
        attachments,
        modality,
        options
      }, {
        timeout: 60000 // 60 segundos timeout para orquestación compleja
      });

      if (response.data && response.data.success) {
        return {
          success: true,
          model: 'sandra-ia-8.0',
          provider: 'sandra',
          taskType: 'orchestrated',
          response: response.data.response || response.data.content,
          modality,
          sources: response.data.sources,
          usage: response.data.usage
        };
      } else {
        throw new Error(response.data?.error || 'Error en Sandra IA');
      }
    } catch (error) {
      console.error('❌ Error enrutando a Sandra IA:', error);
      
      // Fallback a Qwen si Sandra IA falla
      console.log('🔄 Fallback a Qwen debido a error en Sandra IA...');
      try {
        const fallbackResponse = await this.qwen.execute(text, attachments);
        return {
          success: true,
          model: 'qwen',
          provider: 'fallback',
          taskType: 'fallback',
          response: fallbackResponse,
          modality,
          warning: 'Sandra IA no disponible, usando Qwen como fallback'
        };
      } catch (fallbackError) {
        return {
          success: false,
          error: error.message,
          fallbackError: fallbackError.message,
          allProvidersFailed: true
        };
      }
    }
  }
}

module.exports = ModelRouter;

