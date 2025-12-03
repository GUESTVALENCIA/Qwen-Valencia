/**
 * CONVERSATION SERVICE - Servicio Principal de Conversación
 * 
 * Sistema conversacional completo con:
 * - DeepGram STT (reconocimiento continuo)
 * - Qwen/DeepSeek (solo estos modelos)
 * - Cartesia TTS
 * - HeyGen Avatar (llamado desde frontend)
 * - Barge-in en tiempo real
 */

const DeepgramService = require('./deepgram-service');
const CartesiaService = require('./cartesia-service');
const { LoggerFactory } = require('../utils/logger');

class ConversationService {
  constructor(modelRouter) {
    if (!modelRouter) {
      throw new Error('ConversationService requiere modelRouter');
    }

    this.logger = LoggerFactory.create({ service: 'conversation-service' });
    this.deepgram = new DeepgramService();
    this.cartesia = new CartesiaService();
    this.modelRouter = modelRouter;

    // Estado de sesión
    this.sessionId = null;
    this.currentMode = 'text'; // 'text' | 'voice' | 'avatar'
    
    // Estado de conversación
    this.sessionActive = false;
    this.isListening = false;
    this.isThinking = false;
    this.isSpeaking = false;
    
    // Barge-in
    this.bargeInEnabled = true;
    this.lastBargeInAt = null;
    this.bargeInInProgress = false;
    
    // Transcripts
    this.currentTranscript = '';
    this.interimTranscript = '';
    
    // Callbacks para frontend
    this.onTranscriptUpdate = null;
    this.onResponseReady = null;
    this.onSessionState = null;
    this.onError = null;
    this.onAudioChunk = null; // Para visualizador de audio

    this.logger.info('Conversation Service inicializado');
  }

