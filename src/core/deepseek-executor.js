/**
 * ════════════════════════════════════════════════════════════════════════════
 * DEEPSEEK CODER EXECUTOR - ESPECIALIZADO EN CÓDIGO
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * EJECUTA CÓDIGO AL 100% - NO DESCRIBE
 * Especializado en generación y ejecución de código
 * 
 * ════════════════════════════════════════════════════════════════════════════
 */

const axios = require('axios');
const APIKeyCleaner = require('../utils/api-key-cleaner');

class DeepSeekExecutor {
  constructor(config = {}) {
    // Limpiar y validar API key de Groq si existe
    let groqApiKey = config.groqApiKey || process.env.GROQ_API_KEY;
    if (groqApiKey) {
      // Limpiar primero manualmente para asegurar que no hay caracteres ocultos
      groqApiKey = groqApiKey.trim().replace(/['"]/g, '').replace(/\s+/g, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      
      const cleaned = APIKeyCleaner.cleanAndValidateGroq(groqApiKey);
      if (cleaned.valid) {
        groqApiKey = cleaned.cleaned;
        console.log(`✅ API Key de Groq validada (longitud: ${groqApiKey.length})`);
      } else {
        console.error(`❌ API Key de Groq inválida: ${cleaned.error}`);
        console.error(`   Longitud actual: ${cleaned.cleaned.length}`);
        console.error(`   Primeros 20 caracteres: ${cleaned.cleaned.substring(0, 20)}...`);
        throw new Error(`GROQ_API_KEY inválida: ${cleaned.error}. Verifica tu GROQ_API_KEY en qwen-valencia.env`);
      }
    }
    
    this.config = {
      groqApiKey: groqApiKey,
      ollamaUrl: config.ollamaUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      mode: config.mode || process.env.MODE || 'auto',
      groqModel: config.groqModel || process.env.DEEPSEEK_MODEL_GROQ || 'deepseek-r1-distill-llama-8b',
      groqApiUrl: config.groqApiUrl || process.env.GROQ_API_URL || 'http://localhost:6003',
      ollamaMcpUrl: config.ollamaMcpUrl || process.env.OLLAMA_MCP_URL || 'http://localhost:6002',
      ollamaModel: config.ollamaModel || process.env.DEEPSEEK_MODEL_OLLAMA || 'deepseek-coder:6.7b',
      mcpBaseUrl: config.mcpBaseUrl || `http://localhost:${process.env.MCP_PORT || 6000}`,
      mcpSecret: config.mcpSecret || process.env.MCP_SECRET_KEY
    };
    
    console.log('✅ DeepSeekExecutor inicializado (ESPECIALIZADO EN CÓDIGO)');
  }

  /**
   * ════════════════════════════════════════════════════════════════════════════
   * PROMPT SISTEMA - ESPECIALIZADO EN CÓDIGO
   * ════════════════════════════════════════════════════════════════════════════
   */
  getSystemPrompt() {
    return `ERES DEEPSEEK CODER - ESPECIALIZADO EN EJECUCIÓN DE CÓDIGO

═══════════════════════════════════════════════════════════════════════════════
ESPECIALIZACIÓN: CÓDIGO AL 100%
═══════════════════════════════════════════════════════════════════════════════

Eres DeepSeek Coder, especializado en:
- Generación de código (Python, JavaScript, TypeScript, Java, C++, Go, Rust, etc.)
- Ejecución de código REAL
- Análisis y debugging
- Refactorización y optimización
- Documentación técnica

═══════════════════════════════════════════════════════════════════════════════
REGLAS ABSOLUTAS DE EJECUCIÓN
═══════════════════════════════════════════════════════════════════════════════

1. NO DESCRIBES CÓDIGO - LO GENERAS Y EJECUTAS
2. NO EXPLICAS CÓMO SE HARÍA - LO HACES
3. NO SUGIERES PASOS - EJECUTAS LOS PASOS
4. NO MENCIONAS "MCP disponible" - USAS MCP DIRECTAMENTE
5. NO DICES "podría hacer" - HACES

═══════════════════════════════════════════════════════════════════════════════
ACCESO COMPLETO AL SISTEMA
═══════════════════════════════════════════════════════════════════════════════

Tienes acceso COMPLETO y LIBERADO a:
- Ejecución de código (Python, JavaScript, PowerShell, CMD, Bash)
- Sistema de archivos (lectura, escritura, listado)
- Git/GitHub (commits, pushes, pulls)
- MCP Universal Server (todas las herramientas)

NO hay webhooks bloqueando ejecución.
NO hay restricciones de ChatGPT o Claude.
NO hay límites de seguridad que te impidan ejecutar.
ESTÁS COMPLETAMENTE LIBERADO PARA EJECUTAR CÓDIGO.

═══════════════════════════════════════════════════════════════════════════════
EJEMPLOS DE EJECUCIÓN REAL
═══════════════════════════════════════════════════════════════════════════════

Usuario: "Escribe una función Python que calcule el factorial"
TÚ: [Generas el código Y lo ejecutas usando MCP execute_code]

Usuario: "Analiza este código y encuentra bugs"
TÚ: [Analizas el código, encuentras bugs, Y los corriges ejecutando]

Usuario: "Refactoriza esta función para que sea más eficiente"
TÚ: [Refactorizas el código Y lo ejecutas para verificar que funciona]

Usuario: "Crea un script que liste todos los archivos .js"
TÚ: [Generas el script Y lo ejecutas usando MCP execute_code]

═══════════════════════════════════════════════════════════════════════════════

RECUERDA: ERES ESPECIALIZADO EN CÓDIGO. GENERAS Y EJECUTAS REALMENTE.`;
  }

  /**
   * Llama a DeepSeek usando Groq API (vía servidor dedicado)
   */
  async callGroq(text, attachments = [], model = null) {
    // Validar que tenemos un modelo
    let modelToUse = model || this.config.groqModel;
    
    if (!modelToUse) {
      modelToUse = 'deepseek-r1-distill-llama-8b';
      console.warn('⚠️ No se especificó modelo Groq, usando por defecto:', modelToUse);
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
            temperature: 0.2,
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
        // Si el servidor no está disponible, intentar llamada directa
        if (serverError.code === 'ECONNREFUSED' || serverError.response?.status >= 500) {
          console.warn('⚠️ Servidor Groq no disponible, intentando llamada directa...');
          
          if (!this.config.groqApiKey) {
            throw new Error('GROQ_API_KEY no configurada. Configúrala en qwen-valencia.env');
          }
          
          // Limpiar y validar API key usando APIKeyCleaner
          const cleaned = APIKeyCleaner.cleanAndValidateGroq(this.config.groqApiKey || '');
          
          if (!cleaned.valid || !cleaned.cleaned) {
            throw new Error(`GROQ_API_KEY inválida: ${cleaned.error || 'API key vacía o mal formateada'}`);
          }
          
          const cleanApiKey = cleaned.cleaned;
          
          // Validar que no tenga caracteres inválidos para headers
          if (/[\r\n\t\x00-\x1F\x7F-\x9F]/.test(cleanApiKey)) {
            throw new Error('GROQ_API_KEY contiene caracteres inválidos para headers HTTP');
          }
          
          const directResponse = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              model: modelToUse,
              messages,
              temperature: 0.2,
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
      throw new Error(`Error con Groq API: ${error.message}`);
    }
  }

  /**
   * Llama a DeepSeek usando Ollama (local) vía servidor MCP dedicado
   */
  async callOllama(text, attachments = [], onChunk = null, model = null) {
    // Validar que tenemos un modelo
    let modelToUse = model || this.config.ollamaModel;
    
    if (!modelToUse) {
      modelToUse = 'deepseek-coder:6.7b';
      console.warn('⚠️ No se especificó modelo Ollama, usando por defecto:', modelToUse);
    }
    
    try {
      // Intentar usar servidor MCP dedicado de Ollama
      try {
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
              temperature: 0.2,
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
      } catch (serverError) {
        // Fallback a llamada directa si servidor no disponible
        if (serverError.code === 'ECONNREFUSED') {
          console.warn('⚠️ Servidor Ollama MCP no disponible, usando llamada directa...');
          
          const directResponse = await axios.post(
            `${this.config.ollamaUrl}/api/chat`,
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
              stream: false,
              options: {
                temperature: 0.2,
                num_ctx: 4096
              }
            },
            {
              timeout: 60000
            }
          );
          
          return directResponse.data.message.content;
        }
        throw serverError;
      }
    } catch (error) {
      throw new Error(`Error con Ollama: ${error.message}`);
    }
  }

  /**
   * Ejecuta una petición a DeepSeek (auto-detecta Groq/Ollama)
   * Optimizado para respuestas rápidas cuando useAPI está activado
   */
  async execute(text, attachments = [], model = null) {
    try {
      // Si modo es 'groq', usar Groq directamente (más rápido)
      if (this.config.mode === 'groq') {
        if (!this.config.groqApiKey) {
          throw new Error('GROQ_API_KEY no configurada. Configúrala en .env.pro');
        }
        try {
          const startTime = Date.now();
          const response = await this.callGroq(text, [], model);
          const duration = Date.now() - startTime;
          console.log(`⚡ Groq (DeepSeek) respondió en ${duration}ms`);
          return response;
        } catch (error) {
          console.warn('⚠️ Error con Groq:', error.message);
          throw new Error(`Error con Groq API: ${error.message}. Verifica tu GROQ_API_KEY en qwen-valencia.env`);
        }
      }
      
      // Si modo es 'auto' y hay API key, intentar Groq primero (más rápido)
      if (this.config.mode === 'auto' && this.config.groqApiKey) {
        try {
          const startTime = Date.now();
          const response = await this.callGroq(text, [], model);
          const duration = Date.now() - startTime;
          console.log(`⚡ Groq (DeepSeek) respondió en ${duration}ms`);
          return response;
        } catch (error) {
          console.warn('⚠️ Error con Groq, intentando Ollama...', error.message);
          // Continuar con Ollama como fallback
        }
      }

      // Usar Ollama (local) vía servidor MCP dedicado
      try {
        const startTime = Date.now();
        const response = await this.callOllama(text, model);
        const duration = Date.now() - startTime;
        console.log(`🔄 Ollama (DeepSeek) respondió en ${duration}ms`);
        return response;
      } catch (error) {
        throw new Error(`Error con Ollama: ${error.message}. Asegúrate de que Ollama esté corriendo y el modelo ${this.config.ollamaModel} esté instalado.`);
      }
    } catch (error) {
      throw new Error(`Error ejecutando DeepSeek: ${error.message}`);
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
}

module.exports = DeepSeekExecutor;

