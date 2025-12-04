# 🚀 Sandra IA 8.0 - Sistema de Orquestación Multimodal

**Versión:** 8.0  
**Creado por:** Clay  
**Estado:** En Desarrollo Activo

---

## 🎯 Descripción

Sandra IA 8.0 es un sistema de orquestación de inteligencia artificial multimodal que coordina múltiples modelos (Qwen y DeepSeek) y subagentes especializados para ejecutar tareas complejas de manera colaborativa y eficiente.

---

## 🏗️ Arquitectura

### Componentes Principales

1. **Core de Orquestación** (`core/sandra-core/`)
   - `orchestrator.js` - Orquestador maestro
   - `decision-engine.js` - Motor de decisión inteligente
   - `model-invoker.js` - Invocador de modelos

2. **Scripts de Gestión** (`scripts/`)
   - `select-sandra-subagents.js` - Selección de subagentes
   - `invoke-sandra-subagent.js` - Invocación individual
   - `execute-sandra-subagents.js` - Ejecución masiva
   - `start-sandra-monitoring.js` - Inicio de monitoreo
   - `test-sandra-orchestrator.js` - Pruebas del sistema

3. **Servicios de Monitoreo** (`services/`)
   - `github-monitor.js` - Monitoreo de GitHub
   - `mcp-monitor.js` - Monitoreo MCP
   - `app-updater.js` - Actualizador automático

4. **Configuraciones** (`config/`)
   - `models.json` - Configuración de modelos
   - `sandra-orchestrator.json` - Configuración del orquestador
   - `subagents-sandra.json` - Subagentes seleccionados
   - `subagents-execution.json` - Configuración de ejecución

---

## 🚀 Inicio Rápido

### Prerrequisitos

```bash
# Variables de entorno necesarias
export GROQ_API_KEY="tu-api-key-aqui"
export GITHUB_TOKEN="tu-token-aqui"  # Opcional
```

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/GUESTVALENCIA/IA-SANDRA.git
cd IA-SANDRA

# Instalar dependencias (si hay package.json)
npm install
```

### Uso Básico

#### 1. Probar el Orquestador

```bash
node scripts/test-sandra-orchestrator.js
```

#### 2. Ejecutar Subagentes

```bash
# Ejecutar todos los monitores
node scripts/execute-sandra-subagents.js monitors "Analiza el sistema"

# Ejecutar corrección
node scripts/execute-sandra-subagents.js correction "Revisa el código"

# Ejecutar todos
node scripts/execute-sandra-subagents.js all "Reporte completo"
```

#### 3. Invocar Subagente Individual

```bash
node scripts/invoke-sandra-subagent.js code-reviewer "Revisa este código: ..."
```

#### 4. Iniciar Monitoreo

```bash
node scripts/start-sandra-monitoring.js
```

---

## 📋 Uso Programático

### Crear Orquestador

```javascript
const { createOrchestrator } = require('./core/sandra-core');

const orchestrator = createOrchestrator({
  groqApiKey: process.env.GROQ_API_KEY
});

// Escuchar eventos
orchestrator.on('taskCompleted', (result) => {
  console.log('Tarea completada:', result.finalResponse.content);
});

orchestrator.on('taskFailed', (error) => {
  console.error('Error:', error.error);
});

// Ejecutar tarea
const result = await orchestrator.orchestrateTask({
  type: 'reasoning',
  prompt: 'Explica cómo funciona la orquestación de modelos',
  requirements: {
    accuracy: true,
    speed: false
  }
});
```

### Usar Motor de Decisión

```javascript
const { createDecisionEngine } = require('./core/sandra-core');

const engine = createDecisionEngine();

const decision = engine.makeDecision({
  prompt: 'Escribe una función en JavaScript',
  type: 'code',
  requirements: {
    accuracy: true
  }
});

console.log('Modelos seleccionados:', decision.models);
console.log('Modo de ejecución:', decision.executionStrategy.mode);
```

### Invocar Modelos Directamente

```javascript
const { createModelInvoker } = require('./core/sandra-core');

