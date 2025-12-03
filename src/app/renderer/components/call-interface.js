/**
 * CALL INTERFACE COMPONENT - Componente de Interfaz de Llamada Conversacional
 * 
 * Maneja la interfaz de llamada con:
 * - HeyGen Avatar streaming
 * - DeepGram STT
 * - Visualizador de audio
 * - Transcripción en tiempo real
 * - Barge-in
 */

// Estado de la llamada
let callState = {
  isActive: false,
  isListening: false,
  isSpeaking: false,
  isThinking: false,
  mode: 'avatar' // 'voice' | 'avatar'
};

// Referencias a elementos
let callInterface = null;
let avatarVideo = null;
let audioVisualizer = null;
let transcriptEl = null;
let statusIndicator = null;
let callStatusEl = null;

// Servicios
let conversationService = null;
let audioContext = null;
let analyser = null;
let animationFrame = null;
let mediaStream = null;

/**
 * Inicializar interfaz de llamada
 */
function initCallInterface() {
  callInterface = document.getElementById('callInterface');
  avatarVideo = document.getElementById('avatar-video');
  audioVisualizer = document.getElementById('audioVisualizer');
  transcriptEl = document.getElementById('transcript');
  statusIndicator = document.getElementById('callStatusIndicator');
  callStatusEl = document.getElementById('callStatus');

  console.log('✅ Call Interface inicializado');
}

/**
 * Mostrar/Ocultar interfaz de llamada
 */
function toggleCallInterface() {
  if (!callInterface) {
    initCallInterface();
  }

  if (callInterface.style.display === 'none' || !callInterface.style.display) {
    callInterface.style.display = 'flex';
    document.getElementById('callFloatingBtn').classList.add('active');
  } else {
    callInterface.style.display = 'none';
    document.getElementById('callFloatingBtn').classList.remove('active');
    if (callState.isActive) {
      endCall();
    }
  }
}

/**
 * Iniciar llamada
 */
async function startCall() {
  if (callState.isActive) return;

  try {
    updateCallStatus('connecting', 'Iniciando llamada...');

    // Inicializar audio analysis
    await setupAudioAnalysis();

    // Inicializar HeyGen Avatar
    if (callState.mode === 'avatar') {
      const result = await window.initAvatar('avatar-video');
      if (!result.success) {
        throw new Error('Error inicializando avatar: ' + result.error);
      }
    }

    // Inicializar Conversation Service vía IPC
    if (window.qwenValencia && window.qwenValencia.startConversation) {
      const result = await window.qwenValencia.startConversation(callState.mode);
      if (result.success) {
        console.log('✅ Conversation Service iniciado');
        
        // Configurar listeners
        window.qwenValencia.onConversationTranscript((data) => {
          updateTranscript(data.transcript);
        });
        
        window.qwenValencia.onConversationResponse((data) => {
          // Hacer hablar al avatar si está disponible
          if (callState.mode === 'avatar' && window.speakWithAvatar) {
            window.speakWithAvatar(data.text);
          }
          updateCallStatus('speaking', 'Hablando...');
        });
        
        window.qwenValencia.onConversationState((state) => {
          if (state.isListening) {
            updateCallStatus('listening', 'Escuchando...');
          } else if (state.isThinking) {
            updateCallStatus('thinking', 'Pensando...');
          } else if (state.isSpeaking) {
            updateCallStatus('speaking', 'Hablando...');
          }
        });
        
        window.qwenValencia.onConversationError((data) => {
          console.error('Error en conversación:', data.error);
          updateCallStatus('error', 'Error: ' + data.error);
        });
      } else {
        throw new Error(result.error || 'Error iniciando Conversation Service');
      }
    } else {
      console.warn('⚠️ Conversation Service no disponible. La llamada puede no funcionar completamente.');
    }

    callState.isActive = true;
    updateCallStatus('listening', 'Escuchando...');

    // Mostrar botón de terminar
    document.getElementById('callStartBtn').style.display = 'none';
    document.getElementById('callEndBtn').style.display = 'block';

    console.log('✅ Llamada iniciada');
  } catch (error) {
    console.error('❌ Error iniciando llamada:', error);
    updateCallStatus('error', 'Error iniciando la llamada');
  }
}

