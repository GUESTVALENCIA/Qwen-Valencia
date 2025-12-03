# 📋 Modelos Configurados - Qwen-Valencia

## 🎯 Resumen

Qwen-Valencia está optimizado con **6+ modelos API de Groq** y **solo 2 modelos locales ligeros** para optimizar el uso de memoria RAM. Los modelos están configurados para usar **Qwen** y **DeepSeek** exclusivamente.

**Optimización de memoria**: Se redujeron los modelos locales pesados para mejorar el rendimiento en sistemas con poca RAM.

---

## 🚀 Modelos Qwen

### Modelos API (Groq) - 4 modelos disponibles

#### Qwen 2.5 72B Instruct (Groq API) ⭐ Recomendado
- **ID**: `qwen-2.5-72b-instruct`
- **Proveedor**: Groq
- **Tokens**: 32K
- **Velocidad**: ⚡⚡⚡ Ultra rápido
- **Uso**: General, razonamiento complejo, máximo rendimiento
- **Modelo Groq**: `qwen2.5-72b-instruct`
- **Estado**: ✅ Disponible vía API

#### Qwen 2.5 32B Instruct (Groq API)
- **ID**: `qwen-2.5-32b-instruct`
- **Proveedor**: Groq
- **Tokens**: 32K
- **Velocidad**: ⚡⚡ Rápido
- **Uso**: General, balance perfecto entre potencia y velocidad
- **Modelo Groq**: `qwen2.5-32b-instruct`
- **Estado**: ✅ Disponible vía API

#### Qwen 2.5 14B Instruct (Groq API)
- **ID**: `qwen-2.5-14b-instruct`
- **Proveedor**: Groq
- **Tokens**: 32K
- **Velocidad**: ⚡⚡ Rápido
- **Uso**: General, tareas rápidas
- **Modelo Groq**: `qwen2.5-14b-instruct`
- **Estado**: ✅ Disponible vía API

#### Qwen 2.5 7B Instruct (Groq API)
- **ID**: `qwen-2.5-7b-instruct`
- **Proveedor**: Groq
- **Tokens**: 32K
- **Velocidad**: ⚡⚡⚡ Ultra rápido
- **Uso**: General, respuestas instantáneas
- **Modelo Groq**: `qwen2.5-7b-instruct`
- **Estado**: ✅ Disponible vía API

### Modelos Locales (Ollama) - 1 modelo ligero

#### Qwen 2.5 7B Instruct (Ollama Local) ⭐ Único modelo local Qwen
- **ID**: `qwen2.5:7b-instruct`
- **Proveedor**: Ollama
- **Tokens**: 32K
- **Velocidad**: 🐢 Medio (depende de GPU)
- **Uso**: General, privacidad total, modelo ligero
- **Modelo Ollama**: `qwen2.5:7b-instruct`
- **Estado**: ⚠️ Requiere instalación: `ollama pull qwen2.5:7b-instruct`
- **Memoria requerida**: ~4GB RAM

**Nota**: El modelo `qwen2.5vl:3b` fue eliminado para optimizar memoria. Para imágenes, se usa Qwen estándar.

---

## 🧠 Modelos DeepSeek

### Modelos API (Groq) - 3 modelos disponibles

#### DeepSeek R1 70B Distill Llama (Groq API) ⭐ Recomendado
- **ID**: `deepseek-r1-distill-llama-70b`
- **Proveedor**: Groq
- **Tokens**: 8K
- **Velocidad**: ⚡⚡⚡ Ultra rápido
- **Uso**: Razonamiento profundo, análisis complejo, inferencia lógica
- **Modelo Groq**: `deepseek-r1-distill-llama-70b`
- **Estado**: ✅ Disponible vía API

#### DeepSeek R1 7B Distill Qwen (Groq API)
- **ID**: `deepseek-r1-distill-qwen-7b`
- **Proveedor**: Groq
- **Tokens**: 8K
- **Velocidad**: ⚡⚡⚡ Ultra rápido
- **Uso**: Razonamiento rápido y eficiente
- **Modelo Groq**: `deepseek-r1-distill-qwen-7b`
- **Estado**: ✅ Disponible vía API

#### DeepSeek R1 8B Distill Llama (Groq API)
- **ID**: `deepseek-r1-distill-llama-8b`
- **Proveedor**: Groq
- **Tokens**: 8K
- **Velocidad**: ⚡⚡ Rápido
- **Uso**: Razonamiento balanceado
- **Modelo Groq**: `deepseek-r1-distill-llama-8b`
- **Estado**: ✅ Disponible vía API

### Modelos Locales (Ollama) - 1 modelo ligero

