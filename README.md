# 🚀 Qwen-Valencia - Sistema de IA Multimodal con Qwen + DeepSeek

## 🎯 OBJETIVO

Sistema **100% LIMPIO** con Qwen + DeepSeek ejecutores en su **máximo esplendor**, sin contaminación descriptiva de ChatGPT/Claude.

**NO HAY BLOQUEOS. NO HAY DESCRIPCIONES. SOLO EJECUCIÓN REAL.**

Sistema auto-inteligente que selecciona automáticamente el modelo apropiado según el tipo de tarea, con integración completa de Sandra IA 8.0 como orquestador maestro.

---

## 🧠 MODELOS

### Optimización de Memoria RAM ⚡

Qwen-Valencia está optimizado con **7 modelos API de Groq** y **solo 2 modelos locales MUY LIGEROS** para reducir el uso de memoria RAM.

**Total de RAM local: ~1.7 GB** (vs ~11.7 GB anterior)

### Modelos API (Groq) - 7 modelos disponibles

#### Qwen (4 modelos)

- **Qwen 2.5 72B**: `qwen-2.5-72b-instruct` ⭐ Más potente
- **Qwen 2.5 32B**: `qwen-2.5-32b-instruct` - Balanceado
- **Qwen 2.5 14B**: `qwen-2.5-14b-instruct` - Rápido
- **Qwen 2.5 7B**: `qwen-2.5-7b-instruct` - Ultra rápido

#### DeepSeek (3 modelos)

- **DeepSeek R1 70B**: `deepseek-r1-distill-llama-70b` ⭐ Razonamiento profundo
- **DeepSeek R1 7B**: `deepseek-r1-distill-qwen-7b` - Razonamiento rápido
- **DeepSeek R1 8B**: `deepseek-r1-distill-llama-8b` - Razonamiento balanceado

### Modelos Locales (Ollama) - 2 modelos MUY LIGEROS ⚡

- **Qwen 2.5 1.5B**: `qwen2.5:1.5b-instruct` - Conversacional ultra ligero (~986 MB RAM)
- **DeepSeek Coder 1.3B**: `deepseek-coder:1.3b` - Especializado en código ultra ligero (~776 MB RAM)

**Total: ~1.7 GB RAM** (optimizado para sistemas con poca memoria)

> ⚠️ **Nota**: Los modelos pesados (`qwen2.5:7b`, `qwen2.5vl:3b`, `deepseek-coder:6.7b`, `deepseek-r1:7b`) fueron desinstalados para liberar ~10 GB de RAM. Para modelos potentes, usar API Groq.

---

## 🎯 SISTEMA AUTO-INTELIGENTE

### Selección Automática de Modelos

El sistema detecta automáticamente el tipo de tarea y selecciona el modelo apropiado:

- **Razonamiento profundo** → DeepSeek R1 (API) o DeepSeek Coder 1.3B (local)
- **Código y programación** → DeepSeek Coder (API o local)
- **Multimodal (imágenes)** → Qwen (API o local)
- **Tareas generales** → Qwen (API o local)
- **Orquestación compleja** → Sandra IA 8.0 (orquestador maestro)

### DeepSeekExecutor - Sistema Auto-Inteligente

El `DeepSeekExecutor` incluye detección automática de tareas:

```javascript
// Detecta automáticamente:
- taskType: 'reasoning' | 'code' | 'orchestration' | 'multimodal'
- Selecciona modelo apropiado según tipo
- Fallback híbrido a Qwen si es necesario
```

**Características:**

- ✅ Detección automática de tipo de tarea
- ✅ Selección inteligente de modelo (reasoning/code)
- ✅ Fallback híbrido a Qwen para tareas multimodales
- ✅ Compatibilidad total con Qwen (sin supremacía)
- ✅ Circuit breakers y retry logic
- ✅ Validación de parámetros
- ✅ Manejo de errores unificado

---

