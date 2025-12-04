/**
 * ════════════════════════════════════════════════════════════════════════════
 * TEST SANDRA ORCHESTRATOR - Script de Prueba del Orquestador
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Prueba el sistema de orquestación de Sandra con tareas de ejemplo.
 */

const { createOrchestrator } = require('../core/sandra-core');

async function main() {
  console.log('🧪 Probando Orquestador de Sandra IA 8.0\n');

  // Crear orquestador
  const orchestrator = createOrchestrator({
    groqApiKey: process.env.GROQ_API_KEY
  });

  // Configurar eventos
  orchestrator.on('taskCompleted', (result) => {
    console.log('\n✅ Tarea completada:');
    console.log(`   ID: ${result.taskId}`);
    console.log(`   Latencia: ${result.latency}ms`);
    console.log(`   Respuesta: ${result.finalResponse.content.substring(0, 200)}...`);
  });

  orchestrator.on('taskFailed', (error) => {
    console.error('\n❌ Tarea fallida:');
    console.error(`   ID: ${error.taskId}`);
    console.error(`   Error: ${error.error}`);
  });

  // Tareas de prueba
  const testTasks = [
    {
      type: 'reasoning',
      prompt: 'Explica cómo funciona la orquestación de modelos en un sistema de IA multimodal.',
      requirements: {
        accuracy: true,
        speed: false
      }
    },
    {
      type: 'code',
      prompt: 'Escribe una función en JavaScript que calcule el factorial de un número usando recursión.',
      requirements: {
        accuracy: true,
        codeExecution: false
      }
    },
    {
      type: 'vision',
      prompt: 'Analiza esta imagen y describe lo que ves. [Nota: Esto es una prueba sin imagen real]',
      requirements: {
        accuracy: true
      }
    }
  ];

  console.log(`📋 Ejecutando ${testTasks.length} tareas de prueba...\n`);

  // Ejecutar tareas
  for (let i = 0; i < testTasks.length; i++) {
    const task = testTasks[i];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Tarea ${i + 1}/${testTasks.length}: ${task.type}`);
    console.log('='.repeat(60));

    try {
      const result = await orchestrator.orchestrateTask(task);
      console.log(`\n✅ Tarea ${i + 1} completada exitosamente`);
    } catch (error) {
      console.error(`\n❌ Tarea ${i + 1} falló: ${error.message}`);
    }

    // Esperar entre tareas
    if (i < testTasks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Mostrar métricas finales
  console.log('\n' + '='.repeat(60));
  console.log('📊 Métricas Finales');
  console.log('='.repeat(60));
  const metrics = orchestrator.getMetrics();
  console.log(JSON.stringify(metrics, null, 2));
  console.log('\n✅ Pruebas completadas\n');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };

