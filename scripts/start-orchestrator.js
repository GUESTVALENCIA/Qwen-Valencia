/**
 * ════════════════════════════════════════════════════════════════════════════
 * START ORCHESTRATOR - Script de Inicio del Orquestador
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Inicia el orquestador de subagentes con los subagentes existentes.
 * Usa Opus 4.5 (mejor modelo) cuando esté disponible.
 */

const { getOrchestrator } = require('./agent-orchestrator');

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║     ORQUESTADOR DE SUBAGENTES - OPUS 4.5                      ║');
console.log('║     Sistema de Monitoreo y Corrección Automática              ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

const orchestrator = getOrchestrator();

// Event listeners
orchestrator.on('started', () => {
  console.log('\n✅ Orquestador iniciado correctamente');
  console.log('📊 Monitores activos:');
  for (const [id, monitor] of orchestrator.monitors) {
    if (monitor.intervalId) {
      console.log(`   • ${id} (cada ${monitor.interval}ms)`);
    }
  }
  console.log('\n🎯 Sistema monitoreando y corrigiendo automáticamente...');
  console.log('   Presiona Ctrl+C para detener\n');
});

orchestrator.on('monitor-complete', ({ monitorId, errors }) => {
  if (errors > 0) {
    console.log(`⚠️  [${monitorId}] ${errors} error(es) detectado(s)`);
  }
});

orchestrator.on('stopped', () => {
  console.log('\n✅ Orquestador detenido correctamente\n');
});

// Manejar errores no capturados
process.on('unhandledRejection', (error) => {
  console.error('❌ Error no manejado:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
  orchestrator.stop();
  process.exit(1);
});

// Manejar señales de cierre
process.on('SIGINT', () => {
  console.log('\n\n🛑 Deteniendo orquestador...');
  orchestrator.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Deteniendo orquestador...');
  orchestrator.stop();
  process.exit(0);
});

// Iniciar orquestador
orchestrator.start().catch((error) => {
  console.error('❌ Error iniciando orquestador:', error);
  process.exit(1);
});