/**
 * Terminar llamada
 */
async function endCall() {
  if (!callState.isActive) return;

  try {
    callState.isActive = false;
    callState.isListening = false;
    callState.isSpeaking = false;
    callState.isThinking = false;

    // Detener avatar
    if (window.stopAvatar) {
      await window.stopAvatar();
    }

    // Detener audio
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }

    if (audioContext) {
      await audioContext.close();
      audioContext = null;
    }

    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    // Detener Conversation Service vía IPC
    if (window.qwenValencia && window.qwenValencia.stopConversation) {
      await window.qwenValencia.stopConversation();
    }

    updateCallStatus('idle', 'Llamada terminada');
    transcriptEl.textContent = 'Presiona el botón de llamada para comenzar...';

    // Ocultar botón de terminar
    document.getElementById('callStartBtn').style.display = 'block';
    document.getElementById('callEndBtn').style.display = 'none';

    console.log('✅ Llamada terminada');
  } catch (error) {
    console.error('❌ Error terminando llamada:', error);
  }
}

/**
 * Configurar análisis de audio para visualizador
 */
async function setupAudioAnalysis() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(mediaStream);
    source.connect(analyser);
    analyser.fftSize = 256;
    
    // Crear script processor para enviar audio al backend
    const bufferSize = 4096;
    const scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
    scriptProcessor.onaudioprocess = (event) => {
      if (callState.isActive && callState.isListening) {
        const inputData = event.inputBuffer.getChannelData(0);
        const audioBuffer = new Int16Array(inputData.length);
        
        // Convertir a Int16Array
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          audioBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Enviar al backend si está disponible
        if (window.qwenValencia && window.qwenValencia.sendAudioToConversation) {
          window.qwenValencia.sendAudioToConversation(Array.from(audioBuffer));
        }
      }
    };
    
    source.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);
    
    updateAudioVisualizer();
    console.log('✅ Análisis de audio configurado');
  } catch (error) {
    console.error('❌ Error configurando análisis de audio:', error);
    updateCallStatus('error', 'Error accediendo al micrófono');
  }
}

/**
 * Actualizar visualizador de audio
 */
function updateAudioVisualizer() {
  if (!analyser || !callState.isActive || !audioVisualizer) return;

  const ctx = audioVisualizer.getContext('2d');
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteFrequencyData(dataArray);

  ctx.clearRect(0, 0, audioVisualizer.width, audioVisualizer.height);
  ctx.fillStyle = '#667eea';
  const barWidth = audioVisualizer.width / bufferLength * 2.5;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * audioVisualizer.height;
    ctx.fillRect(x, audioVisualizer.height - barHeight, barWidth, barHeight);
    x += barWidth + 1;
  }

  animationFrame = requestAnimationFrame(updateAudioVisualizer);
}

/**
 * Actualizar estado de la llamada
 */
function updateCallStatus(state, message) {
  if (statusIndicator) {
    statusIndicator.className = `status-indicator status-${state}`;
  }
  if (callStatusEl) {
    callStatusEl.textContent = message;
  }

  // Actualizar estado interno
  callState.isListening = state === 'listening';
  callState.isSpeaking = state === 'speaking';
  callState.isThinking = state === 'thinking';
}

/**
 * Actualizar transcripción
 */
function updateTranscript(text) {
  if (transcriptEl) {
    transcriptEl.textContent = text;
  }
}

/**
 * Toggle micrófono en llamada
 */
function toggleCallMic() {
  const micBtn = document.getElementById('callMicBtn');
  
  if (callState.isListening) {
    // Silenciar
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => {
        track.enabled = false;
      });
    }
    micBtn.classList.remove('active');
    updateCallStatus('muted', 'Micrófono silenciado');
  } else {
    // Activar
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => {
        track.enabled = true;
      });
    }
    micBtn.classList.add('active');
    updateCallStatus('listening', 'Escuchando...');
  }
}

// Exportar funciones globales
window.toggleCallInterface = toggleCallInterface;
window.startCall = startCall;
window.endCall = endCall;
window.toggleCallMic = toggleCallMic;
window.updateCallStatus = updateCallStatus;
window.updateTranscript = updateTranscript;

// Inicializar al cargar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCallInterface);
} else {
  initCallInterface();
}