## 🚀 INSTALACIÓN

```bash
# 1. Clonar repo
git clone https://github.com/GUESTVALENCIA/Qwen-Valencia.git
cd Qwen-Valencia

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
# Crear archivo qwen-valencia.env con:
GROQ_API_KEY=tu_api_key_aqui

# 4. Instalar modelos Ollama (solo modelos ligeros)
ollama pull qwen2.5:1.5b-instruct      # Qwen ultra ligero (~986 MB)
ollama pull deepseek-coder:1.3b         # DeepSeek ultra ligero (~776 MB)

# 5. Limpiar modelos pesados (opcional)
node scripts/cleanup-ollama-models.js

# 6. Iniciar aplicación
npm start
```

---

## ⚙️ CONFIGURACIÓN

### Variables de Entorno (`qwen-valencia.env`)

```env
# Groq API (requerido para modelos API)
GROQ_API_KEY=tu_api_key_aqui

# Ollama (opcional, para modelos locales)
OLLAMA_BASE_URL=http://localhost:11434

# MCP Universal Server
MCP_PORT=6000
MCP_SECRET_KEY=tu_secret_key_aqui

# Modo por defecto
MODE=auto  # auto, groq, ollama
```

### Modelos Locales (Ollama)

**Configuración automática:**

- Qwen: `qwen2.5:1.5b-instruct` (auto-detectado)
- DeepSeek: `deepseek-coder:1.3b` (auto-detectado)

**Variables de entorno opcionales:**

```env
QWEN_MODEL_OLLAMA=qwen2.5:1.5b-instruct
DEEPSEEK_MODEL_OLLAMA_CODE=deepseek-coder:1.3b
DEEPSEEK_MODEL_OLLAMA_REASONING=deepseek-coder:1.3b
```

---

## 🎯 CARACTERÍSTICAS

### Ejecutores

✅ **QwenExecutor**: Núcleo ejecutor puro para Qwen
✅ **DeepSeekExecutor**: Núcleo ejecutor puro con sistema auto-inteligente
✅ **ModelRouter**: Routing inteligente entre modelos
✅ **Sandra IA 8.0**: Orquestador maestro integrado

### Capacidades

✅ **Ejecución Real**: NO describe, EJECUTA
✅ **Sin Bloqueos**: Sin webhooks de ChatGPT/Claude
✅ **Multimodal**: Qwen procesa imágenes y texto
✅ **Especializado**: DeepSeek para código y razonamiento profundo
✅ **Sistema Auto**: Selección inteligente de modelos según tarea
✅ **Flexible**: 7 modelos API + 2 modelos locales ultra ligeros
✅ **Optimizado**: Solo ~1.7 GB RAM para modelos locales
✅ **Híbrido**: Compatibilidad total Qwen + DeepSeek (sin supremacía)
✅ **Orquestación**: Integración con Sandra IA 8.0
✅ **100% Limpio**: Sin contaminación descriptiva

---

## 📋 ESTRUCTURA

```
Qwen-Valencia/
├── src/
│   ├── core/
│   │   ├── qwen-executor.js          # Núcleo ejecutor Qwen
│   │   └── deepseek-executor.js      # Núcleo ejecutor DeepSeek (auto-inteligente)
│   ├── orchestrator/
│   │   └── model-router.js           # Routing inteligente Qwen + DeepSeek + Sandra
│   ├── mcp/
│   │   ├── mcp-universal.js          # Servidor MCP Universal
│   │   ├── ollama-mcp-server.js      # Servidor MCP Ollama
│   │   ├── groq-api-server.js        # Servidor MCP Groq
│   │   └── sandra-ia-mcp-server.js   # Servidor MCP Sandra IA 8.0
│   └── app/
│       ├── main.js                   # Electron main process
│       ├── preload.js                # IPC bridge
│       └── renderer/
│           ├── index.html            # UI principal
│           └── components/
│               ├── app.js            # Lógica frontend
│               └── model-selector.js # Selector de modelos
├── core/
│   └── sandra-core/                  # Núcleo de Sandra IA 8.0
│       ├── orchestrator.js           # Orquestador maestro
│       ├── decision-engine.js        # Motor de decisión
│       └── model-invoker.js          # Invocador de modelos
├── scripts/
│   ├── cleanup-ollama-models.js       # Limpieza de modelos pesados
│   └── health-check.js               # Verificación de salud
├── config/
│   ├── models.json                   # Configuración de modelos
│   └── sandra-orchestrator.json      # Configuración Sandra IA
├── qwen-valencia.env                 # Variables de entorno
└── package.json
```

