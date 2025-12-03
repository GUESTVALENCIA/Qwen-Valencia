/**
 * CARTESIA TTS SERVICE - Text-to-Speech con Cartesia
 */

const axios = require('axios');
const path = require('path');
const variablesLoader = require('../utils/variables-loader');
const { LoggerFactory } = require('../utils/logger');

// Cargar variables al inicializar
variablesLoader.load();

class CartesiaService {
  constructor() {
    this.logger = LoggerFactory.create({ service: 'cartesia-service' });
    this.apiKey = variablesLoader.get('CARTESIA_API_KEY') || process.env.CARTESIA_API_KEY;
    this.baseUrl = process.env.CARTESIA_BASE_URL || 'https://api.cartesia.ai';
    this.apiVersion = process.env.CARTESIA_API_VERSION || '2024-11-13';
    this.voiceId = variablesLoader.get('CARTESIA_VOICE_ID') || process.env.CARTESIA_VOICE_ID || 'a0e99841-438c-4a64-b679-ae501e7d6091';
    
    if (this.apiKey) {
      this.logger.info('Cartesia TTS Service inicializado', { voiceId: this.voiceId });
    } else {
      this.logger.warn('Cartesia API Key no encontrada');
    }
  }

  /**
   * Generar audio desde texto
   */
  async generateSpeech(text, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Cartesia API Key no configurada');
      }

      const voiceId = options.voiceId || this.voiceId;

      const payload = {
        model_id: 'sonic-multilingual',
        transcript: text,
        voice: {
          mode: 'id',
          id: voiceId
        },
        output_format: {
          container: 'wav',
          encoding: 'pcm_s16le',
          sample_rate: 22050
        },
        language: 'es',
        speed: typeof options.speed === 'number' ? options.speed : 0.78,
        emotion: Array.isArray(options.emotion) ? options.emotion : [{ id: 'warm', strength: 0.6 }]
      };

      const { data } = await axios.post(
        `${this.baseUrl}/tts/bytes`,
        payload,
        {
          headers: {
            'X-API-Key': this.apiKey,
            'Cartesia-Version': this.apiVersion,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer',
          timeout: 30000
        }
      );

      const audioBuffer = Buffer.from(data);

      return {
        success: true,
        audioBuffer,
        format: 'wav',
        sampleRate: 22050
      };
    } catch (error) {
      this.logger.error('Error en Cartesia TTS', { error: error.message, stack: error.stack });
      return {
        success: false,
        error: error.message || 'Error desconocido'
      };
    }
  }

  /**
   * Streaming de audio en tiempo real
   */
  async streamSpeech(text, onAudioChunk, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('Cartesia API Key no configurada');
      }

      const voiceId = options.voiceId || this.voiceId;

      const response = await axios.post(
        `${this.baseUrl}/tts/sse`,
        {
          model_id: 'sonic-multilingual',
          transcript: text,
          voice: {
            mode: 'id',
            id: voiceId
          },
          output_format: {
            container: 'wav',
            encoding: 'pcm_s16le',
            sample_rate: 22050
          },
          language: 'es',
          speed: typeof options.speed === 'number' ? options.speed : 0.78,
          emotion: Array.isArray(options.emotion) ? options.emotion : [{ id: 'warm', strength: 0.6 }]
        },
        {
          headers: {
            'X-API-Key': this.apiKey,
            'Cartesia-Version': this.apiVersion,
            'Content-Type': 'application/json'
          },
          responseType: 'stream'
        }
      );

      response.data.on('data', (chunk) => {
        if (onAudioChunk) {
          onAudioChunk(chunk);
        }
      });

      response.data.on('end', () => {
        this.logger.debug('Stream de audio completado');
      });

      return {
        success: true,
        message: 'Streaming iniciado'
      };
    } catch (error) {
      this.logger.error('Error en streaming de audio', { error: error.message, stack: error.stack });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Detener síntesis de voz (para barge-in)
   */
  stopSpeech() {
    // Cartesia no tiene un método directo para detener, pero podemos cancelar el stream
    // Esto se manejará en el conversation-service
    this.logger.info('Deteniendo síntesis de voz (barge-in)');
  }
}

module.exports = CartesiaService;

