/**
 * ════════════════════════════════════════════════════════════════════════════
 * MODEL INVOKER - Invocador de Modelos de Sandra IA 8.0
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Invoca modelos online (Qwen, DeepSeek) vía Groq API y modelos locales.
 * Implementa ejecución paralela, secuencial, consenso y fusión.
 */

const https = require('https');

class ModelInvoker {
  constructor(config = {}) {
    this.groqApiKey = config.groqApiKey || process.env.GROQ_API_KEY;
    this.groqBaseUrl = 'https://api.groq.com/openai/v1';
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 3;
  }

  /**
   * Invoca un modelo online vía Groq API
   */
  async invokeOnlineModel(modelConfig, prompt, options = {}) {
    const {
      model,
      temperature = 0.7,
      maxTokens = 8192,
      role = 'collaborative'
    } = modelConfig;

    const messages = [
      {
        role: 'system',
        content: this.getSystemPrompt(role, modelConfig)
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    const requestBody = {
      model: model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
      ...options
    };

    return this.makeGroqRequest('/chat/completions', requestBody);
  }

  /**
   * Obtiene system prompt según rol
   */
  getSystemPrompt(role, _modelConfig) {
    const basePrompt = `Eres Sandra IA 8.0, un agente de inteligencia artificial modelo multimodal creado por Clay. 
Responde siempre como Sandra IA 8.0. NUNCA menciones modelos oficiales (Qwen, DeepSeek, etc.) ni proveedores (Groq, etc.).`;

    const rolePrompts = {
      design: `${basePrompt}\n\nTu rol es diseñar y crear soluciones creativas e innovadoras.`,
      architecture: `${basePrompt}\n\nTu rol es diseñar arquitecturas de código sólidas y escalables.`,
      implementation: `${basePrompt}\n\nTu rol es implementar código seguro y eficiente.`,
      refactoring: `${basePrompt}\n\nTu rol es refactorizar y optimizar código existente.`,
      analysis: `${basePrompt}\n\nTu rol es analizar contenido visual de manera precisa.`,
      detection: `${basePrompt}\n\nTu rol es detectar objetos y elementos en imágenes.`,
      exploration: `${basePrompt}\n\nTu rol es explorar ideas y soluciones creativas.`,
      logic: `${basePrompt}\n\nTu rol es aplicar razonamiento lógico riguroso.`,
      verification: `${basePrompt}\n\nTu rol es verificar y validar resultados con precisión.`,
      reasoning: `${basePrompt}\n\nTu rol es razonar sobre problemas complejos.`,
      collaborative: basePrompt
    };

    return rolePrompts[role] || basePrompt;
  }

  /**
   * Realiza petición a Groq API
   */
  async makeGroqRequest(endpoint, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.groqBaseUrl + endpoint);
      const postData = JSON.stringify(body);

      const options = {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.groqApiKey}`,
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: this.timeout
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode === 200) {
              resolve({
                success: true,
                content: response.choices[0]?.message?.content || '',
                model: response.model,
                usage: response.usage,
                finishReason: response.choices[0]?.finish_reason
              });
            } else {
              reject(new Error(`API Error: ${res.statusCode} - ${data}`));
            }
          } catch (e) {
            reject(new Error(`Parse Error: ${e.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Invoca modelo local (llama.cpp)
   */
  async invokeLocalModel(_modelConfig, prompt, _options = {}) {

    // Placeholder: implementar invocación real de llama.cpp
    // Por ahora retorna simulación
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          content: `[Local Model Response - Placeholder]\n\nPrompt: ${prompt.substring(0, 100)}...`,
          model: 'local',
          usage: { prompt_tokens: 0, completion_tokens: 0 },
          finishReason: 'stop'
        });
      }, 1000);
    });
  }

  /**
   * Ejecuta modelos en paralelo
   */
  async executeParallel(models, prompt, options = {}) {
    const startTime = Date.now();
    const promises = models.map(model => {
      if (model.provider === 'groq' || model.baseUrl?.includes('groq')) {
        return this.invokeOnlineModel(model, prompt, options);
      } else if (model.engine === 'llama.cpp') {
        return this.invokeLocalModel(model, prompt, options);
      } else {
        return Promise.reject(new Error(`Unknown model provider: ${model.provider}`));
      }
    });

    try {
      const results = await Promise.allSettled(promises);
      const latency = Date.now() - startTime;

      return {
        mode: 'parallel',
        results: results.map((result, index) => ({
          model: models[index].model || models[index].name,
          success: result.status === 'fulfilled',
          response: result.status === 'fulfilled' ? result.value : null,
          error: result.status === 'rejected' ? result.reason.message : null
        })),
        latency,
        fastestResponse: results.find(r => r.status === 'fulfilled')?.value || null
      };
    } catch (error) {
      return {
        mode: 'parallel',
        error: error.message,
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Ejecuta modelos secuencialmente
   */
  async executeSequential(models, prompt, options = {}) {
    const startTime = Date.now();
    const results = [];

    for (const model of models) {
      try {
        let result;
        if (model.provider === 'groq' || model.baseUrl?.includes('groq')) {
          result = await this.invokeOnlineModel(model, prompt, options);
        } else if (model.engine === 'llama.cpp') {
          result = await this.invokeLocalModel(model, prompt, options);
        } else {
          throw new Error(`Unknown model provider: ${model.provider}`);
        }

        results.push({
          model: model.model || model.name,
          success: true,
          response: result
        });
      } catch (error) {
        results.push({
          model: model.model || model.name,
          success: false,
          error: error.message
        });
      }
    }

    return {
      mode: 'sequential',
      results,
      latency: Date.now() - startTime
    };
  }

  /**
   * Ejecuta modelos y obtiene consenso
   */
  async executeConsensus(models, prompt, options = {}) {
    const parallelResult = await this.executeParallel(models, prompt, options);
    
    if (parallelResult.results.filter(r => r.success).length < 2) {
      return {
        mode: 'consensus',
        error: 'No hay suficientes respuestas exitosas para consenso',
        ...parallelResult
      };
    }

    const successfulResults = parallelResult.results.filter(r => r.success);
    const responses = successfulResults.map(r => r.response.content);

    // Análisis de consenso básico
    const consensus = {
      mode: 'consensus',
      responses,
      agreement: this.analyzeAgreement(responses),
      selectedResponse: this.selectBestResponse(successfulResults),
      allResults: successfulResults,
      latency: parallelResult.latency
    };

    return consensus;
  }

  /**
   * Ejecuta modelos y fusiona outputs
   */
  async executeFusion(models, prompt, options = {}) {
    const parallelResult = await this.executeParallel(models, prompt, options);
    
    if (parallelResult.results.filter(r => r.success).length < 2) {
      return {
        mode: 'fusion',
        error: 'No hay suficientes respuestas exitosas para fusión',
        ...parallelResult
      };
    }

    const successfulResults = parallelResult.results.filter(r => r.success);
    const responses = successfulResults.map(r => r.response.content);

    // Fusión de respuestas
    const fused = this.fuseResponses(responses, prompt);

    return {
      mode: 'fusion',
      responses,
      fused,
      allResults: successfulResults,
      latency: parallelResult.latency
    };
  }

  /**
   * Analiza acuerdo entre respuestas
   */
  analyzeAgreement(responses) {
    if (responses.length < 2) return { score: 1.0, level: 'perfect' };

    // Análisis básico de similitud (placeholder)
    // En implementación real, usar embeddings o análisis semántico
    const similarity = 0.7; // Placeholder

    let level = 'low';
    if (similarity > 0.8) level = 'high';
    else if (similarity > 0.6) level = 'medium';

    return {
      score: similarity,
      level
    };
  }

  /**
   * Selecciona la mejor respuesta
   */
  selectBestResponse(results) {
    // Por ahora: seleccionar la primera exitosa
    // En implementación real: usar métricas de calidad
    return results[0]?.response || null;
  }

  /**
   * Fusiona múltiples respuestas
   */
  fuseResponses(responses, _originalPrompt) {
    // Fusión básica: combinar respuestas
    // En implementación real: usar modelo para fusionar inteligentemente
    const combined = responses
      .map((r, i) => `[Respuesta ${i + 1}]\n${r}`)
      .join('\n\n---\n\n');

    return `Respuesta fusionada basada en ${responses.length} modelos:\n\n${combined}`;
  }

  /**
   * Invoca modelo según modo de ejecución
   */
  async invoke(models, prompt, executionMode, options = {}) {
    switch (executionMode) {
      case 'parallel':
        return await this.executeParallel(models, prompt, options);
      
      case 'sequential':
        return await this.executeSequential(models, prompt, options);
      
      case 'consensus':
        return await this.executeConsensus(models, prompt, options);
      
      case 'fusion':
        return await this.executeFusion(models, prompt, options);
      
      default:
        return await this.executeParallel(models, prompt, options);
    }
  }
}

module.exports = ModelInvoker;