const invoker = createModelInvoker({
  groqApiKey: process.env.GROQ_API_KEY
});

const result = await invoker.invoke(
  [/* modelos seleccionados */],
  'Tu prompt aquí',
  'parallel' // o 'sequential', 'consensus', 'fusion'
);
```

---

## 🔧 Configuración

### Modelos

Editar `config/models.json` para configurar modelos disponibles:

```json
{
  "online": {
    "reasoning": {
      "qwen": { "model": "qwen3-235b-a22b", ... },
      "deepseek": { "model": "deepseek-r1", ... }
    }
  }
}
```

### Subagentes

Los subagentes se seleccionan automáticamente desde `.sandra-8.0-orchestration-config.json`. Para regenerar:

```bash
node scripts/select-sandra-subagents.js
```

### Orquestación

Editar `config/sandra-orchestrator.json` para ajustar:
- Identidad de Sandra
- Principios de orquestación
- Matriz de decisión
- Configuración de monitoreo

---

## 📊 Modelos Soportados

### Online (vía Groq API)

- **Razonamiento:**
  - Qwen3-MAX (`qwen3-235b-a22b`)
  - DeepSeek-R1 (`deepseek-r1`)

- **Visión:**
  - Qwen-VL-MAX (`qwen-vl-max`)
  - DeepSeek-VL (`deepseek-vl-7b-chat`)

- **Código:**
  - Qwen3-MAX (`qwen3-235b-a22b`)
  - DeepSeek-Coder-V2 (`deepseek-coder-v2`)

- **Audio:**
  - Qwen-Audio (`qwen-audio-chat`)

### Local

- Qwen2.5-1.5B-Instruct (Orquestación ligera)

---

## 🎯 Modos de Ejecución

1. **Parallel** - Ejecuta modelos en paralelo, toma el más rápido
2. **Sequential** - Ejecuta modelos secuencialmente
3. **Consensus** - Ejecuta ambos y compara resultados
4. **Fusion** - Ejecuta ambos y fusiona outputs

---

## 📈 Monitoreo

### GitHub Monitor

Monitorea commits y pushes en el repositorio:
- Detecta nuevos commits cada 5 segundos
- Detecta pushes cada 3 segundos
- Servidor webhook en puerto 3012
- Actualización automática de aplicación

### MCP Monitor

Monitorea salud del servidor MCP:
- Health check cada 10 segundos
- Monitoreo de cola cada 5 segundos
- Detección de workflows bloqueados

---

## 🔐 Identidad de Sandra

Sandra siempre se identifica como:

> "Hola, soy Sandra IA 8.0, un agente de inteligencia artificial modelo multimodal, creado por Clay. ¿En qué puedo ayudarte?"

**NUNCA menciona:**
- Modelos oficiales (Qwen, DeepSeek, etc.)
- Proveedores (Groq, Anthropic, etc.)
- Detalles técnicos de implementación

---

## 📝 Documentación Adicional

- `docs/SANDRA_ORCHESTRATOR_MASTER_PROMPT.md` - Prompt maestro de Sandra
- `docs/SANDRA_IDENTITY_PROTOCOL.md` - Protocolo de identidad
- `docs/PLAN_IMPLEMENTACION_SANDRA_IA_PROFESIONAL.md` - Plan de implementación
- `docs/SANDRA_IA_ARCHITECTURE_EXTRACT.md` - Arquitectura del sistema

---

## 🐛 Troubleshooting

### Error: "No hay token de VoltAgent configurado"

Asegúrate de tener el archivo de tokens en:
```
C:\Users\clayt\Desktop\VoltAgent-Composer-Workflow\tokens.json
```

### Error: "GROQ_API_KEY no encontrado"

```bash
export GROQ_API_KEY="tu-api-key"
```

### Error: "No se pudo cargar configuración de modelos"

Verifica que `config/models.json` existe y tiene formato válido.

---

## 📞 Soporte

Para problemas o preguntas, consulta la documentación en `docs/` o revisa los logs en `.sandra-logs/`.

---

**Sandra IA 8.0 - Sistema de Orquestación Multimodal**  
Creado por Clay

