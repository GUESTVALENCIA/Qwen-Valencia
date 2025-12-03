// ═══════════════════════════════════════════════════════════════════
// QWEN-VALENCIA - APP.JS - PROFESIONAL
// ═══════════════════════════════════════════════════════════════════
// Adaptado de Sandra Studio Ultimate para Qwen-Valencia
// Solo modelos Qwen y DeepSeek (Ollama y Groq)
// Optimizado: 6+ modelos API, 2 modelos locales ligeros
// Enterprise-Level: Logger estructurado, State Manager, Event Manager
// ═══════════════════════════════════════════════════════════════════

// Importar módulos enterprise-level
// Nota: En el navegador, estos módulos se cargan como scripts globales en index.html
// No usar require() aquí porque estamos en el renderer process de Electron

/**
 * Verificar memoria RAM disponible del sistema (RAM real, no heap de JavaScript)
 * @returns {Promise<object|null>} Información de memoria disponible del sistema
 */
async function checkMemoryAvailable() {
    try {
        // Usar IPC para obtener memoria real del sistema desde el proceso principal
        if (window.qwenValencia && window.qwenValencia.getSystemMemory) {
            const memory = await window.qwenValencia.getSystemMemory();
            if (memory) {
                return {
                    total: memory.total,      // MB de RAM total del sistema
                    used: memory.used,        // MB de RAM usada
                    available: memory.available, // MB de RAM libre
                    free: memory.free,        // MB de RAM libre (alias)
                    percentage: memory.percentage // Porcentaje de uso
                };
            }
        }
    } catch (error) {
        if (typeof window !== 'undefined' && window.logger) {
            window.logger.warn('No se pudo obtener memoria del sistema', { error: error.message });
        } else {
            console.warn('⚠️ No se pudo obtener memoria del sistema:', error);
        }
    }
    return null;
}

/**
 * Verificar si hay suficiente memoria para modelos locales
 * @returns {Promise<boolean>} true si hay suficiente memoria
 */
async function hasEnoughMemoryForLocalModels() {
    const memory = await checkMemoryAvailable();
    if (!memory) return true; // Si no se puede verificar, asumir que hay suficiente
    
    // Los modelos locales requieren al menos 4GB de RAM libre del sistema
    const minRequiredMB = 4096; // 4GB mínimo
    return memory.available >= minRequiredMB;
}

// Estado global - Usar StateManager si está disponible, sino objeto simple
let stateManager = null;
let state = null;

// Inicializar StateManager si está disponible
try {
    if (typeof window !== 'undefined' && window.getStateManager) {
        stateManager = window.getStateManager();
        state = stateManager.getState();
        
        // Crear proxy para mantener compatibilidad con código existente
        state = new Proxy(state, {
            set(target, prop, value) {
                target[prop] = value;
                if (stateManager) {
                    stateManager.set(prop, value);
                }
                return true;
            },
            get(target, prop) {
                if (prop === 'getState') {
                    return () => stateManager ? stateManager.getState() : target;
                }
                return target[prop];
            }
        });
    } else {
        // Fallback a objeto simple si StateManager no está disponible
        state = {
            model: 'qwen2.5:7b-instruct',
            mode: 'agent',
            messages: [],
            isGenerating: false,
            attachedImage: null,
            stream: null,
            config: {
                ollamaUrl: 'http://localhost:11434',
                temperature: 0.7,
                maxTokens: 4096
            },
            theme: 'dark',
            mediaStream: null,
            recognition: null,
            isListening: false,
            deepgramConnection: null,
            isRecording: false,
            recordingStartTime: null,
            recordingMaxTime: 20 * 60 * 1000, // 20 minutos
            ttsInterval: null,
            lastTTSAt: null,
            voiceCallActive: false,
            deepgramAvailable: false,
            useAPI: true, // Por defecto usar API (Groq)
            micActive: false,
            micStream: null,
            micRecorder: null
        };
    }
} catch (error) {
    // Fallback si hay error inicializando StateManager
    console.warn('Error inicializando StateManager, usando estado simple:', error);
    state = {
        model: 'qwen2.5:7b-instruct',
        mode: 'agent',
        messages: [],
        isGenerating: false,
        attachedImage: null,
        stream: null,
        config: {
            ollamaUrl: 'http://localhost:11434',
            temperature: 0.7,
            maxTokens: 4096
        },
        theme: 'dark',
        mediaStream: null,
        recognition: null,
        isListening: false,
        deepgramConnection: null,
        isRecording: false,
        recordingStartTime: null,
        recordingMaxTime: 20 * 60 * 1000,
        ttsInterval: null,
        lastTTSAt: null,
        voiceCallActive: false,
        deepgramAvailable: false,
        useAPI: true,
        micActive: false,
        micStream: null,
        micRecorder: null
    };
}

// Variables globales de Avatar (declaradas antes de uso)
let avatarSession = null;
let avatarMode = 'sidebar';
let avatarWindow = null;
let avatarInactivityTimer = null;
let avatarCameraStream = null;
let avatarPaused = false;

// Funciones globales se exponen al final del archivo

// Modelos disponibles - Solo Qwen y DeepSeek
// Optimizado: 6+ modelos API, 2 modelos locales ligeros
const MODELS = {
    // Ollama Local - Solo 2 modelos ligeros
    'qwen2.5:7b-instruct': { 
        name: 'Qwen 2.5 7B', 
        provider: 'Ollama', 
        tokens: '32K', 
        version: '2.5', 
        category: 'Chat', 
        compact: 'Q2.5 7B',
        capabilities: ['Conversación natural', 'Respuestas rápidas', 'Multilenguaje'],
        description: 'Modelo conversacional rápido y eficiente. Ideal para chats generales y respuestas rápidas. Modelo local ligero.'
    },
    'deepseek-coder:6.7b': { 
        name: 'DeepSeek Coder', 
        provider: 'Ollama', 
        tokens: '16K', 
        version: '6.7', 
        category: 'Código', 
        compact: 'DS Coder',
        capabilities: ['Generación de código', 'Debugging', 'Refactoring', 'Múltiples lenguajes'],
        description: 'Modelo especializado en programación. Excelente para escribir, depurar y refactorizar código en múltiples lenguajes. Modelo local ligero.'
    },
    
    // Groq API - Qwen (4 modelos)
    'qwen-2.5-72b-instruct': { 
        name: 'Qwen 2.5 72B (Groq)', 
        provider: 'Groq', 
        tokens: '32K', 
        version: '2.5', 
        category: 'API', 
        compact: 'Q2.5 72B API',
        capabilities: ['API rápida', 'Respuestas instantáneas', 'Sin GPU local', 'Máxima potencia'],
        description: 'Qwen 2.5 72B vía Groq API. Ultra rápido y sin necesidad de GPU local. Modelo más potente de Qwen.'
    },
    'qwen-2.5-32b-instruct': { 
        name: 'Qwen 2.5 32B (Groq)', 
        provider: 'Groq', 
        tokens: '32K', 
        version: '2.5', 
        category: 'API', 
        compact: 'Q2.5 32B API',
        capabilities: ['API rápida', 'Balanceado', 'Sin GPU local'],
        description: 'Qwen 2.5 32B vía Groq API. Balance perfecto entre potencia y velocidad.'
    },
    'qwen-2.5-14b-instruct': { 
        name: 'Qwen 2.5 14B (Groq)', 
        provider: 'Groq', 
        tokens: '32K', 
        version: '2.5', 
        category: 'API', 
        compact: 'Q2.5 14B API',
        capabilities: ['API rápida', 'Rápido', 'Sin GPU local'],
        description: 'Qwen 2.5 14B vía Groq API. Rápido y eficiente para tareas generales.'
    },
    'qwen-2.5-7b-instruct': { 
        name: 'Qwen 2.5 7B (Groq)', 
        provider: 'Groq', 
        tokens: '32K', 
        version: '2.5', 
        category: 'API', 
        compact: 'Q2.5 7B API',
        capabilities: ['API rápida', 'Ultra rápido', 'Sin GPU local'],
        description: 'Qwen 2.5 7B vía Groq API. Ultra rápido para respuestas instantáneas.'
    },
    
    // Groq API - DeepSeek (3 modelos)
    'deepseek-r1-distill-llama-70b': { 
        name: 'DeepSeek R1 70B (Groq)', 
        provider: 'Groq', 
        tokens: '8K', 
        version: 'R1', 
        category: 'API', 
        compact: 'DS R1 70B API',
        capabilities: ['Razonamiento API', 'Ultra rápido', 'Sin GPU local', 'Máxima potencia'],
        description: 'DeepSeek R1 70B vía Groq API. Razonamiento profundo con velocidad extrema. Modelo más potente de DeepSeek.'
    },
    'deepseek-r1-distill-qwen-7b': { 
        name: 'DeepSeek R1 7B (Groq)', 
        provider: 'Groq', 
        tokens: '8K', 
        version: 'R1', 
        category: 'API', 
        compact: 'DS R1 7B API',
        capabilities: ['Razonamiento API', 'Rápido', 'Sin GPU local'],
        description: 'DeepSeek R1 7B vía Groq API. Razonamiento rápido y eficiente.'
    },
    'deepseek-r1-distill-llama-8b': { 
        name: 'DeepSeek R1 8B (Groq)', 
        provider: 'Groq', 
        tokens: '8K', 
        version: 'R1', 
        category: 'API', 
        compact: 'DS R1 8B API',
        capabilities: ['Razonamiento API', 'Balanceado', 'Sin GPU local'],
        description: 'DeepSeek R1 8B vía Groq API. Razonamiento balanceado entre potencia y velocidad.'
    },
    
    // Auto
    'auto': { 
        name: 'Auto', 
        provider: 'Auto', 
        tokens: 'Variable', 
        version: '-', 
        category: 'Selección inteligente', 
        compact: 'Auto',
        capabilities: ['Selección automática', 'Optimización inteligente', 'Adaptación al contexto'],
        description: 'Sistema inteligente que selecciona automáticamente el mejor modelo según el tipo de tarea y contenido.'
    }
};