  /**
   * Iniciar conversación
   */
  async startConversation(options = {}) {
    const {
      mode = 'text',
      userId = null,
      callbacks = {}
    } = options;

    try {
      this.currentMode = mode;
      this.userId = userId;
      this.sessionId = this.sessionId || `session_${Date.now()}`;

      // Bind callbacks
      if (callbacks.onTranscriptUpdate) this.onTranscriptUpdate = callbacks.onTranscriptUpdate;
      if (callbacks.onResponseReady) this.onResponseReady = callbacks.onResponseReady;
      if (callbacks.onSessionState) this.onSessionState = callbacks.onSessionState;
      if (callbacks.onError) this.onError = callbacks.onError;
      if (callbacks.onAudioChunk) this.onAudioChunk = callbacks.onAudioChunk;

      this.sessionActive = true;
      this.isListening = mode !== 'text';
      this.isThinking = false;
      this.isSpeaking = false;

      this._emitSessionState();

      // Iniciar DeepGram Live para voz/avatar
      if (mode === 'voice' || mode === 'avatar') {
        await this._startDeepgramLive();
      }

      return {
        success: true,
        message: 'Conversación iniciada',
        mode: this.currentMode,
        sessionId: this.sessionId
      };
    } catch (error) {
      this.logger.error('Error iniciando conversación', { error: error.message, stack: error.stack });
      this._emitError(error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Iniciar DeepGram Live
   */
  async _startDeepgramLive() {
    try {
      const result = await this.deepgram.startLiveTranscription(
        (data) => this.handleTranscript(data),
        (error) => this.handleError(error)
      );

      if (result.success) {
        this.isListening = true;
        this._emitSessionState();
      }
    } catch (error) {
      this.logger.error('Error iniciando DeepGram Live', { error: error.message, stack: error.stack });
      this._emitError(error);
    }
  }

  /**
   * Manejar transcripción de DeepGram
   */
  async handleTranscript(data) {
    const { transcript, isFinal, confidence } = data || {};
    const normalized = (transcript || '').trim();
    if (!normalized) return;

    // Barge-in: detectar interrupciones
    if (!isFinal && this.isSpeaking && this.bargeInEnabled) {
      await this._handleBargeIn(normalized);
    }

    if (isFinal) {
      this.currentTranscript = normalized;
      this.interimTranscript = '';
      
      if (this.onTranscriptUpdate) {
        this.onTranscriptUpdate({
          transcript: normalized,
          isFinal: true,
          confidence
        });
      }

      // Procesar transcripción final
      if (this.sessionActive && normalized) {
        await this._processFinalTranscript(normalized);
      }
    } else {
      // Transcripción intermedia
      this.interimTranscript = normalized;
      if (this.onTranscriptUpdate) {
        this.onTranscriptUpdate({
          transcript: normalized,
          isFinal: false,
          confidence
        });
      }
    }
  }

  /**
   * Procesar transcripción final y generar respuesta
   */
  async _processFinalTranscript(transcript) {
    this.isThinking = true;
    this._emitSessionState();

    try {
      // Llamar a Qwen/DeepSeek vía model-router
      const result = await this.modelRouter.route(
        transcript,
        this.currentMode,
        [],
        {
          useAPI: true, // Usar Groq API por defecto
          model: null // Auto-selección
        }
      );

      if (result.success && result.response) {
        await this._speakResponse(result.response);
      } else {
        throw new Error(result.error || 'Error generando respuesta');
      }
    } catch (error) {
      this.logger.error('Error procesando transcripción', { error: error.message, stack: error.stack });
      this._emitError(error);
      await this._speakResponse('Disculpa, he tenido un problema técnico. ¿Puedes repetir?');
    } finally {
      this.isThinking = false;
      this._emitSessionState();
    }
  }

  /**
   * Hablar respuesta (TTS + Avatar)
   */
  async _speakResponse(text) {
    if (!text || this.isSpeaking) return;

    this.isSpeaking = true;
    this._emitSessionState();

    try {
      // Si hay avatar, usar HeyGen (llamado desde frontend)
      if (this.currentMode === 'avatar' && typeof window !== 'undefined' && window.speakWithAvatar) {
        // El frontend manejará el avatar
        // También podemos usar Cartesia como fallback
        await this.cartesia.streamSpeech(text, (chunk) => {
          if (this.onAudioChunk) {
            this.onAudioChunk(chunk);
          }
        });
      } else {
        // Solo Cartesia TTS
        await this.cartesia.streamSpeech(text, (chunk) => {
          if (this.onAudioChunk) {
            this.onAudioChunk(chunk);
          }
        });
      }

      // Emitir respuesta al frontend
      if (this.onResponseReady) {
        this.onResponseReady({
          text,
          audio: null // El audio se maneja por streaming
        });
      }
    } catch (error) {
      this.logger.error('Error hablando respuesta', { error: error.message, stack: error.stack });
      this._emitError(error);
    } finally {
      this.isSpeaking = false;
      this._emitSessionState();
    }
  }

  /**
   * Manejar barge-in
   */
  async _handleBargeIn(transcript) {
    if (this.bargeInInProgress) return;

    // Detectar si hay suficiente contenido para considerar barge-in
    if (transcript.length > 3) {
      this.bargeInInProgress = true;
      this.lastBargeInAt = Date.now();

      this.logger.info('Barge-in detectado', { transcript });

      // Detener TTS
      this.cartesia.stopSpeech();

      // Detener avatar si está hablando
      if (this.currentMode === 'avatar' && typeof window !== 'undefined' && window.stopAvatar) {
        // El frontend manejará la detención del avatar
      }

      this.isSpeaking = false;
      this._emitSessionState();

      // Resetear flag después de un tiempo
      setTimeout(() => {
        this.bargeInInProgress = false;
      }, 1000);
    }
  }

  /**
   * Manejar errores
   */
  handleError(error) {
    this.logger.error('Error en Conversation Service', { error: error.message, stack: error.stack });
    this._emitError(error);
  }

  /**
   * Enviar audio al stream de DeepGram
   * @param {Array|Buffer|Int16Array} audioData - Datos de audio del frontend
   */
  sendAudio(audioData) {
    if (this.deepgram && this.isListening && this.deepgram.isConnected) {
      // Convertir array a buffer si es necesario
      let buffer;
      if (Array.isArray(audioData)) {
        buffer = Buffer.from(audioData);
      } else if (audioData instanceof Int16Array) {
        buffer = Buffer.from(audioData.buffer);
      } else {
        buffer = audioData;
      }
      
      this.deepgram.sendAudio(buffer);
    }
  }

  /**
   * Detener conversación
   */
  async stopConversation() {
    this.sessionActive = false;
    this.isListening = false;
    this.isSpeaking = false;
    this.isThinking = false;

    // Detener DeepGram
    if (this.deepgram) {
      this.deepgram.stopLiveTranscription();
    }

    // Detener avatar
    if (this.currentMode === 'avatar' && typeof window !== 'undefined' && window.stopAvatar) {
      await window.stopAvatar();
    }

    this._emitSessionState();
  }

  /**
   * Emitir estado de sesión
   */
  _emitSessionState() {
    if (this.onSessionState) {
      this.onSessionState({
        sessionId: this.sessionId,
        mode: this.currentMode,
        isActive: this.sessionActive,
        isListening: this.isListening,
        isThinking: this.isThinking,
        isSpeaking: this.isSpeaking
      });
    }
  }

  /**
   * Emitir error
   */
  _emitError(error) {
    if (this.onError) {
      this.onError(error);
    }
  }
}

module.exports = ConversationService;

