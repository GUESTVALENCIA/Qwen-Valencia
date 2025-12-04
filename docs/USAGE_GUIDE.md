# 📖 Guía de Uso - Sandra IA 8.0

**Versión:** 8.0  
**Última actualización:** 2025-01-11

---

## 🚀 Inicio Rápido

### 1. Validar Configuración

Antes de usar Sandra, valida que todo esté configurado correctamente:

```bash
npm run validate
# o
node scripts/validate-config.js
```

### 2. Health Check

Verifica que todos los servicios estén disponibles:

```bash
npm run health
# o
node scripts/health-check.js
```

### 3. Probar el Sistema

Ejecuta las pruebas básicas:

```bash
npm test
# o
node scripts/test-sandra-orchestrator.js
```

---

## 📋 Comandos Disponibles

### Gestión de Subagentes

#### Seleccionar Subagentes

Regenera la lista de subagentes desde la configuración:

```bash
npm run select-subagents
# o
node scripts/select-sandra-subagents.js
```

#### Invocar Subagente Individual

```bash
npm run invoke-subagent -- <agentId> "<prompt>"
# o
node scripts/invoke-sandra-subagent.js code-reviewer "Revisa este código..."
```

#### Ejecutar Subagentes por Categoría

```bash
npm run execute-subagents -- <categoria> "<prompt>" [mode]
# o
node scripts/execute-sandra-subagents.js monitors "Analiza el sistema"
node scripts/execute-sandra-subagents.js correction "Revisa el código" parallel
node scripts/execute-sandra-subagents.js all "Reporte completo" sequential
```

**Categorías disponibles:**
- `monitors` - Monitores del sistema
- `correction` - Especialistas en corrección
- `improvement` - Especialistas en mejora
- `orchestration` - Coordinadores
- `all` - Todos los subagentes

**Modos:**
- `parallel` - Ejecución paralela (default)
- `sequential` - Ejecución secuencial

### Monitoreo

Inicia el sistema de monitoreo completo:

```bash
npm run monitor
# o
node scripts/start-sandra-monitoring.js
```

Esto iniciará:
- Monitor de GitHub (commits, pushes)
- Monitor MCP (salud del servidor)
- Actualizador automático de aplicación

---

## 💻 Uso Programático

### Ejemplo Básico

```javascript
const { createOrchestrator } = require('./core/sandra-core');

// Crear orquestador
const orchestrator = createOrchestrator({
  groqApiKey: process.env.GROQ_API_KEY
});

// Escuchar eventos
orchestrator.on('taskCompleted', (result) => {
  console.log('✅ Tarea completada');
  console.log('Respuesta:', result.finalResponse.content);
});

orchestrator.on('taskFailed', (error) => {
  console.error('❌ Error:', error.error);
});

// Ejecutar tarea
async function ejecutarTarea() {
  const result = await orchestrator.orchestrateTask({
    type: 'reasoning',
    prompt: 'Explica cómo funciona la orquestación de modelos',
    requirements: {
      accuracy: true,
      speed: false
    }
  });

  return result;
}
```

### Ejemplo con Motor de Decisión

```javascript
const { createDecisionEngine } = require('./core/sandra-core');

const engine = createDecisionEngine();

const decision = engine.makeDecision({
  prompt: 'Escribe una función en JavaScript para calcular factoriales',
  type: 'code',
  requirements: {
    accuracy: true,
    codeExecution: false
  }
});

console.log('Modelos seleccionados:', decision.models.map(m => m.model));
console.log('Modo de ejecución:', decision.executionStrategy.mode);
console.log('Tiempo estimado:', decision.estimatedTime.estimated, 'ms');
```

### Ejemplo con Invocador de Modelos

