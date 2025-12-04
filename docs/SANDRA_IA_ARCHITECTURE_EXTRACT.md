# 🏗️ Arquitectura y Funcionalidad de Sandra IA - Extracción del Workflow

**Fecha:** 2025-01-11  
**Fuente:** Workflow completo de Sandra Studio  
**Estado:** Extracción técnica completa

---

## 📊 RESUMEN EJECUTIVO

### Objetivo del Sistema
Sandra IA es un sistema de inteligencia artificial multimodal, robusto y potente, construido con modelos de código abierto (Qwen y DeepSeek), orquestado por 117 subagentes especializados, diseñado para funcionar principalmente online vía Groq API con un modelo local ligero para orquestación mínima.

---

## 🧠 ARQUITECTURA DE MODELOS

### Modelos Online (Groq API)

#### 1. Razonamiento Profundo
- **Qwen:** `qwen3-235b-a22b` (Qwen3 MAX, 235B parámetros, MoE, multimodal)
- **DeepSeek:** `deepseek-r1` (236B parámetros, MoE, entrenado en 8T tokens)

#### 2. Análisis Visual (Multimodal)
- **Qwen:** `qwen-vl-max` (OCR preciso, razonamiento visual, análisis de gráficos, ~32K tokens visuales)
- **DeepSeek:** `deepseek-vl-7b-chat` (detección de objetos, escenas complejas)

#### 3. Ejecución de Código
- **Qwen:** `qwen3-235b-a22b` (soporta code generation)
- **DeepSeek:** `deepseek-coder-v2` (generación segura, refactorización, tests unitarios)

#### 4. Audio/Voz
- **Qwen:** `qwen-audio-chat` (STT multilingüe, TTS natural, análisis emocional de voz)
- **DeepSeek:** No disponible aún

### Modelo Local Ligero (Orquestación Mínima)
- **Qwen:** `Qwen2.5-1.5B-Instruct-GGUF` (Q4_K_M, ~0.9 GB)
  - Comunicación con app
  - Control de subagentes
  - Fallback de bajo nivel
  - Ejecución de scripts de control

---

## ⚙️ SISTEMA DE ORQUESTACIÓN

### Principios Fundamentales
1. **Sin Prioridades Estáticas:** Ningún modelo tiene prioridad numérica sobre otro
2. **Selección Dinámica:** El sistema Auto-Agent decide qué modelo usar según:
   - Tipo de tarea
   - Especialidad del modelo
   - Historial de éxito
   - Latencia y disponibilidad
   - Balance de carga
3. **Uso Dual Simultáneo:** Ambos modelos (Qwen + DeepSeek) están activos simultáneamente
4. **Asignación Funcional:** Cada modelo tiene un `role` que define su función en la tarea, no su prioridad

### Lógica de Selección por Tarea

#### Razonamiento
```javascript
// Siempre devuelve ambos modelos
return [
  { provider: 'groq', model: 'qwen3-235b-a22b', role: 'primary-reasoner' },
  { provider: 'groq', model: 'deepseek-r1', role: 'co-reasoner' }
];
```

#### Visión
- **Documentos/Texto:** Qwen-VL (OCR) + DeepSeek-VL (análisis de escena)
- **Objetos/Escenas:** DeepSeek-VL (detección) + Qwen-VL (contexto)
- **General:** Ambos en paralelo

#### Código
- **Python/JS/TS:** Qwen3 (diseño lógico) + DeepSeek-Coder (implementación)
- **Rust/C++/Go:** DeepSeek-Coder (programación de sistemas) + Qwen3 (revisión de seguridad)
- **General:** DeepSeek-Coder (primario) + Qwen3 (secundario)

---

## 🤖 SISTEMA DE SUBAGENTES (117 Subagentes)

### Arquitectura de Subagentes

#### Nivel 1: Core Agents
- `sandra_core` - Núcleo principal
- `mcp_coordinator` - Coordinador MCP
- `galaxy_platform` - Plataforma Galaxy
- `memory_manager` - Gestor de memoria

