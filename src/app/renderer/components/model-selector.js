// ═══════════════════════════════════════════════════════════════════
// MODEL SELECTOR - Qwen-Valencia
// Sistema de selección de modelos adaptado para Qwen/DeepSeek
// ═══════════════════════════════════════════════════════════════════

class ModelSelector {
    constructor() {
        this.menu = null;
        this.button = null;
        this.isOpen = false;
        this.currentModel = 'qwen2.5:7b-instruct';
        this.selectedModels = [];
        this.multiModel = false;
        this.autoMode = false;
        
        this.init();
    }
    
    init() {
        this.menu = document.getElementById('modelMenu');
        this.button = document.querySelector('.model-btn') || document.querySelector('#modelDropdown');
        
        if (!this.menu || !this.button) {
            console.warn('⚠️ Model selector elements not found, reintentando...', {
                menu: !!this.menu,
                button: !!this.button
            });
            setTimeout(() => this.init(), 100);
            return;
        }
        
        // Cargar estado guardado
        const savedModel = localStorage.getItem('selectedModel') || 'qwen2.5:7b-instruct';
        this.currentModel = savedModel;
        
        // Cargar modelos seleccionados
        const savedModels = localStorage.getItem('selectedModels');
        if (savedModels) {
            try {
                this.selectedModels = JSON.parse(savedModels);
            } catch (e) {
                this.selectedModels = [];
            }
        }
        
        // Cargar multi-model y auto-mode
        this.multiModel = localStorage.getItem('multiModel') === 'true';
        this.autoMode = localStorage.getItem('autoMode') !== 'false';
        
        this.setupEventListeners();
        this.renderModelList();
        this.updateButtonDisplay();
        
        console.log('✅ ModelSelector inicializado correctamente');
    }
    
