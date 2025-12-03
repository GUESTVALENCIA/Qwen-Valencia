# Tipos Compartidos Frontend-Backend

Sistema de tipos compartidos usando JSDoc para type safety entre frontend y backend.

## Estructura

- `models.js` - Tipos relacionados con modelos (ModelInfo, ModelId, etc.)
- `messages.js` - Tipos de mensajes y conversación
- `state.js` - Tipos de estado de la aplicación
- `api.js` - Tipos de requests/responses de API
- `errors.js` - Tipos de errores estandarizados
- `attachments.js` - Tipos de attachments (imágenes, archivos)
- `config.js` - Tipos de configuración de servicios

## Uso

### En Backend (Node.js)

```javascript
const types = require('../types');

/**
 * @param {types.ModelId} modelId
 * @param {types.ChatMessage[]} messages
 * @returns {Promise<types.MessageResponse>}
 */
async function processMessage(modelId, messages) {
  // ...
}
```

### En Frontend (Browser)

```javascript
// Los tipos están disponibles vía JSDoc
// Los IDEs modernos los reconocerán automáticamente

/**
 * @param {import('../../types').ModelId} modelId
 * @param {import('../../types').ChatMessage[]} messages
 * @returns {Promise<import('../../types').MessageResponse>}
 */
async function sendMessage(modelId, messages) {
  // ...
}
```

## Tipos Principales

### Modelos

- `ModelId` - ID del modelo (string)
- `ModelInfo` - Información completa del modelo
- `ModelProvider` - 'Groq' | 'Ollama'
- `ModelConfig` - Configuración del modelo

### Mensajes

- `ChatMessage` - Mensaje de conversación
- `MessageRole` - 'system' | 'user' | 'assistant'
- `MessageRequest` - Request para enviar mensaje
- `MessageResponse` - Response del mensaje

### Estado

- `AppState` - Estado completo de la aplicación frontend
- `AppMode` - 'agent' | 'chat' | 'code'
- `UIConfig` - Configuración de UI/frontend
- `ServiceAppConfig` - Configuración de servicios backend

### API

- `APIRequest` - Request genérico de API
- `APIResponse` - Response genérico de API
- `ChatAPIRequest` - Request específico de chat
- `ChatAPIResponse` - Response específico de chat

### Errores

- `APIErrorResponse` - Error estandarizado de API
- `ErrorType` - Tipo de error
- `ErrorSeverity` - Severidad del error

### Attachments

- `ImageAttachment` - Attachment de imagen
- `FileAttachment` - Attachment de archivo
- `AttachmentType` - 'image' | 'file' | 'audio' | 'video'

## Validación

Los tipos JSDoc proporcionan:
- Autocompletado en IDEs
- Validación en tiempo de desarrollo
- Documentación inline
- Type checking con herramientas como TypeScript (opcional)

## Extensión

Para agregar nuevos tipos:

1. Agregar el tipo en el archivo correspondiente
2. Exportar en `index.js`
3. Documentar con JSDoc completo
4. Actualizar este README