// Mapeo de modelos a APIs reales
const MODEL_API_MAP = {
    // Ollama (locales) - Solo 2 modelos ligeros
    'qwen2.5:7b-instruct': { provider: 'ollama', apiModel: 'qwen2.5:7b-instruct' },
    'deepseek-coder:6.7b': { provider: 'ollama', apiModel: 'deepseek-coder:6.7b' },
    
    // Groq API - Qwen (4 modelos)
    'qwen-2.5-72b-instruct': { provider: 'groq', apiModel: 'qwen2.5-72b-instruct' },
    'qwen-2.5-32b-instruct': { provider: 'groq', apiModel: 'qwen2.5-32b-instruct' },
    'qwen-2.5-14b-instruct': { provider: 'groq', apiModel: 'qwen2.5-14b-instruct' },
    'qwen-2.5-7b-instruct': { provider: 'groq', apiModel: 'qwen2.5-7b-instruct' },
    
    // Groq API - DeepSeek (3 modelos)
    'deepseek-r1-distill-llama-70b': { provider: 'groq', apiModel: 'deepseek-r1-distill-llama-70b' },
    'deepseek-r1-distill-qwen-7b': { provider: 'groq', apiModel: 'deepseek-r1-distill-qwen-7b' },
    'deepseek-r1-distill-llama-8b': { provider: 'groq', apiModel: 'deepseek-r1-distill-llama-8b' }
};

// Timeouts optimizados por proveedor
const API_TIMEOUTS = {
    ollama: 300000,   // 5 minutos para Ollama (streaming)
    groq: 30000       // 30 segundos para Groq (muy rápido)
};

// Estado de selección de modelos
state.selectedModels = JSON.parse(localStorage.getItem('selectedModels') || '[]');
state.autoMode = localStorage.getItem('autoMode') !== 'false';
state.maxMode = localStorage.getItem('maxMode') === 'true';
state.multiModel = localStorage.getItem('multiModel') === 'true';
state.autoModeMaxModel = null;

// ═══════════════════════════════════════════════════════════════════
// INICIALIZACION
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    initTheme();
    initSpeechRecognition();
    initPasteHandler();
    initContextMenu();
    initModelList();
    initModelTooltips();
    initAvatarIndependence();
    initMenus();
    checkDeepgramAvailability();
    
    // Inicializar event listeners de la barra de chat
    initChatInputListeners();
    
    // Conectar cámara y micrófono automáticamente al iniciar
    initMediaDevices();
    
    // Restaurar estado del modelo
    const savedModel = localStorage.getItem('selectedModel');
    if (savedModel && MODELS[savedModel]) {
        state.model = savedModel;
    }
    
    // Restaurar estado del toggle API
    const savedUseAPI = localStorage.getItem('useAPI');
    if (savedUseAPI !== null) {
        state.useAPI = savedUseAPI === 'true';
        const toggle = document.getElementById('apiToggle');
        if (toggle) {
            toggle.checked = state.useAPI;
            toggleAPI(); // Actualizar UI
        }
    }
    
    // Inicializar UI del modelo
    updateModelMenuUI();
    if (state.autoMode) {
        updateModelButtonDisplay('Auto');
    } else {
        updateModelButtonDisplay(MODELS[state.model]?.compact || state.model);
    }
    
    // Restaurar estado del sidebar
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        toggleSidebar();
    }
    
    document.getElementById('chatInput').focus();
    
    // Click fuera cierra menus
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.model-dropdown') && !e.target.closest('.model-tooltip')) {
            document.getElementById('modelMenu').classList.remove('show');
        }
        hideContextMenu();
    });
});

function loadConfig() {
    try {
        const saved = localStorage.getItem('qwen_config');
        if (saved) {
            Object.assign(state.config, JSON.parse(saved));
        }
        state.theme = localStorage.getItem('qwen_theme') || 'dark';
    } catch (e) {
        console.error('Error loading config:', e);
    }
}

function saveConfig() {
    try {
        localStorage.setItem('qwen_config', JSON.stringify(state.config));
    } catch (e) {
        console.error('Error saving config:', e);
    }
}

// ═══════════════════════════════════════════════════════════════════
// TEMA
// ═══════════════════════════════════════════════════════════════════

function initTheme() {
    if (state.theme === 'light') {
        document.body.classList.add('light');
        document.getElementById('themeToggle').innerHTML = '&#9728;';
    }
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.body.classList.toggle('light');
    document.getElementById('themeToggle').innerHTML = state.theme === 'light' ? '&#9728;' : '&#9789;';
    const themeMenuText = document.getElementById('themeMenuText');
    if (themeMenuText) {
        themeMenuText.textContent = state.theme === 'light' ? 'Claro' : 'Oscuro';
    }
    localStorage.setItem('qwen_theme', state.theme);
}

// ═══════════════════════════════════════════════════════════════════
// MODELO
// ═══════════════════════════════════════════════════════════════════

function toggleModelMenu() {
    const menu = document.getElementById('modelMenu');
    const button = document.querySelector('.model-btn');
    
    if (!menu || !button) return;
    
    menu.classList.toggle('show');
    
    if (menu.classList.contains('show')) {
        const rect = button.getBoundingClientRect();
        menu.style.left = rect.left + 'px';
        menu.style.bottom = (window.innerHeight - rect.top) + 'px';
        menu.style.top = 'auto';
        menu.style.zIndex = '999999';
        document.getElementById('modelSearch').focus();
    } else {
        menu.style.left = '';
        menu.style.bottom = '';
        menu.style.top = '';
    }
}

function initModelList() {
    const container = document.getElementById('modelListScroll');
    if (!container) return;
    
    const modelKeys = Object.keys(MODELS).filter(k => k !== 'auto');
    
    container.innerHTML = modelKeys.map(modelId => {
        const model = MODELS[modelId];
        const isSelected = state.selectedModels.includes(modelId);
        return `
            <div class="model-item-compact" 
                 data-model="${modelId}" 
                 data-provider="${model.provider}"
                 data-tokens="${model.tokens}"
                 data-version="${model.version}"
                 data-category="${model.category}"
                 onclick="handleModelClick('${modelId}', event)">
                <input type="checkbox" class="model-checkbox" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation()">
                <span class="model-name-compact">${model.compact || model.name}</span>
            </div>
        `;
    }).join('');
}

function filterModels(searchTerm) {
    const items = document.querySelectorAll('.model-item-compact');
    const term = searchTerm.toLowerCase();
    
    items.forEach(item => {
        const modelId = item.dataset.model;
        const model = MODELS[modelId];
        const text = `${model.name} ${model.provider} ${model.category}`.toLowerCase();
        item.style.display = text.includes(term) ? 'flex' : 'none';
    });
}

function handleModelClick(modelId, event) {
    if (event) {
        event.stopPropagation();
    }
    
    if (state.multiModel) {
        toggleModelCheckbox(modelId);
    } else {
        selectModel(modelId);
        const modelMenu = document.getElementById('modelMenu');
        if (modelMenu) {
            modelMenu.classList.remove('show');
        }
    }
}

function toggleModelCheckbox(modelId) {
    const checkbox = document.querySelector(`.model-item-compact[data-model="${modelId}"] .model-checkbox`);
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        updateSelectedModels();
    }
}

function updateSelectedModels() {
    const checkboxes = document.querySelectorAll('.model-checkbox:checked');
    state.selectedModels = Array.from(checkboxes).map(cb => 
        cb.closest('.model-item-compact').dataset.model
    );
    localStorage.setItem('selectedModels', JSON.stringify(state.selectedModels));
}

function toggleAutoMode(enabled) {
    state.autoMode = enabled;
    localStorage.setItem('autoMode', enabled);
    
    if (enabled) {
        updateModelButtonDisplay('Auto');
        state.model = 'auto';
    } else {
        const lastModel = state.selectedModels.length > 0 
            ? state.selectedModels[state.selectedModels.length - 1] 
            : (state.model !== 'auto' ? state.model : 'qwen2.5:7b-instruct');
        state.model = lastModel;
        updateModelButtonDisplay(MODELS[lastModel]?.compact || lastModel);
    }
    
    updateModelMenuUI();
    localStorage.setItem('selectedModel', state.model);
}

function toggleMaxMode(enabled) {
    state.maxMode = enabled;
    localStorage.setItem('maxMode', enabled);
    
    if (enabled) {
        const maxModel = getMaxModel();
        if (state.autoMode) {
            state.autoModeMaxModel = maxModel;
        } else {
            state.model = maxModel;
            updateModelButtonDisplay(MODELS[maxModel]?.compact || maxModel);
            localStorage.setItem('selectedModel', maxModel);
        }
    }
    
    updateModelMenuUI();
}

function getMaxModel() {
    // Prioridad: Modelos API más potentes > Modelos locales
    if (MODELS['deepseek-r1-distill-llama-70b']) return 'deepseek-r1-distill-llama-70b';
    if (MODELS['qwen-2.5-72b-instruct']) return 'qwen-2.5-72b-instruct';
    if (MODELS['qwen-2.5-32b-instruct']) return 'qwen-2.5-32b-instruct';
    // Fallback a modelos locales
    if (MODELS['deepseek-coder:6.7b']) return 'deepseek-coder:6.7b';
    return 'qwen2.5:7b-instruct';
}

