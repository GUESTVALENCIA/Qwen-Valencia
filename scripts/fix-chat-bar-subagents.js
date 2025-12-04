/**
 * ════════════════════════════════════════════════════════════════════════════
 * FIX CHAT BAR - INVOCACIÓN DE SUBAGENTES ESPECIALIZADOS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Invoca subagentes especializados para arreglar:
 * - Barra de chat estilo ChatGPT
 * - Botón de dictado (grabación 30 segundos)
 * - Botón de llamada conversacional
 * - Botón de enviar
 * - Selector de modelos (online vs local)
 * - Modelo Sandra IA 8.0 visible
 * - Limpieza de código muerto y corrupto en index.html
 */

const { invokeSubagent } = require('./invoke-sandra-subagent');
const fs = require('fs');
const path = require('path');

// Subagentes especializados para cada tarea
const SUBAGENTS = {
  frontend: 'frontendSpecialist',
  ui: 'uiSpecialist',
  bugFixer: 'bugFixer',
  refactoring: 'refactoringSpecialist',
  legacy: 'legacyModernizer',
  codeOptimizer: 'codeOptimizer',
  audio: 'frontend-audio-specialist',
  deepgram: 'deepgram-stt-specialist',
  voice: 'voiceIntegrationSpecialist',
  appMonitor: 'app-functionality-monitor',
  electron: 'electronPro',
  eventHandler: 'event-handler-specialist'
};

// Tareas a realizar
const TASKS = [
  {
    id: '1',
    name: 'Arreglar barra de chat estilo ChatGPT',
    subagents: [SUBAGENTS.frontend, SUBAGENTS.ui, SUBAGENTS.bugFixer],
    files: [
      'src/app/renderer/index.html',
      'src/app/renderer/components/app.js',
      'src/app/renderer/styles/chat-input.css'
    ],
    prompt: `ARREGLA LA BARRA DE CHAT ESTILO CHATGPT:

1. La barra de chat debe tener el estilo exacto de ChatGPT:
   - Input textarea con placeholder "Message Qwen-Valencia..."
   - Botones de acción (dictado, llamada, enviar) a la derecha
   - Diseño limpio y profesional
   - Responsive y accesible

2. Elimina TODO el código muerto (onclick inline)
3. Usa EventManager para todos los event listeners
4. Asegura que el CSS esté correcto
5. Verifica que todos los botones funcionen

ARCHIVOS A REVISAR:
- src/app/renderer/index.html (líneas 241-288)
- src/app/renderer/components/app.js
- src/app/renderer/styles/chat-input.css

IMPORTANTE: NO uses onclick inline. Usa addEventListener o EventManager.`
  },
  {
    id: '2',
    name: 'Arreglar botón de dictado (30 segundos)',
    subagents: [SUBAGENTS.audio, SUBAGENTS.deepgram, SUBAGENTS.eventHandler],
    files: ['src/app/renderer/utils/deepgram-dictation.js', 'src/app/renderer/components/app.js'],
    prompt: `ARREGLA EL BOTÓN DE DICTADO:

1. El botón de dictado (#dictateBtn) debe:
   - Iniciar grabación al hacer click
   - Mostrar "Grabando..." durante la grabación
   - Grabar máximo 30 segundos (no 20 minutos)
   - Detenerse automáticamente a los 30 segundos
   - Enviar el texto transcrito al chat automáticamente

2. Usa Deepgram STT correctamente
3. Muestra feedback visual durante la grabación
4. Limpia recursos al terminar

ARCHIVOS A REVISAR:
- src/app/renderer/utils/deepgram-dictation.js
- src/app/renderer/components/app.js (función toggleDictation)

IMPORTANTE: El tiempo máximo debe ser 30 segundos (30000ms), no 20 minutos.`
  },
  {
    id: '3',
    name: 'Arreglar botón de llamada conversacional',
    subagents: [SUBAGENTS.voice, SUBAGENTS.audio, SUBAGENTS.eventHandler],
    files: ['src/app/renderer/components/app.js'],
    prompt: `ARREGLA EL BOTÓN DE LLAMADA CONVERSACIONAL:

1. El botón de llamada (#voiceCallBtn) debe:
   - Iniciar llamada conversacional al hacer click
   - Mostrar estado "Llamando..." o "En llamada"
   - Permitir colgar la llamada
   - Integrar con HeyGen Avatar si está disponible
   - Usar Deepgram STT para transcripción en tiempo real

2. Implementa el flujo completo:
   - Iniciar llamada → Conectar audio → Mostrar avatar → Transcribir → Responder → Colgar

ARCHIVOS A REVISAR:
- src/app/renderer/components/app.js (función startVoiceCall)

IMPORTANTE: Debe funcionar completamente, no solo mostrar un mensaje.`
  },
  {
    id: '4',
    name: 'Arreglar botón de enviar',
    subagents: [SUBAGENTS.frontend, SUBAGENTS.bugFixer, SUBAGENTS.eventHandler],
    files: ['src/app/renderer/components/app.js'],
    prompt: `ARREGLA EL BOTÓN DE ENVIAR:

1. El botón de enviar (#sendBtn) debe:
   - Enviar el mensaje del textarea al hacer click
   - También enviar con Enter (pero no con Shift+Enter)
   - Mostrar estado de carga mientras se envía
   - Limpiar el input después de enviar
   - Manejar errores correctamente

2. Verifica que la función sendMessage() funcione correctamente
3. Asegura que use el modelo seleccionado
4. Maneja attachments si hay

ARCHIVOS A REVISAR:
- src/app/renderer/components/app.js (función sendMessage)

IMPORTANTE: Debe funcionar con todos los modelos (Qwen, DeepSeek, Sandra IA).`
  },
  {
    id: '5',
    name: 'Actualizar selector de modelos (online vs local)',
    subagents: [SUBAGENTS.frontend, SUBAGENTS.ui, SUBAGENTS.codeOptimizer],
    files: ['src/app/renderer/components/model-selector.js', 'src/app/renderer/components/app.js'],
    prompt: `ACTUALIZA EL SELECTOR DE MODELOS:

1. El selector de modelos debe mostrar:
   - Modelos ONLINE (Groq API) claramente marcados
   - Modelos LOCALES (Ollama) claramente marcados
   - Modelo SANDRA IA 8.0 visible y diferenciado
   - Actualización automática de modelos disponibles

2. Agrupa modelos por categoría:
   - "Sistemas de IA" (Sandra IA 8.0, QWEN Valencia)
   - "Ollama Local" (modelos locales)
   - "Groq API" (modelos online)

3. Muestra estado de cada modelo (disponible/no disponible)
4. Actualiza la lista cuando cambian los modelos

ARCHIVOS A REVISAR:
- src/app/renderer/components/model-selector.js
- src/app/renderer/components/app.js (MODELS y MODEL_API_MAP)

IMPORTANTE: Sandra IA 8.0 debe estar visible y funcional.`
  },
  {
    id: '6',
    name: 'Limpiar código muerto y corrupto en index.html',
    subagents: [SUBAGENTS.refactoring, SUBAGENTS.legacy, SUBAGENTS.codeOptimizer],
    files: ['src/app/renderer/index.html'],
    prompt: `LIMPIA EL CÓDIGO MUERTO Y CORRUPTO EN INDEX.HTML:

1. ELIMINA TODOS los onclick inline (código muerto):
   - Reemplaza onclick="funcion()" con addEventListener
   - Usa EventManager cuando sea posible
   - Centraliza todos los event listeners

2. Arregla CSS corrupto:
   - Verifica que todos los estilos estén correctos
   - Elimina estilos duplicados o conflictivos
   - Asegura que el diseño sea consistente

3. Arregla JavaScript corrupto:
   - Verifica que todas las funciones estén definidas
   - Elimina código duplicado
   - Asegura que los scripts se carguen en el orden correcto

4. Verifica que no haya errores de sintaxis

ARCHIVOS A REVISAR:
- src/app/renderer/index.html (TODO el archivo)

IMPORTANTE: El código debe estar limpio, sin onclick inline, sin código muerto, sin errores.`
  }
];

