const fs = require('fs');
const path = require('path');
const readline = require('readline');
const VariablesEncoder = require('./src/utils/variables-encoder');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function updateApiKey() {
  console.log('\n🔑 Actualizar API Key de Groq\n');
  
  // Leer API key desde input del usuario o variable de entorno
  const apiKeyFromEnv = process.env.GROQ_API_KEY;
  let newApiKey;
  
  if (apiKeyFromEnv && apiKeyFromEnv.trim() !== '') {
    console.log('✅ API Key encontrada en variable de entorno GROQ_API_KEY');
    newApiKey = apiKeyFromEnv;
  } else {
    newApiKey = await question('📝 Ingresa tu API Key de Groq: ');
  }
  
  if (!newApiKey || newApiKey.trim() === '') {
    console.log('❌ No se proporcionó API Key');
    rl.close();
    return;
  }
  
  const cleanKey = newApiKey.trim().replace(/['"]/g, '').replace(/\s+/g, '');
  const encodedKey = VariablesEncoder.encode(cleanKey);

  const envFile = path.join(__dirname, '.env.pro');
  
  if (!fs.existsSync(envFile)) {
    console.log('⚠️ Archivo .env.pro no existe, creándolo...');
    fs.writeFileSync(envFile, '');
  }
  
  let content = fs.readFileSync(envFile, 'utf8');

  // Reemplazar la línea GROQ_API_KEY o añadirla si no existe
  if (content.includes('GROQ_API_KEY=')) {
    content = content.replace(/^GROQ_API_KEY=.*$/m, `GROQ_API_KEY=${encodedKey}`);
  } else {
    content += (content.endsWith('\n') ? '' : '\n') + `GROQ_API_KEY=${encodedKey}\n`;
  }

  fs.writeFileSync(envFile, content, 'utf8');

  console.log('✅ API Key actualizada en .env.pro');
  console.log(`✅ Nueva key codificada: ${encodedKey.substring(0, 30)}...`);
  
  rl.close();
}

updateApiKey().catch(error => {
  console.error('❌ Error:', error.message);
  rl.close();
  process.exit(1);
});

