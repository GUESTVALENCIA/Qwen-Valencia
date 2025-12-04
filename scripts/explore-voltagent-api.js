/**
 * ════════════════════════════════════════════════════════════════════════════
 * EXPLORE VOLTAGENT API - Explorar y Configurar VoltAgent Automáticamente
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Este script usa la API de VoltAgent para:
 * - Listar agentes existentes
 * - Ver proyectos y configuraciones
 * - Crear/actualizar agentes automáticamente
 * - Configurar la orquestación completa
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Cargar tokens
const TOKENS_PATH = path.join(
  'C:',
  'Users',
  'clayt',
  'Desktop',
  'VoltAgent-Composer-Workflow',
  'tokens.json'
);

const API_BASE = 'https://api.voltagent.dev';

function loadTokens() {
  try {
    if (fs.existsSync(TOKENS_PATH)) {
      const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
      return tokens.tokens?.development?.token || tokens.tokens?.admin?.token || tokens.tokens?.original?.token;
    }
  } catch (e) {
    console.error('❌ Error cargando tokens:', e.message);
  }
  return null;
}

const TOKEN = loadTokens();

if (!TOKEN) {
  console.error('❌ No se encontró token de VoltAgent');
  process.exit(1);
}

// Función para hacer peticiones a la API
function makeRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'VoltAgent-Explorer/1.0'
      }
    };

    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`API Error ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          resolve(responseData);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Explorar agentes
async function listAgents() {
  console.log('\n🔍 Explorando agentes en VoltAgent...\n');
  
  try {
    // Intentar diferentes endpoints comunes
    const endpoints = [
      '/agents',
      '/api/agents',
      '/v1/agents',
      '/projects',
      '/api/projects'
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`📡 Intentando: ${endpoint}...`);
        const result = await makeRequest(endpoint);
        console.log(`✅ Éxito en ${endpoint}:`);
        console.log(JSON.stringify(result, null, 2));
        return result;
      } catch (e) {
        console.log(`   ⚠️  ${endpoint}: ${e.message}`);
      }
    }

    // Si no funciona, intentar verificar el token
    console.log('\n🔐 Verificando token...');
    try {
      const verifyResult = await makeRequest('/auth/verify', 'POST', { token: TOKEN });
      console.log('✅ Token válido:', verifyResult);
    } catch (e) {
      console.log('⚠️  Verificación de token:', e.message);
    }

  } catch (error) {
    console.error('❌ Error explorando API:', error.message);
  }
}

// Ver información de la cuenta
async function getAccountInfo() {
  console.log('\n👤 Obteniendo información de la cuenta...\n');
  
  try {
    const endpoints = [
      '/account',
      '/api/account',
      '/v1/account',
      '/user',
      '/api/user'
    ];

    for (const endpoint of endpoints) {
      try {
        const result = await makeRequest(endpoint);
        console.log(`✅ Información de cuenta (${endpoint}):`);
        console.log(JSON.stringify(result, null, 2));
        return result;
      } catch (e) {
        // Silencioso, probar siguiente
      }
    }
  } catch (error) {
    console.log('⚠️  No se pudo obtener información de cuenta');
  }
}

// Listar proyectos
async function listProjects() {
  console.log('\n📁 Explorando proyectos...\n');
  
  try {
    const endpoints = [
      '/projects',
      '/api/projects',
      '/v1/projects'
    ];

    for (const endpoint of endpoints) {
      try {
        const result = await makeRequest(endpoint);
        console.log(`✅ Proyectos encontrados (${endpoint}):`);
        console.log(JSON.stringify(result, null, 2));
        return result;
      } catch (e) {
        // Silencioso
      }
    }
  } catch (error) {
    console.log('⚠️  No se encontraron proyectos');
  }
}

// Función principal
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  EXPLORADOR DE VOLTAGENT API - Configuración Automática                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\n🔑 Token cargado: ${TOKEN.substring(0, 20)}...`);
  console.log(`🌐 API Base: ${API_BASE}\n`);

  // Explorar diferentes aspectos
  await getAccountInfo();
  await listProjects();
  await listAgents();

  console.log('\n✅ Exploración completada\n');
  console.log('📝 Próximos pasos:');
  console.log('   1. Revisa los resultados arriba');
  console.log('   2. Usa la consola web: https://console.voltagent.dev');
  console.log('   3. O configura agentes usando los scripts existentes\n');
}

// Ejecutar
main().catch(console.error);