function toggleMultiModel(enabled) {
    state.multiModel = enabled;
    localStorage.setItem('multiModel', enabled);
    
    if (enabled) {
        document.querySelectorAll('.model-checkbox').forEach(cb => {
            cb.style.display = 'block';
        });
        if (state.selectedModels.length === 0 && state.model !== 'auto') {
            state.selectedModels = [state.model];
            updateSelectedModels();
        }
    } else {
        document.querySelectorAll('.model-checkbox').forEach(cb => {
            cb.style.display = 'none';
        });
        if (state.selectedModels.length > 0) {
            state.model = state.selectedModels[0];
            updateModelButtonDisplay(MODELS[state.model]?.compact || state.model);
        }
    }
    
    updateModelMenuUI();
}

function initModelTooltips() {
    let tooltip = document.getElementById('modelTooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'modelTooltip';
        tooltip.className = 'model-tooltip';
        tooltip.innerHTML = `
            <div class="tooltip-header">
                <div class="tooltip-provider"></div>
                <div class="tooltip-name"></div>
            </div>
            <div class="tooltip-tokens"></div>
            <div class="tooltip-category"></div>
            <div class="tooltip-capabilities"></div>
            <div class="tooltip-description"></div>
        `;
        document.body.appendChild(tooltip);
    }
    
    let tooltipTimeout = null;
    
    const hideTooltip = () => {
        if (tooltipTimeout) {
            clearTimeout(tooltipTimeout);
            tooltipTimeout = null;
        }
        tooltip.classList.remove('show');
        tooltip.style.display = 'none';
    };
    
    document.addEventListener('mouseover', (e) => {
        const item = e.target.closest('.model-item-compact, .model-option');
        if (item) {
            const modelId = item.dataset.model || item.getAttribute('data-model');
            if (!modelId) return;
            
            const model = MODELS[modelId];
            if (model) {
                if (tooltipTimeout) {
                    clearTimeout(tooltipTimeout);
                }
                
                updateTooltipContent(tooltip, model);
                positionTooltip(e, tooltip);
                tooltip.style.display = 'block';
                tooltip.classList.add('show');
                
                tooltipTimeout = setTimeout(hideTooltip, 3000);
            }
        }
    });
    
    document.addEventListener('mouseout', (e) => {
        const related = e.relatedTarget;
        if (!related || (!related.closest('.model-item-compact, .model-option') && !related.closest('.model-tooltip'))) {
            hideTooltip();
        }
    });
    
    document.addEventListener('click', hideTooltip);
}

function updateTooltipContent(tooltip, model) {
    const providerEl = tooltip.querySelector('.tooltip-provider');
    const nameEl = tooltip.querySelector('.tooltip-name');
    const tokensEl = tooltip.querySelector('.tooltip-tokens');
    const categoryEl = tooltip.querySelector('.tooltip-category');
    const capabilitiesEl = tooltip.querySelector('.tooltip-capabilities');
    const descriptionEl = tooltip.querySelector('.tooltip-description');
    
    if (providerEl) providerEl.textContent = model.provider;
    if (nameEl) nameEl.textContent = model.name;
    if (tokensEl) {
        const tokensText = model.tokens === 'N/A' || model.tokens === '-' || model.tokens === 'Ilimitado' 
            ? 'Contexto: Ilimitado' 
            : `Contexto: ${model.tokens} tokens`;
        tokensEl.textContent = tokensText;
    }
    if (categoryEl) categoryEl.textContent = `Categoría: ${model.category || 'General'}`;
    if (capabilitiesEl) {
        if (model.capabilities && model.capabilities.length > 0) {
            capabilitiesEl.innerHTML = `<strong>Capacidades:</strong><br>${model.capabilities.join(', ')}`;
            capabilitiesEl.style.display = 'block';
        } else {
            capabilitiesEl.style.display = 'none';
        }
    }
    if (descriptionEl) {
        if (model.description) {
            descriptionEl.textContent = model.description;
            descriptionEl.style.display = 'block';
        } else {
            descriptionEl.style.display = 'none';
        }
    }
}

function positionTooltip(e, tooltip) {
    if (!tooltip) return;
    
    const rect = e.target.getBoundingClientRect();
    let left = rect.right + 10;
    let top = rect.top;
    
    tooltip.style.visibility = 'hidden';
    tooltip.style.display = 'block';
    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;
    
    if (left + tooltipWidth > window.innerWidth - 10) {
        left = rect.left - tooltipWidth - 10;
    }
    
    if (left < 10) {
        left = 10;
    }
    
    if (top + tooltipHeight > window.innerHeight - 10) {
        top = window.innerHeight - tooltipHeight - 10;
    }
    
    if (top < 10) {
        top = 10;
    }
    
    tooltip.style.position = 'fixed';
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.style.zIndex = '9999999';
    tooltip.style.visibility = 'visible';
}

function updateModelButtonDisplay(modelName) {
    const modelNameSpan = document.getElementById('modelName');
    
    if (modelNameSpan) {
        modelNameSpan.textContent = modelName;
    }
    
    // Actualizar icono según el modelo
    const modelIcon = document.getElementById('modelIcon');
    if (modelIcon) {
        if (modelName === 'Auto') {
            modelIcon.textContent = '🤖';
        } else {
            const model = MODELS[Object.keys(MODELS).find(k => MODELS[k]?.compact === modelName || k === modelName)];
            modelIcon.textContent = model?.icon || '🤖';
        }
    }
}

function updateModelMenuUI() {
    document.querySelectorAll('.model-item-compact').forEach(item => {
        const modelId = item.dataset.model;
        const checkbox = item.querySelector('.model-checkbox');
        
        if (checkbox) {
            checkbox.checked = state.selectedModels.includes(modelId);
            if (state.multiModel) {
                checkbox.style.display = 'block';
            } else {
                checkbox.style.display = 'none';
            }
        }
        
        if (modelId === state.model) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    const autoToggle = document.getElementById('autoToggle');
    const maxToggle = document.getElementById('maxToggle');
    const multiToggle = document.getElementById('multiToggle');
    
    if (autoToggle) autoToggle.checked = state.autoMode;
    if (maxToggle) maxToggle.checked = state.maxMode;
    if (multiToggle) multiToggle.checked = state.multiModel;
    
    if (state.autoMode) {
        updateModelButtonDisplay('Auto');
    } else {
        updateModelButtonDisplay(MODELS[state.model]?.compact || state.model);
    }
}

function showAddModelModal() {
    alert('Funcionalidad de añadir modelos personalizados próximamente');
}

function selectModel(modelId) {
    if (state.autoMode && modelId !== 'auto') {
        toggleAutoMode(false);
    }
    
    if (state.multiModel && modelId !== 'auto') {
        if (!state.selectedModels.includes(modelId)) {
            state.selectedModels.push(modelId);
            updateSelectedModels();
        }
    } else {
        state.model = modelId;
        localStorage.setItem('selectedModel', modelId);
        updateModelButtonDisplay(MODELS[modelId]?.compact || modelId);
        
        // Log para debug
        if (typeof window !== 'undefined' && window.logger) {
            window.logger.info('Modelo seleccionado', { modelId, model: MODELS[modelId] });
        } else {
            console.log(`✅ Modelo seleccionado: ${modelId}`, MODELS[modelId]);
        }
    }
    
    if (state.attachedImage && modelId === 'auto') {
        // Usar Qwen estándar (local o API según useAPI) para imágenes
        state.model = state.useAPI ? 'qwen-2.5-72b-instruct' : 'qwen2.5:7b-instruct';
        updateModelButtonDisplay(MODELS[state.model]?.compact || 'Qwen');
    }
    
    document.getElementById('modelMenu').classList.remove('show');
    updateModelMenuUI();
    
    const tooltip = document.getElementById('modelTooltip');
    if (tooltip) {
        tooltip.classList.remove('show');
        tooltip.style.display = 'none';
    }
}

/**
 * Verificar si un modelo es Qwen (no solo buscar 'qwen' como substring)
 * @param {string} modelId - ID del modelo
 * @returns {boolean} true si es un modelo Qwen
 */
function isQwenModel(modelId) {
    if (!modelId) return false;
    // Modelos Qwen empiezan con 'qwen' o tienen patrón 'qwen-2.5' o 'qwen2.5'
    // Excluir modelos DeepSeek que contienen 'qwen' en el nombre (ej: deepseek-r1-distill-qwen-7b)
    return modelId.startsWith('qwen') || 
           modelId.startsWith('qwen-2.5') || 
           modelId.startsWith('qwen2.5');
}

function getAutoModel(message, hasImage = false) {
    const lower = message.toLowerCase();
    
    // Si hay imagen, usar Qwen (local o API según useAPI)
    if (hasImage || state.attachedImage) {
        return state.useAPI ? 'qwen-2.5-72b-instruct' : 'qwen2.5:7b-instruct';
    }
    
    // Razonamiento complejo - DeepSeek R1
    if (lower.match(/piensa|analiza|razona|explica|por que|como funciona|deduce|inferencia/)) {
        if (state.useAPI) {
            // Priorizar modelos API de DeepSeek R1 según disponibilidad
            return 'deepseek-r1-distill-llama-70b'; // Más potente
        } else {
            // Local: usar DeepSeek Coder (más ligero que R1)
            return 'deepseek-coder:6.7b';
        }
    }
    
    // Código - DeepSeek
    if (lower.match(/codigo|code|programa|script|funcion|python|javascript|html|css|typescript|java|c\+\+|rust|go/)) {
        if (state.useAPI) {
            // API: usar DeepSeek R1 (no hay DeepSeek Coder API en Groq)
            // Usar modelo más rápido para código: deepseek-r1-distill-qwen-7b
            return 'deepseek-r1-distill-qwen-7b';
        } else {
            // Local: usar DeepSeek Coder (especializado en código)
            return 'deepseek-coder:6.7b';
        }
    }
    
    // Conversación general - Qwen
    // Priorizar modelos API más potentes cuando useAPI=true
    if (state.useAPI) {
        return 'qwen-2.5-72b-instruct'; // Modelo más potente por defecto
    } else {
        return 'qwen2.5:7b-instruct'; // Modelo local ligero
    }
}

// ═══════════════════════════════════════════════════════════════════
// MODO
// ═══════════════════════════════════════════════════════════════════

function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
}

// ═══════════════════════════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════════════════════════

function handleKeydown(e) {
    const textarea = e.target;
    
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
        return;
    }
    
    // Auto-resize sin scroll interno
    if (e.key === 'Enter' && e.shiftKey) {
        // Permitir nueva línea, ajustar altura después
        setTimeout(() => {
            autoResize(textarea);
        }, 0);
    }
}