```javascript
const { createModelInvoker } = require('./core/sandra-core');

const invoker = createModelInvoker({
  groqApiKey: process.env.GROQ_API_KEY
});

// Ejecutar en paralelo
const result = await invoker.invoke(
  [
    { model: 'qwen3-235b-a22b', provider: 'groq', ... },
    { model: 'deepseek-r1', provider: 'groq', ... }
  ],
  'Tu prompt aquí',
  'parallel'
);

console.log('Resultado:', result.fastestResponse.content);
```

---

## 🎯 Tipos de Tareas

### Reasoning (Razonamiento)

```javascript
{
  type: 'reasoning',
  prompt: 'Analiza este problema y propón una solución...',
  requirements: {
    accuracy: true,
    speed: false
  }
}
```

**Modelos usados:** Qwen3-MAX + DeepSeek-R1

### Vision (Visión)

```javascript
{
  type: 'vision',
  prompt: 'Analiza esta imagen y describe lo que ves...',
  requirements: {
    accuracy: true
  }
}
```

**Modelos usados:** Qwen-VL-MAX + DeepSeek-VL

### Code (Código)

```javascript
{
  type: 'code',
  prompt: 'Escribe una función que...',
  requirements: {
    accuracy: true,
    codeExecution: false
  }
}
```

**Modelos usados:** Qwen3-MAX + DeepSeek-Coder-V2

### Audio

```javascript
{
  type: 'audio',
  prompt: 'Transcribe este audio...',
  requirements: {
    accuracy: true
  }
}
```

**Modelos usados:** Qwen-Audio

---

## 🔄 Modos de Ejecución

### Parallel

Ejecuta modelos en paralelo y toma el resultado más rápido:

```javascript
executionStrategy: { mode: 'parallel' }
```

### Sequential

Ejecuta modelos uno después del otro:

```javascript
executionStrategy: { mode: 'sequential' }
```

### Consensus

Ejecuta ambos modelos y compara resultados:

```javascript
executionStrategy: { mode: 'consensus' }
```

### Fusion

Ejecuta ambos modelos y fusiona sus outputs:

```javascript
executionStrategy: { mode: 'fusion' }
```

---

## 📊 Métricas

Obtener métricas del orquestador:

```javascript
const metrics = orchestrator.getMetrics();
console.log(metrics);
// {
//   totalTasks: 10,
//   successfulTasks: 9,
//   failedTasks: 1,
//   modelUsage: { ... },
//   subagentUsage: { ... },
//   activeTasks: 0,
//   successRate: '90.00%'
// }
```

---

## 🔧 Configuración

### Variables de Entorno

```bash
# Requerido
export GROQ_API_KEY="tu-api-key-aqui"

# Opcional
export GITHUB_TOKEN="tu-token-aqui"
```

### Archivos de Configuración

- `config/models.json` - Modelos disponibles
- `config/sandra-orchestrator.json` - Configuración del orquestador
- `config/subagents-sandra.json` - Subagentes seleccionados
- `config/subagents-execution.json` - Configuración de ejecución

---

## 🐛 Troubleshooting

### Error: "GROQ_API_KEY no encontrado"

```bash
export GROQ_API_KEY="tu-api-key"
```

### Error: "No hay token de VoltAgent"

Verifica que el archivo existe en:
```
C:\Users\clayt\Desktop\VoltAgent-Composer-Workflow\tokens.json
```

### Error: "No se pudo cargar configuración"

Ejecuta el validador:
```bash
npm run validate
```

### Los modelos no responden

Verifica la conexión:
```bash
npm run health
```

---

## 📚 Documentación Adicional

- `README_SANDRA_IA.md` - Documentación principal
- `docs/SANDRA_ORCHESTRATOR_MASTER_PROMPT.md` - Prompt maestro
- `docs/SANDRA_IDENTITY_PROTOCOL.md` - Protocolo de identidad
- `docs/PLAN_IMPLEMENTACION_SANDRA_IA_PROFESIONAL.md` - Plan de implementación

---

**Sandra IA 8.0 - Guía de Uso**  
Creado por Clay

