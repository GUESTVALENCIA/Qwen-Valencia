/**
 * ════════════════════════════════════════════════════════════════════════════
 * QWEN-VALENCIA - FRONTEND
 * ════════════════════════════════════════════════════════════════════════════
 */

const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const status = document.getElementById('status');

let isProcessing = false;
let useAPI = true; // Por defecto usar API (Groq) - más rápido
let micActive = false;
let selectedModel = null; // Modelo seleccionado
let availableModels = {
  ollama: [],
  groq: []
};

/**
 * Agrega un mensaje al chat
 */
function addMessage(text, isUser = false, model = null) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isUser ? 'user' : 'assistant'}`;
  
  if (model && !isUser) {
    const modelDiv = document.createElement('div');
    modelDiv.className = 'model';
    modelDiv.textContent = model;
    messageDiv.appendChild(modelDiv);
  }
  
  const textDiv = document.createElement('div');
  
  // Detectar bloques de código
  const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let processedText = text;
  let match;
  const codeBlocks = [];
  
  while ((match = codeRegex.exec(text)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2],
      index: match.index
    });
  }
  
  if (codeBlocks.length > 0) {
    // Procesar texto con bloques de código
    let lastIndex = 0;
    codeBlocks.forEach(block => {
      // Agregar texto antes del bloque
      if (block.index > lastIndex) {
        const textBefore = document.createTextNode(text.substring(lastIndex, block.index));
        textDiv.appendChild(textBefore);
      }
      
      // Agregar bloque de código
      const codeBlock = document.createElement('pre');
      codeBlock.className = 'code-block';
      codeBlock.textContent = block.code;
      textDiv.appendChild(codeBlock);
      
      lastIndex = block.index + match[0].length;
    });
    
    // Agregar texto después del último bloque
    if (lastIndex < text.length) {
      const textAfter = document.createTextNode(text.substring(lastIndex));
      textDiv.appendChild(textAfter);
    }
  } else {
    textDiv.textContent = text;
  }
  
  messageDiv.appendChild(textDiv);
  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Envía un mensaje
 */
async function sendMessage() {
  const text = messageInput.value.trim();
  
  if (!text || isProcessing) return;
  
  // Agregar mensaje del usuario
  addMessage(text, true);
  messageInput.value = '';
  
  // Deshabilitar input
  isProcessing = true;
  sendButton.disabled = true;
  status.innerHTML = '<span class="loading"></span> Procesando...';
  
  try {
    // Determinar modelo a usar
    let modelToUse = null;
    let providerToUse = useAPI ? 'groq' : 'ollama';
    
    if (selectedModel && selectedModel.trim() !== '') {
      const [provider, ...modelParts] = selectedModel.split(':');
      if (modelParts.length > 0) {
        providerToUse = provider;
        modelToUse = modelParts.join(':'); // Reunir en caso de que el nombre tenga ':'
        console.log(`🎯 Usando modelo seleccionado: ${providerToUse}:${modelToUse}`);
      }
    } else {
      console.log(`🎯 Usando modelo por defecto: ${providerToUse}`);
    }
    
    // Crear elemento de mensaje para streaming (si es local)
    let assistantMessageDiv = null;
    let assistantTextDiv = null;
    
    if (!useAPI || providerToUse === 'ollama') {
      // Preparar UI para streaming
      assistantMessageDiv = document.createElement('div');
      assistantMessageDiv.className = 'message assistant';
      const modelDiv = document.createElement('div');
      modelDiv.className = 'model';
      modelDiv.textContent = modelToUse || 'Qwen-Valencia';
      assistantMessageDiv.appendChild(modelDiv);
      assistantTextDiv = document.createElement('div');
      assistantMessageDiv.appendChild(assistantTextDiv);
      chatContainer.appendChild(assistantMessageDiv);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    // Enviar mensaje al modelo con preferencia de API y modelo seleccionado
    const result = await window.qwenValencia.routeMessage(text, 'text', [], { 
      useAPI: providerToUse === 'groq',
      model: modelToUse,
      provider: providerToUse
    });
    
    if (result.success) {
      if (assistantMessageDiv && assistantTextDiv) {
        // Actualizar mensaje de streaming
        assistantTextDiv.textContent = result.response;
      } else {
        // Agregar mensaje normal
        addMessage(result.response, false, result.model);
      }
      status.textContent = `✅ Respuesta de ${result.model} ${useAPI ? '(API)' : '(Local)'}`;
    } else {
      if (assistantMessageDiv) {
        assistantMessageDiv.remove();
      }
      addMessage(`❌ Error: ${result.error}`, false);
      status.textContent = '❌ Error';
    }
  } catch (error) {
    console.error('Error:', error);
    addMessage(`❌ Error: ${error.message}`, false);
    status.textContent = '❌ Error';
  } finally {
    // Habilitar input
    isProcessing = false;
    sendButton.disabled = false;
    messageInput.focus();
  }
}

// Event listeners
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Focus en el input al cargar
messageInput.focus();

/**
 * Toggle API/Ollama
 */
function toggleAPI() {
  const toggle = document.getElementById('apiToggle');
  const text = document.getElementById('apiToggleText');
  
  useAPI = toggle.checked;
  
  if (useAPI) {
    text.textContent = 'API';
    text.style.color = '#4CAF50';
    console.log('✅ Modo API activado (Groq - rápido)');
  } else {
    text.textContent = 'Local';
    text.style.color = '#FF9800';
    console.log('🔄 Modo Local activado (Ollama)');
  }
  
  // Guardar preferencia
  localStorage.setItem('useAPI', useAPI);
}

/**
 * Sistema de Dictado de Voz (Estilo ChatGPT)
 * Grabar → Guardar → Transcribir → Insertar en chat
 */
let mediaRecorder = null;
let audioStream = null;
let audioChunks = [];
let recordingTimer = null;
let recordingStartTime = null;
const MAX_RECORDING_TIME = 30000; // 30 segundos

async function toggleMic() {
  const micBtn = document.getElementById('micButton');
  
  if (!micActive) {
    // Iniciar grabación
    try {
      // Solicitar acceso al micrófono
      audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      // Configurar MediaRecorder
      const options = {
        mimeType: 'audio/webm;codecs=opus'
      };
      
      // Verificar si el formato está soportado
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'audio/webm';
      }
      
      mediaRecorder = new MediaRecorder(audioStream, options);
      audioChunks = [];
      
      // Evento: datos disponibles
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      // Evento: grabación detenida
      mediaRecorder.onstop = async () => {
        try {
          // Detener stream de audio
          if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
          }
          
          // Limpiar timer
          if (recordingTimer) {
            clearInterval(recordingTimer);
            recordingTimer = null;
          }
          
          // Mostrar estado de procesamiento
          status.innerHTML = '<span class="loading"></span> Transcribiendo... Habla ahora...';
          
          // Transcribir usando Web Speech API directamente (no podemos procesar blob)
          const transcript = await transcribeWithWebSpeechLive();
          
          if (transcript && transcript.trim().length > 0) {
            // Insertar transcripción en el input
            messageInput.value = transcript.trim();
            messageInput.focus();
            
            // Mover cursor al final
            messageInput.setSelectionRange(messageInput.value.length, messageInput.value.length);
            
            status.textContent = '✅ Transcripción completada';
            console.log('✅ Transcripción:', transcript);
          } else {
            status.textContent = '⚠️ No se detectó habla';
            console.warn('⚠️ Transcripción vacía');
          }
        } catch (error) {
          console.error('Error transcribiendo audio:', error);
          status.textContent = '❌ Error en transcripción';
          
          // Solo mostrar alerta si no es timeout o cancelación
          if (!error.message.includes('Timeout') && !error.message.includes('aborted') && !error.message.includes('No se detectó')) {
            alert(`Error al transcribir: ${error.message}`);
          }
        } finally {
          // Limpiar
          audioChunks = [];
          micActive = false;
          
          const micBtn = document.getElementById('micButton');
          micBtn.classList.remove('active');
          micBtn.title = 'Dictar mensaje';
        }
      };
      
      // Iniciar grabación
      mediaRecorder.start();
      micActive = true;
      recordingStartTime = Date.now();
      
      // Actualizar UI
      micBtn.classList.add('active');
      micBtn.title = 'Detener grabación y transcribir';
      status.innerHTML = '<span class="loading"></span> Grabando... (0s)';
      
      // Timer para mostrar tiempo de grabación
      recordingTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const remaining = MAX_RECORDING_TIME / 1000 - elapsed;
        
        if (remaining > 0) {
          status.innerHTML = `<span class="loading"></span> Grabando... (${elapsed}s / ${MAX_RECORDING_TIME / 1000}s)`;
        } else {
          // Límite alcanzado, detener automáticamente
          stopRecording();
        }
      }, 1000);
      
      console.log('🎤 Grabación iniciada - Habla ahora (máx 30s)');
      
    } catch (error) {
      console.error('Error iniciando grabación:', error);
      alert('No se pudo acceder al micrófono. Verifica los permisos.');
      micActive = false;
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
      }
    }
  } else {
    // Detener grabación
    stopRecording();
  }
}

/**
 * Detener grabación
 */
function stopRecording() {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  
  micActive = false;
  
  const micBtn = document.getElementById('micButton');
  micBtn.classList.remove('active');
  micBtn.title = 'Dictar mensaje';
  
  recordingStartTime = null;
  
  console.log('🔇 Grabación detenida');
}


// Restaurar preferencia de API
const savedUseAPI = localStorage.getItem('useAPI');
if (savedUseAPI !== null) {
  useAPI = savedUseAPI === 'true';
  const toggle = document.getElementById('apiToggle');
  if (toggle) {
    toggle.checked = useAPI;
    toggleAPI();
  }
}

/**
 * Cambiar modelo seleccionado
 */
function changeModel() {
  const select = document.getElementById('modelSelect');
  selectedModel = select.value;
  localStorage.setItem('selectedModel', selectedModel);
  
  const status = document.getElementById('modelStatus');
  if (selectedModel) {
    status.textContent = '✓ Seleccionado';
    status.className = 'model-status available';
    console.log(`✅ Modelo seleccionado: ${selectedModel}`);
  } else {
    status.textContent = 'No seleccionado';
    status.className = 'model-status';
  }
}

/**
 * Modelos por defecto (fallback si servidores no disponibles)
 */
const DEFAULT_GROQ_MODELS = [
  'qwen2.5-72b-instruct',
  'qwen2.5-32b-instruct',
  'qwen2.5-14b-instruct',
  'qwen2.5-7b-instruct',
  'deepseek-r1-distill-llama-8b',
  'deepseek-r1-distill-qwen-7b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama-3.1-70b-versatile',
  'mixtral-8x7b-32768',
  'gemma2-9b-it'
];

const DEFAULT_OLLAMA_MODELS = [
  'qwen2.5:7b-instruct-q4_K_M',
  'qwen2.5-vl:7b',
  'deepseek-coder:6.7b',
  'llama3.2:3b',
  'mistral:7b'
];

/**
 * Cargar modelos disponibles
 */
async function loadAvailableModels() {
  const modelSelect = document.getElementById('modelSelect');
  const modelStatus = document.getElementById('modelStatus');
  
  let ollamaLoaded = false;
  let groqLoaded = false;
  
  try {
    // Cargar modelos de Ollama
    try {
      const ollamaResponse = await fetch('http://localhost:6002/ollama/models', { 
        timeout: 3000 
      });
      const ollamaData = await ollamaResponse.json();
      if (ollamaData.success && ollamaData.models && ollamaData.models.length > 0) {
        availableModels.ollama = ollamaData.models.map(m => ({
          name: m.name,
          provider: 'ollama',
          label: `Ollama: ${m.name}`
        }));
        ollamaLoaded = true;
        console.log(`✅ Cargados ${availableModels.ollama.length} modelos de Ollama`);
      }
    } catch (e) {
      console.warn('⚠️ No se pudieron cargar modelos de Ollama desde servidor:', e.message);
    }
    
    // Cargar modelos de Groq
    try {
      const groqResponse = await fetch('http://localhost:6003/groq/models', { 
        timeout: 3000 
      });
      const groqData = await groqResponse.json();
      if (groqData.success && groqData.models && groqData.models.length > 0) {
        availableModels.groq = groqData.models.map(m => ({
          name: m,
          provider: 'groq',
          label: `Groq: ${m}`
        }));
        groqLoaded = true;
        console.log(`✅ Cargados ${availableModels.groq.length} modelos de Groq`);
      }
    } catch (e) {
      console.warn('⚠️ No se pudieron cargar modelos de Groq desde servidor:', e.message);
    }
    
    // Fallback a modelos por defecto si servidores no disponibles
    if (!ollamaLoaded) {
      console.log('📋 Usando modelos por defecto de Ollama');
      availableModels.ollama = DEFAULT_OLLAMA_MODELS.map(name => ({
        name: name,
        provider: 'ollama',
        label: `Ollama: ${name}`
      }));
    }
    
    if (!groqLoaded) {
      console.log('📋 Usando modelos por defecto de Groq');
      availableModels.groq = DEFAULT_GROQ_MODELS.map(name => ({
        name: name,
        provider: 'groq',
        label: `Groq: ${name}`
      }));
    }
    
    // Limpiar selector
    modelSelect.innerHTML = '<option value="">Selecciona un modelo...</option>';
    
    // Agregar modelos de Ollama
    if (availableModels.ollama.length > 0) {
      const ollamaGroup = document.createElement('optgroup');
      ollamaGroup.label = 'Ollama (Local)';
      availableModels.ollama.forEach(model => {
        const option = document.createElement('option');
        option.value = `${model.provider}:${model.name}`;
        option.textContent = model.label;
        ollamaGroup.appendChild(option);
      });
      modelSelect.appendChild(ollamaGroup);
    }
    
    // Agregar modelos de Groq
    if (availableModels.groq.length > 0) {
      const groqGroup = document.createElement('optgroup');
      groqGroup.label = 'Groq (API)';
      availableModels.groq.forEach(model => {
        const option = document.createElement('option');
        option.value = `${model.provider}:${model.name}`;
        option.textContent = model.label;
        groqGroup.appendChild(option);
      });
      modelSelect.appendChild(groqGroup);
    }
    
    // Restaurar modelo seleccionado
    const savedModel = localStorage.getItem('selectedModel');
    if (savedModel) {
      modelSelect.value = savedModel;
      changeModel();
    }
    
    const totalModels = availableModels.ollama.length + availableModels.groq.length;
    modelStatus.textContent = `${totalModels} modelos disponibles`;
    modelStatus.className = 'model-status available';
    
    if (!ollamaLoaded || !groqLoaded) {
      modelStatus.textContent += ' (modo fallback)';
      modelStatus.className = 'model-status';
      console.log('⚠️ Algunos servidores no están disponibles, usando modelos por defecto');
      console.log('💡 Ejecuta INICIAR_SERVIDORES.bat para cargar modelos desde servidores');
    }
    
  } catch (error) {
    console.error('Error cargando modelos:', error);
    // Usar modelos por defecto en caso de error
    availableModels.ollama = DEFAULT_OLLAMA_MODELS.map(name => ({
      name: name,
      provider: 'ollama',
      label: `Ollama: ${name}`
    }));
    availableModels.groq = DEFAULT_GROQ_MODELS.map(name => ({
      name: name,
      provider: 'groq',
      label: `Groq: ${name}`
    }));
    
    modelStatus.textContent = `${availableModels.ollama.length + availableModels.groq.length} modelos (fallback)`;
    modelStatus.className = 'model-status';
  }
}

// Cargar modelos al iniciar
loadAvailableModels();

console.log('✅ Qwen-Valencia Frontend cargado');

