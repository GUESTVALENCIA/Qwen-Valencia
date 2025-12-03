/**
 * DEEPGRAM STT SERVICE - Speech-to-Text con DeepGram
 * 
 * Transcripción de voz en tiempo real con streaming
 * Soporte para barge-in con transcripciones intermedias
 */

const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const path = require('path');
const variablesLoader = require('../utils/variables-loader');
const { LoggerFactory } = require('../utils/logger');

// Cargar variables al inicializar
variablesLoader.load();

class DeepgramService {
  constructor() {
    this.logger = LoggerFactory.create({ service: 'deepgram-service' });
    this.apiKey = variablesLoader.get('DEEPGRAM_API_KEY') || process.env.DEEPGRAM_API_KEY;
    this.client = null;
    this.liveConnection = null;
    this.isConnected = false;
    this.statusCallback = null;
    this.enabled = false; // Flag para habilitar/deshabilitar
    
    if (this.apiKey && this.apiKey.trim().length > 0) {
      try {
        // Limpiar API key
        const cleanedKey = this.apiKey.trim().replace(/['"]/g, '').replace(/\s+/g, '');
        this.client = createClient(cleanedKey);
        this.enabled = true;
        this.logger.info('Deepgram STT Service inicializado');
      } catch (error) {
        this.logger.warn('Error inicializando Deepgram client (deshabilitado)', { error: error.message });
        this.enabled = false;
      }
    } else {
      this.logger.warn('Deepgram API Key no encontrada - Servicio deshabilitado');
      this.enabled = false;
    }
  }

  /**
   * Transcribir audio desde archivo
   */
  async transcribeFile(audioFilePath) {
    try {
      if (!this.client) {
        throw new Error('Deepgram client no inicializado');
      }

      const fs = require('fs');
      const audioBuffer = fs.readFileSync(audioFilePath);

      const { result, error } = await this.client.listen.prerecorded.transcribeFile(audioBuffer, {
        model: 'nova-2',
        language: 'es',
        smart_format: true,
        punctuate: true
      });

      if (error) {
        throw error;
      }

      return {
        success: true,
        transcript: result.results.channels[0].alternatives[0].transcript,
        confidence: result.results.channels[0].alternatives[0].confidence
      };
    } catch (error) {
      this.logger.error('Error transcribiendo archivo', { error: error.message, stack: error.stack });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Transcribir audio desde buffer
   */
  async transcribeBuffer(audioBuffer, mimeType = 'audio/wav') {
    try {
      if (!this.enabled || !this.client) {
        return {
          success: false,
          error: 'Deepgram no está habilitado o no está inicializado. Verifica DEEPGRAM_API_KEY en qwen-valencia.env'
        };
      }

      const { result, error } = await this.client.listen.prerecorded.transcribeFile(audioBuffer, {
        model: 'nova-2',
        language: 'es',
        smart_format: true,
        punctuate: true,
        mimetype: mimeType
      });

      if (error) {
        throw error;
      }

      const transcript = result.results.channels[0].alternatives[0].transcript;

      return {
        success: true,
        transcript,
        confidence: result.results.channels[0].alternatives[0].confidence
      };
    } catch (error) {
      this.logger.error('Error transcribiendo buffer', { error: error.message, stack: error.stack });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Iniciar transcripción en tiempo real (streaming)
   */
  async startLiveTranscription(onTranscript, onError) {
    try {
      if (!this.enabled || !this.client) {
        const error = new Error('Deepgram no está habilitado o no está inicializado. Verifica DEEPGRAM_API_KEY en qwen-valencia.env');
        if (onError) onError(error);
        return {
          success: false,
          error: error.message
        };
      }

      this.liveConnection = this.client.listen.live({
        model: 'nova-2',
        language: 'es',
        smart_format: true,
        punctuate: true,
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1,
        interim_results: true,
        endpointing: 1200  // Margen de silencio antes de cerrar enunciado (barge-in más tolerante)
      });

      // Evento: Conexión abierta
      this.liveConnection.on(LiveTranscriptionEvents.Open, () => {
        this.logger.info('Conexión Deepgram Live abierta');
        this.isConnected = true;
        if (typeof this.statusCallback === 'function') {
          try { 
            this.statusCallback({ connected: true }); 
          } catch (e) {
            this.logger.error('Error en statusCallback', { error: e.message });
          }
        }
      });

      // Evento: Transcripción recibida
      this.liveConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel.alternatives[0].transcript;
        const isFinal = data.is_final;
        
        if (transcript && transcript.length > 0) {
          onTranscript({
            transcript,
            isFinal,
            confidence: data.channel.alternatives[0].confidence
          });
        }
      });

      // Evento: Metadata
      this.liveConnection.on(LiveTranscriptionEvents.Metadata, (data) => {
        this.logger.debug('Deepgram metadata', { metadata: data });
      });

      // Evento: Error
      this.liveConnection.on(LiveTranscriptionEvents.Error, (error) => {
        this.logger.error('Error en Deepgram Live', { error: error.message || error });
        if (onError) onError(error);
        if (typeof this.statusCallback === 'function') {
          try { 
            this.statusCallback({ connected: false, error: error?.message || String(error) }); 
          } catch (e) {
            this.logger.error('Error en statusCallback', { error: e.message });
          }
        }
      });

      // Evento: Conexión cerrada
      this.liveConnection.on(LiveTranscriptionEvents.Close, () => {
        this.logger.info('Conexión Deepgram Live cerrada');
        this.isConnected = false;
        if (typeof this.statusCallback === 'function') {
          try { 
            this.statusCallback({ connected: false }); 
          } catch (e) {
            this.logger.error('Error en statusCallback', { error: e.message });
          }
        }
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Error iniciando transcripción en vivo', { error: error.message, stack: error.stack });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enviar audio al stream en vivo
   */
  sendAudio(audioBuffer) {
    if (this.liveConnection && this.isConnected) {
      this.liveConnection.send(audioBuffer);
    }
  }

  /**
   * Detener transcripción en vivo
   */
  stopLiveTranscription() {
    if (this.liveConnection) {
      this.liveConnection.finish();
      this.liveConnection = null;
      this.isConnected = false;
    }
  }

  /**
   * Establecer callback de estado
   */
  setStatusCallback(callback) {
    this.statusCallback = callback;
  }
}

module.exports = DeepgramService;