function autoResize(textarea) {
    if (!textarea) return;
    
    // Reset height to get accurate scrollHeight
    textarea.style.height = '24px';
    
    // Calculate new height (min 24px, max 200px)
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 24), 200);
    textarea.style.height = newHeight + 'px';
    
    // Ensure no internal scroll
    if (textarea.scrollHeight <= 200) {
        textarea.style.overflowY = 'hidden';
    } else {
        textarea.style.overflowY = 'auto';
    }
}

function getProviderFromModel(model) {
    const apiConfig = MODEL_API_MAP[model];
    if (apiConfig) return apiConfig.provider;
    
    const modelInfo = MODELS[model];
    if (!modelInfo) return 'ollama';
    return modelInfo.provider.toLowerCase() || 'ollama';
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    
    const message = input.value.trim();
    
    if (!message && !state.attachedImage) return;
    
    // Reset textarea height
    input.style.height = '24px';
    input.value = '';
    if (state.isGenerating) return;
    
    state.isGenerating = true;
    updateSendButton(true);
    
    const hasImage = !!state.attachedImage;
    // Nota: qwen2.5vl:3b fue eliminado, usar Qwen estándar para imágenes
    if (hasImage && state.model !== 'auto' && !isQwenModel(state.model)) {
        // Si hay imagen y no es Qwen, cambiar a Qwen (local o API según useAPI)
        const previousModel = state.model;
        state.model = state.useAPI ? 'qwen-2.5-72b-instruct' : 'qwen2.5:7b-instruct';
        updateModelButtonDisplay(MODELS[state.model]?.compact || 'Qwen');
        if (typeof window !== 'undefined' && window.logger) {
            window.logger.info('Imagen detectada, cambiando modelo', { 
                from: previousModel, 
                to: state.model 
            });
        } else {
            console.log(`🖼️ Imagen detectada: Cambiando de ${previousModel} a ${state.model} para procesamiento de imágenes`);
        }
    }
    
    let modelsToUse = [];
    
    if (state.multiModel && state.selectedModels.length > 0) {
        modelsToUse = state.selectedModels;
    } else if (state.autoMode) {
        let autoModel = getAutoModel(message, hasImage);
        
        if (state.maxMode && state.autoModeMaxModel && !hasImage) {
            autoModel = state.autoModeMaxModel;
        }
        
        modelsToUse = [autoModel];
    } else {
        modelsToUse = [state.model];
    }
    
    // Verificar memoria antes de usar modelos locales (RAM real del sistema)
    const hasLocalModels = modelsToUse.some(modelId => modelId && modelId.includes(':'));
    if (hasLocalModels && !state.useAPI) {
        // Verificar memoria del sistema ANTES de enviar el mensaje
        const hasEnough = await hasEnoughMemoryForLocalModels();
        if (!hasEnough) {
            const memory = await checkMemoryAvailable();
            if (memory) {
                const memoryGB = (memory.available / 1024).toFixed(1);
                showToast(`⚠️ Memoria RAM del sistema baja (${memoryGB}GB disponible). Los modelos locales requieren al menos 4GB. Considera usar modelos API.`, 'warning');
                // No bloquear completamente, pero advertir al usuario
                // El usuario puede decidir continuar o cancelar
            }
        }
    }
    
    addMessage('user', message, state.attachedImage);
    state.messages.push({ role: 'user', content: message });
    
    input.value = '';
    input.style.height = 'auto';
    const attachedImage = state.attachedImage;
    removeAttachment();
    
    showStreaming(true);
    
    try {
        if (modelsToUse.length === 1) {
            const response = await routeToModel(modelsToUse[0], message, attachedImage);
            addMessage('assistant', response);
            state.messages.push({ role: 'assistant', content: response });
        } else {
            await sendToMultipleModels(message, modelsToUse, attachedImage);
        }
    } catch (error) {
        if (typeof window !== 'undefined' && window.logger) {
            window.logger.error('Error enviando mensaje', { 
                error: error.message,
                stack: error.stack 
            });
        } else {
            console.error('Error enviando mensaje:', error);
        }
        let errorMessage = error.message || 'Error desconocido';
        let userFriendlyMessage = '';
        
        // Mensajes de error más amigables y específicos
        if (errorMessage.includes('Invalid character in header')) {
            userFriendlyMessage = '⚠️ Error de autenticación con Groq API\n\n💡 La API key contiene caracteres inválidos. Verifica que GROQ_API_KEY en qwen-valencia.env esté correctamente configurada sin espacios ni caracteres especiales.';
            showToast('Error de autenticación - Verifica GROQ_API_KEY', 'error');
        } else {
            // Intentar parsear error como APIError estándar
            let parsedError = null;
            try {
                // Buscar JSON de error en el mensaje
                const errorMatch = errorMessage.match(/\{[^}]+\}/);
                if (errorMatch) {
                    parsedError = JSON.parse(errorMatch[0]);
                }
            } catch (e) {
                // No es JSON, continuar con manejo tradicional
            }
            
            if (parsedError && parsedError.error) {
                // Error estándar APIError
                const apiError = parsedError.error;
                const code = apiError.code || 'UNKNOWN';
                const message = apiError.message || errorMessage;
                const details = apiError.details || {};
                
                if (code.includes('API_KEY_INVALID') || code.includes('AUTH_REQUIRED')) {
                    userFriendlyMessage = `⚠️ ${message}\n\n💡 Solución: Verifica que GROQ_API_KEY esté correctamente configurada en qwen-valencia.env sin espacios ni caracteres especiales.`;
                    showToast('Error de API Key - Verifica qwen-valencia.env', 'error');
                } else if (code.includes('RATE_LIMIT') || code.includes('TOO_MANY_REQUESTS')) {
                    const retryAfter = details.retryAfter ? ` Reintenta después de ${details.retryAfter}s.` : '';
                    userFriendlyMessage = `⚠️ ${message}${retryAfter}\n\n💡 Has excedido el límite de requests. Espera unos momentos e intenta de nuevo.`;
                    showToast('Rate limit alcanzado - Espera un momento', 'warning');
                } else if (code.includes('MODEL_NOT_FOUND') || code.includes('OLLAMA')) {
                    const modelName = details.model || modelsToUse[0] || 'qwen2.5:7b-instruct';
                    userFriendlyMessage = `⚠️ ${message}\n\n💡 Soluciones:\n1. Verifica que Ollama esté corriendo: \`ollama serve\`\n2. Descarga el modelo: \`ollama pull ${modelName}\`\n3. Verifica que el nombre del modelo sea correcto`;
                    showToast('Modelo no encontrado', 'warning');
                } else if (code.includes('ALL_PROVIDERS_FAILED')) {
                    userFriendlyMessage = `⚠️ ${message}\n\n💡 Todos los proveedores fallaron. Verifica:\n1. GROQ_API_KEY en qwen-valencia.env\n2. Ollama corriendo y modelos instalados\n3. Conexión a internet`;
                    showToast('Todos los proveedores fallaron', 'error');
                } else {
                    userFriendlyMessage = `⚠️ ${message}\n\n💡 Si el problema persiste, verifica la configuración en qwen-valencia.env`;
                    showToast('Error al procesar mensaje', 'error');
                }
            } else if (errorMessage.includes('404') && errorMessage.includes('Groq')) {
                userFriendlyMessage = '⚠️ Error conectando con Groq API (404)\n\n💡 Verifica que:\n1. GROQ_API_KEY esté correcta en qwen-valencia.env\n2. La API key tenga el formato correcto (debe empezar con "gsk_")\n3. No haya espacios o caracteres especiales en la key';
                showToast('Error 404 - Verifica GROQ_API_KEY', 'error');
            } else if (errorMessage.includes('429')) {
                userFriendlyMessage = '⚠️ Límite de rate limit alcanzado\n\n💡 Has excedido el límite de requests de Groq. Espera unos momentos e intenta de nuevo.';
                showToast('Rate limit alcanzado - Espera un momento', 'warning');
            } else if (errorMessage.includes('Ollama') && errorMessage.includes('404')) {
                userFriendlyMessage = '⚠️ Modelo de Ollama no encontrado\n\n💡 Soluciones:\n1. Verifica que Ollama esté corriendo: `ollama serve`\n2. Descarga el modelo: `ollama pull ' + (modelsToUse[0] || 'qwen2.5:7b-instruct') + '`\n3. Verifica que el nombre del modelo sea correcto';
                showToast('Modelo Ollama no encontrado', 'warning');
            } else if (errorMessage.includes('API Key') || errorMessage.includes('GROQ_API_KEY')) {
                userFriendlyMessage = '⚠️ ' + errorMessage + '\n\n💡 Solución: Verifica que GROQ_API_KEY esté correctamente configurada en qwen-valencia.env sin espacios ni caracteres especiales.';
                showToast('Error de API Key - Verifica qwen-valencia.env', 'error');
            } else {
                userFriendlyMessage = '⚠️ ' + errorMessage + '\n\n💡 Si el problema persiste, verifica la configuración en qwen-valencia.env';
                showToast('Error al procesar mensaje', 'error');
            }
        }
        
        addMessage('assistant', userFriendlyMessage);
    } finally {
        showStreaming(false);
        state.isGenerating = false;
        updateSendButton(false);
    }
}

