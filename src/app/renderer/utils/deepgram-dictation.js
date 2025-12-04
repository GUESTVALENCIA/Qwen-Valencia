/**
 * ════════════════════════════════════════════════════════════════════════════
 * DEEPGRAM DICTATION - Gestión de Dictado con Deepgram
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Extrae la lógica de dictado con Deepgram para mejorar mantenibilidad
 */

/**
 * Inicia el dictado con Deepgram
 * @param {Object} options - Opciones de configuración
 * @param {Object} options.state - Estado de la aplicación
 * @param {Function} options.autoResize - Función para auto-resize del input
 * @param {Function} options.sendMessageForTTS - Función para enviar mensaje TTS
 * @param {Function} options.showToast - Función para mostrar toast
 * @param {Function} options.handleError - Función para manejar errores
 * @param {Function} options.logger - Logger para logging
 * @returns {Promise<void>}
 */
async function startDeepgramDictation(options) {
    const {
        state,
        autoResize,
        sendMessageForTTS,
        showToast,
        handleError,
        logger
    } = options;
    
    try {
        state.isRecording = true;
        state.recordingStartTime = Date.now();
        state.lastTTSAt = Date.now();
        
        // Obtener stream de audio
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true
            } 
        });
        state.mediaStream = stream;
        
        // Iniciar Deepgram Live
        const deepgramResult = await window.qwenValencia.deepgramStartLive();
        if (!deepgramResult || !deepgramResult.success) {
            throw new Error('No se pudo iniciar Deepgram Live. Verifica tu API key de Deepgram.');
        }
        
        // Configurar listeners de transcripción
        setupDeepgramListeners({
            state,
            autoResize,
            sendMessageForTTS,
            logger
        });
        
        // Configurar MediaRecorder
        const mediaRecorder = setupMediaRecorder({
            stream,
            state,
            logger
        });
        
        state.deepgramConnection = { 
            mediaRecorder, 
            stream 
        };
        
        showToast('Dictado iniciado con Deepgram', 'success');
        
        // Configurar timeout de grabación
        setupRecordingTimeout({
            state,
            showToast
        });
        
    } catch (error) {
        handleError(error, {
            source: 'startDeepgramDictation',
            type: 'api',
            severity: 'medium',
            metadata: { function: 'startDeepgramDictation', service: 'Deepgram' }
        });
        
        cleanupDictationState(state);
    }
}

/**
 * Configura los listeners de Deepgram
 * @param {Object} options - Opciones
 */
function setupDeepgramListeners(options) {
    const { state, autoResize, sendMessageForTTS, logger } = options;
    
    // Listener de transcripción
    window.qwenValencia.onDeepgramTranscript((data) => {
        if (!state.isRecording) return;
        
        const input = document.getElementById('chatInput');
        if (!input) return;
        
        // Transcripción intermedia
        if (data.transcript && !data.isFinal) {
            const currentText = input.value;
            const baseText = currentText.split('\n').slice(0, -1).join('\n');
            input.value = baseText + (baseText ? '\n' : '') + data.transcript;
            autoResize(input);
        }
        
        // Transcripción final
        if (data.isFinal && data.transcript) {
            const finalTranscript = data.transcript.trim();
            if (finalTranscript) {
                input.value = finalTranscript;
                autoResize(input);
                
                // Enviar para TTS si ha pasado suficiente tiempo
                const now = Date.now();
                if (now - state.lastTTSAt >= 30000 && finalTranscript.length > 10) {
                    sendMessageForTTS(finalTranscript);
                    state.lastTTSAt = now;
                }
            }
        }
    });
    
    // Listener de errores
    window.qwenValencia.onDeepgramError((error) => {
        logger.error('Deepgram error', { error: error.message || error, stack: error.stack });
        stopDeepgramDictation({ state, showToast: options.showToast });
        if (options.showToast) {
            options.showToast('Error en Deepgram: ' + (error.message || error), 'error');
        }
        cleanupDictationUI(state);
    });
}

