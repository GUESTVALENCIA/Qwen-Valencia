/**
 * ════════════════════════════════════════════════════════════════════════════
 * INVOKE SANDRA SUBAGENT - Invocación Individual de Subagentes
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Invoca un subagente específico vía VoltAgent API o MCP Server local.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuración
const VOLTAGENT_TOKENS_PATH = path.join(
  'C:',
  'Users',
  'clayt',
  'Desktop',
  'VoltAgent-Composer-Workflow',
  'tokens.json'
);
const API_BASE = 'https://api.voltagent.dev';
const MCP_SERVER_URL = 'http://localhost:3141';

// Cargar tokens
function loadTokens() {
  try {
    if (fs.existsSync(VOLTAGENT_TOKENS_PATH)) {
      const tokens = JSON.parse(fs.readFileSync(VOLTAGENT_TOKENS_PATH, 'utf-8'));
      return tokens.tokens?.development?.token || tokens.tokens?.original?.token;
    }
  } catch (e) {
    console.warn('⚠️  No se encontraron tokens de VoltAgent');
  }
  return null;
}

const TOKEN = loadTokens();

/**
 * Realiza una petición HTTP/HTTPS
 */
function makeRequest(url, options, data = null) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    const urlObj = new URL(url);

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        ...options.headers
      }
    };

    const req = client.request(requestOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * Invoca un subagente vía VoltAgent API
 */
async function invokeSubagent(agentId, prompt, options = {}) {
  if (!TOKEN) {
    throw new Error('No hay token de VoltAgent configurado');
  }

  const endpoints = [
    {
      url: `${API_BASE}/agents/${agentId}/chat`,
      description: 'VoltAgent API'
    },
    {
      url: `${MCP_SERVER_URL}/agents/${agentId}/chat`,
      description: 'MCP Server Local'
    }
  ];

  const body = {
    input: [{ role: 'user', text: prompt, content: prompt }],
    options: {
      userId: options.userId || 'sandra-orchestrator',
      conversationId: options.conversationId || `sandra-${Date.now()}`,
      temperature: options.temperature || 0.7,
      maxOutputTokens: options.maxOutputTokens || 8000
    }
  };

  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      console.log(`🔄 Intentando invocar ${agentId} vía ${endpoint.description}...`);
      
      const response = await makeRequest(
        endpoint.url,
        { method: 'POST' },
        body
      );

      if (response.status === 200 || response.status === 201) {
        console.log(`✅ ${agentId} respondió vía ${endpoint.description}`);
        return response.data;
      } else {
        lastError = { status: response.status, data: response.data, endpoint: endpoint.description };
        console.warn(`⚠️  ${endpoint.description} respondió con status ${response.status}`);
      }
    } catch (err) {
      lastError = { error: err.message, endpoint: endpoint.description };
      console.warn(`⚠️  Error con ${endpoint.description}: ${err.message}`);
      continue;
    }
  }

  if (lastError) {
    throw new Error(`Error invocando ${agentId}: ${JSON.stringify(lastError)}`);
  }

  return null;
}

/**
 * Función principal (CLI)
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Uso: node invoke-sandra-subagent.js <agentId> <prompt> [options]');
    console.log('\nEjemplo:');
    console.log('  node invoke-sandra-subagent.js code-reviewer "Revisa este código: ..."');
    process.exit(1);
  }

  const agentId = args[0];
  const prompt = args[1];
  const options = args[2] ? JSON.parse(args[2]) : {};

  try {
    console.log(`\n🎯 Invocando subagente: ${agentId}\n`);
    const response = await invokeSubagent(agentId, prompt, options);
    
    if (response) {
      console.log('\n📋 Respuesta:');
      console.log(JSON.stringify(response, null, 2));
    } else {
      console.log('⚠️  No se recibió respuesta');
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main();
}

module.exports = { invokeSubagent, loadTokens };