async function routeToModel(modelId, message, image = null) {
    const messages = [...state.messages];
    
    // Asegurar que se use el modelo correcto
    const modelToUse = modelId || state.model;
    
    // Log para debug
    if (typeof window !== 'undefined' && window.logger) {
        window.logger.debug('Enrutando mensaje', {
        modelId,
        stateModel: state.model,
        useAPI: state.useAPI,
        modelInfo: MODELS[modelToUse]
    });
    
    // Usar window.qwenValencia.routeMessage() para enrutar a través del model-router
    try {
        const result = await window.qwenValencia.routeMessage({
            text: message,
            attachments: image ? [{ data: image, type: 'image' }] : [],
            model: modelToUse,
            useAPI: state.useAPI
        });
        
        if (result.success) {
            return result.response;
        } else {
            throw new Error(result.error || 'Error desconocido');
        }
    } catch (error) {
        if (typeof window !== 'undefined' && window.logger) {
            window.logger.error('Error en routeToModel', { 
                error: error.message,
                model: modelToUse 
            });
        } else {
            console.error('Error en routeToModel:', error);
        }
        
        // Mejorar mensaje de error antes de lanzarlo
        let improvedError = error;
        
        if (error.message) {
            // Si el error menciona "Invalid character in header", mejorar el mensaje
            if (error.message.includes('Invalid character in header')) {
                improvedError = new Error('Error con Groq API: Invalid character in header content ["Authorization"]. Verifica tu GROQ_API_KEY en qwen-valencia.env');
            } else if (error.message.includes('Error ejecutando Qwen')) {
                // Mantener el mensaje original pero asegurar que menciona qwen-valencia.env
                improvedError = new Error(error.message.replace(/\.env\.pro/g, 'qwen-valencia.env'));
            }
        }
        
        throw improvedError;
    }
}

async function sendToMultipleModels(message, models, images = null) {
    const promises = models.map(async (modelId) => {
        try {
            const response = await routeToModel(modelId, message, images);
            return { modelId, success: true, response };
        } catch (error) {
            return { modelId, success: false, error: error.message };
        }
    });
    
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            const { modelId, success, response, error } = result.value;
            if (success) {
                addMessage('assistant', response, null, modelId);
                state.messages.push({ role: 'assistant', content: response });
            } else {
                addMessage('assistant', `Error con ${MODELS[modelId]?.name || modelId}: ${error}`, null, modelId);
            }
        } else {
            const modelId = models[index];
            addMessage('assistant', `Error con ${MODELS[modelId]?.name || modelId}: ${result.reason}`, null, modelId);
        }
    });
}

function updateSendButton(loading) {
    const btn = document.getElementById('sendBtn');
    btn.disabled = loading;
    btn.innerHTML = loading ? '&#8987;' : '&#10148;';
}

function showStreaming(show) {
    document.getElementById('streamingBar').style.display = show ? 'flex' : 'none';
}

function stopGeneration() {
    if (state.stream) {
        state.stream.abort();
        state.stream = null;
    }
    state.isGenerating = false;
    showStreaming(false);
    updateSendButton(false);
}

// ═══════════════════════════════════════════════════════════════════
// MENSAJES
// ═══════════════════════════════════════════════════════════════════

function addMessage(role, content, image = null, modelId = null) {
    const container = document.getElementById('chatMessages');
    
    const welcome = container.querySelector('.welcome-screen');
    if (welcome) welcome.remove();
    
    const div = document.createElement('div');
    div.className = 'message ' + role;
    if (modelId) {
        div.dataset.model = modelId;
    }
    
    let html = '<div class="message-bubble">';
    if (image) {
        html += '<img src="data:image/jpeg;base64,' + image + '" alt="Imagen">';
    }
    
    if (role === 'assistant' && modelId && state.multiModel) {
        const modelName = MODELS[modelId]?.compact || modelId;
        html += '<div class="model-label">' + modelName + '</div>';
    }
    
    html += '<div class="message-text">' + formatContent(content) + '</div>';
    html += '</div>';
    
    div.innerHTML = html;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    
    return div;
}

function updateMessageContent(el, content) {
    const textEl = el.querySelector('.message-text');
    if (textEl) {
        textEl.innerHTML = formatContent(content);
        el.parentElement.scrollTop = el.parentElement.scrollHeight;
    }
}

function formatContent(content) {
    if (!content) return '';
    
    content = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
    content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    content = content.replace(/\n/g, '<br>');
    
    return content;
}

function newChat() {
    state.messages = [];
    document.getElementById('chatMessages').innerHTML = 
        '<div class="welcome-screen">' +
        '<div class="welcome-logo">Q</div>' +
        '<h1>Qwen-Valencia</h1>' +
        '<p>Asistente IA con modelos chinos</p>' +
        '</div>';
}

// ═══════════════════════════════════════════════════════════════════
// IMAGEN / CAMARA
// ═══════════════════════════════════════════════════════════════════

function attachImage() {
    document.getElementById('fileInput').click();
}

function openFileSelector() {
    // Abrir selector de archivos (mismo que attachImage pero para el botón +)
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.click();
    } else {
        console.error('fileInput no encontrado');
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
        const base64 = ev.target.result.split(',')[1];
        state.attachedImage = base64;
        showAttachment(ev.target.result);
        
        if (state.model === 'auto') {
            selectModelByKey('qwen2.5vl:3b');
        }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

function showAttachment(src) {
    const preview = document.getElementById('attachedPreview');
    document.getElementById('previewImg').src = src;
    preview.style.display = 'inline-block';
}

function removeAttachment() {
    state.attachedImage = null;
    document.getElementById('attachedPreview').style.display = 'none';
    document.getElementById('previewImg').src = '';
}

function selectModelByKey(key) {
    const el = document.querySelector('.model-option[data-model="' + key + '"]');
    if (el) selectModel(el);
}

function openCamera() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            state.mediaStream = stream;
            video.srcObject = stream;
            modal.classList.add('show');
        })
        .catch(err => {
            alert('No se pudo acceder a la camara: ' + err.message);
        });
}

function closeCamera() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    
    if (state.mediaStream) {
        state.mediaStream.getTracks().forEach(track => track.stop());
        state.mediaStream = null;
    }
    video.srcObject = null;
    modal.classList.remove('show');
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    state.attachedImage = dataUrl.split(',')[1];
    showAttachment(dataUrl);
    
    closeCamera();
    
    if (state.model === 'auto') {
        selectModelByKey('qwen2.5vl:3b');
    }
}

// ═══════════════════════════════════════════════════════════════════
// VOZ
// ═══════════════════════════════════════════════════════════════════

function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        state.recognition = new SpeechRecognition();
        state.recognition.lang = 'es-ES';
        state.recognition.continuous = true;
        state.recognition.interimResults = true;
        
        state.recognition.onresult = (e) => {
            let transcript = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                transcript += e.results[i][0].transcript;
            }
            document.getElementById('chatInput').value = transcript;
            autoResize(document.getElementById('chatInput'));
        };
        
        state.recognition.onend = () => {
            if (state.isListening) {
                state.recognition.start();
            }
        };
    }
}

// ═══════════════════════════════════════════════════════════════════
// PEGADO DE IMAGENES (CTRL+V)
// ═══════════════════════════════════════════════════════════════════

