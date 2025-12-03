# PLAN DE CORRECCIÓN DE ERRORES - Qwen-Valencia

## ANÁLISIS DE ERRORES IDENTIFICADOS

### Error 1: Puerto 3001 en uso
**Síntoma**: Log muestra "Puerto: 3001" aunque código dice 6000
**Causa probable**: 
- Proceso viejo de MCP corriendo en puerto 3001
- Variable de entorno MCP_PORT=3001 en .env.pro
- Caché de proceso Node.js

### Error 2: Servidores 6002 y 6003 no iniciados
**Síntoma**: ERR_CONNECTION_REFUSED en localhost:6002 y localhost:6003
**Causa**: Los servidores dedicados (Ollama MCP y Groq API) no están corriendo
**Solución**: Usuario debe ejecutar INICIAR_SERVIDORES.bat primero

### Error 3: "model is not defined"
**Síntoma**: Error cuando no hay modelo seleccionado
**Causa**: 
- selectedModel es null/undefined
- callGroq recibe model=null pero no valida antes de enviar
- Servidor Groq no maneja modelo undefined

### Error 4: Selector muestra "0 modelos disponibles"
**Causa**: Los servidores no están corriendo, por lo que no puede cargar modelos

### Error 5: Micrófono - Cambio de requerimiento
**Requerimiento nuevo**: Sistema de dictado estilo ChatGPT
- Grabar audio (máx 30 segundos)
- Guardar audio
- Cuando usuario termine de hablar (click o timeout), transcribir
- Insertar transcripción en el chat
- NO llamada conversacional, solo dictado

---

## PLAN DE IMPLEMENTACIÓN

### FASE 1: CORRECCIÓN DE PUERTOS Y SERVIDORES

#### Checklist 1.1: Verificar y corregir puerto MCP
- [ ] Verificar que mcp-universal.js use puerto 6000 (no 3001)
- [ ] Verificar que .env.pro no tenga MCP_PORT=3001
- [ ] Agregar detección de proceso viejo en puerto 3001
- [ ] Agregar script para matar proceso en puerto 3001 si existe
- [ ] Actualizar INICIAR_TODO.bat para verificar puertos antes de iniciar

#### Checklist 1.2: Iniciar servidores automáticamente
- [ ] Modificar main.js para iniciar servidores dedicados si no están corriendo
- [ ] Verificar salud de servidores antes de usarlos
- [ ] Mostrar mensaje claro si servidores no están disponibles
- [ ] Agregar fallback si servidores no responden

#### Checklist 1.3: Validación de modelo antes de llamar API
- [ ] Validar que model no sea null/undefined antes de llamar callGroq
- [ ] Si no hay modelo seleccionado, usar modelo por defecto
- [ ] Mostrar error claro si no hay modelo disponible
- [ ] Actualizar UI para mostrar modelo por defecto cuando no hay selección

---

### FASE 2: CORRECCIÓN DEL SELECTOR DE MODELOS

#### Checklist 2.1: Carga de modelos con fallback
- [ ] Intentar cargar modelos de servidores dedicados
- [ ] Si servidores no están disponibles, mostrar modelos hardcodeados
- [ ] Agregar modelos por defecto de Groq (lista conocida)
- [ ] Agregar modelos por defecto de Ollama (si Ollama está disponible directamente)
- [ ] Mostrar estado claro: "Servidores no disponibles, usando modelos por defecto"

#### Checklist 2.2: Validación de modelo seleccionado
- [ ] Validar que el modelo seleccionado existe antes de usarlo
- [ ] Si modelo no existe, resetear a modelo por defecto
- [ ] Mostrar advertencia si modelo seleccionado no está disponible

---

### FASE 3: IMPLEMENTACIÓN DE DICTADO DE VOZ (ESTILO CHATGPT)