---

## 🔥 INTEGRACIÓN CON SANDRA IA 8.0

### Sandra IA como Orquestador Maestro

Sandra IA 8.0 está integrada como otro modelo disponible en el sistema:

- **Modelo**: `sandra-ia-8.0`
- **Puerto MCP**: `6004`
- **Capacidades**: Orquestación, multimodal, subagentes, razonamiento avanzado
- **Fallback**: Si Sandra IA no está disponible, usa Qwen como fallback

### Selección de Modelos

En la aplicación, puedes seleccionar entre:

- **Sandra IA 8.0**: Orquestador maestro con 117 subagentes
- **QWEN Valencia**: Sistema auto que selecciona Qwen o DeepSeek
- **Modelos individuales**: Qwen o DeepSeek específicos

---

## 🚀 USO

### Ejemplo Básico

```javascript
const ModelRouter = require('./src/orchestrator/model-router');

const router = new ModelRouter();

// El sistema auto-detecta el tipo de tarea y selecciona el modelo apropiado
const response = await router.route(
  'Analiza este código y sugiere mejoras',
  'text',
  [],
  { model: 'auto' } // Sistema auto-inteligente
);
```

### Ejemplo con DeepSeekExecutor

```javascript
const DeepSeekExecutor = require('./src/core/deepseek-executor');

const deepseek = new DeepSeekExecutor({
  groqApiKey: process.env.GROQ_API_KEY
});

// El sistema detecta automáticamente que es código y usa deepseek-coder
const response = await deepseek.execute('Escribe una función Python para ordenar una lista');
```

### Ejemplo con Sandra IA

```javascript
const response = await router.route(
  'Orquesta una tarea compleja que requiere múltiples modelos',
  'text',
  [],
  { model: 'sandra-ia-8.0' }
);
```

---

## 📊 COMPARATIVA DE MODELOS

### Modelos API (Groq) - 7 modelos

| Modelo          | Tokens | Velocidad | Uso Principal               |
| --------------- | ------ | --------- | --------------------------- |
| Qwen 2.5 72B    | 32K    | ⚡⚡⚡    | General, máximo rendimiento |
| Qwen 2.5 32B    | 32K    | ⚡⚡      | General, balanceado         |
| Qwen 2.5 14B    | 32K    | ⚡⚡      | General, rápido             |
| Qwen 2.5 7B     | 32K    | ⚡⚡⚡    | General, ultra rápido       |
| DeepSeek R1 70B | 8K     | ⚡⚡⚡    | Razonamiento profundo       |
| DeepSeek R1 7B  | 8K     | ⚡⚡⚡    | Razonamiento rápido         |
| DeepSeek R1 8B  | 8K     | ⚡⚡      | Razonamiento balanceado     |

### Modelos Locales (Ollama) - 2 modelos ultra ligeros

| Modelo              | Tokens | Velocidad | Memoria | Uso Principal              |
| ------------------- | ------ | --------- | ------- | -------------------------- |
| Qwen 2.5 1.5B       | 32K    | ⚡        | ~986 MB | General local ultra ligero |
| DeepSeek Coder 1.3B | 16K    | ⚡        | ~776 MB | Código local ultra ligero  |

**Total**: 9 modelos (7 API + 2 locales ultra ligeros)