#### Nivel 2: Business Agents
- `negotiation` - Negociación
- `booking` - Reservas
- `payment` - Pagos
- `property` - Propiedades

#### Nivel 3: Communication Agents
- `multimodal` - Multimodal
- `whatsapp` - WhatsApp
- `voice` - Voz
- `avatar` - Avatar

#### Nivel 4: Support Agents
- `training` - Entrenamiento
- `analytics` - Análisis
- `security` - Seguridad
- `cache` - Caché

### Subagentes Especializados Identificados

#### Monitores
1. `sandra-coo` - Sandra COO (Groq Llama 3.3 70B) - Orquestador principal
2. `sistema-conversacional-analyst` - Analista de Sistemas Conversacionales
3. `conversational-code-reviewer` - Revisor de Código Conversacional
4. `app-functionality-monitor` - Monitor de Funcionalidad de App
5. `app-performance-monitor` - Monitor de Performance
6. `git-repo-monitor` - Monitor de Repositorio Git

#### Especialistas
1. `claude-code` - Claude Code Assistant (Claude 3.5 Sonnet)
2. `sandra-groq` - Sandra con Super Poderes MCP
3. `deepgram-stt-specialist` - Especialista en Deepgram STT
4. `frontend-audio-specialist` - Especialista en Audio Frontend
5. `frontend-specialist` - Especialista en Frontend
6. `event-handler-specialist` - Especialista en Event Handlers
7. `ui-specialist` - Especialista en UI/UX
8. `code-reviewer` - Revisor de Código

---

## 🔄 FLUJO DE FUNCIONAMIENTO

### 1. Recepción de Tarea
- Usuario envía tarea/pregunta
- Sistema Auto-Agent analiza la tarea
- Identifica tipo: reasoning, vision, code, audio

### 2. Selección de Modelos
- Sistema selecciona modelos apropiados (siempre 2: Qwen + DeepSeek)
- Asigna roles funcionales a cada modelo
- Verifica disponibilidad y latencia

### 3. Ejecución
- **Paralelo:** Ambos modelos procesan simultáneamente
- **Secuencial:** Un modelo diseña, otro implementa
- **Consenso:** Compara salidas y fusiona resultados

### 4. Orquestación de Subagentes
- Si requiere especialización, invoca subagente apropiado
- Subagente puede usar modelo específico según su especialidad
- Resultado se integra en respuesta final

### 5. Respuesta
- Sistema fusiona/valida respuestas de ambos modelos
- Presenta resultado unificado al usuario
- Registra métricas de uso y éxito

---

## 📦 COMPONENTES DEL SISTEMA

### 1. Orquestador Principal
- **Archivo:** `llm-orchestrator/ai-orchestrator.js`
- **Función:** Coordinador central de modelos y subagentes
- **Características:**
  - Selección dinámica de modelos
  - Balanceo de carga
  - Gestión de fallbacks
  - Integración con MCP Server

### 2. Sistema de Roles
- **Archivo:** `core/roles-system.js`
- **Función:** Asignación de modelos según rol
- **Características:**
  - Mapeo rol → modelo
  - Contexto online/offline
  - Especialización por dominio

### 3. MCP Server
- **Puerto:** 3141
- **Función:** Servidor Model Context Protocol
- **Características:**
  - Integración con 117 subagentes
  - Invocación desde Claude/Cursor
  - Automatización completa

### 4. Configuración
- **Archivo:** `config/models.json`
- **Contenido:** Definición de todos los modelos
- **Formato:** JSON estructurado por categoría

### 5. Health Check
- **Script:** `scripts/health-check.mjs`
- **Función:** Verificación del sistema
- **Características:**
  - Estado de modelos online
  - Verificación de subagentes
  - Estado de MCP Server
  - Estado de Avatar (HeyGen + Cartesia)

---

## 🔧 CONFIGURACIÓN TÉCNICA