    setupEventListeners() {
        // Cerrar menú al hacer click fuera
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.model-dropdown') && !e.target.closest('.model-tooltip')) {
                this.closeMenu();
            }
        });
        
        // Buscador de modelos
        const searchInput = document.getElementById('modelSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterModels(e.target.value);
            });
        }
        
        // Toggles
        const autoToggle = document.getElementById('autoToggle');
        if (autoToggle) {
            autoToggle.addEventListener('change', (e) => {
                this.toggleAutoMode(e.target.checked);
            });
        }
        
        const multiModelToggle = document.getElementById('multiModelToggle');
        if (multiModelToggle) {
            multiModelToggle.addEventListener('change', (e) => {
                this.toggleMultiModel(e.target.checked);
            });
        }
        
        const maxToggle = document.getElementById('maxToggle');
        if (maxToggle) {
            maxToggle.addEventListener('change', (e) => {
                this.toggleMaxMode(e.target.checked);
            });
        }
    }
    
    toggleMenu() {
        if (this.isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }
    
    openMenu() {
        if (!this.menu || !this.button) {
            console.warn('⚠️ No se puede abrir el menú: elementos no encontrados');
            return;
        }
        
        const rect = this.button.getBoundingClientRect();
        const menuHeight = 600;
        const menuWidth = 360;
        
        let left = rect.left;
        let bottom = window.innerHeight - rect.top + 8;
        
        if (left < 16) {
            left = 16;
        }
        
        if (left + menuWidth > window.innerWidth - 16) {
            left = window.innerWidth - menuWidth - 16;
        }
        
        if (bottom + menuHeight > window.innerHeight - 16) {
            bottom = menuHeight + 16;
        }
        
        this.menu.style.cssText = `
            position: fixed !important;
            left: ${left}px !important;
            bottom: ${bottom}px !important;
            top: auto !important;
            right: auto !important;
            width: ${menuWidth}px !important;
            z-index: 99999999 !important;
            display: flex !important;
            flex-direction: column !important;
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
        `;
        
        this.menu.classList.add('show');
        this.isOpen = true;
        
        // Focus en buscador
        const searchInput = document.getElementById('modelSearch');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 100);
        }
    }
    
    closeMenu() {
        if (this.menu) {
            this.menu.classList.remove('show');
            this.menu.style.cssText = '';
        }
        this.isOpen = false;
        this.hideTooltip();
    }
    
    renderModelList() {
        const container = document.getElementById('modelListScroll');
        if (!container) return;
        
        // Usar MODELS de app.js (objeto plano)
        // eslint-disable-next-line no-undef
        const MODELS_REF = window.MODELS || (typeof MODELS !== 'undefined' ? MODELS : {});
        
        // Filtrar solo modelos Qwen/DeepSeek (excluir 'auto')
        const modelKeys = Object.keys(MODELS_REF).filter(k => k !== 'auto');
        
        // Agrupar por proveedor para mejor organización
        const systemModels = []; // Sandra IA y QWEN Valencia
        const ollamaModels = [];
        const groqModels = [];
        
        modelKeys.forEach(modelId => {
            const model = MODELS_REF[modelId];
            if (!model) return;
            
            // Sistemas principales (Sandra IA y QWEN Valencia)
            if (modelId === 'sandra-ia-8.0' || modelId === 'qwen-valencia') {
                systemModels.push({ id: modelId, model });
            } else if (model.provider === 'Ollama') {
                ollamaModels.push({ id: modelId, model });
            } else if (model.provider === 'Groq') {
                groqModels.push({ id: modelId, model });
            }
        });
        
        // Preparar items para renderizado (con separadores)
        const items = [];
        
        // Sistemas principales primero
        if (systemModels.length > 0) {
            items.push({ type: 'header', text: 'Sistemas de IA', key: 'header-systems' });
            systemModels.forEach(({ id, model }) => {
                items.push({ type: 'model', id, model, key: id });
            });
            if (ollamaModels.length > 0 || groqModels.length > 0) {
                items.push({ type: 'divider', key: 'divider-systems' });
            }
        }
        
        if (ollamaModels.length > 0) {
            items.push({ type: 'header', text: 'Ollama Local', key: 'header-ollama' });
            ollamaModels.forEach(({ id, model }) => {
                items.push({ type: 'model', id, model, key: id });
            });
        }
        
        if (groqModels.length > 0) {
            if (ollamaModels.length > 0) {
                items.push({ type: 'divider', key: 'divider-groq' });
            }
            items.push({ type: 'header', text: 'Groq API', key: 'header-groq' });
            groqModels.forEach(({ id, model }) => {
                items.push({ type: 'model', id, model, key: id });
            });
        }
        
        // Usar actualización incremental si está disponible
        if (typeof window !== 'undefined' && window.updateListIncremental) {
            const result = window.updateListIncremental(
                container,
                items,
                (item) => this.renderModelItem(item),
                (item) => item.key,
                {
                    itemSelector: '[data-key]',
                    keyAttribute: 'data-key',
                    preserveOrder: true
                }
            );
            
            // FIX: Verificar que result existe y que el total de elementos procesados coincida con items.length
            // result.total incluye todos los elementos procesados (headers, dividers, modelos)
            // items.length incluye headers, dividers y modelos
            // Por lo tanto, result.total debería coincidir con items.length
            if (!result || result.total !== items.length) {
                // Fallback: renderización completa si la actualización incremental falló o no produjo el resultado esperado
                this.renderModelListFull(container, items);
            } else {
                // FIX: Verificar conteo real usando el mismo selector que updateListIncremental configuró
                // itemSelector es '[data-key]' y items incluye headers, dividers y modelos (todos tienen data-key)
                // Comparar result.total (elementos procesados) con actualCount (elementos en DOM con data-key)
                const actualCount = container.querySelectorAll('[data-key]').length;
                if (actualCount !== result.total) {
                    // Si el conteo en el DOM no coincide con result.total, ejecutar fallback
                    // Esto puede ocurrir si algunos elementos no se renderizaron correctamente
                    this.renderModelListFull(container, items);
                }
            }
        } else {
            // Fallback: renderización completa
            this.renderModelListFull(container, items);
        }
    }
    
    /**
     * Renderiza un item individual (modelo, header o divider)
     */
    renderModelItem(item) {
        if (item.type === 'header') {
            const header = document.createElement('div');
            header.className = 'model-group-header';
            header.textContent = item.text;
            header.setAttribute('data-key', item.key);
            return header;
        }
        
        if (item.type === 'divider') {
            const divider = document.createElement('div');
            divider.className = 'model-group-divider';
            divider.setAttribute('data-key', item.key);
            return divider;
        }
        
        if (item.type === 'model') {
            const { id, model } = item;
            const isActive = this.currentModel === id;
            const isSelected = this.selectedModels.includes(id);
            
            // Crear elementos de forma segura sin innerHTML
            const div = document.createElement('div');
            div.className = `model-item-compact ${isActive ? 'active' : ''}`;
            div.setAttribute('data-model', id);
            div.setAttribute('data-key', id);
            div.setAttribute('data-provider', model.provider || '');
            div.setAttribute('data-tokens', String(model.tokens || 'N/A'));
            div.setAttribute('data-category', model.category || 'General');
            div.setAttribute('data-capabilities', JSON.stringify(model.capabilities || []));
            div.setAttribute('data-description', (model.description || '').replace(/"/g, '&quot;'));
            
            // Checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'model-checkbox';
            if (isSelected || isActive) checkbox.checked = true;
            if (!this.multiModel) checkbox.style.display = 'none';
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSelection(id, checkbox);
            });
            
            // Nombre del modelo
            const nameSpan = document.createElement('span');
            nameSpan.className = 'model-name-compact';
            nameSpan.textContent = model.compact || model.name || id;
            
            // Badge de proveedor
            const badgeSpan = document.createElement('span');
            badgeSpan.className = 'model-provider-badge';
            badgeSpan.textContent = model.provider || '';
            
            // Event listeners
            div.addEventListener('mouseenter', (e) => {
                this.showTooltip(e, div);
            });
            div.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
            div.addEventListener('click', (e) => {
                this.selectModel(id, e);
            });
            
            div.appendChild(checkbox);
            div.appendChild(nameSpan);
            div.appendChild(badgeSpan);
            
            return div;
        }
        
        return null;
    }
    
    /**
     * Renderización completa (fallback)
     */
    renderModelListFull(container, items) {
        const fragment = document.createDocumentFragment();
        
        items.forEach(item => {
            const element = this.renderModelItem(item);
            if (element) {
                fragment.appendChild(element);
            }
        });
        
        container.innerHTML = '';
        container.appendChild(fragment);
    }
    
    selectModel(modelId, event) {
        if (event) {
            event.stopPropagation();
        }
        
        if (!modelId) return;
        
        // Usar función global selectModel si existe (de app.js)
        if (window.selectModel) {
            window.selectModel(modelId);
        } else {
            this.currentModel = modelId;
            localStorage.setItem('selectedModel', modelId);
            
            // Actualizar UI
            document.querySelectorAll('.model-item-compact').forEach(item => {
                item.classList.remove('active');
            });
            const selectedItem = document.querySelector(`[data-model="${modelId}"]`);
            if (selectedItem) {
                selectedItem.classList.add('active');
            }
            
            this.updateButtonDisplay();
        }
        
        this.closeMenu();
        
        console.log(`✅ Modelo seleccionado: ${modelId}`);
    }
    
    toggleSelection(modelId, checkbox) {
        if (checkbox.checked) {
            if (!this.selectedModels.includes(modelId)) {
                this.selectedModels.push(modelId);
            }
            
            if (!this.multiModel) {
                // Modo single: deseleccionar otros
                this.selectedModels = [modelId];
                document.querySelectorAll('.model-checkbox').forEach(cb => {
                    if (cb !== checkbox) cb.checked = false;
                });
                // Seleccionar este modelo
                this.selectModel(modelId);
            }
        } else {
            this.selectedModels = this.selectedModels.filter(id => id !== modelId);
        }
        
        // Guardar modelos seleccionados
        try {
            localStorage.setItem('selectedModels', JSON.stringify(this.selectedModels));
        } catch (e) {
            console.error('Error guardando modelos seleccionados:', e);
        }
        
        // Actualizar estado global si existe
        if (window.state) {
            window.state.selectedModels = this.selectedModels;
        }
    }
    
    toggleAutoMode(enabled) {
        this.autoMode = enabled;
        localStorage.setItem('autoMode', enabled);
        
        if (enabled) {
            this.currentModel = 'auto';
            this.updateButtonDisplay();
            
            // Llamar función global si existe
            if (window.toggleAutoMode) {
                window.toggleAutoMode(enabled);
            }
        }
    }
    
    toggleMaxMode(enabled) {
        localStorage.setItem('maxMode', enabled);
        
        // Llamar función global si existe
        if (window.toggleMaxMode) {
            window.toggleMaxMode(enabled);
        }
    }
    
    toggleMultiModel(enabled) {
        this.multiModel = enabled;
        localStorage.setItem('multiModel', enabled);
        
        // Mostrar/ocultar checkboxes
        document.querySelectorAll('.model-checkbox').forEach(cb => {
            cb.style.display = enabled ? 'block' : 'none';
        });
        
        if (!enabled && this.selectedModels.length > 0) {
            const first = this.selectedModels[0];
            this.currentModel = first;
            this.selectedModels = [first];
            this.updateButtonDisplay();
            this.renderModelList();
        }
        
        // Actualizar estado global si existe
        if (window.state) {
            window.state.multiModel = enabled;
            window.state.selectedModels = this.selectedModels;
        }
    }
    
    filterModels(term) {
        const items = document.querySelectorAll('.model-item-compact');
        const searchTerm = term.toLowerCase().trim();
        
        if (!searchTerm) {
            items.forEach(item => {
                item.style.display = 'flex';
            });
            return;
        }
        
        items.forEach(item => {
            const modelId = item.dataset.model || '';
            const provider = item.dataset.provider || '';
            const category = item.dataset.category || '';
            const name = item.querySelector('.model-name-compact')?.textContent || '';
            
            const searchText = `${modelId} ${provider} ${category} ${name}`.toLowerCase();
            item.style.display = searchText.includes(searchTerm) ? 'flex' : 'none';
        });
        
        // Ocultar headers de grupo si no hay modelos visibles en ese grupo
        const headers = document.querySelectorAll('.model-group-header');
        headers.forEach(header => {
            const group = header.nextElementSibling;
            let hasVisible = false;
            let current = group;
            while (current && !current.classList.contains('model-group-divider') && !current.classList.contains('model-group-header')) {
                if (current.classList.contains('model-item-compact') && current.style.display !== 'none') {
                    hasVisible = true;
                    break;
                }
                current = current.nextElementSibling;
            }
            header.style.display = hasVisible ? 'block' : 'none';
        });
    }
    
    updateButtonDisplay() {
        const modelNameSpan = document.getElementById('modelName');
        
        if (modelNameSpan) {
            // eslint-disable-next-line no-undef
            const MODELS_REF = window.MODELS || (typeof MODELS !== 'undefined' ? MODELS : {});
            
            if (this.currentModel === 'auto' || this.autoMode) {
                modelNameSpan.textContent = 'Auto';
            } else {
                const model = MODELS_REF[this.currentModel];
                if (model) {
                    modelNameSpan.textContent = model.compact || model.name;
                } else {
                    modelNameSpan.textContent = this.currentModel;
                }
            }
        }
        
        // Actualizar botón principal
        const modelButton = document.getElementById('modelDropdown');
        if (modelButton) {
            if (this.currentModel === 'auto' || this.autoMode) {
                modelButton.classList.add('auto-mode');
            } else {
                modelButton.classList.remove('auto-mode');
            }
        }
    }
    
    showTooltip(event, element) {
        clearTimeout(this.tooltipTimeout);
        
        this.tooltipTimeout = setTimeout(() => {
            const tooltip = document.getElementById('modelTooltip');
            if (!tooltip || !element) return;
            
            const modelId = element.dataset.model || '';
            const provider = element.dataset.provider || '';
            const tokens = element.dataset.tokens || 'N/A';
            const category = element.dataset.category || '';
            const capabilities = JSON.parse(element.dataset.capabilities || '[]');
            const description = element.dataset.description || '';
            
            // eslint-disable-next-line no-undef
            const MODELS_REF = window.MODELS || (typeof MODELS !== 'undefined' ? MODELS : {});
            const model = MODELS_REF[modelId];
            const modelName = model?.name || modelId;
            
            // Actualizar contenido
            const tooltipProvider = tooltip.querySelector('.tooltip-provider');
            const tooltipName = tooltip.querySelector('.tooltip-name');
            const tooltipTokens = tooltip.querySelector('.tooltip-tokens');
            const tooltipCategory = tooltip.querySelector('.tooltip-category');
            const tooltipCapabilities = tooltip.querySelector('.tooltip-capabilities');
            const tooltipDescription = tooltip.querySelector('.tooltip-description');
            
            if (tooltipProvider) tooltipProvider.textContent = provider;
            if (tooltipName) tooltipName.textContent = modelName;
            if (tooltipTokens) {
                const tokensText = tokens === 'N/A' || tokens === '-' || tokens === 'Ilimitado' 
                    ? 'Contexto: Ilimitado' 
                    : `Contexto: ${tokens} tokens`;
                tooltipTokens.textContent = tokensText;
            }
            if (tooltipCategory) tooltipCategory.textContent = `Categoría: ${category || 'General'}`;
            
            if (tooltipCapabilities && capabilities.length > 0) {
                tooltipCapabilities.innerHTML = `
                    <strong>Capacidades:</strong>
                    <ul>
                        ${capabilities.map(cap => `<li>${cap}</li>`).join('')}
                    </ul>
                `;
                tooltipCapabilities.style.display = 'block';
            } else if (tooltipCapabilities) {
                tooltipCapabilities.style.display = 'none';
            }
            
            if (tooltipDescription) {
                if (description) {
                    tooltipDescription.textContent = description;
                    tooltipDescription.style.display = 'block';
                } else {
                    tooltipDescription.style.display = 'none';
                }
            }
            
            // Posicionar tooltip
            const rect = element.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            
            let left = rect.right + 12;
            let top = rect.top;
            
            if (left + tooltipRect.width > window.innerWidth - 16) {
                left = rect.left - tooltipRect.width - 12;
            }
            
            if (top + tooltipRect.height > window.innerHeight - 16) {
                top = window.innerHeight - tooltipRect.height - 16;
            }
            
            if (top < 16) {
                top = 16;
            }
            
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
            tooltip.classList.add('show');
        }, 300);
    }
    
    hideTooltip() {
        if (this.tooltipTimeout) {
            clearTimeout(this.tooltipTimeout);
            this.tooltipTimeout = null;
        }
        
        const tooltip = document.getElementById('modelTooltip');
        if (tooltip) {
            tooltip.classList.remove('show');
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════════

let modelSelector = null;
let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 20;

function initModelSelector() {
    // Verificar que MODELS esté disponible (definido en app.js)
    if (!window.MODELS || typeof window.MODELS !== 'object') {
        initAttempts++;
        if (initAttempts < MAX_INIT_ATTEMPTS) {
            setTimeout(initModelSelector, 100);
            return;
        } else {
            console.error('❌ MODELS no disponible después de múltiples intentos');
            return;
        }
    }
    
    // Verificar que los elementos DOM existan
    const menu = document.getElementById('modelMenu');
    const button = document.querySelector('.model-btn') || document.querySelector('#modelDropdown');
    
    if (!menu || !button) {
        initAttempts++;
        if (initAttempts < MAX_INIT_ATTEMPTS) {
            setTimeout(initModelSelector, 100);
            return;
        } else {
            console.error('❌ Elementos DOM no encontrados después de múltiples intentos');
            return;
        }
    }
    
    // Inicializar solo una vez
    if (!modelSelector) {
        try {
            modelSelector = new ModelSelector();
            window.modelSelector = modelSelector;
            
            // Exponer toggleModelMenu globalmente
            window.toggleModelMenu = () => {
                if (modelSelector) {
                    modelSelector.toggleMenu();
                } else {
                    console.warn('⚠️ ModelSelector no inicializado aún');
                }
            };
            
            console.log('✅ ModelSelector inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando ModelSelector:', error);
        }
    }
}

// Inicializar cuando TODO esté listo
(function() {
    let tryInitTimeout = null;
    let loadTimeout = null;
    
    const tryInit = () => {
        if (tryInitTimeout) {
            clearTimeout(tryInitTimeout);
            tryInitTimeout = null;
        }
        
        if (document.readyState === 'complete' && window.MODELS) {
            initModelSelector();
        } else if (document.readyState === 'interactive' || document.readyState === 'complete') {
            tryInitTimeout = setTimeout(tryInit, 50);
        }
    };
    
    const cleanup = () => {
        if (tryInitTimeout) {
            clearTimeout(tryInitTimeout);
            tryInitTimeout = null;
        }
        if (loadTimeout) {
            clearTimeout(loadTimeout);
            loadTimeout = null;
        }
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            tryInitTimeout = setTimeout(tryInit, 150);
        });
    } else {
        tryInitTimeout = setTimeout(tryInit, 150);
    }
    
    window.addEventListener('load', () => {
        loadTimeout = setTimeout(() => {
            if (!modelSelector && window.MODELS) {
                initModelSelector();
            }
            loadTimeout = null;
        }, 100);
    });
    
    window.cleanupModelSelectorInit = cleanup;
})();

console.log('✅ Qwen-Valencia model-selector.js cargado');