---

## 🛠️ SCRIPTS DISPONIBLES

```bash
# Iniciar aplicación
npm start

# Limpiar modelos pesados de Ollama
node scripts/cleanup-ollama-models.js

# Verificar salud del sistema
npm run health

# Validar configuración
npm run validate

# Probar orquestador Sandra
npm run test
```

---

## 💾 OPTIMIZACIÓN DE MEMORIA

### Antes de la Optimización

- Modelos locales: ~11.7 GB RAM
- Modelos pesados instalados

### Después de la Optimización

- Modelos locales: ~1.7 GB RAM
- Solo modelos ultra ligeros
- **Liberación: ~10 GB RAM**

### Recomendaciones

- **Sistemas con poca RAM (< 8GB)**: Usar solo modelos API (Groq)
- **Sistemas con RAM media (8-16GB)**: Usar modelos locales ligeros + API
- **Sistemas con mucha RAM (> 16GB)**: Pueden instalar modelos más pesados si lo desean

---

## 🔄 FLUJO DE FUNCIONAMIENTO

### 1. Recepción de Tarea

- Usuario envía tarea/pregunta
- Sistema auto-inteligente analiza la tarea
- Identifica tipo: reasoning, code, multimodal, orchestration

### 2. Selección de Modelo

- **Sistema Auto**: Selecciona Qwen o DeepSeek según tipo
- **DeepSeekExecutor**: Auto-detecta y selecciona modelo apropiado
- **Sandra IA**: Orquesta tareas complejas con múltiples modelos

### 3. Ejecución

- **API (Groq)**: Rápido, potente, sin uso de RAM local
- **Local (Ollama)**: Privado, ultra ligero, solo ~1.7 GB RAM

### 4. Fallback

- Si API falla → Local
- Si DeepSeek no es apropiado → Qwen
- Si Sandra IA no está disponible → Qwen

### 5. Respuesta

- Sistema presenta resultado al usuario
- Registra métricas de uso y éxito

---

## 🔥 DIFERENCIAS CON OTROS SISTEMAS

| Característica    | Otros Sistemas        | Qwen-Valencia                 |
| ----------------- | --------------------- | ----------------------------- |
| **Núcleo**        | Descriptivo (ChatGPT) | Ejecutor puro (Qwen/DeepSeek) |
| **Bloqueos**      | ✅ Sí (webhooks)      | ❌ NO                         |
| **Ejecución**     | Describe acciones     | Ejecuta acciones              |
| **Modelos**       | GPT/Claude/Gemini     | Qwen/DeepSeek                 |
| **Sistema Auto**  | ❌ No                 | ✅ Sí (detección automática)  |
| **Memoria Local** | ~11+ GB               | ~1.7 GB                       |
| **Orquestación**  | ❌ No                 | ✅ Sandra IA 8.0              |
| **Contaminación** | ✅ Sí                 | ❌ NO                         |

---

## 📝 LICENCIA

MIT - Libre para uso personal y comercial

---

## 🆘 SOPORTE

### Problemas Comunes

**Error: "Cannot find module '../core/deepseek-executor'"**

- Solución: Verificar que `src/core/deepseek-executor.js` existe

**Error: "GROQ_API_KEY no encontrada"**

- Solución: Crear archivo `qwen-valencia.env` con `GROQ_API_KEY=tu_key`

**Modelos locales no funcionan**

- Solución: Ejecutar `ollama pull qwen2.5:1.5b-instruct` y `ollama pull deepseek-coder:1.3b`

**Memoria RAM insuficiente**

- Solución: Usar solo modelos API (Groq), desinstalar modelos locales pesados

---

**Creado con ❤️ para ejecución REAL sin bloqueos**

**Versión**: 1.0.0  
**Última actualización**: 2025-12-04  
**Optimización**: 7 modelos API + 2 modelos locales ultra ligeros (~1.7 GB RAM)
