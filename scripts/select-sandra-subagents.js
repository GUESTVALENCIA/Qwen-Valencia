/**
 * ════════════════════════════════════════════════════════════════════════════
 * SELECT SANDRA SUBAGENTS - Selección Automática de Subagentes para Sandra IA
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Lee la configuración de Sandra 8.0 y extrae todos los subagentes mencionados
 * para generar la configuración final de subagentes seleccionados.
 */

const fs = require('fs');
const path = require('path');

// Rutas de configuración
const SANDRA_CONFIG_PATH = path.join(__dirname, '..', '.sandra-8.0-orchestration-config.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'config', 'subagents-sandra.json');
const SUBAGENTS_DEFINITIONS_PATH = path.join(__dirname, '..', 'docs', 'subagents-definitions.json');

// Crear directorio config si no existe
const configDir = path.join(__dirname, '..', 'config');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

/**
 * Extrae todos los subagentes únicos de la configuración
 */
function extractSubagents(config) {
  const subagents = new Set();

  // Monitores
  if (config.monitoring) {
    Object.values(config.monitoring).forEach(category => {
      if (category.agents && Array.isArray(category.agents)) {
        category.agents.forEach(agent => subagents.add(agent));
      }
    });
  }

  // Corrección
  if (config.correction && config.correction.agents) {
    Object.values(config.correction.agents).forEach(category => {
      if (category.agents && Array.isArray(category.agents)) {
        category.agents.forEach(agent => subagents.add(agent));
      }
    });
  }

  // Mejora
  if (config.improvement && config.improvement.agents) {
    Object.values(config.improvement.agents).forEach(category => {
      if (category.agents && Array.isArray(category.agents)) {
        category.agents.forEach(agent => subagents.add(agent));
      }
    });
  }

  // Orquestación
  if (config.orchestration) {
    if (config.orchestration.primary) {
      subagents.add(config.orchestration.primary);
    }
    if (config.orchestration.coordinators && Array.isArray(config.orchestration.coordinators)) {
      config.orchestration.coordinators.forEach(coord => subagents.add(coord));
    }
    if (config.orchestration.contextManagers && Array.isArray(config.orchestration.contextManagers)) {
      config.orchestration.contextManagers.forEach(manager => subagents.add(manager));
    }
  }

  return Array.from(subagents);
}

/**
 * Categoriza subagentes según su función
 */
function categorizeSubagents(subagents, config) {
  const categorized = {
    monitors: {
      conversational: [],
      application: [],
      code: [],
      infrastructure: []
    },
    correction: {
      frontend: [],
      backend: [],
      audio: [],
      code: []
    },
    improvement: {
      architecture: [],
      performance: [],
      experience: [],
      documentation: []
    },
    orchestration: {
      coordinators: [],
      contextManagers: []
    }
  };

  // Monitores
  if (config.monitoring) {
    if (config.monitoring.conversational?.agents) {
      categorized.monitors.conversational = config.monitoring.conversational.agents;
    }
    if (config.monitoring.application?.agents) {
      categorized.monitors.application = config.monitoring.application.agents;
    }
    if (config.monitoring.code?.agents) {
      categorized.monitors.code = config.monitoring.code.agents;
    }
    if (config.monitoring.infrastructure?.agents) {
      categorized.monitors.infrastructure = config.monitoring.infrastructure.agents;
    }
  }

  // Corrección
  if (config.correction?.agents) {
    if (config.correction.agents.frontend?.agents) {
      categorized.correction.frontend = config.correction.agents.frontend.agents;
    }
    if (config.correction.agents.backend?.agents) {
      categorized.correction.backend = config.correction.agents.backend.agents;
    }
    if (config.correction.agents.audio?.agents) {
      categorized.correction.audio = config.correction.agents.audio.agents;
    }
    if (config.correction.agents.code?.agents) {
      categorized.correction.code = config.correction.agents.code.agents;
    }
  }

  // Mejora
  if (config.improvement?.agents) {
    if (config.improvement.agents.architecture?.agents) {
      categorized.improvement.architecture = config.improvement.agents.architecture.agents;
    }
    if (config.improvement.agents.performance?.agents) {
      categorized.improvement.performance = config.improvement.agents.performance.agents;
    }
    if (config.improvement.agents.experience?.agents) {
      categorized.improvement.experience = config.improvement.agents.experience.agents;
    }
    if (config.improvement.agents.documentation?.agents) {
      categorized.improvement.documentation = config.improvement.agents.documentation.agents;
    }
  }

  // Orquestación
  if (config.orchestration) {
    if (config.orchestration.coordinators) {
      categorized.orchestration.coordinators = config.orchestration.coordinators;
    }
    if (config.orchestration.contextManagers) {
      categorized.orchestration.contextManagers = config.orchestration.contextManagers;
    }
    if (config.orchestration.primary) {
      categorized.orchestration.coordinators.unshift(config.orchestration.primary);
    }
  }

  return categorized;
}

/**
 * Carga definiciones de subagentes si existen
 */
function loadSubagentDefinitions() {
  try {
    if (fs.existsSync(SUBAGENTS_DEFINITIONS_PATH)) {
      return JSON.parse(fs.readFileSync(SUBAGENTS_DEFINITIONS_PATH, 'utf-8'));
    }
  } catch (e) {
    console.warn('⚠️  No se pudieron cargar definiciones de subagentes');
  }
  return null;
}

/**
 * Función principal
 */
function main() {
  console.log('🔍 Seleccionando subagentes para Sandra IA 8.0...\n');

  // Cargar configuración de Sandra 8.0
  if (!fs.existsSync(SANDRA_CONFIG_PATH)) {
    console.error('❌ No se encontró la configuración de Sandra 8.0');
    console.error(`   Ruta esperada: ${SANDRA_CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(SANDRA_CONFIG_PATH, 'utf-8'));
  const definitions = loadSubagentDefinitions();

  // Extraer subagentes
  const allSubagents = extractSubagents(config);
  const categorized = categorizeSubagents(allSubagents, config);

  // Contar total
  const totalCount = allSubagents.length;
  const monitorCount = [
    ...categorized.monitors.conversational,
    ...categorized.monitors.application,
    ...categorized.monitors.code,
    ...categorized.monitors.infrastructure
  ].length;
  const correctionCount = [
    ...categorized.correction.frontend,
    ...categorized.correction.backend,
    ...categorized.correction.audio,
    ...categorized.correction.code
  ].length;
  const improvementCount = [
    ...categorized.improvement.architecture,
    ...categorized.improvement.performance,
    ...categorized.improvement.experience,
    ...categorized.improvement.documentation
  ].length;
  const orchestrationCount = [
    ...categorized.orchestration.coordinators,
    ...categorized.orchestration.contextManagers
  ].length;

  // Construir configuración final
  const output = {
    metadata: {
      generated: new Date().toISOString(),
      source: '.sandra-8.0-orchestration-config.json',
      totalSubagents: totalCount,
      breakdown: {
        monitors: monitorCount,
        correction: correctionCount,
        improvement: improvementCount,
        orchestration: orchestrationCount
      }
    },
    subagents: {
      all: allSubagents,
      categorized: categorized
    },
    definitions: definitions
  };

  // Guardar configuración
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  console.log('✅ Subagentes seleccionados:');
  console.log(`   Total: ${totalCount} subagentes`);
  console.log(`   - Monitores: ${monitorCount}`);
  console.log(`   - Corrección: ${correctionCount}`);
  console.log(`   - Mejora: ${improvementCount}`);
  console.log(`   - Orquestación: ${orchestrationCount}`);
  console.log(`\n✅ Configuración guardada en: ${OUTPUT_PATH}\n`);
}

// Ejecutar
if (require.main === module) {
  main();
}

module.exports = { extractSubagents, categorizeSubagents, main };

