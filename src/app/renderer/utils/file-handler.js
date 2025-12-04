/**
 * ════════════════════════════════════════════════════════════════════════════
 * FILE HANDLER - Manejo de Archivos e Imágenes
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Centraliza la lógica de manejo de archivos e imágenes
 */

/**
 * Maneja la selección de archivo
 * @param {Event} e - Evento de selección de archivo
 * @param {Object} options - Opciones
 * @param {Object} options.state - Estado de la aplicación
 * @param {Function} options.showAttachment - Función para mostrar adjunto
 * @param {Function} options.showToast - Función para mostrar toast
 * @param {Function} options.selectModelByKey - Función para seleccionar modelo
 */
function handleFileSelect(e, options) {
    const { state, showAttachment, showToast, selectModelByKey } = options;
    const file = e.target.files[0];
    
    if (!file) return;
    
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
        if (showToast) {
            showToast('Solo se permiten archivos de imagen', 'error');
        }
        return;
    }
    
    // Validar tamaño (máx 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        if (showToast) {
            showToast('La imagen es demasiado grande (máx 10MB)', 'error');
        }
        return;
    }
    
    // Leer archivo como base64
    const reader = new FileReader();
    reader.onload = (event) => {
        const base64 = event.target.result.split(',')[1];
        state.attachedImage = base64;
        
        if (showAttachment) {
            showAttachment(event.target.result);
        }
        
        // Cambiar a modelo visual si está en auto
        if (state.model === 'auto' && selectModelByKey) {
            selectModelByKey('qwen2.5vl:3b');
        }
        
        if (showToast) {
            showToast('Imagen adjuntada', 'success');
        }
    };
    
    reader.onerror = () => {
        if (showToast) {
            showToast('Error al leer el archivo', 'error');
        }
    };
    
    reader.readAsDataURL(file);
}

/**
 * Valida si un archivo es una imagen válida
 * @param {File} file - Archivo a validar
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateImageFile(file) {
    if (!file) {
        return { valid: false, error: 'No se seleccionó ningún archivo' };
    }
    
    if (!file.type.startsWith('image/')) {
        return { valid: false, error: 'Solo se permiten archivos de imagen' };
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        return { valid: false, error: 'La imagen es demasiado grande (máx 10MB)' };
    }
    
    return { valid: true };
}

/**
 * Convierte un archivo a base64
 * @param {File} file - Archivo a convertir
 * @returns {Promise<string>} Base64 del archivo
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = () => {
            reject(new Error('Error al leer el archivo'));
        };
        reader.readAsDataURL(file);
    });
}

if (typeof window !== 'undefined') {
    window.handleFileSelect = handleFileSelect;
    window.validateImageFile = validateImageFile;
    window.fileToBase64 = fileToBase64;
}