/**
 * Configura el MediaRecorder para capturar audio
 * @param {Object} options - Opciones
 * @returns {MediaRecorder} MediaRecorder configurado
 */
function setupMediaRecorder(options) {
    const { stream, state, logger } = options;
    
    const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
    });
    
    // Handler de datos disponibles
    mediaRecorder.ondataavailable = async (e) => {
        if (!state.isRecording || !e.data || e.data.size === 0) return;
        
        try {
            const arrayBuffer = await e.data.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Convertir a base64
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) {
                binary += String.fromCharCode(uint8Array[i]);
            }
            const base64 = btoa(binary);
            
            // Enviar a Deepgram
            window.qwenValencia.deepgramSendAudio(base64);
        } catch (error) {
            logger.error('Error procesando audio para Deepgram', { 
                error: error.message, 
                stack: error.stack 
            });
        }
    };
    
    // Handler de errores
    mediaRecorder.onerror = (error) => {
        logger.error('Error en MediaRecorder', { 
            error: error.message, 
            stack: error.stack 
        });
    };
    
    // Iniciar grabación
    mediaRecorder.start(100);
    
    return mediaRecorder;
}

/**
 * Configura el timeout de grabación
 * @param {Object} options - Opciones
 */
function setupRecordingTimeout(options) {
    const { state, showToast } = options;
    
    const checkTime = setInterval(() => {
        if (!state.isRecording) {
            clearInterval(checkTime);
            return;
        }
        
        if (Date.now() - state.recordingStartTime >= state.recordingMaxTime) {
            stopDeepgramDictation({ state, showToast });
            clearInterval(checkTime);
            if (showToast) {
                showToast('Tiempo máximo de grabación alcanzado (20 minutos)', 'info');
            }
        }
    }, 1000);
    
    // Guardar interval ID para cleanup
    state.recordingTimeoutId = checkTime;
}

/**
 * Detiene el dictado con Deepgram
 * @param {Object} options - Opciones
 */
async function stopDeepgramDictation(options) {
    const { state, showToast } = options;
    
    state.isRecording = false;
    
    // Limpiar timeout
    if (state.recordingTimeoutId) {
        clearInterval(state.recordingTimeoutId);
        state.recordingTimeoutId = null;
    }
    
    try {
        await window.qwenValencia.deepgramStopLive();
    } catch (error) {
        if (options.logger) {
            options.logger.error('Error deteniendo Deepgram', { error: error.message });
        }
    }
    
    cleanupDictationState(state);
    cleanupDictationUI(state);
    
    if (showToast) {
        showToast('Dictado detenido', 'info');
    }
}

/**
 * Limpia el estado de dictado
 * @param {Object} state - Estado de la aplicación
 */
function cleanupDictationState(state) {
    state.isRecording = false;
    
    if (state.mediaStream) {
        state.mediaStream.getTracks().forEach(track => track.stop());
        state.mediaStream = null;
    }
    
    if (state.deepgramConnection) {
        if (state.deepgramConnection.mediaRecorder) {
            try {
                state.deepgramConnection.mediaRecorder.stop();
            } catch (e) {
                // Ignorar errores al detener
            }
        }
        state.deepgramConnection = null;
    }
}

/**
 * Limpia la UI de dictado
 * @param {Object} state - Estado de la aplicación
 */
function cleanupDictationUI(state) {
    state.voiceCallActive = false;
    
    const voiceCallBtn = document.getElementById('voiceCallBtn');
    const dictateBtn = document.getElementById('dictateBtn');
    
    if (voiceCallBtn) voiceCallBtn.classList.remove('active');
    if (dictateBtn) dictateBtn.classList.remove('active');
}

if (typeof window !== 'undefined') {
    window.startDeepgramDictation = startDeepgramDictation;
    window.stopDeepgramDictation = stopDeepgramDictation;
    window.cleanupDictationState = cleanupDictationState;
    window.cleanupDictationUI = cleanupDictationUI;
}

