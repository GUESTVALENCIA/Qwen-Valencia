/**
 * ════════════════════════════════════════════════════════════════════════════
 * SCRIPT DE LIMPIEZA DE MODELOS OLLAMA
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Desinstala modelos pesados y deja solo modelos muy ligeros
 *
 * ════════════════════════════════════════════════════════════════════════════
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Modelos pesados a desinstalar
const HEAVY_MODELS = [
  'qwen2.5:7b-instruct-q4_K_M',
  'qwen2.5vl:3b-q4_K_M',
  'deepseek-coder:6.7b',
  'qwen2.5:7b-instruct', // Versión sin cuantización también
  'qwen2.5vl:3b',
  'deepseek-r1:7b' // Si existe
];

// Modelos ligeros a mantener/instalar
const LIGHT_MODELS = {
  qwen: 'qwen2.5:1.5b-instruct', // Muy ligero (~1GB)
  deepseek: null // Buscaremos el más ligero disponible
};

async function listOllamaModels() {
  try {
    const { stdout } = await execAsync('ollama list');
    const lines = stdout.split('\n').slice(1); // Saltar header
    const models = [];

    for (const line of lines) {
      if (line.trim()) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          models.push({
            name: parts[0],
            size: parts[parts.length - 2] || 'unknown'
          });
        }
      }
    }

    return models;
  } catch (error) {
    console.error('❌ Error listando modelos:', error.message);
    return [];
  }
}

async function removeModel(modelName) {
  try {
    console.log(`🗑️  Desinstalando: ${modelName}...`);
    await execAsync(`ollama rm ${modelName}`);
    console.log(`✅ Desinstalado: ${modelName}`);
    return true;
  } catch (error) {
    console.warn(`⚠️  No se pudo desinstalar ${modelName}: ${error.message}`);
    return false;
  }
}

async function pullLightModel(modelName) {
  try {
    console.log(`📥 Instalando modelo ligero: ${modelName}...`);
    await execAsync(`ollama pull ${modelName}`);
    console.log(`✅ Instalado: ${modelName}`);
    return true;
  } catch (error) {
    console.error(`❌ Error instalando ${modelName}: ${error.message}`);
    return false;
  }
}

async function findLightestDeepSeek() {
  // Modelos DeepSeek ligeros posibles (ordenados de más ligero a más pesado)
  const possibleModels = [
    'deepseek-coder:1.3b', // Si existe, sería el más ligero
    'gemma:2b', // Alternativa muy ligera
    'phi-3-mini' // Alternativa ligera
  ];

  console.log('🔍 Buscando modelo DeepSeek ligero...');

  // Intentar con deepseek-coder:1.3b primero
  try {
    await execAsync(`ollama pull deepseek-coder:1.3b`);
    console.log('✅ Encontrado: deepseek-coder:1.3b');
    return 'deepseek-coder:1.3b';
  } catch (error) {
    console.log('⚠️  deepseek-coder:1.3b no disponible');
  }

  // Si no existe, usar gemma:2b como alternativa muy ligera
  try {
    await execAsync(`ollama pull gemma:2b`);
    console.log('✅ Usando alternativa ligera: gemma:2b');
    return 'gemma:2b';
  } catch (error) {
    console.warn('⚠️  gemma:2b no disponible, intentando phi-3-mini...');
  }

  // Última opción: phi-3-mini
  try {
    await execAsync(`ollama pull phi-3-mini`);
    console.log('✅ Usando alternativa ligera: phi-3-mini');
    return 'phi-3-mini';
  } catch (error) {
    console.error('❌ No se encontró ningún modelo ligero de DeepSeek');
    return null;
  }
}

async function main() {
  console.log('🧹 Iniciando limpieza de modelos Ollama...\n');

  // Listar modelos actuales
  console.log('📋 Modelos actuales:');
  const currentModels = await listOllamaModels();
  currentModels.forEach(model => {
    console.log(`   - ${model.name} (${model.size})`);
  });
  console.log('');

  // Desinstalar modelos pesados
  console.log('🗑️  Desinstalando modelos pesados...\n');
  for (const model of HEAVY_MODELS) {
    // Verificar si el modelo existe antes de intentar desinstalarlo
    const exists = currentModels.some(m => m.name === model || m.name.startsWith(model));
    if (exists) {
      await removeModel(model);
    }
  }
  console.log('');

  // Instalar modelos ligeros
  console.log('📥 Instalando modelos ligeros...\n');

  // Qwen ligero
  await pullLightModel(LIGHT_MODELS.qwen);

  // DeepSeek ligero (buscar el más ligero disponible)
  const lightDeepSeek = await findLightestDeepSeek();
  if (lightDeepSeek) {
    LIGHT_MODELS.deepseek = lightDeepSeek;
  }

  console.log('\n✅ Limpieza completada!\n');
  console.log('📋 Modelos ligeros instalados:');
  console.log(`   - Qwen: ${LIGHT_MODELS.qwen}`);
  if (LIGHT_MODELS.deepseek) {
    console.log(`   - DeepSeek: ${LIGHT_MODELS.deepseek}`);
  } else {
    console.log('   - DeepSeek: No se encontró modelo ligero (usar solo API)');
  }
  console.log('\n💾 Memoria RAM liberada!');
}

main().catch(error => {
  console.error('❌ Error en limpieza:', error);
  process.exit(1);
});