#### Checklist 3.1: Sistema de grabación de audio
- [ ] Crear MediaRecorder para grabar audio
- [ ] Configurar formato: audio/webm o audio/wav
- [ ] Límite de 30 segundos de grabación
- [ ] Mostrar indicador visual de grabación (animación)
- [ ] Mostrar contador de tiempo (0-30 segundos)

#### Checklist 3.2: Control de grabación
- [ ] Botón "Grabar" inicia grabación
- [ ] Botón cambia a "Detener" durante grabación
- [ ] Al hacer click en "Detener", detener grabación
- [ ] Guardar audio en Blob/ArrayBuffer
- [ ] Mostrar indicador de "Procesando..." después de detener

#### Checklist 3.3: Transcripción de audio
- [ ] Enviar audio grabado a backend vía IPC
- [ ] Usar Web Speech API como fallback si backend falla
- [ ] Mostrar transcripción en el input del chat
- [ ] NO enviar automáticamente, solo insertar texto
- [ ] Usuario puede editar antes de enviar

#### Checklist 3.4: Integración con chat
- [ ] Insertar texto transcrito en messageInput
- [ ] Mantener focus en el input
- [ ] Permitir edición del texto antes de enviar
- [ ] Botón "Enviar" funciona normalmente después de dictado

---

### FASE 4: VALIDACIONES Y MANEJO DE ERRORES

#### Checklist 4.1: Validaciones de modelo
- [ ] Validar model antes de todas las llamadas API
- [ ] Usar modelo por defecto si model es null/undefined
- [ ] Log claro de qué modelo se está usando
- [ ] Error claro si modelo no está disponible

#### Checklist 4.2: Manejo de errores de servidores
- [ ] Detectar si servidores no están corriendo
- [ ] Mostrar mensaje claro: "Inicia los servidores con INICIAR_SERVIDORES.bat"
- [ ] Fallback a llamadas directas si servidores no disponibles
- [ ] Log de errores detallado en consola

#### Checklist 4.3: Validaciones de micrófono
- [ ] Verificar permisos de micrófono antes de grabar
- [ ] Manejar error si micrófono no disponible
- [ ] Manejar error si transcripción falla
- [ ] Mostrar mensajes de error claros al usuario

---

## ARCHIVOS A MODIFICAR

1. `src/mcp/mcp-universal.js` - Verificar puerto y agregar detección de proceso viejo
2. `src/app/main.js` - Iniciar servidores automáticamente si no están corriendo
3. `src/core/qwen-executor.js` - Validar model antes de llamar API
4. `src/core/deepseek-executor.js` - Validar model antes de llamar API
5. `src/app/renderer/app.js` - Implementar sistema de dictado estilo ChatGPT
6. `src/app/renderer/index.html` - Actualizar UI del micrófono (botón grabar/detener)
7. `src/app/preload.js` - Agregar IPC para transcripción de audio
8. `src/app/main.js` - Agregar handler IPC para transcripción
9. `INICIAR_TODO.bat` - Verificar y matar procesos en puertos antes de iniciar

---

## ORDEN DE IMPLEMENTACIÓN

1. **PRIMERO**: Corregir puertos y validación de modelo (Errores 1 y 3)
2. **SEGUNDO**: Mejorar selector de modelos con fallback (Error 4)
3. **TERCERO**: Implementar dictado de voz estilo ChatGPT (Error 5)
4. **CUARTO**: Agregar iniciar servidores automáticamente (Error 2)

---

## CHECKLIST FINAL DE VERIFICACIÓN

- [ ] Puerto 6000 se usa correctamente (no 3001)
- [ ] Servidores 6002 y 6003 se inician automáticamente o muestran mensaje claro
- [ ] Error "model is not defined" resuelto
- [ ] Selector de modelos muestra modelos disponibles (o por defecto)
- [ ] Micrófono funciona como dictado (grabar → transcribir → insertar en chat)
- [ ] No hay errores en consola
- [ ] Aplicación funciona en modo API y Local
- [ ] Todos los mensajes de error son claros y útiles

