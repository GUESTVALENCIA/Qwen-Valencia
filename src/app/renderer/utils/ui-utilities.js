/**
 * ════════════════════════════════════════════════════════════════════════════
 * UI UTILITIES - Utilidades de Interfaz de Usuario
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Centraliza funciones de UI: tooltips, context menu, modales
 */

/**
 * ============================================================================
 * TOOLTIPS
 * ============================================================================
 */

/**
 * Inicializa tooltips para modelos
 * @param {Object} MODELS - Objeto con información de modelos
 */
function initModelTooltips(MODELS) {
    let tooltip = document.getElementById('modelTooltip');
    if (!tooltip) {
        tooltip = createTooltipElement();
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
    
    // Event listeners
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

/**
 * Crea el elemento tooltip
 * @returns {HTMLElement} Elemento tooltip
 */
function createTooltipElement() {
    const tooltip = document.createElement('div');
    tooltip.id = 'modelTooltip';
    tooltip.className = 'model-tooltip';
    
    // Crear estructura de forma segura sin innerHTML
    const header = document.createElement('div');
    header.className = 'tooltip-header';
    
    const providerEl = document.createElement('div');
    providerEl.className = 'tooltip-provider';
    
    const nameEl = document.createElement('div');
    nameEl.className = 'tooltip-name';
    
    header.appendChild(providerEl);
    header.appendChild(nameEl);
    
    const tokensEl = document.createElement('div');
    tokensEl.className = 'tooltip-tokens';
    
    const categoryEl = document.createElement('div');
    categoryEl.className = 'tooltip-category';
    
    const capabilitiesEl = document.createElement('div');
    capabilitiesEl.className = 'tooltip-capabilities';
    
    const descriptionEl = document.createElement('div');
    descriptionEl.className = 'tooltip-description';
    
    tooltip.appendChild(header);
    tooltip.appendChild(tokensEl);
    tooltip.appendChild(categoryEl);
    tooltip.appendChild(capabilitiesEl);
    tooltip.appendChild(descriptionEl);
    
    document.body.appendChild(tooltip);
    return tooltip;
}

/**
 * Actualiza el contenido del tooltip
 * @param {HTMLElement} tooltip - Elemento tooltip
 * @param {Object} model - Información del modelo
 */
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
    
    if (categoryEl) {
        categoryEl.textContent = `Categoría: ${model.category || 'General'}`;
    }
    
    if (capabilitiesEl) {
        if (model.capabilities && model.capabilities.length > 0) {
            // Limpiar contenido previo
            capabilitiesEl.innerHTML = '';
            
            // Crear elementos de forma segura
            const strong = document.createElement('strong');
            strong.textContent = 'Capacidades:';
            capabilitiesEl.appendChild(strong);
            
            const br = document.createElement('br');
            capabilitiesEl.appendChild(br);
            
            const text = document.createTextNode(model.capabilities.join(', '));
            capabilitiesEl.appendChild(text);
            
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

/**
 * Posiciona el tooltip
 * @param {Event} e - Evento del mouse
 * @param {HTMLElement} tooltip - Elemento tooltip
 */
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
    
    // Ajustar posición horizontal
    if (left + tooltipWidth > window.innerWidth - 10) {
        left = rect.left - tooltipWidth - 10;
    }
    if (left < 10) {
        left = 10;
    }
    
    // Ajustar posición vertical
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

/**
 * ============================================================================
 * CONTEXT MENU
 * ============================================================================
 */

/**
 * Inicializa el menú contextual
 */
function initContextMenu() {
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    
    if (chatMessages) {
        chatMessages.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e.pageX, e.pageY, e.target);
        });
    }
    
    if (chatInput) {
        chatInput.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e.pageX, e.pageY, chatInput);
        });
    }
}

/**
 * Muestra el menú contextual
 * @param {number} x - Posición X
 * @param {number} y - Posición Y
 * @param {HTMLElement} target - Elemento objetivo
 */
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
    
    // Calcular posición
    let left = x;
    let top = y;
    
    // Ajustar horizontalmente
    if (x + menuWidth > windowWidth) {
        left = windowWidth - menuWidth - 10;
    }
    if (left < 10) {
        left = 10;
    }
    
    // Ajustar verticalmente
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

/**
 * Oculta el menú contextual
 */
function hideContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (menu) {
        menu.style.display = 'none';
        menu.classList.remove('show');
    }
}

/**
 * Copia texto al portapapeles
 */
function contextCopy() {
    const target = document.getElementById('contextMenu')?.dataset.target;
    if (target === 'input') {
        const input = document.getElementById('chatInput');
        if (input) {
            input.select();
            document.execCommand('copy');
        }
    } else {
        const selection = window.getSelection().toString();
        if (selection) {
            navigator.clipboard.writeText(selection);
        }
    }
    hideContextMenu();
}

/**
 * Pega texto del portapapeles
 */
function contextPaste() {
    const target = document.getElementById('contextMenu')?.dataset.target;
    if (target === 'input') {
        const input = document.getElementById('chatInput');
        if (input) {
            input.focus();
            document.execCommand('paste');
        }
    }
    hideContextMenu();
}

/**
 * Corta texto al portapapeles
 */
function contextCut() {
    const target = document.getElementById('contextMenu')?.dataset.target;
    if (target === 'input') {
        const input = document.getElementById('chatInput');
        if (input) {
            input.select();
            document.execCommand('cut');
        }
    }
    hideContextMenu();
}

/**
 * Selecciona todo el texto
 */
function contextSelectAll() {
    const target = document.getElementById('contextMenu')?.dataset.target;
    if (target === 'input') {
        const input = document.getElementById('chatInput');
        if (input) {
            input.select();
        }
    } else {
        const messages = document.getElementById('chatMessages');
        if (messages) {
            window.getSelection().selectAllChildren(messages);
        }
    }
    hideContextMenu();
}

if (typeof window !== 'undefined') {
    window.initModelTooltips = initModelTooltips;
    window.updateTooltipContent = updateTooltipContent;
    window.positionTooltip = positionTooltip;
    window.initContextMenu = initContextMenu;
    window.showContextMenu = showContextMenu;
    window.hideContextMenu = hideContextMenu;
    window.contextCopy = contextCopy;
    window.contextPaste = contextPaste;
    window.contextCut = contextCut;
    window.contextSelectAll = contextSelectAll;
}