/**
 * Ejecuta una tarea con sus subagentes
 */
async function executeTask(task) {
  console.log(`\n🎯 Ejecutando tarea: ${task.name}`);
  console.log(`   Subagentes: ${task.subagents.join(', ')}`);
  console.log(`   Archivos: ${task.files.join(', ')}\n`);

  const results = [];

  for (const subagentId of task.subagents) {
    try {
      console.log(`   🔄 Invocando ${subagentId}...`);

      const response = await invokeSubagent(subagentId, task.prompt, {
        temperature: 0.3, // Más determinístico para correcciones
        maxOutputTokens: 16000
      });

      if (response) {
        results.push({
          subagent: subagentId,
          success: true,
          response
        });
        console.log(`   ✅ ${subagentId} completado`);
      } else {
        results.push({
          subagent: subagentId,
          success: false,
          error: 'No response'
        });
        console.log(`   ⚠️  ${subagentId} no respondió`);
      }
    } catch (error) {
      results.push({
        subagent: subagentId,
        success: false,
        error: error.message
      });
      console.log(`   ❌ Error con ${subagentId}: ${error.message}`);
    }
  }

  return {
    task: task.name,
    results
  };
}

/**
 * Función principal
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔧 FIX CHAT BAR - INVOCACIÓN DE SUBAGENTES ESPECIALIZADOS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const allResults = [];

  // Ejecutar todas las tareas
  for (const task of TASKS) {
    const result = await executeTask(task);
    allResults.push(result);

    // Pequeña pausa entre tareas
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Resumen
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 RESUMEN DE EJECUCIÓN');
  console.log('═══════════════════════════════════════════════════════════════\n');

  for (const result of allResults) {
    const successCount = result.results.filter(r => r.success).length;
    const totalCount = result.results.length;

    console.log(`${result.task}:`);
    console.log(`   ✅ ${successCount}/${totalCount} subagentes completados`);

    if (successCount < totalCount) {
      const failed = result.results.filter(r => !r.success);
      console.log(`   ⚠️  Fallidos: ${failed.map(f => f.subagent).join(', ')}`);
    }
    console.log('');
  }

  console.log('✅ Proceso completado. Revisa los archivos modificados.');
}

// Ejecutar
if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Error fatal:', error);
    process.exit(1);
  });
}

module.exports = { executeTask, TASKS, SUBAGENTS };