### Variables de Entorno (.env.pro)
```env
# Groq API (para Qwen3 y DeepSeek-R1)
GROQ_API_KEY=tu_groq_api_key
GROQ_BASE_URL=https://api.groq.com/openai/v1

# Audio (Deepgram + Cartesia + HeyGen)
DEEPGRAM_API_KEY=tu_deepgram_api_key
CARTESIA_API_KEY=tu_cartesia_api_key
HEYGEN_API_KEY=tu_heygen_api_key
HEYGEN_AVATAR_ID=tu_avatar_id

# Base de Datos (Neon)
DATABASE_URL=postgresql://...

# Local (llama.cpp para modelos GGUF)
LLAMACPP_SERVER=http://localhost:8080
```

### Estructura de Directorios
```
IA-SANDRA/
├── config/
│   └── models.json           # Configuración de modelos
├── llm-orchestrator/
│   └── ai-orchestrator.js    # Orquestador principal
├── core/
│   └── roles-system.js       # Sistema de roles
├── scripts/
│   ├── health-check.mjs      # Verificación del sistema
│   └── download-models.sh    # Descarga de modelos locales
├── models/                   # Modelos locales (GGUF)
├── agents/
│   └── subagents-manifest.json  # 117 subagentes
└── .env.pro                  # Variables de entorno
```

---

## 🎯 FUNCIONALIDADES PRINCIPALES

### 1. Multimodalidad
- **Visión:** OCR, análisis de imágenes, detección de objetos
- **Audio:** STT, TTS, análisis emocional
- **Texto:** Razonamiento profundo, generación de código
- **Código:** Generación, refactorización, tests

### 2. Orquestación Inteligente
- Selección automática de modelos
- Balanceo de carga
- Fallback automático
- Paralelización cuando es posible

### 3. Integración con Subagentes
- 117 subagentes especializados
- Invocación bajo demanda
- Especialización por dominio
- Coordinación centralizada

### 4. Persistencia y Estado
- Base de datos Neon (PostgreSQL)
- Gestión de memoria
- Historial de interacciones
- Métricas de uso

---

## 📈 MÉTRICAS Y MONITOREO

### Métricas del Sistema
- **Latencia:** Tiempo de respuesta por modelo
- **Tasa de Éxito:** Porcentaje de tareas completadas correctamente
- **Uso:** Distribución de uso entre modelos
- **Disponibilidad:** Estado de modelos online

### Monitoreo Continuo
- Estado de modelos (online/offline)
- Estado de subagentes
- Estado de MCP Server
- Estado de integraciones (Deepgram, HeyGen, Cartesia)

---

## ✅ REQUISITOS TÉCNICOS

### Modelos Online
- Acceso a Groq API
- API Key válida
- Conexión a internet estable

### Modelo Local
- Espacio en disco: ~1 GB (Qwen2.5-1.5B)
- RAM: ~2 GB mínimo
- CPU: 4+ threads recomendado

### Dependencias
- Node.js 18+
- llama.cpp (para modelos GGUF locales)
- PostgreSQL (Neon)
- APIs de terceros (Deepgram, HeyGen, Cartesia)

---

## 🔒 LICENCIAS Y LEGALIDAD

### Modelos Qwen
- **Licencia:** Apache 2.0
- **Open Weights:** ✅ Sí
- **Uso Comercial:** ✅ Permitido
- **Sin Restricciones:** ✅ Sin censura, sin alineamiento occidental

### Modelos DeepSeek
- **Licencia:** MIT / Apache 2.0
- **Open Weights:** ✅ Sí
- **Uso Comercial:** ✅ Permitido
- **Sin Restricciones:** ✅ Sin censura, sin alineamiento occidental

---

## 📝 NOTAS IMPORTANTES

1. **No hay prioridades estáticas:** Todos los modelos son iguales en jerarquía
2. **Selección dinámica:** El sistema decide según contexto y tarea
3. **Uso dual:** Siempre se usan ambos modelos (Qwen + DeepSeek) cuando es posible
4. **Local mínimo:** Solo un modelo local ligero para orquestación básica
5. **Online primero:** Sistema diseñado para funcionar principalmente online
6. **117 subagentes:** Todos disponibles y listos para usar
7. **Sin marginación:** Ningún modelo es "backup" o "secundario" por defecto

---

**Fin del Documento de Extracción**

