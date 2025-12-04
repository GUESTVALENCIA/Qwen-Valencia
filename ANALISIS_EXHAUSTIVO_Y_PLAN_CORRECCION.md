# 🔍 ANÁLISIS EXHAUSTIVO Y PLAN DE CORRECCIÓN PROFESIONAL
## Qwen-Valencia - Sistema de IA Multimodal

**Fecha**: 2025-01-12  
**Versión**: 1.0  
**Estado**: ANÁLISIS COMPLETO - PLAN DE CORRECCIÓN DETALLADO

---

## 📋 TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Análisis Completo de la Aplicación](#análisis-completo-de-la-aplicación)
3. [Análisis de Funcionalidades y Botones](#análisis-de-funcionalidades-y-botones)
4. [Errores Críticos Detectados](#errores-críticos-detectados)
5. [Errores de Persistencia y Guardado de Modelos](#errores-de-persistencia-y-guardado-de-modelos)
6. [Plan de Corrección Detallado](#plan-de-corrección-detallado)
7. [Checklist de Corrección](#checklist-de-corrección)

---

## 🎯 RESUMEN EJECUTIVO

### Estado Actual
La aplicación Qwen-Valencia está **BLOQUEADA POR ERRORES CRÍTICOS** que impiden:
- ❌ Guardar modelos a producción
- ❌ Funcionamiento correcto de botones y menús
- ❌ Persistencia de configuraciones
- ❌ Funcionalidades básicas de la aplicación

### Errores Detectados
- **60+ errores críticos** identificados por el orquestador
- **52 funciones onclick no definidas** en la aplicación
- **Errores de persistencia** que bloquean guardar modelos
- **Problemas de inicialización** que impiden el funcionamiento correcto

### Impacto
- 🚫 **Alto**: La aplicación no puede guardar modelos a producción
- 🚫 **Alto**: La mayoría de los botones y menús no funcionan
- 🚫 **Medio**: La persistencia de configuraciones falla
- 🚫 **Medio**: El selector de modelos tiene problemas

---

## 🔬 ANÁLISIS COMPLETO DE LA APLICACIÓN

### 1. Arquitectura de la Aplicación

#### 1.1 Estructura de Archivos Principales

```
Qwen-Valencia/
├── src/
│   ├── app/
│   │   ├── main.js                    # Proceso principal Electron
│   │   ├── preload.js                 # Bridge IPC
│   │   └── renderer/
│   │       ├── index.html             # Interfaz principal
│   │       ├── components/
│   │       │   ├── app.js             # Lógica principal frontend
│   │       │   └── model-selector.js  # Selector de modelos
│   │       ├── core/
│   │       │   ├── state-manager.js   # Gestor de estado
│   │       │   └── event-manager.js   # Gestor de eventos
│   │       └── utils/
│   │           └── event-listeners.js # Listeners de eventos
│   ├── core/
│   │   ├── qwen-executor.js          # Ejecutor Qwen
│   │   └── deepseek-executor.js      # Ejecutor DeepSeek
│   ├── orchestrator/
│   │   └── model-router.js           # Router de modelos
│   └── mcp/
│       ├── mcp-universal.js          # Servidor MCP Universal
│       ├── ollama-mcp-server.js      # Servidor Ollama MCP
│       └── groq-api-server.js        # Servidor Groq API
├── config/
│   ├── models.json                   # Configuración de modelos
│   ├── sandra-orchestrator.json      # Configuración orquestador
│   └── subagents-sandra.json         # Configuración subagentes
└── core/
    └── sandra-core/                  # Núcleo de Sandra IA
```

#### 1.2 Flujo de Datos

```
Usuario → Frontend (index.html) 
      → Event Listeners (event-listeners.js)
      → App Logic (app.js)
      → IPC Bridge (preload.js)
      → Main Process (main.js)
      → Model Router (model-router.js)
      → Executors (qwen-executor.js, deepseek-executor.js)
      → APIs (Groq/Ollama)
```

#### 1.3 Estado de la Aplicación

- **Frontend**: Estado global en `state` (objeto mutable)
- **Backend**: Estado en `sharedState` (sincronizado via IPC)
- **Persistencia**: localStorage para frontend, electron-store para backend
- **Modelos**: Configuración en `config/models.json` + localStorage

---

## 🎨 ANÁLISIS DE FUNCIONALIDADES Y BOTONES

### 2.1 Titlebar (Barra de Título)

| Botón | ID | Función Esperada | Estado | Error Detectado |
|-------|----|-----------------|--------|-----------------|
| Tema | `themeToggle` | Alternar tema claro/oscuro | ❌ NO FUNCIONA | Función `toggleTheme()` no está en `window` |
| Minimizar | `minimizeBtn` | Minimizar ventana | ⚠️ PARCIAL | Usa `window.qwenValencia?.minimize` |
| Maximizar | `maximizeBtn` | Maximizar/Restaurar ventana | ⚠️ PARCIAL | Usa `window.qwenValencia?.maximize` |
| Cerrar | `closeBtn` | Cerrar aplicación | ⚠️ PARCIAL | Usa `window.qwenValencia?.close` |

**Problemas Detectados**:
- Los botones de ventana dependen de `window.qwenValencia` que puede no estar inicializado
- `toggleTheme()` no está expuesta globalmente

---

### 2.2 Menú Archivo

| Opción | Action | Función Esperada | Estado | Error Detectado |
|--------|--------|-----------------|--------|-----------------|
| Nuevo | `newChat` | Crear nueva conversación | ❌ NO FUNCIONA | `window.newChat()` no definida |
| Abrir... | `openChat` | Cargar conversación guardada | ❌ NO FUNCIONA | `window.openChat()` no definida |
| Guardar | `saveChat` | Guardar conversación actual | ❌ NO FUNCIONA | `window.saveChat()` no definida |
| Guardar como... | `saveChatAs` | Guardar con nombre personalizado | ❌ NO FUNCIONA | `window.saveChatAs()` no definida |
| Exportar... | `exportChat` | Exportar conversación a JSON | ❌ NO FUNCIONA | `window.exportChat()` no definida |

**Problemas Detectados**:
- Todas las funciones están definidas en `app.js` pero no están en `window.*`
- `event-listeners.js` busca funciones en `window.*` pero no las encuentra

---

### 2.3 Menú Editar

| Opción | Action | Función Esperada | Estado | Error Detectado |
|--------|--------|-----------------|--------|-----------------|
| Copiar | `contextCopy` | Copiar texto seleccionado | ❌ NO FUNCIONA | `window.contextCopy()` no definida |
| Pegar | `contextPaste` | Pegar desde portapapeles | ❌ NO FUNCIONA | `window.contextPaste()` no definida |
| Cortar | `contextCut` | Cortar texto seleccionado | ❌ NO FUNCIONA | `window.contextCut()` no definida |
| Seleccionar todo | `contextSelectAll` | Seleccionar todo el texto | ❌ NO FUNCIONA | `window.contextSelectAll()` no definida |

---

### 2.4 Menú Ver

| Opción | Action | Función Esperada | Estado | Error Detectado |
|--------|--------|-----------------|--------|-----------------|
| Tema | `toggleTheme` | Alternar tema | ❌ NO FUNCIONA | `window.toggleTheme()` no definida |
| Mostrar/Ocultar Sidebar | `toggleSidebar` | Toggle sidebar | ❌ NO FUNCIONA | `window.toggleSidebar()` no definida |

---

### 2.5 Menú Ejecutar

| Opción | Action | Función Esperada | Estado | Error Detectado |
|--------|--------|-----------------|--------|-----------------|
| Ejecutar código | `executeCode` | Ejecutar código en laboratorio | ❌ NO FUNCIONA | Función solo muestra alert |
| Ejecutar comando | `executeCommand` | Ejecutar comando sistema | ❌ NO FUNCIONA | Función solo muestra alert |

---

### 2.6 Menú Terminal

| Opción | Action | Función Esperada | Estado | Error Detectado |
|--------|--------|-----------------|--------|-----------------|
| Abrir terminal | `openTerminal` | Abrir ventana terminal | ❌ NO FUNCIONA | Función solo muestra alert |
| Mostrar/Ocultar terminal | `toggleTerminal` | Toggle terminal | ❌ NO FUNCIONA | Función solo muestra alert |

---

### 2.7 Selector de Modelos

| Elemento | ID | Función Esperada | Estado | Error Detectado |
|----------|----|-----------------|--------|-----------------|
| Botón selector | `modelSelectorBtn` | Abrir menú de modelos | ⚠️ PARCIAL | Funciona pero con errores |
| Menú modelos | `modelMenu` | Mostrar lista modelos | ⚠️ PARCIAL | Funciona pero modelos no persisten |
| Búsqueda | `modelSearch` | Filtrar modelos | ✅ FUNCIONA | Sin errores detectados |
| Toggle Auto | `autoToggle` | Activar modo auto | ⚠️ PARCIAL | Guarda en localStorage pero no persiste en producción |
| Toggle MAX Mode | `maxModeToggle` | Activar modo máximo | ⚠️ PARCIAL | Guarda en localStorage pero no persiste |
| Toggle Multi Model | `multiModelToggle` | Activar múltiples modelos | ⚠️ PARCIAL | Guarda en localStorage pero no persiste |
| Añadir modelo | `addModelBtn` | Añadir modelo personalizado | ❌ NO FUNCIONA | `window.showAddModelModal()` no definida |

**Problemas Críticos**:
- Los modelos se guardan en `localStorage` pero NO se persisten en `config/models.json`
- No hay función para guardar modelos personalizados a producción
- El estado de selección de modelos se pierde al reiniciar

---

### 2.8 Área de Chat

| Elemento | ID | Función Esperada | Estado | Error Detectado |
|----------|----|-----------------|--------|-----------------|
| Input chat | `chatInput` | Escribir mensaje | ✅ FUNCIONA | Funciona correctamente |
| Botón enviar | `sendBtn` | Enviar mensaje | ✅ FUNCIONA | Funciona correctamente |
| Botón micrófono | `dictateBtn` | Dictar mensaje | ⚠️ PARCIAL | Funciona pero requiere Deepgram |
| Botón llamada | `voiceCallBtn` | Llamada conversacional | ❌ NO FUNCIONA | `window.startVoiceCall()` no definida |
| Botón cámara | `cameraBtn` | Abrir cámara | ⚠️ PARCIAL | Funciona pero con errores |
| Botón adjuntar | `attachBtn` | Adjuntar imagen | ⚠️ PARCIAL | Funciona pero con errores |
| Barra streaming | `streamingBar` | Indicador de generación | ✅ FUNCIONA | Funciona correctamente |
| Botón detener | `stopGenerationBtn` | Detener generación | ❌ NO FUNCIONA | `window.stopGeneration()` no definida |

---

### 2.9 Configuración (Settings)

| Elemento | ID | Función Esperada | Estado | Error Detectado |
|----------|----|-----------------|--------|-----------------|
| Botón abrir | `openSettingsBtn` | Abrir modal configuración | ❌ NO FUNCIONA | `window.openSettings()` no definida |
| Botón cerrar | `closeSettingsBtn` | Cerrar modal | ❌ NO FUNCIONA | `window.closeSettings()` no definida |
| Botón guardar | `saveSettingsBtn` | Guardar configuración | ❌ NO FUNCIONA | `window.saveSettings()` no definida |
| Panel general | `panel-general` | Configuración general | ⚠️ PARCIAL | Funciona pero no persiste |
| Panel MCP | `panel-mcp` | Configuración MCP | ⚠️ PARCIAL | Funciona pero no persiste |
| Panel conectores | `panel-connectors` | Estado conectores | ⚠️ PARCIAL | Funciona pero con errores |
| Panel servidores | `panel-servers` | Configurar servidores MCP | ⚠️ PARCIAL | Funciona pero no persiste |

**Problemas Críticos**:
- `saveSettings()` está definida pero no persiste modelos a producción
- Las configuraciones se guardan en localStorage pero no en archivos de configuración
- No hay función para exportar configuración a `config/models.json`

---

### 2.10 Avatar (HeyGen)

| Elemento | ID | Función Esperada | Estado | Error Detectado |
|----------|----|-----------------|--------|-----------------|
| Botón cámara | `avatarCameraBtn` | Activar cámara avatar | ❌ NO FUNCIONA | `window.toggleAvatarCamera()` no definida |
| Botón llamada | `avatarCallBtn` | Iniciar llamada avatar | ❌ NO FUNCIONA | `window.toggleAvatarCall()` no definida |
| Botón colgar | `avatarHangBtn` | Colgar llamada | ❌ NO FUNCIONA | `window.hangAvatarCall()` no definida |
| Botón pausa | `avatarPauseBtn` | Pausar avatar | ❌ NO FUNCIONA | `window.toggleAvatarPause()` no definida |
| Modo compartir | `setAvatarMode` | Modo compartir pantalla | ❌ NO FUNCIONA | `window.setAvatarMode()` no definida |
| Modo fullscreen | `setAvatarMode` | Modo pantalla completa | ❌ NO FUNCIONA | `window.setAvatarMode()` no definida |
| Modo PiP | `setAvatarMode` | Modo imagen flotante | ❌ NO FUNCIONA | `window.setAvatarMode()` no definida |

**Nota**: HeyGen Avatar está deshabilitado temporalmente en el código.

---

### 2.11 Sidebar

| Elemento | ID | Función Esperada | Estado | Error Detectado |
|----------|----|-----------------|--------|-----------------|
| Botón colapsar | `collapseSidebarBtn` | Colapsar/Expandir sidebar | ⚠️ PARCIAL | Funciona pero con errores |
| Botón nuevo chat | `newChatSidebarBtn` | Crear nuevo chat | ❌ NO FUNCIONA | `window.newChat()` no definida |
| Historial chats | `chatHistory` | Listar chats guardados | ⚠️ PARCIAL | Funciona pero no carga chats |
| Botón config | `openSettingsBtn` | Abrir configuración | ❌ NO FUNCIONA | `window.openSettings()` no definida |

---

## 🔴 ERRORES CRÍTICOS DETECTADOS

### 3.1 Error Principal: Funciones No Expuestas Globalmente

**Descripción**: Las funciones están definidas en `app.js` pero no están expuestas en `window.*`, lo que impide que `event-listeners.js` las encuentre.

**Impacto**: 
- 🚫 **CRÍTICO**: 52 botones/menús no funcionan
- 🚫 **ALTO**: La aplicación está prácticamente inutilizable

**Evidencia**:
```javascript
// En event-listeners.js (línea 89):
if (typeof window[funcName] === 'function') {
    window[funcName]();
} else {
    console.warn(`Función ${funcName} no está disponible`);
}

// En app.js las funciones están definidas así:
function saveChat() { ... }  // ❌ NO está en window.saveChat
```

**Solución Requerida**:
```javascript
// Todas las funciones deben estar en window.*
window.saveChat = saveChat;
window.newChat = newChat;
// ... etc
```

---

### 3.2 Error: Persistencia de Modelos No Funciona

**Descripción**: Los modelos se guardan en `localStorage` pero NO se persisten en `config/models.json` para producción.

**Impacto**:
- 🚫 **CRÍTICO**: No se pueden guardar modelos a producción
- 🚫 **ALTO**: La configuración se pierde al reiniciar
- 🚫 **ALTO**: Los modelos personalizados no se guardan

**Evidencia**:
```javascript
// En model-selector.js (línea 408):
localStorage.setItem('selectedModels', JSON.stringify(this.selectedModels));
// ❌ Solo guarda en localStorage, no en config/models.json
```

**Problemas**:
1. No hay función para escribir en `config/models.json`
2. No hay sincronización entre localStorage y archivos de configuración
3. No hay validación antes de guardar
4. No hay manejo de errores al guardar

---

### 3.3 Error: Estado de Modelos No Sincronizado

**Descripción**: El estado de selección de modelos se mantiene en múltiples lugares sin sincronización:
- `localStorage` (frontend)
- `config/models.json` (configuración)
- `state.selectedModels` (estado en memoria)

**Impacto**:
- 🚫 **ALTO**: Inconsistencias entre lo que se muestra y lo que está guardado
- 🚫 **MEDIO**: El modelo seleccionado se pierde al reiniciar

---

### 3.4 Error: Inicialización Asíncrona

**Descripción**: Los event listeners se inicializan antes de que las funciones estén disponibles en `window.*`.

**Impacto**:
- 🚫 **ALTO**: Los botones no funcionan al iniciar la aplicación
- 🚫 **MEDIO**: Requiere recargar la página para que funcione

---

## 💾 ERRORES DE PERSISTENCIA Y GUARDADO DE MODELOS

### 4.1 Problema Principal: No Hay Función para Guardar Modelos a Producción

**Estado Actual**:
- ✅ Los modelos se guardan en `localStorage`
- ❌ NO se guardan en `config/models.json`
- ❌ NO hay función para exportar modelos a producción
- ❌ NO hay validación antes de guardar
- ❌ NO hay manejo de errores

**Código Actual** (model-selector.js):
```javascript
// Línea 408 - Solo guarda en localStorage
localStorage.setItem('selectedModels', JSON.stringify(this.selectedModels));
```

**Lo que FALTA**:
1. Función para leer `config/models.json`
2. Función para escribir en `config/models.json`
3. Validación de formato antes de guardar
4. Sincronización entre localStorage y archivos
5. Manejo de errores con rollback

---

### 4.2 Problema: Estructura de Datos Incompatible

**localStorage** guarda:
```json
["qwen2.5:7b-instruct", "deepseek-r1:7b"]
```

**config/models.json** espera:
```json
{
  "online": {
    "reasoning": { ... },
    "vision": { ... },
    "code": { ... }
  },
  "local": { ... }
}
```

**Impacto**: Los formatos son incompatibles, necesitamos conversión.

---

### 4.3 Problema: No Hay Persistencia de Modelos Personalizados

**Estado Actual**:
- ❌ El botón "Add more models" (`addModelBtn`) no funciona
- ❌ No hay UI para añadir modelos personalizados
- ❌ No hay función para guardar modelos personalizados

**Requerimiento**:
- ✅ Permitir añadir modelos personalizados desde la UI
- ✅ Guardar modelos personalizados en `config/models.json`
- ✅ Validar que el modelo existe antes de guardar
- ✅ Mostrar error si el modelo no es válido

---

### 4.4 Problema: Configuración No Persiste Entre Sesiones

**Estado Actual**:
- ⚠️ Algunas configuraciones se guardan en localStorage
- ❌ Las configuraciones NO se guardan en archivos de producción
- ❌ Se pierden al limpiar localStorage

**Configuraciones Afectadas**:
- Selección de modelos
- Modo auto/max/multi
- Configuración de servidores MCP
- Configuración de conectores
- Temperatura y maxTokens

---

## 📋 PLAN DE CORRECCIÓN DETALLADO

### FASE 1: Exponer Funciones Globalmente (PRIORIDAD CRÍTICA)

**Objetivo**: Hacer que todos los botones y menús funcionen.

**Tareas**:
1. ✅ Identificar todas las funciones necesarias (52 funciones)
2. ⏳ Exponer todas las funciones en `window.*` al final de `app.js`
3. ⏳ Verificar que todas las funciones estén disponibles antes de inicializar event listeners
4. ⏳ Agregar validación para funciones faltantes

**Archivos a Modificar**:
- `src/app/renderer/components/app.js` (al final del archivo)

**Código a Agregar**:
```javascript
// Exponer todas las funciones globalmente
window.toggleTheme = toggleTheme;
window.newChat = newChat;
window.openChat = openChat;
window.saveChat = saveChat;
window.saveChatAs = saveChatAs;
window.exportChat = exportChat;
window.contextCopy = contextCopy;
window.contextPaste = contextPaste;
window.contextCut = contextCut;
window.contextSelectAll = contextSelectAll;
window.toggleSidebar = toggleSidebar;
window.executeCode = executeCode;
window.executeCommand = executeCommand;
window.openTerminal = openTerminal;
window.toggleTerminal = toggleTerminal;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
window.showPanel = showPanel;
window.toggleModelMenu = toggleModelMenu;
window.setMode = setMode;
window.stopGeneration = stopGeneration;
window.removeAttachment = removeAttachment;
window.showAddModelModal = showAddModelModal;
window.openCameraForIA = openCameraForIA;
window.closeCamera = closeCamera;
window.capturePhoto = capturePhoto;
window.toggleAvatarCamera = toggleAvatarCamera;
window.toggleAvatarCall = toggleAvatarCall;
window.hangAvatarCall = hangAvatarCall;
window.toggleAvatarPause = toggleAvatarPause;
window.setAvatarMode = setAvatarMode;
window.startVoiceCall = startVoiceCall;
window.toggleDictation = toggleDictation;
// ... etc para todas las 52 funciones
```

---

### FASE 2: Implementar Persistencia de Modelos a Producción (PRIORIDAD CRÍTICA)

**Objetivo**: Permitir guardar modelos en `config/models.json` para producción.

**Tareas**:
1. ⏳ Crear función para leer `config/models.json` desde el frontend (via IPC)
2. ⏳ Crear función para escribir en `config/models.json` desde el frontend (via IPC)
3. ⏳ Agregar handler IPC en `main.js` para lectura/escritura de archivos de configuración
4. ⏳ Implementar conversión entre formato localStorage y formato config/models.json
5. ⏳ Agregar validación antes de guardar
6. ⏳ Implementar sincronización entre localStorage y archivos
7. ⏳ Agregar manejo de errores con rollback

**Archivos a Crear/Modificar**:
- `src/app/main.js` (agregar handlers IPC)
- `src/app/preload.js` (exponer funciones IPC)
- `src/app/renderer/components/app.js` (agregar funciones de persistencia)
- `src/app/renderer/components/model-selector.js` (integrar persistencia)

**Código a Implementar**:

**1. Handler IPC en main.js**:
```javascript
// Leer configuración de modelos
ipcMain.handle('read-models-config', async () => {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, '..', '..', 'config', 'models.json');
    const content = fs.readFileSync(configPath, 'utf-8');
    return { success: true, data: JSON.parse(content) };
  } catch (error) {
    logger.error('Error leyendo config/models.json', { error: error.message });
    return { success: false, error: error.message };
  }
});

// Guardar configuración de modelos
ipcMain.handle('save-models-config', async (event, modelsConfig) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, '..', '..', 'config', 'models.json');
    
    // Validar formato antes de guardar
    if (!validateModelsConfig(modelsConfig)) {
      return { success: false, error: 'Formato de configuración inválido' };
    }
    
    // Hacer backup antes de guardar
    const backupPath = configPath + '.backup.' + Date.now();
    if (fs.existsSync(configPath)) {
      fs.copyFileSync(configPath, backupPath);
    }
    
    // Guardar nueva configuración
    fs.writeFileSync(configPath, JSON.stringify(modelsConfig, null, 2), 'utf-8');
    
    logger.info('Configuración de modelos guardada exitosamente');
    return { success: true };
  } catch (error) {
    logger.error('Error guardando config/models.json', { error: error.message });
    
    // Intentar restaurar backup si existe
    // ... código de rollback
    
    return { success: false, error: error.message };
  }
});
```

**2. Exponer funciones en preload.js**:
```javascript
contextBridge.exposeInMainWorld('qwenValencia', {
  // ... funciones existentes ...
  
  // Nuevas funciones para persistencia
  readModelsConfig: () => ipcRenderer.invoke('read-models-config'),
  saveModelsConfig: (config) => ipcRenderer.invoke('save-models-config', config),
});
```

**3. Función de guardado en model-selector.js**:
```javascript
async saveModelsToProduction() {
  try {
    // Leer configuración actual
    const result = await window.qwenValencia.readModelsConfig();
    if (!result.success) {
      throw new Error(result.error);
    }
    
    const config = result.data;
    
    // Convertir selectedModels a formato config/models.json
    const updatedConfig = this.convertSelectedModelsToConfig(this.selectedModels, config);
    
    // Guardar en archivo
    const saveResult = await window.qwenValencia.saveModelsConfig(updatedConfig);
    if (!saveResult.success) {
      throw new Error(saveResult.error);
    }
    
    // También guardar en localStorage para consistencia
    localStorage.setItem('selectedModels', JSON.stringify(this.selectedModels));
    
    console.log('✅ Modelos guardados a producción exitosamente');
    showToast('Modelos guardados a producción', 'success');
  } catch (error) {
    console.error('❌ Error guardando modelos a producción:', error);
    showToast('Error al guardar modelos: ' + error.message, 'error');
  }
}

convertSelectedModelsToConfig(selectedModels, currentConfig) {
  // Implementar lógica de conversión
  // ...
}
```

---

### FASE 3: Sincronizar Estado de Modelos (PRIORIDAD ALTA)

**Objetivo**: Mantener sincronizado el estado de modelos entre localStorage, memoria y archivos.

**Tareas**:
1. ⏳ Crear función de sincronización que unifique todas las fuentes
2. ⏳ Implementar carga inicial desde archivos de configuración
3. ⏳ Sincronizar cambios entre localStorage y archivos
4. ⏳ Agregar validación de consistencia

---

### FASE 4: Implementar UI para Añadir Modelos Personalizados (PRIORIDAD MEDIA)

**Objetivo**: Permitir añadir modelos personalizados desde la UI.

**Tareas**:
1. ⏳ Crear modal para añadir modelos
2. ⏳ Agregar formulario con campos necesarios (nombre, provider, modelo, etc.)
3. ⏳ Validar formato antes de guardar
4. ⏳ Integrar con función de guardado a producción

---

### FASE 5: Mejorar Manejo de Errores (PRIORIDAD MEDIA)

**Objetivo**: Mejorar el manejo de errores en toda la aplicación.

**Tareas**:
1. ⏳ Agregar try-catch a todas las funciones críticas
2. ⏳ Implementar logging estructurado
3. ⏳ Mostrar mensajes de error claros al usuario
4. ⏳ Implementar rollback automático en caso de error

---

## ✅ CHECKLIST DE CORRECCIÓN

### FASE 1: Exponer Funciones Globalmente

- [ ] **1.1** Identificar todas las funciones necesarias (52 funciones)
- [ ] **1.2** Agregar exposición de funciones en `app.js` al final del archivo
- [ ] **1.3** Verificar que `toggleTheme()` está en `window.toggleTheme`
- [ ] **1.4** Verificar que `newChat()` está en `window.newChat`
- [ ] **1.5** Verificar que `openChat()` está en `window.openChat`
- [ ] **1.6** Verificar que `saveChat()` está en `window.saveChat`
- [ ] **1.7** Verificar que `saveChatAs()` está en `window.saveChatAs`
- [ ] **1.8** Verificar que `exportChat()` está en `window.exportChat`
- [ ] **1.9** Verificar que `contextCopy()` está en `window.contextCopy`
- [ ] **1.10** Verificar que `contextPaste()` está en `window.contextPaste`
- [ ] **1.11** Verificar que `contextCut()` está en `window.contextCut`
- [ ] **1.12** Verificar que `contextSelectAll()` está en `window.contextSelectAll`
- [ ] **1.13** Verificar que `toggleSidebar()` está en `window.toggleSidebar`
- [ ] **1.14** Verificar que `openSettings()` está en `window.openSettings`
- [ ] **1.15** Verificar que `closeSettings()` está en `window.closeSettings`
- [ ] **1.16** Verificar que `saveSettings()` está en `window.saveSettings`
- [ ] **1.17** Verificar que `showPanel()` está en `window.showPanel`
- [ ] **1.18** Verificar que `toggleModelMenu()` está en `window.toggleModelMenu`
- [ ] **1.19** Verificar que `setMode()` está en `window.setMode`
- [ ] **1.20** Verificar que `stopGeneration()` está en `window.stopGeneration`
- [ ] **1.21** Verificar que `removeAttachment()` está en `window.removeAttachment`
- [ ] **1.22** Verificar que `showAddModelModal()` está en `window.showAddModelModal`
- [ ] **1.23** Verificar que `openCameraForIA()` está en `window.openCameraForIA`
- [ ] **1.24** Verificar que `closeCamera()` está en `window.closeCamera`
- [ ] **1.25** Verificar que `capturePhoto()` está en `window.capturePhoto`
- [ ] **1.26** Verificar que `startVoiceCall()` está en `window.startVoiceCall`
- [ ] **1.27** Verificar que `toggleDictation()` está en `window.toggleDictation`
- [ ] **1.28** Verificar que todas las funciones de avatar están expuestas
- [ ] **1.29** Probar que todos los botones funcionan después de los cambios
- [ ] **1.30** Verificar que no hay errores en consola

---

### FASE 2: Implementar Persistencia de Modelos a Producción

- [ ] **2.1** Crear handler IPC `read-models-config` en `main.js`
- [ ] **2.2** Crear handler IPC `save-models-config` en `main.js`
- [ ] **2.3** Agregar validación de formato en handler de guardado
- [ ] **2.4** Implementar backup antes de guardar
- [ ] **2.5** Implementar rollback en caso de error
- [ ] **2.6** Exponer funciones IPC en `preload.js`
- [ ] **2.7** Crear función `readModelsConfig()` en frontend
- [ ] **2.8** Crear función `saveModelsConfig()` en frontend
- [ ] **2.9** Crear función `convertSelectedModelsToConfig()` para conversión de formato
- [ ] **2.10** Integrar guardado a producción en `model-selector.js`
- [ ] **2.11** Agregar botón "Guardar a Producción" en UI de modelos
- [ ] **2.12** Probar lectura de configuración desde archivo
- [ ] **2.13** Probar guardado de configuración a archivo
- [ ] **2.14** Verificar que se crea backup antes de guardar
- [ ] **2.15** Verificar que funciona rollback en caso de error
- [ ] **2.16** Probar que los modelos se persisten después de reiniciar
- [ ] **2.17** Verificar que localStorage y archivos están sincronizados

---

### FASE 3: Sincronizar Estado de Modelos

- [ ] **3.1** Crear función `syncModelsState()` que unifica todas las fuentes
- [ ] **3.2** Implementar carga inicial desde archivos de configuración
- [ ] **3.3** Sincronizar cambios entre localStorage y archivos
- [ ] **3.4** Agregar validación de consistencia
- [ ] **3.5** Probar sincronización al iniciar aplicación
- [ ] **3.6** Probar sincronización al cambiar modelo
- [ ] **3.7** Probar sincronización al guardar

---

### FASE 4: Implementar UI para Añadir Modelos Personalizados

- [ ] **4.1** Crear modal HTML para añadir modelos
- [ ] **4.2** Agregar formulario con campos necesarios
- [ ] **4.3** Implementar validación de formato en formulario
- [ ] **4.4** Integrar con función de guardado a producción
- [ ] **4.5** Probar añadir modelo personalizado
- [ ] **4.6** Verificar que se guarda correctamente

---

### FASE 5: Mejorar Manejo de Errores

- [ ] **5.1** Agregar try-catch a todas las funciones críticas
- [ ] **5.2** Implementar logging estructurado
- [ ] **5.3** Mostrar mensajes de error claros al usuario
- [ ] **5.4** Implementar rollback automático
- [ ] **5.5** Probar manejo de errores en escenarios de fallo

---

## 🎯 PRIORIDADES DE IMPLEMENTACIÓN

### PRIORIDAD CRÍTICA (Hacer primero)

1. **Exponer todas las funciones globalmente** (FASE 1)
   - Sin esto, la aplicación no funciona en absoluto
   - Tiempo estimado: 2-3 horas

2. **Implementar persistencia de modelos a producción** (FASE 2)
   - Sin esto, no se pueden guardar modelos
   - Tiempo estimado: 4-6 horas

### PRIORIDAD ALTA (Hacer después)

3. **Sincronizar estado de modelos** (FASE 3)
   - Importante para consistencia
   - Tiempo estimado: 2-3 horas

### PRIORIDAD MEDIA (Hacer al final)

4. **UI para añadir modelos personalizados** (FASE 4)
   - Mejora de funcionalidad
   - Tiempo estimado: 3-4 horas

5. **Mejorar manejo de errores** (FASE 5)
   - Mejora continua
   - Tiempo estimado: 2-3 horas

---

## 📊 RESUMEN DE ESTADO

### Funcionalidades que FUNCIONAN ✅
- Input de chat y envío de mensajes
- Selector de modelos (parcialmente)
- Búsqueda de modelos
- Streaming de respuestas
- Carga de configuración básica

### Funcionalidades que NO FUNCIONAN ❌
- Guardar modelos a producción (CRÍTICO)
- 52 botones/menús (CRÍTICO)
- Persistencia de configuraciones
- Añadir modelos personalizados
- Funciones de avatar
- Funciones de terminal
- Funciones de ejecución de código

### Errores Bloqueantes
1. ❌ **Funciones no expuestas globalmente** - Bloquea 52 funcionalidades
2. ❌ **No hay persistencia a producción** - Bloquea guardar modelos
3. ❌ **Estado no sincronizado** - Bloquea consistencia

---

## 🚀 SIGUIENTE PASO

**ACCIÓN INMEDIATA**: Implementar FASE 1 (Exponer Funciones Globalmente)

Este es el bloqueador principal. Una vez resuelto, al menos los botones funcionarán y la aplicación será utilizable.

---

**Documento creado**: 2025-01-12  
**Última actualización**: 2025-01-12  
**Autor**: Análisis Automatizado del Sistema

