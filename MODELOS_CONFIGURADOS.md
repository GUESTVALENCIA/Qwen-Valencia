# 📋 Modelos Configurados - Qwen-Valencia

## 🎯 Resumen

Qwen-Valencia está configurado para usar modelos **Qwen** y **DeepSeek** exclusivamente, tanto vía **Groq API** (online, rápido) como **Ollama** (local, privado).

---

## 🚀 Modelos Qwen

### Qwen 2.5 72B Instruct (Groq API)
- **ID**: `qwen-2.5-72b-instruct`
- **Proveedor**: Groq
- **Tokens**: 8K
- **Velocidad**: ⚡⚡⚡ Ultra rápido
- **Uso**: General, razonamiento complejo, ejecución de código
- **Modelo Groq**: `qwen2.5-72b-instruct`
- **Estado**: ✅ Disponible vía API

### Qwen 2.5 7B Instruct (Ollama Local)
- **ID**: `qwen2.5:7b-instruct`
- **Proveedor**: Ollama
- **Tokens**: 32K
- **Velocidad**: 🐢 Medio (depende de GPU)
- **Uso**: General, privacidad total
- **Modelo Ollama**: `qwen2.5:7b-instruct`
- **Estado**: ⚠️ Requiere instalación: `ollama pull qwen2.5:7b-instruct`

### Qwen 2.5 VL 3B (Ollama Local - Multimodal)
- **ID**: `qwen2.5vl:3b`
- **Proveedor**: Ollama
- **Tokens**: 32K
- **Velocidad**: 🐢 Medio
- **Uso**: Procesamiento de imágenes, visión
- **Modelo Ollama**: `qwen2.5vl:3b`
- **Estado**: ⚠️ Requiere instalación: `ollama pull qwen2.5vl:3b`

### Qwen 2.5 3B Instruct (Ollama Local)
- **ID**: `qwen2.5:3b-instruct`
- **Proveedor**: Ollama
- **Tokens**: 32K
- **Velocidad**: ⚡ Rápido (modelo pequeño)
- **Uso**: Tareas rápidas, respuestas cortas
- **Modelo Ollama**: `qwen2.5:3b-instruct`
- **Estado**: ⚠️ Requiere instalación: `ollama pull qwen2.5:3b-instruct`

---

## 🧠 Modelos DeepSeek

### DeepSeek R1 70B Distill Llama (Groq API)
- **ID**: `deepseek-r1-distill-llama-70b`
- **Proveedor**: Groq
- **Tokens**: 8K
- **Velocidad**: ⚡⚡⚡ Ultra rápido
- **Uso**: Razonamiento profundo, análisis complejo, inferencia lógica
- **Modelo Groq**: `deepseek-r1-distill-llama-70b`
- **Estado**: ✅ Disponible vía API

### DeepSeek R1 7B (Ollama Local)
- **ID**: `deepseek-r1:7b`
- **Proveedor**: Ollama
- **Tokens**: 32K
- **Velocidad**: 🐢 Medio
- **Uso**: Razonamiento profundo local, análisis complejo
- **Modelo Ollama**: `deepseek-r1:7b`
- **Estado**: ⚠️ Requiere instalación: `ollama pull deepseek-r1:7b`

### DeepSeek Coder 6.7B (Ollama Local)
- **ID**: `deepseek-coder:6.7b`
- **Proveedor**: Ollama
- **Tokens**: 16K
- **Velocidad**: ⚡ Rápido
- **Uso**: Especializado en código, programación, debugging
- **Modelo Ollama**: `deepseek-coder:6.7b`
- **Estado**: ⚠️ Requiere instalación: `ollama pull deepseek-coder:6.7b`

---

## 🔄 Modo Auto

El sistema incluye un **Modo Auto** que selecciona automáticamente el modelo más apropiado según:
- **Tipo de tarea**: Código → DeepSeek, General → Qwen
- **Presencia de imágenes**: Si hay imágenes → Qwen VL
- **Toggle API**: API activado → Groq, API desactivado → Ollama

---

## 📊 Comparativa de Modelos

| Modelo | Proveedor | Tokens | Velocidad | Uso Principal |
|--------|-----------|--------|-----------|---------------|
| Qwen 2.5 72B | Groq | 8K | ⚡⚡⚡ | General, razonamiento |
| Qwen 2.5 7B | Ollama | 32K | 🐢 | General local |
| Qwen 2.5 VL 3B | Ollama | 32K | 🐢 | Imágenes, visión |
| Qwen 2.5 3B | Ollama | 32K | ⚡ | Tareas rápidas |
| DeepSeek R1 70B | Groq | 8K | ⚡⚡⚡ | Razonamiento profundo |
| DeepSeek R1 7B | Ollama | 32K | 🐢 | Razonamiento local |
| DeepSeek Coder 6.7B | Ollama | 16K | ⚡ | Código, programación |

---

## 🛠️ Instalación de Modelos Ollama

Para usar modelos locales, instala Ollama y descarga los modelos:

```bash
# Instalar Ollama (si no está instalado)
# Descargar desde: https://ollama.ai

# Modelos Qwen
ollama pull qwen2.5:7b-instruct
ollama pull qwen2.5vl:3b
ollama pull qwen2.5:3b-instruct

# Modelos DeepSeek
ollama pull deepseek-r1:7b
ollama pull deepseek-coder:6.7b
```

---

## ⚙️ Configuración

### Variables de Entorno

```env
# Groq API (para modelos online)
GROQ_API_KEY=tu_api_key_aqui

# Ollama (para modelos locales)
OLLAMA_BASE_URL=http://localhost:11434

# Modo por defecto
MODE=auto  # auto, groq, ollama
```

### Selección de Modelo

1. **Manual**: Usa el selector de modelos en la UI
2. **Auto**: Activa el modo auto para selección automática
3. **Multi-modelo**: Selecciona múltiples modelos para comparar respuestas

---

## 📝 Notas

- Los modelos Groq requieren conexión a internet y API key válida
- Los modelos Ollama requieren instalación local y GPU recomendada
- El modo auto selecciona el mejor modelo según la tarea
- Los modelos se pueden cambiar en tiempo real desde la UI

---

**Última actualización**: 2025-12-03
**Versión**: Qwen-Valencia v1.0.0
