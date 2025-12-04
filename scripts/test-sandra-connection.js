/**
 * ════════════════════════════════════════════════════════════════════════════
 * TEST SANDRA CONNECTION - Verificación de Conexión con Sandra IA
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Verifica que Sandra IA esté funcionando correctamente y responde a un saludo.
 */

const axios = require('axios');

const SANDRA_MCP_URL = 'http://localhost:6004';
const TIMEOUT = 30000; // 30 segundos

async function checkHealth() {
  try {
    console.log('🔍 Verificando salud del servidor...');
    const response = await axios.get(`${SANDRA_MCP_URL}/health`, { timeout: 5000 });
    
    if (response.data.status === 'ok') {
      console.log('✅ Servidor de Sandra IA está activo');
      console.log(`   Orquestador disponible: ${response.data.orchestrator ? 'Sí' : 'No'}`);
      return true;
    } else {
      console.error('❌ Servidor respondió pero con estado incorrecto');
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ No se pudo conectar al servidor de Sandra IA');
      console.error('   Asegúrate de que la aplicación esté corriendo');
    } else {
      console.error('❌ Error verificando salud:', error.message);
    }
    return false;
  }
}

async function testGreeting() {
  try {
    console.log('\n👋 Enviando saludo de prueba...');
    
    const greeting = 'Hola, ¿cómo estás?';
    console.log(`   Mensaje: "${greeting}"`);
    
    const response = await axios.post(
      `${SANDRA_MCP_URL}/route-message`,
      {
        text: greeting,
        attachments: [],
        modality: 'text',
        options: {}
      },
      {
        timeout: TIMEOUT,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data && response.data.success) {
      console.log('\n✅ Sandra IA respondió correctamente:');
      console.log(`\n📝 Respuesta:\n${response.data.response || response.data.content}\n`);
      console.log(`   Modelo: ${response.data.model || 'sandra-ia-8.0'}`);
      console.log(`   Provider: ${response.data.provider || 'sandra'}`);
      
      if (response.data.usage) {
        console.log(`   Tokens: ${response.data.usage.total_tokens || 'N/A'}`);
      }
      
      return true;
    } else {
      console.error('❌ Sandra IA respondió pero con error:', response.data.error);
      return false;
    }
  } catch (error) {
    if (error.response) {
      console.error('❌ Error en respuesta del servidor:');
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Error: ${error.response.data?.error || error.response.data?.message || 'Error desconocido'}`);
    } else if (error.request) {
      console.error('❌ No se recibió respuesta del servidor');
      console.error('   Verifica que el servidor esté corriendo en el puerto 6004');
    } else {
      console.error('❌ Error:', error.message);
    }
    return false;
  }
}

async function checkVariables() {
  console.log('\n🔑 Verificando variables de entorno...\n');
  
  // Verificar GROQ_API_KEY
  const groqApiKey = process.env.GROQ_API_KEY;
  
  if (groqApiKey) {
    const preview = groqApiKey.substring(0, 10) + '...';
    console.log(`✅ GROQ_API_KEY encontrada: ${preview}`);
    
    if (groqApiKey.startsWith('gsk_')) {
      console.log('   ✅ Formato correcto');
    } else {
      console.log('   ⚠️  Formato puede ser incorrecto (debe empezar con "gsk_")');
    }
  } else {
    console.log('❌ GROQ_API_KEY no encontrada en variables de entorno');
    console.log('   Necesitas configurar GROQ_API_KEY para que Sandra IA funcione');
    console.log('   Puedes hacerlo en:');
    console.log('   - qwen-valencia.env');
    console.log('   - .env.pro');
    console.log('   - Variables de entorno del sistema');
    return false;
  }
  
  return true;
}

async function main() {
  console.log('🧪 Test de Conexión - Sandra IA 8.0\n');
  console.log('='.repeat(60));
  
  // Verificar variables
  const varsOk = await checkVariables();
  if (!varsOk) {
    console.log('\n⚠️  Continuando sin GROQ_API_KEY (puede fallar)...\n');
  }
  
  // Verificar salud
  const healthOk = await checkHealth();
  if (!healthOk) {
    console.log('\n❌ El servidor no está disponible. Asegúrate de que la aplicación esté corriendo.\n');
    process.exit(1);
  }
  
  // Probar saludo
  const greetingOk = await testGreeting();
  
  // Resumen
  console.log('\n' + '='.repeat(60));
  if (greetingOk) {
    console.log('✅ Test completado exitosamente');
    console.log('   Sandra IA está funcionando correctamente\n');
    process.exit(0);
  } else {
    console.log('❌ Test falló');
    console.log('   Revisa los errores arriba\n');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Error fatal:', error.message);
    process.exit(1);
  });
}

module.exports = { checkHealth, testGreeting, checkVariables };

