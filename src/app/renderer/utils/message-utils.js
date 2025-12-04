/**
 * ════════════════════════════════════════════════════════════════════════════
 * MESSAGE UTILITIES - Utilidades para Mensajes
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Centraliza funciones relacionadas con mensajes del chat
 */

/**
 * Formatea el contenido de un mensaje (markdown básico) con sanitización
 * @param {string} content - Contenido del mensaje
 * @returns {string} Contenido formateado en HTML sanitizado
 */
function formatContent(content) {
    if (!content) return '';
    
    // Escapar HTML para prevenir XSS
    const escapeHTML = (text) => {
        if (typeof text !== 'string') return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    };
    
    // Usar marcadores temporales para preservar tags HTML seguros
    const placeholders = [];
    let placeholderIndex = 0;
    
    let processed = content;
    
    // Procesar bloques de código primero
    processed = processed.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const escapedCode = escapeHTML(code);
        const placeholder = `__CODE_BLOCK_${placeholderIndex}__`;
        placeholders.push({ placeholder, replacement: `<pre><code>${escapedCode}</code></pre>` });
        placeholderIndex++;
        return placeholder;
    });
    
    // Procesar código inline
    processed = processed.replace(/`([^`]+)`/g, (match, code) => {
        const escapedCode = escapeHTML(code);
        const placeholder = `__CODE_INLINE_${placeholderIndex}__`;
        placeholders.push({ placeholder, replacement: `<code>${escapedCode}</code>` });
        placeholderIndex++;
        return placeholder;
    });
    
    // Procesar negrita
    processed = processed.replace(/\*\*([^*]+)\*\*/g, (match, text) => {
        const escapedText = escapeHTML(text);
        const placeholder = `__BOLD_${placeholderIndex}__`;
        placeholders.push({ placeholder, replacement: `<strong>${escapedText}</strong>` });
        placeholderIndex++;
        return placeholder;
    });
    
    // Escapar todo el contenido restante
    processed = escapeHTML(processed);
    
    // Restaurar placeholders con HTML seguro
    placeholders.forEach(({ placeholder, replacement }) => {
        processed = processed.replace(placeholder, replacement);
    });
    
    // Convertir saltos de línea a <br>
    processed = processed.replace(/\n/g, '<br>');
    
    return processed;
}

/**
 * Crea el HTML de un mensaje
 * @param {Object} options - Opciones
 * @param {string} options.role - Rol del mensaje (user/assistant)
 * @param {string} options.content - Contenido del mensaje
 * @param {string|null} options.image - Imagen en base64 o null
 * @param {string|null} options.modelId - ID del modelo (para multi-modelo)
 * @param {Object} options.MODELS - Objeto con información de modelos
 * @param {boolean} options.multiModel - Si está activo modo multi-modelo
 * @returns {string} HTML del mensaje
 */
function createMessageHTML(options) {
    const { role, content, image, modelId, MODELS, multiModel } = options;
    
    let html = '<div class="message-bubble">';
    
    // Imagen adjunta
    if (image) {
        html += `<img src="data:image/jpeg;base64,${image}" alt="Imagen">`;
    }
    
    // Etiqueta de modelo (solo para assistant en multi-modelo)
    if (role === 'assistant' && modelId && multiModel) {
        const modelName = MODELS[modelId]?.compact || modelId;
        html += `<div class="model-label">${modelName}</div>`;
    }
    
    // Contenido del mensaje
    html += `<div class="message-text">${formatContent(content)}</div>`;
    html += '</div>';
    
    return html;
}

/**
 * Agrega un mensaje al chat
 * @param {Object} options - Opciones
 * @param {string} options.role - Rol del mensaje
 * @param {string} options.content - Contenido del mensaje
 * @param {string|null} options.image - Imagen adjunta
 * @param {string|null} options.modelId - ID del modelo
 * @param {Object} options.MODELS - Objeto con información de modelos
 * @param {Object} options.state - Estado de la aplicación
 * @returns {HTMLElement} Elemento del mensaje creado
 */
function addMessageToChat(options) {
    const { role, content, image, modelId, MODELS, state } = options;
    
    const container = document.getElementById('chatMessages');
    if (!container) return null;
    
    // Remover pantalla de bienvenida
    const welcome = container.querySelector('.welcome-screen');
    if (welcome) welcome.remove();
    
    // Crear elemento del mensaje
    const div = document.createElement('div');
    div.className = `message ${role}`;
    if (modelId) {
        div.dataset.model = modelId;
    }
    
    // Generar HTML
    const html = createMessageHTML({
        role,
        content,
        image,
        modelId,
        MODELS,
        multiModel: state.multiModel
    });
    
    // Usar sanitización para prevenir XSS
    if (typeof window !== 'undefined' && window.setSafeHTML) {
        window.setSafeHTML(div, html);
    } else {
        // Fallback: usar innerHTML solo si setSafeHTML no está disponible
        div.innerHTML = html;
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    
    return div;
}

/**
 * Actualiza el contenido de un mensaje existente
 * @param {HTMLElement} el - Elemento del mensaje
 * @param {string} content - Nuevo contenido
 */
function updateMessageContent(el, content) {
    const textEl = el.querySelector('.message-text');
    if (textEl) {
        const formatted = formatContent(content);
        // Usar sanitización
        if (typeof window !== 'undefined' && window.setSafeHTML) {
            window.setSafeHTML(textEl, formatted);
        } else {
            textEl.innerHTML = formatted;
        }
        const container = el.parentElement;
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }
}

if (typeof window !== 'undefined') {
    window.formatContent = formatContent;
    window.createMessageHTML = createMessageHTML;
    window.addMessageToChat = addMessageToChat;
    window.updateMessageContent = updateMessageContent;
}

