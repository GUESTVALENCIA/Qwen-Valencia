/**
 * ════════════════════════════════════════════════════════════════════════════
 * VALIDATE CONFIG - Validador de Configuraciones de Sandra IA
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Valida que todas las configuraciones estén correctas antes de ejecutar.
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATHS = {
  models: path.join(__dirname, '..', 'config', 'models.json'),
  orchestrator: path.join(__dirname, '..', 'config', 'sandra-orchestrator.json'),
  subagents: path.join(__dirname, '..', 'config', 'subagents-sandra.json'),
  execution: path.join(__dirname, '..', 'config', 'subagents-execution.json'),
  sandraConfig: path.join(__dirname, '..', '.sandra-8.0-orchestration-config.json')
};

function validateFile(filePath, name) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: `Archivo no encontrado: ${name}` };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return { valid: true, data: parsed };
  } catch (e) {
    return { valid: false, error: `Error parseando ${name}: ${e.message}` };
  }
}

function validateModels(config) {
  const errors = [];
  const warnings = [];

  if (!config.online) {
    errors.push('No hay configuración de modelos online');
    return { valid: false, errors, warnings };
  }

  const categories = ['reasoning', 'vision', 'code', 'audio'];
  categories.forEach(category => {
    if (!config.online[category]) {
      warnings.push(`Categoría ${category} no configurada`);
      return;
    }

    const categoryConfig = config.online[category];
    
    // Verificar que hay al menos Qwen
    if (!categoryConfig.qwen) {
      warnings.push(`Categoría ${category}: No hay configuración de Qwen`);
    }

    // Verificar que hay DeepSeek (excepto audio)
    if (category !== 'audio' && !categoryConfig.deepseek) {
      warnings.push(`Categoría ${category}: No hay configuración de DeepSeek`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function validateOrchestrator(config) {
  const errors = [];
  const warnings = [];

  if (!config.identity) {
    errors.push('No hay configuración de identidad');
  } else {
    if (!config.identity.name || config.identity.name !== 'Sandra IA 8.0') {
      errors.push('Nombre de identidad incorrecto');
    }
    if (!config.identity.creator || config.identity.creator !== 'Clay') {
      errors.push('Creador de identidad incorrecto');
    }
    if (!config.identity.response || !config.identity.response.includes('Clay')) {
      errors.push('Respuesta de identidad no incluye a Clay');
    }
  }

  if (!config.orchestration) {
    errors.push('No hay configuración de orquestación');
  } else {
    if (config.orchestration.principle !== 'no_supremacy') {
      warnings.push('Principio de orquestación no es "no_supremacy"');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function validateSubagents(config) {
  const errors = [];
  const warnings = [];

  if (!config.subagents) {
    errors.push('No hay configuración de subagentes');
    return { valid: false, errors, warnings };
  }

  if (!config.subagents.all || config.subagents.all.length === 0) {
    errors.push('No hay subagentes seleccionados');
  } else {
    const total = config.subagents.all.length;
    if (total < 10) {
      warnings.push(`Solo hay ${total} subagentes seleccionados (se esperan más)`);
    }
  }

  if (!config.subagents.categorized) {
    warnings.push('No hay categorización de subagentes');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function validateEnvironment() {
  const errors = [];
  const warnings = [];

  if (!process.env.GROQ_API_KEY) {
    errors.push('GROQ_API_KEY no está configurada en variables de entorno');
  }

  const voltAgentPath = path.join(
    'C:',
    'Users',
    'clayt',
    'Desktop',
    'VoltAgent-Composer-Workflow',
    'tokens.json'
  );

  if (!fs.existsSync(voltAgentPath)) {
    warnings.push('Archivo de tokens de VoltAgent no encontrado (subagentes pueden no funcionar)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function main() {
  console.log('🔍 Validando Configuraciones de Sandra IA 8.0\n');
  console.log('='.repeat(60));

  let allValid = true;
  const allErrors = [];
  const allWarnings = [];

  // Validar archivos
  console.log('\n📁 Validando archivos de configuración...');
  Object.entries(CONFIG_PATHS).forEach(([name, path]) => {
    const result = validateFile(path, name);
    if (!result.valid) {
      console.error(`   ❌ ${name}: ${result.error}`);
      allValid = false;
      allErrors.push(`${name}: ${result.error}`);
    } else {
      console.log(`   ✅ ${name}: OK`);
    }
  });

  // Validar modelos
  console.log('\n🤖 Validando configuración de modelos...');
  const modelsResult = validateFile(CONFIG_PATHS.models, 'models');
  if (modelsResult.valid) {
    const validation = validateModels(modelsResult.data);
    if (!validation.valid) {
      allValid = false;
      allErrors.push(...validation.errors);
    }
    allWarnings.push(...validation.warnings);
    
    validation.errors.forEach(e => console.error(`   ❌ ${e}`));
    validation.warnings.forEach(w => console.warn(`   ⚠️  ${w}`));
    if (validation.valid && validation.warnings.length === 0) {
      console.log('   ✅ Configuración de modelos: OK');
    }
  }

  // Validar orquestador
  console.log('\n🎯 Validando configuración del orquestador...');
  const orchestratorResult = validateFile(CONFIG_PATHS.orchestrator, 'orchestrator');
  if (orchestratorResult.valid) {
    const validation = validateOrchestrator(orchestratorResult.data);
    if (!validation.valid) {
      allValid = false;
      allErrors.push(...validation.errors);
    }
    allWarnings.push(...validation.warnings);
    
    validation.errors.forEach(e => console.error(`   ❌ ${e}`));
    validation.warnings.forEach(w => console.warn(`   ⚠️  ${w}`));
    if (validation.valid && validation.warnings.length === 0) {
      console.log('   ✅ Configuración del orquestador: OK');
    }
  }

  // Validar subagentes
  console.log('\n👥 Validando configuración de subagentes...');
  const subagentsResult = validateFile(CONFIG_PATHS.subagents, 'subagents');
  if (subagentsResult.valid) {
    const validation = validateSubagents(subagentsResult.data);
    if (!validation.valid) {
      allValid = false;
      allErrors.push(...validation.errors);
    }
    allWarnings.push(...validation.warnings);
    
    validation.errors.forEach(e => console.error(`   ❌ ${e}`));
    validation.warnings.forEach(w => console.warn(`   ⚠️  ${w}`));
    if (validation.valid && validation.warnings.length === 0) {
      console.log('   ✅ Configuración de subagentes: OK');
    }
  }

  // Validar entorno
  console.log('\n🌍 Validando variables de entorno...');
  const envValidation = validateEnvironment();
  if (!envValidation.valid) {
    allValid = false;
    allErrors.push(...envValidation.errors);
  }
  allWarnings.push(...envValidation.warnings);
  
  envValidation.errors.forEach(e => console.error(`   ❌ ${e}`));
  envValidation.warnings.forEach(w => console.warn(`   ⚠️  ${w}`));
  if (envValidation.valid && envValidation.warnings.length === 0) {
    console.log('   ✅ Variables de entorno: OK');
  }

  // Resumen
  console.log('\n' + '='.repeat(60));
  if (allValid) {
    console.log('✅ Validación completada: TODO OK');
    if (allWarnings.length > 0) {
      console.log(`\n⚠️  Advertencias: ${allWarnings.length}`);
      allWarnings.forEach(w => console.log(`   - ${w}`));
    }
    process.exit(0);
  } else {
    console.error('❌ Validación fallida: Hay errores que corregir');
    console.error(`\nErrores encontrados: ${allErrors.length}`);
    allErrors.forEach(e => console.error(`   - ${e}`));
    if (allWarnings.length > 0) {
      console.warn(`\nAdvertencias: ${allWarnings.length}`);
      allWarnings.forEach(w => console.warn(`   - ${w}`));
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateFile,
  validateModels,
  validateOrchestrator,
  validateSubagents,
  validateEnvironment
};

