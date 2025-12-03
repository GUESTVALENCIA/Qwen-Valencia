/**
 * DEEPGRAM STT SERVICE - Speech-to-Text con DeepGram
 * 
 * Transcripción de voz en tiempo real con streaming
 * Soporte para barge-in con transcripciones intermedias
 */

const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const path = require('path');
const variablesLoader = require('../utils/variables-loader');

// Cargar variables al inicializar
variablesLoader.load();

class DeepgramService {
  constructor() {
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
        console.log('✅ Deepgram STT Service inicializado');
      } catch (error) {
        console.warn('⚠️ Error inicializando Deepgram client (deshabilitado):', error.message);
        this.enabled = false;
      }
    } else {
      console.warn('⚠️ Deepgram API Key no encontrada - Servicio deshabilitado');
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
      console.error('Error transcribiendo archivo:', error);
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
      console.error('Error transcribiendo buffer:', error);
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
        console.log('✅ Conexión Deepgram Live abierta');
        this.isConnected = true;
        if (typeof this.statusCallback === 'function') {
          try { 
            this.statusCallback({ connected: true }); 
          } catch (e) {
            console.error('Error en statusCallback:', e);
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
        console.log('Deepgram metadata:', data);
      });

      // Evento: Error
      this.liveConnection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('Error en Deepgram Live:', error);
        if (onError) onError(error);
        if (typeof this.statusCallback === 'function') {
          try { 
            this.statusCallback({ connected: false, error: error?.message || String(error) }); 
          } catch (e) {
            console.error('Error en statusCallback:', e);
          }
        }
      });

      // Evento: Conexión cerrada
      this.liveConnection.on(LiveTranscriptionEvents.Close, () => {
        console.log('🔌 Conexión Deepgram Live cerrada');
        this.isConnected = false;
        if (typeof this.statusCallback === 'function') {
          try { 
            this.statusCallback({ connected: false }); 
          } catch (e) {
            console.error('Error en statusCallback:', e);
          }
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error iniciando transcripción en vivo:', error);
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