#### DeepSeek Coder 6.7B (Ollama Local) ⭐ Único modelo local DeepSeek
- **ID**: `deepseek-coder:6.7b`
- **Proveedor**: Ollama
- **Tokens**: 16K
- **Velocidad**: ⚡ Rápido
- **Uso**: Especializado en código, programación, debugging
- **Modelo Ollama**: `deepseek-coder:6.7b`
- **Estado**: ⚠️ Requiere instalación: `ollama pull deepseek-coder:6.7b`
- **Memoria requerida**: ~3GB RAM

**Nota**: El modelo `deepseek-r1:7b` fue eliminado para optimizar memoria.

---

## 🔄 Modo Auto

El sistema incluye un **Modo Auto** optimizado que selecciona automáticamente el modelo más apropiado según:
- **Tipo de tarea**: 
  - Código → DeepSeek Coder (local) o DeepSeek R1 (API)
  - Razonamiento → DeepSeek R1 (API) o DeepSeek Coder (local)
  - General → Qwen 72B/32B (API) o Qwen 7B (local)
- **Presencia de imágenes**: Qwen estándar (local o API según configuración)
- **Toggle API**: 
  - API activado (por defecto) → Prioriza modelos Groq API
  - API desactivado → Usa solo modelos locales ligeros

**Optimización**: El modo Auto prioriza modelos API cuando están disponibles para mejor rendimiento y menor uso de memoria.

---

## 📊 Comparativa de Modelos

### Modelos API (Groq) - 7 modelos

| Modelo | Tokens | Velocidad | Uso Principal |
|--------|--------|-----------|---------------|
| Qwen 2.5 72B | 32K | ⚡⚡⚡ | General, máximo rendimiento |
| Qwen 2.5 32B | 32K | ⚡⚡ | General, balanceado |
| Qwen 2.5 14B | 32K | ⚡⚡ | General, rápido |
| Qwen 2.5 7B | 32K | ⚡⚡⚡ | General, ultra rápido |
| DeepSeek R1 70B | 8K | ⚡⚡⚡ | Razonamiento profundo |
| DeepSeek R1 7B | 8K | ⚡⚡⚡ | Razonamiento rápido |
| DeepSeek R1 8B | 8K | ⚡⚡ | Razonamiento balanceado |

### Modelos Locales (Ollama) - 2 modelos ligeros

| Modelo | Tokens | Velocidad | Memoria | Uso Principal |
|--------|--------|-----------|---------|---------------|
| Qwen 2.5 7B | 32K | 🐢 | ~4GB | General local |
| DeepSeek Coder 6.7B | 16K | ⚡ | ~3GB | Código, programación |

**Total**: 9 modelos (7 API + 2 locales)

---

## 🛠️ Instalación de Modelos Ollama

Para usar modelos locales, instala Ollama y descarga **solo los 2 modelos ligeros**:

```bash
# Instalar Ollama (si no está instalado)
# Descargar desde: https://ollama.ai

# Modelos locales ligeros (solo 2)
ollama pull qwen2.5:7b-instruct      # Qwen ligero
ollama pull deepseek-coder:6.7b      # DeepSeek Coder ligero
```

**Nota**: Los modelos pesados (`qwen2.5vl:3b`, `deepseek-r1:7b`) fueron eliminados para optimizar memoria. Se recomienda usar modelos API para mejor rendimiento.

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

## 💾 Optimización de Memoria

El sistema incluye verificación automática de memoria RAM:
- **Advertencia**: Si hay menos de 4GB RAM disponible, se muestra advertencia al usar modelos locales
- **Recomendación**: Usar modelos API cuando hay poca memoria disponible
- **Modelos locales**: Requieren al menos 4-6GB RAM libre para funcionar correctamente

## 📝 Notas

- **Modelos API**: No requieren descarga ni GPU local, solo conexión a internet y API key válida
- **Modelos locales**: Requieren instalación con `ollama pull` y GPU recomendada (4GB+ RAM)
- **Modo Auto**: Prioriza modelos API cuando están disponibles para mejor rendimiento
- **Memoria**: Se redujeron modelos locales pesados para optimizar uso de RAM
- Los modelos se pueden cambiar en tiempo real desde la UI

## 🗑️ Modelos Eliminados

Los siguientes modelos fueron eliminados para optimizar memoria:
- `qwen2.5vl:3b` - Modelo VL pesado (reemplazado por Qwen estándar)
- `deepseek-r1:7b` - Modelo R1 pesado (reemplazado por DeepSeek Coder ligero)

**Razón**: Estos modelos requerían mucha memoria RAM y fueron reemplazados por modelos más ligeros o equivalentes en API.

---

**Última actualización**: 2025-12-03
**Versión**: Qwen-Valencia v1.0.0
**Optimización**: 6+ modelos API, 2 modelos locales ligeros