function initPasteHandler() {
    const chatInput = document.getElementById('chatInput');
    
    chatInput.addEventListener('paste', (e) => {
        const items = e.clipboardData.items;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                const reader = new FileReader();
                
                reader.onload = (ev) => {
                    const dataUrl = ev.target.result;
                    const base64 = dataUrl.split(',')[1];
                    state.attachedImage = base64;
                    showAttachment(dataUrl);
                    
                    if (state.model === 'auto') {
                        selectModelByKey('qwen2.5vl:3b');
                    }
                };
                
                reader.readAsDataURL(blob);
                e.preventDefault();
                break;
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════════
// INICIALIZACIÓN AUTOMÁTICA DE DISPOSITIVOS
// ═══════════════════════════════════════════════════════════════════

async function initMediaDevices() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        stream.getTracks().forEach(track => track.stop());
        
        if (typeof window !== 'undefined' && window.logger) {
            window.logger.info('Permisos de cámara y micrófono obtenidos');
        } else {
            console.log('✅ Permisos de cámara y micrófono obtenidos');
        }
        localStorage.setItem('mediaPermissionsGranted', 'true');
        
    } catch (error) {
        if (typeof window !== 'undefined' && window.logger) {
            window.logger.warn('No se pudieron obtener permisos de medios', { 
                error: error.message 
            });
        } else {
            console.warn('⚠️ No se pudieron obtener permisos de medios:', error.message);
        }
    }
}

async function openCameraForIA() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsinline = true;
        
        const cameraModal = document.createElement('div');
        cameraModal.className = 'camera-modal';
        cameraModal.innerHTML = `
            <div class="camera-modal-content">
                <div class="camera-header">
                    <h3>Cámara activa</h3>
                    <button onclick="closeCameraModal()">✕</button>
                </div>
                <video id="cameraPreview" autoplay playsinline></video>
                <div class="camera-controls">
                    <button onclick="captureImageForIA()">Capturar y enviar a IA</button>
                    <button onclick="closeCameraModal()">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(cameraModal);
        
        const preview = cameraModal.querySelector('#cameraPreview');
        preview.srcObject = stream;
        
        window.currentCameraStream = stream;
        
    } catch (error) {
        alert('No se pudo acceder a la cámara: ' + error.message);
    }
}

function closeCameraModal() {
    const modal = document.querySelector('.camera-modal');
    if (modal) {
        if (window.currentCameraStream) {
            window.currentCameraStream.getTracks().forEach(track => track.stop());
            window.currentCameraStream = null;
        }
        modal.remove();
    }
}

function captureImageForIA() {
    const preview = document.querySelector('#cameraPreview');
    if (!preview) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = preview.videoWidth;
    canvas.height = preview.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(preview, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg');
    const base64 = dataUrl.split(',')[1];
    state.attachedImage = base64;
    showAttachment(dataUrl);
    
    if (state.model === 'auto' || !isQwenModel(state.model)) {
        // Usar Qwen estándar (local o API según useAPI) para imágenes
        state.model = state.useAPI ? 'qwen-2.5-72b-instruct' : 'qwen2.5:7b-instruct';
        updateModelButtonDisplay(MODELS[state.model]?.compact || 'Qwen');
    }
    
    closeCameraModal();
}

// Llamada Conversacional - SOLO DEEPGRAM
async function startVoiceCall() {
    const btn = document.getElementById('voiceCallBtn');
    
    try {
        if (state.voiceCallActive) {
            await stopVoiceCall();
            btn.classList.remove('active');
            state.voiceCallActive = false;
        } else {
            await startChatGPTDictation();
            state.voiceCallActive = true;
            btn.classList.add('active');
        }
    } catch (error) {
        console.error('Error en llamada de voz:', error);
        showToast('Error al iniciar llamada de voz: ' + error.message, 'error');
        btn.classList.remove('active');
        state.voiceCallActive = false;
    }
}

async function stopVoiceCall() {
    await stopChatGPTDictation();
    state.voiceCallActive = false;
}

// Videollamada con Avatar
async function startAvatarCall() {
    // HeyGen deshabilitado temporalmente
    showToast('Avatar HeyGen deshabilitado temporalmente', 'info');
    return;
}

// Dictado estilo ChatGPT
async function toggleDictation() {
    const btn = document.getElementById('dictateBtn');
    if (!btn) {
        console.error('Botón de dictado no encontrado');
        return;
    }
    
    try {
        if (!state.isRecording) {
            await startChatGPTDictation();
            btn.classList.add('active', 'mic-active');
        } else {
            await stopChatGPTDictation();
            btn.classList.remove('active', 'mic-active');
        }
    } catch (error) {
        console.error('Error en dictado:', error);
        showToast('Error en dictado: ' + error.message, 'error');
        if (btn) {
            btn.classList.remove('active', 'mic-active');
        }
        state.isRecording = false;
    }
}

async function toggleVoice() {
    return await toggleDictation();
}

// Dictado ChatGPT con DEEPGRAM
async function startChatGPTDictation() {
    try {
        state.isRecording = true;
        state.recordingStartTime = Date.now();
        state.lastTTSAt = Date.now();
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true
            } 
        });
        state.mediaStream = stream;
        
        const deepgramResult = await window.qwenValencia.deepgramStartLive();
        if (!deepgramResult || !deepgramResult.success) {
            throw new Error('No se pudo iniciar Deepgram Live. Verifica tu API key de Deepgram.');
        }
        
        window.qwenValencia.onDeepgramTranscript((data) => {
            if (!state.isRecording) return;
            
            const input = document.getElementById('chatInput');
            
            if (data.transcript && !data.isFinal) {
                const currentText = input.value;
                const baseText = currentText.split('\n').slice(0, -1).join('\n');
                input.value = baseText + (baseText ? '\n' : '') + data.transcript;
                autoResize(input);
            }
            
            if (data.isFinal && data.transcript) {
                const finalTranscript = data.transcript.trim();
                if (finalTranscript) {
                    input.value = finalTranscript;
                    autoResize(input);
                    
                    const now = Date.now();
                    if (now - state.lastTTSAt >= 30000 && finalTranscript.length > 10) {
                        sendMessageForTTS(finalTranscript);
                        state.lastTTSAt = now;
                    }
                }
            }
        });
        
        window.qwenValencia.onDeepgramError((error) => {
            console.error('Deepgram error:', error);
            stopChatGPTDictation();
            showToast('Error en Deepgram: ' + (error.message || error), 'error');
            document.getElementById('voiceCallBtn')?.classList.remove('active');
            document.getElementById('dictateBtn')?.classList.remove('active');
            state.voiceCallActive = false;
        });
        
        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        mediaRecorder.ondataavailable = async (e) => {
            if (!state.isRecording || !e.data || e.data.size === 0) return;
            
            try {
                const arrayBuffer = await e.data.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                let binary = '';
                for (let i = 0; i < uint8Array.length; i++) {
                    binary += String.fromCharCode(uint8Array[i]);
                }
                const base64 = btoa(binary);
                
                window.qwenValencia.deepgramSendAudio(base64);
            } catch (error) {
                console.error('Error procesando audio para Deepgram:', error);
            }
        };
        
        mediaRecorder.onerror = (error) => {
            console.error('Error en MediaRecorder:', error);
        };
        
        mediaRecorder.start(100);
        
        state.deepgramConnection = { 
            mediaRecorder, 
            stream 
        };
        
        showToast('Dictado iniciado con Deepgram', 'success');
        
        const checkTime = setInterval(() => {
            if (!state.isRecording) {
                clearInterval(checkTime);
                return;
            }
            
            if (Date.now() - state.recordingStartTime >= state.recordingMaxTime) {
                stopChatGPTDictation();
                clearInterval(checkTime);
                showToast('Tiempo máximo de grabación alcanzado (20 minutos)', 'info');
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error iniciando dictado Deepgram:', error);
        showToast('Error al iniciar dictado: ' + error.message, 'error');
        state.isRecording = false;
        document.getElementById('voiceCallBtn')?.classList.remove('active');
        document.getElementById('dictateBtn')?.classList.remove('active');
        state.voiceCallActive = false;
        
        if (state.mediaStream) {
            state.mediaStream.getTracks().forEach(track => track.stop());
            state.mediaStream = null;
        }
    }
}

async function stopChatGPTDictation() {
    state.isRecording = false;
    
    try {
        await window.qwenValencia.deepgramStopLive();
    } catch (error) {
        console.error('Error deteniendo Deepgram:', error);
    }
    
    if (state.deepgramConnection) {
        if (state.deepgramConnection.processor) {
            try {
                state.deepgramConnection.processor.disconnect();
            } catch (e) {}
        }
        if (state.deepgramConnection.source) {
            try {
                state.deepgramConnection.source.disconnect();
            } catch (e) {}
        }
        if (state.deepgramConnection.audioContext) {
            try {
                await state.deepgramConnection.audioContext.close();
            } catch (e) {}
        }
        state.deepgramConnection = null;
    }
    
    if (state.mediaStream) {
        state.mediaStream.getTracks().forEach(track => track.stop());
        state.mediaStream = null;
    }
    
    showToast('Dictado detenido', 'info');
}

async function sendMessageForTTS(transcript) {
    const messages = [...state.messages, { role: 'user', content: transcript }];
    const model = state.model === 'auto' ? getAutoModel(transcript) : state.model;
    
    try {
        const response = await routeToModel(model, transcript);
        
        if (response) {
            // Si hay avatar activo, hacer que hable
            if (avatarSession && window.speakWithAvatar) {
                await window.speakWithAvatar(response);
            } else {
                // Fallback: usar Cartesia TTS
                const voiceId = state.config.cartesiaVoiceId || process.env.CARTESIA_VOICE_ID;
                const ttsResult = await window.qwenValencia.cartesiaTTS({ text: response, voiceId });
                if (ttsResult.success) {
                    const audio = new Audio(`data:audio/${ttsResult.format};base64,${ttsResult.audio}`);
                    audio.play().catch(e => console.warn('Error reproduciendo audio:', e));
                }
            }
        }
    } catch (error) {
        console.error('Error en TTS:', error);
    }
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════

function openSettings() {
    document.getElementById('settingsModal').classList.add('show');
    
    document.getElementById('temperature').value = state.config.temperature;
    document.getElementById('tempValue').textContent = state.config.temperature;
    document.getElementById('maxTokens').value = state.config.maxTokens;
    
    checkMCPStatus();
    checkConnectorsStatus();
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('show');
}

function showPanel(panelId) {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.panel === panelId);
    });
    document.querySelectorAll('.panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === 'panel-' + panelId);
    });
}

function updateTempValue(input) {
    document.getElementById('tempValue').textContent = input.value;
}

function saveSettings() {
    state.config.temperature = parseFloat(document.getElementById('temperature').value);
    state.config.maxTokens = parseInt(document.getElementById('maxTokens').value);
    
    saveConfig();
    closeSettings();
}

async function startMCPServer() {
    try {
        const result = await window.qwenValencia.startMCPMaster();
        if (result.success) {
            document.getElementById('mcpStatus').textContent = 'Conectado';
            document.getElementById('mcpStatus').className = 'mcp-status connected';
            document.getElementById('mcpStartBtn').disabled = true;
            document.getElementById('mcpStopBtn').disabled = false;
            showToast('MCP Server iniciado', 'success');
        } else {
            showToast('Error iniciando MCP: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function stopMCPServer() {
    try {
        const result = await window.qwenValencia.stopMCPMaster();
        if (result.success) {
            document.getElementById('mcpStatus').textContent = 'Desconectado';
            document.getElementById('mcpStatus').className = 'mcp-status';
            document.getElementById('mcpStartBtn').disabled = false;
            document.getElementById('mcpStopBtn').disabled = true;
            showToast('MCP Server detenido', 'info');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function checkMCPStatus() {
    try {
        const status = await window.qwenValencia.getMCPMasterStatus();
        const statusEl = document.getElementById('mcpStatus');
        const startBtn = document.getElementById('mcpStartBtn');
        const stopBtn = document.getElementById('mcpStopBtn');
        
        if (statusEl) {
            if (status.running) {
                statusEl.textContent = 'Conectado';
                statusEl.className = 'mcp-status connected';
            } else {
                statusEl.textContent = 'Desconectado';
                statusEl.className = 'mcp-status';
            }
        }
        
        if (startBtn) {
            startBtn.disabled = status.running;
        }
        
        if (stopBtn) {
            stopBtn.disabled = !status.running;
        }
    } catch (error) {
        console.error('Error verificando MCP:', error);
        // Silenciar error si los elementos no existen
    }
}

async function checkConnectorsStatus() {
    const connectors = ['ollama', 'groq'];
    for (const connector of connectors) {
        try {
            const statusEl = document.getElementById(connector + 'Status');
            if (statusEl) {
                statusEl.textContent = 'Configurado';
                statusEl.className = 'connector-status configured';
            }
        } catch (error) {
            const statusEl = document.getElementById(connector + 'Status');
            if (statusEl) {
                statusEl.textContent = 'Error';
                statusEl.className = 'connector-status error';
            }
        }
    }
}

function addMCPServer() {
    const name = document.getElementById('newServerName').value;
    const command = document.getElementById('newServerCommand').value;
    if (!name || !command) {
        showToast('Por favor completa todos los campos', 'warning');
        return;
    }
    showToast('Funcionalidad próximamente disponible', 'info');
}

// ═══════════════════════════════════════════════════════════════════
// MENU CONTEXTUAL
// ═══════════════════════════════════════════════════════════════════

function initContextMenu() {
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    
    chatMessages.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e.pageX, e.pageY, e.target);
    });
    
    chatInput.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e.pageX, e.pageY, chatInput);
    });
}

function showContextMenu(x, y, target) {
    const menu = document.getElementById('contextMenu');
    if (!menu) return;
    
    menu.style.visibility = 'hidden';
    menu.style.display = 'block';
    menu.classList.add('show');
    
    const menuRect = menu.getBoundingClientRect();
    const menuWidth = menuRect.width;
    const menuHeight = menuRect.height;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    let left = x;
    let top = y;
    
    if (x + menuWidth > windowWidth) {
        left = windowWidth - menuWidth - 10;
    }
    if (left < 10) {
        left = 10;
    }
    
    if (y + menuHeight > windowHeight - 50) {
        top = y - menuHeight - 5;
    } else {
        top = y + 5;
    }
    
    if (top < 10) {
        top = 10;
    }
    
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.style.visibility = 'visible';
    menu.dataset.target = target === document.getElementById('chatInput') ? 'input' : 'message';
}

function hideContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (menu) {
        menu.style.display = 'none';
        menu.classList.remove('show');
    }
}

function contextCopy() {
    const target = document.getElementById('contextMenu').dataset.target;
    if (target === 'input') {
        document.getElementById('chatInput').select();
        document.execCommand('copy');
    } else {
        const selection = window.getSelection().toString();
        if (selection) {
            navigator.clipboard.writeText(selection);
        }
    }
    hideContextMenu();
}

function contextPaste() {
    const target = document.getElementById('contextMenu').dataset.target;
    if (target === 'input') {
        document.getElementById('chatInput').focus();
        document.execCommand('paste');
    }
    hideContextMenu();
}

function contextCut() {
    const target = document.getElementById('contextMenu').dataset.target;
    if (target === 'input') {
        document.getElementById('chatInput').select();
        document.execCommand('cut');
    }
    hideContextMenu();
}

function contextSelectAll() {
    const target = document.getElementById('contextMenu').dataset.target;
    if (target === 'input') {
        document.getElementById('chatInput').select();
    } else {
        window.getSelection().selectAllChildren(document.getElementById('chatMessages'));
    }
    hideContextMenu();
}

// ═══════════════════════════════════════════════════════════════════
// AVATAR INDEPENDENCIA
// ═══════════════════════════════════════════════════════════════════

function initAvatarIndependence() {
    const avatarSection = document.getElementById('avatarSection');
    if (!avatarSection) return;
    
    const avatarControls = avatarSection.querySelectorAll('button');
    avatarControls.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
}

// ═══════════════════════════════════════════════════════════════════
// AVATAR HEYGEN
// ═══════════════════════════════════════════════════════════════════

async function toggleAvatarCall() {
    // HeyGen Avatar deshabilitado temporalmente
    showToast('Avatar HeyGen deshabilitado temporalmente', 'info');
    return;
}

function hangAvatarCall() {
    const callBtn = document.getElementById('avatarCallBtn');
    const hangBtn = document.getElementById('avatarHangBtn');
    const pauseBtn = document.getElementById('avatarPauseBtn');
    const video = document.getElementById('avatarVideo');
    const placeholder = document.getElementById('avatarPlaceholder');
    
    if (avatarInactivityTimer) {
        clearTimeout(avatarInactivityTimer);
        avatarInactivityTimer = null;
    }
    
    // Usar el componente HeyGen Avatar si está disponible
    if (window.stopAvatar) {
        window.stopAvatar();
    } else if (avatarSession) {
        window.qwenValencia.heygenStop();
    }
    
    if (avatarWindow) {
        avatarWindow.close();
        avatarWindow = null;
    }
    
    if (avatarCameraStream) {
        avatarCameraStream.getTracks().forEach(track => track.stop());
        avatarCameraStream = null;
    }
    
    video.src = '';
    video.srcObject = null;
    video.style.display = 'none';
    placeholder.style.display = 'flex';
    
    callBtn.style.display = 'inline-flex';
    hangBtn.style.display = 'none';
    pauseBtn.style.display = 'none';
    
    avatarSession = null;
    
    showToast('Avatar desconectado', 'info');
}

function toggleAvatarPause() {
    avatarPaused = !avatarPaused;
    const video = document.getElementById('avatarVideo');
    if (avatarPaused) {
        video.pause();
        if (window.qwenValencia) {
            window.qwenValencia.heygenInterrupt();
        }
    } else {
        video.play();
    }
}

async function toggleAvatarCamera() {
    if (!avatarCameraStream) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            avatarCameraStream = stream;
        } catch (error) {
            console.error('Error accediendo a cámara:', error);
            alert('Error al acceder a la cámara: ' + error.message);
        }
    } else {
        avatarCameraStream.getTracks().forEach(track => track.stop());
        avatarCameraStream = null;
    }
}

function setAvatarMode(mode) {
    avatarMode = mode;
    const video = document.getElementById('avatarVideo');
    
    if (mode === 'fullscreen') {
        if (!avatarWindow) {
            avatarWindow = window.open('', 'avatar-fullscreen', 'width=800,height=600');
            avatarWindow.document.write(`
                <html>
                    <head><title>Avatar - Pantalla Completa</title></head>
                    <body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;">
                        <video id="avatarVideoFull" autoplay playsinline style="width:100%;height:100%;object-fit:contain;"></video>
                        <script>
                            document.getElementById('avatarVideoFull').src = '${video.src}';
                        </script>
                    </body>
                </html>
            `);
        }
    } else if (mode === 'pip') {
        if (video && video.requestPictureInPicture) {
            video.requestPictureInPicture().then(pipWindow => {
                state.avatarPipActive = true;
                console.log('Picture-in-Picture activado');
            }).catch(err => {
                console.error('Error activando PiP:', err);
                createFloatingAvatarWindow();
            });
        } else {
            createFloatingAvatarWindow();
        }
    } else if (mode === 'share') {
        console.log('Modo compartir pantalla activado');
    }
    
    document.querySelectorAll('.avatar-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
}

function createFloatingAvatarWindow() {
    const video = document.getElementById('avatarVideo');
    if (video && video.src) {
        window.qwenValencia.createFloatingAvatarWindow(video.src);
    }
}

// ═══════════════════════════════════════════════════════════════════
// SIDEBAR COLAPSABLE
// ═══════════════════════════════════════════════════════════════════

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const isCollapsed = sidebar.classList.toggle('collapsed');
    
    if (isCollapsed) {
        sidebar.style.width = '60px';
        document.querySelectorAll('.sidebar-text, .history-title, .new-chat-btn span').forEach(el => {
            if (el) el.style.display = 'none';
        });
        document.getElementById('collapseIcon').textContent = '›';
    } else {
        sidebar.style.width = '220px';
        document.querySelectorAll('.sidebar-text, .history-title').forEach(el => {
            if (el) el.style.display = '';
        });
        const newChatBtn = document.querySelector('.new-chat-btn');
        if (newChatBtn) newChatBtn.innerHTML = '+ Nuevo chat';
        document.getElementById('collapseIcon').textContent = '‹';
    }
    
    localStorage.setItem('sidebarCollapsed', isCollapsed);
}

// ═══════════════════════════════════════════════════════════════════
// MENUS
// ═══════════════════════════════════════════════════════════════════

function initMenus() {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const menu = item.dataset.menu;
            const dropdown = document.getElementById(`menu${menu.charAt(0).toUpperCase() + menu.slice(1)}`);
            
            document.querySelectorAll('.menu-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.remove('show');
            });
            
            dropdown.classList.toggle('show');
        });
    });
    
    document.addEventListener('click', () => {
        document.querySelectorAll('.menu-dropdown').forEach(d => d.classList.remove('show'));
    });
}

function openChat() {
    alert('Funcionalidad de abrir chat próximamente');
}

function saveChat() {
    const chatData = {
        messages: state.messages,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('currentChat', JSON.stringify(chatData));
    alert('Chat guardado');
}

function saveChatAs() {
    alert('Funcionalidad de guardar como próximamente');
}

function exportChat() {
    const chatData = {
        messages: state.messages,
        timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function executeCode() {
    alert('Funcionalidad de ejecutar código próximamente');
}

function executeCommand() {
    alert('Funcionalidad de ejecutar comando próximamente');
}

function openTerminal() {
    alert('Funcionalidad de terminal próximamente');
}

function toggleTerminal() {
    alert('Funcionalidad de terminal próximamente');
}

// ═══════════════════════════════════════════════════════════════════
// VERIFICACIÓN DE DEEPGRAM
// ═══════════════════════════════════════════════════════════════════

async function checkDeepgramAvailability() {
    try {
        if (!window.qwenValencia) {
            state.deepgramAvailable = false;
            enableTextOnlyMode();
            return;
        }
        
        state.deepgramAvailable = true;
        updateVoiceButtons();
    } catch (error) {
        console.warn('Deepgram no disponible:', error);
        state.deepgramAvailable = false;
        enableTextOnlyMode();
    }
}

function enableTextOnlyMode() {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.disabled = false;
        chatInput.placeholder = 'Escribe tu mensaje (voz no disponible)...';
    }
    
    updateVoiceButtons();
}

function updateVoiceButtons() {
    const voiceButtons = document.querySelectorAll('.voice-btn, #voiceCallBtn, #avatarCallBtn, #dictateBtn');
    voiceButtons.forEach(btn => {
        if (btn) {
            if (!state.deepgramAvailable) {
                btn.disabled = true;
                btn.classList.add('disabled');
                btn.title = 'Servicio de voz no disponible';
            } else {
                btn.disabled = false;
                btn.classList.remove('disabled');
            }
        }
    });
}

if (window.qwenValencia) {
    window.qwenValencia.onDeepgramError((error) => {
        console.error('Error Deepgram:', error);
        state.deepgramAvailable = false;
        enableTextOnlyMode();
        showToast('Servicio de voz no disponible. Puedes seguir escribiendo.', 'warning');
    });
}

// ═══════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════

function showToast(message, type = 'info') {
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        padding: 12px 16px;
        background: ${type === 'error' ? '#e81123' : type === 'warning' ? '#ff8c00' : '#0066cc'};
        color: white;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        font-size: 13px;
        max-width: 300px;
        animation: slideIn 0.3s ease;
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ═══════════════════════════════════════════════════════════════════
// API TOGGLE - Cambiar entre API (Groq) y Ollama Local
// ═══════════════════════════════════════════════════════════════════

function toggleAPI() {
    const toggle = document.getElementById('apiToggle');
    const text = document.getElementById('apiToggleText');
    
    state.useAPI = toggle.checked;
    
    if (state.useAPI) {
        text.textContent = 'API';
        text.style.color = '#4CAF50';
        console.log('✅ Modo API activado (Groq - rápido)');
    } else {
        text.textContent = 'Local';
        text.style.color = '#FF9800';
        console.log('🔄 Modo Local activado (Ollama)');
    }
    
    localStorage.setItem('useAPI', state.useAPI);
}

// ═══════════════════════════════════════════════════════════════════
// MICRÓFONO PARA CHAT - Llamadas Conversacionales
// ═══════════════════════════════════════════════════════════════════

async function toggleMic() {
    const micBtn = document.getElementById('micBtn');
    
    if (!state.micActive) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.micStream = stream;
            state.micActive = true;
            
            state.micRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            
            const audioChunks = [];
            
            state.micRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };
            
            state.micRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                
                if (state.deepgramAvailable && window.qwenValencia && window.qwenValencia.deepgramTranscribe) {
                    try {
                        const audioArrayBuffer = await audioBlob.arrayBuffer();
                        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioArrayBuffer)));
                        
                        const result = await window.qwenValencia.deepgramTranscribe({
                            audio: base64Audio,
                            mimeType: 'audio/webm'
                        });
                        
                        if (result && result.success && result.transcript) {
                            const input = document.getElementById('chatInput');
                            input.value = result.transcript;
                            sendMessage();
                        }
                    } catch (error) {
                        console.error('Error transcribiendo:', error);
                    }
                } else {
                    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
                    recognition.lang = 'es-ES';
                    recognition.continuous = false;
                    recognition.interimResults = false;
                    
                    recognition.onresult = (event) => {
                        const transcript = event.results[0][0].transcript;
                        const input = document.getElementById('chatInput');
                        input.value = transcript;
                        sendMessage();
                    };
                    
                    recognition.onerror = (error) => {
                        console.error('Error en reconocimiento de voz:', error);
                    };
                    
                    recognition.start();
                }
                
                audioChunks.length = 0;
            };
            
            state.micRecorder.start();
            
            micBtn.classList.add('mic-active');
            micBtn.title = 'Detener micrófono';
            
            console.log('🎤 Micrófono activado');
        } catch (error) {
            console.error('Error activando micrófono:', error);
            alert('No se pudo acceder al micrófono. Verifica los permisos.');
        }
    } else {
        if (state.micRecorder && state.micRecorder.state !== 'inactive') {
            state.micRecorder.stop();
        }
        
        if (state.micStream) {
            state.micStream.getTracks().forEach(track => track.stop());
            state.micStream = null;
        }
        
        state.micActive = false;
        state.micRecorder = null;
        
        micBtn.classList.remove('mic-active');
        micBtn.title = 'Micrófono para Chat';
        
        console.log('🔇 Micrófono desactivado');
    }
}

// ═══════════════════════════════════════════════════════════════════
// EXPOSICIÓN GLOBAL DE FUNCIONES
// ═══════════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
    // Funciones básicas
    window.toggleTheme = toggleTheme;
    window.toggleModelMenu = toggleModelMenu;
    window.selectModel = selectModel;
    window.setMode = setMode;
    window.handleKeydown = handleKeydown;
    window.autoResize = autoResize;
    window.sendMessage = sendMessage;
    window.stopGeneration = stopGeneration;
    
    // Imágenes y archivos
    window.attachImage = attachImage;
    window.openFileSelector = openFileSelector;
    window.handleFileSelect = handleFileSelect;
    window.removeAttachment = removeAttachment;
    window.openCamera = openCamera;
    window.closeCamera = closeCamera;
    window.capturePhoto = capturePhoto;
    
    // Voz y dictado
    window.toggleVoice = toggleVoice;
    window.toggleDictation = toggleDictation;
    window.startVoiceCall = startVoiceCall;
    window.startAvatarCall = startAvatarCall;
    
    // Inicializar event listeners de la barra de chat
    initChatInputListeners();
    
    // Chat y mensajes
    window.newChat = newChat;
    
    // Settings
    window.openSettings = openSettings;
    window.closeSettings = closeSettings;
    window.showPanel = showPanel;
    window.updateTempValue = updateTempValue;
    window.saveSettings = saveSettings;
    
    // MCP Functions
    window.startMCPServer = startMCPServer;
    window.stopMCPServer = stopMCPServer;
    window.checkMCPStatus = checkMCPStatus;
    window.addMCPServer = addMCPServer;
    
    // Camera Functions
    window.openCameraForIA = openCameraForIA;
    window.closeCameraModal = closeCameraModal;
    window.captureImageForIA = captureImageForIA;
    
    // Context menu
    window.contextCopy = contextCopy;
    window.contextPaste = contextPaste;
    window.contextCut = contextCut;
    window.contextSelectAll = contextSelectAll;
    
    // Avatar
    window.toggleAvatarCall = toggleAvatarCall;
    window.hangAvatarCall = hangAvatarCall;
    window.toggleAvatarPause = toggleAvatarPause;
    window.toggleAvatarCamera = toggleAvatarCamera;
    window.setAvatarMode = setAvatarMode;
    
    // Modelos
    window.handleModelClick = handleModelClick;
    window.toggleModelCheckbox = toggleModelCheckbox;
    window.filterModels = filterModels;
    window.toggleAutoMode = toggleAutoMode;
    window.toggleMaxMode = toggleMaxMode;
    window.toggleMultiModel = toggleMultiModel;
    window.showAddModelModal = showAddModelModal;
    
    // Menús
    window.toggleSidebar = toggleSidebar;
    window.openChat = openChat;
    window.saveChat = saveChat;
    window.saveChatAs = saveChatAs;
    window.exportChat = exportChat;
    window.executeCode = executeCode;
    window.executeCommand = executeCommand;
    window.openTerminal = openTerminal;
    window.toggleTerminal = toggleTerminal;
    
    // API Toggle
    window.toggleAPI = toggleAPI;
    
    // Micrófono
    window.toggleMic = toggleMic;
    
    // Dropdowns de barra única
    window.toggleModeDropdown = toggleModeDropdown;
    window.closeModeDropdown = closeModeDropdown;
}

// Función para inicializar event listeners de la barra de chat
function initChatInputListeners() {
    // Event listener para textarea
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', handleKeydown);
        chatInput.addEventListener('input', function() {
            autoResize(this);
        });
    }
    
    // Event listeners para botones
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn && !sendBtn.hasAttribute('data-listener-added')) {
        sendBtn.addEventListener('click', sendMessage);
        sendBtn.setAttribute('data-listener-added', 'true');
    }
    
    const dictateBtn = document.getElementById('dictateBtn');
    if (dictateBtn && !dictateBtn.hasAttribute('data-listener-added')) {
        dictateBtn.addEventListener('click', toggleDictation);
        dictateBtn.setAttribute('data-listener-added', 'true');
    }
    
    const voiceCallBtn = document.getElementById('voiceCallBtn');
    if (voiceCallBtn && !voiceCallBtn.hasAttribute('data-listener-added')) {
        voiceCallBtn.addEventListener('click', startVoiceCall);
        voiceCallBtn.setAttribute('data-listener-added', 'true');
    }
    
    // Cerrar menú de modelos al hacer click fuera
    document.addEventListener('click', function(e) {
        const modelMenu = document.getElementById('modelMenu');
        const modelDropdown = document.getElementById('modelDropdown');
        
        if (modelMenu && modelMenu.classList.contains('show')) {
            if (!modelDropdown || !modelDropdown.contains(e.target)) {
                if (!e.target.closest('.model-menu')) {
                    modelMenu.classList.remove('show');
                }
            }
        }
    });
}

console.log('✅ Qwen-Valencia app.js cargado correctamente');

