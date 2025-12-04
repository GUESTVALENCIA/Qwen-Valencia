/**
 * ════════════════════════════════════════════════════════════════════════════
 * EXECUTE SANDRA SUBAGENTS - Script Maestro de Ejecución de Subagentes
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Ejecuta todos los subagentes seleccionados según su categoría.
 * Orquesta ejecución paralela/secuencial según necesidad.
 */

const fs = require('fs');
const path = require('path');
const { invokeSubagent } = require('./invoke-sandra-subagent');

// Rutas
const SUBAGENTS_CONFIG_PATH = path.join(__dirname, '..', 'config', 'subagents-sandra.json');
const EXECUTION_CONFIG_PATH = path.join(__dirname, '..', 'config', 'subagents-execution.json');

// Cargar configuraciones
function loadConfigs() {
  const subagents = JSON.parse(fs.readFileSync(SUBAGENTS_CONFIG_PATH, 'utf-8'));
  const execution = JSON.parse(fs.readFileSync(EXECUTION_CONFIG_PATH, 'utf-8'));
  return { subagents, execution };
}

/**
 * Ejecuta subagentes en paralelo (hasta el límite)
 */
async function executeParallel(subagents, prompt, limit = 5) {
  const results = [];
  const chunks = [];
  
  // Dividir en chunks
  for (let i = 0; i < subagents.length; i += limit) {
    chunks.push(subagents.slice(i, i + limit));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (agentId) => {
      try {
        const response = await invokeSubagent(agentId, prompt);
        return { agentId, success: true, response };
      } catch (error) {
        return { agentId, success: false, error: error.message };
      }
    });

    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Ejecuta subagentes secuencialmente
 */
async function executeSequential(subagents, prompt) {
  const results = [];

  for (const agentId of subagents) {
    try {
      console.log(`🔄 Ejecutando ${agentId}...`);
      const response = await invokeSubagent(agentId, prompt);
      results.push({ agentId, success: true, response });
    } catch (error) {
      console.error(`❌ Error con ${agentId}: ${error.message}`);
      results.push({ agentId, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Ejecuta por categoría
 */
async function executeByCategory(category, subagents, prompt, mode = 'parallel') {
  console.log(`\n📋 Ejecutando categoría: ${category}`);
  console.log(`   Subagentes: ${subagents.length}`);
  console.log(`   Modo: ${mode}\n`);

  if (mode === 'parallel') {
    return await executeParallel(subagents, prompt, 5);
  } else {
    return await executeSequential(subagents, prompt);
  }
}

/**
 * Función principal
 */
async function main() {
  const args = process.argv.slice(2);
  const { subagents } = loadConfigs();

  if (args.length < 1) {
    console.log('Uso: node execute-sandra-subagents.js <categoria|all> <prompt> [mode]');
    console.log('\nCategorías disponibles:');
    console.log('  - monitors');
    console.log('  - correction');
    console.log('  - improvement');
    console.log('  - orchestration');
    console.log('  - all (todos)');
    console.log('\nModos: parallel (default) | sequential');
    process.exit(1);
  }

  const category = args[0];
  const prompt = args[1] || 'Analiza el estado actual del sistema y proporciona un reporte.';
  const mode = args[2] || 'parallel';

  console.log('🚀 Ejecutando Subagentes de Sandra IA 8.0\n');
  console.log(`📝 Prompt: ${prompt}\n`);

  let results = [];

  if (category === 'all') {
    // Ejecutar todas las categorías
    const categories = ['monitors', 'correction', 'improvement', 'orchestration'];
    
    for (const cat of categories) {
      const agents = getCategorySubagents(cat, subagents);
      if (agents.length > 0) {
        const catResults = await executeByCategory(cat, agents, prompt, mode);
        results.push(...catResults);
      }
    }
  } else {
    const agents = getCategorySubagents(category, subagents);
    if (agents.length === 0) {
      console.error(`❌ Categoría "${category}" no encontrada o vacía`);
      process.exit(1);
    }
    results = await executeByCategory(category, agents, prompt, mode);
  }

  // Reporte
  console.log('\n📊 Reporte de Ejecución:');
  console.log(`   Total ejecutados: ${results.length}`);
  console.log(`   Exitosos: ${results.filter(r => r.success).length}`);
  console.log(`   Fallidos: ${results.filter(r => !r.success).length}`);

  // Guardar resultados
  const reportPath = path.join(__dirname, '..', '.sandra-logs', `execution-${Date.now()}.json`);
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n✅ Reporte guardado en: ${reportPath}\n`);
}

function getCategorySubagents(category, subagents) {
  const categorized = subagents.subagents.categorized;
  
  switch (category) {
    case 'monitors':
      return [
        ...categorized.monitors.conversational,
        ...categorized.monitors.application,
        ...categorized.monitors.code,
        ...categorized.monitors.infrastructure
      ];
    case 'correction':
      return [
        ...categorized.correction.frontend,
        ...categorized.correction.backend,
        ...categorized.correction.audio,
        ...categorized.correction.code
      ];
    case 'improvement':
      return [
        ...categorized.improvement.architecture,
        ...categorized.improvement.performance,
        ...categorized.improvement.experience,
        ...categorized.improvement.documentation
      ];
    case 'orchestration':
      return [
        ...categorized.orchestration.coordinators,
        ...categorized.orchestration.contextManagers
      ];
    default:
      return [];
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { executeParallel, executeSequential, executeByCategory };

