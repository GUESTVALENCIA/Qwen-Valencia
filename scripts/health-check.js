/**
 * ════════════════════════════════════════════════════════════════════════════
 * HEALTH CHECK - Verificación de Salud del Sistema
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Verifica que todos los componentes del sistema estén funcionando correctamente.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createOrchestrator } = require('../core/sandra-core');

const MCP_SERVER_URL = 'http://localhost:3141';

async function checkGroqAPI() {
  return new Promise((resolve) => {
    if (!process.env.GROQ_API_KEY) {
      resolve({ status: 'error', message: 'GROQ_API_KEY no configurada' });
      return;
    }

    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/models',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      res.on('data', () => {}); // Consumir datos
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ status: 'ok', message: 'Groq API accesible' });
        } else {
          resolve({ status: 'error', message: `Groq API respondió con status ${res.statusCode}` });
        }
      });
    });

    req.on('error', (error) => {
      resolve({ status: 'error', message: `Error conectando a Groq API: ${error.message}` });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'error', message: 'Timeout conectando a Groq API' });
    });

    req.end();
  });
}

async function checkVoltAgentAPI() {
  return new Promise((resolve) => {
    const tokensPath = path.join(
      'C:',
      'Users',
      'clayt',
      'Desktop',
      'VoltAgent-Composer-Workflow',
      'tokens.json'
    );

    if (!fs.existsSync(tokensPath)) {
      resolve({ status: 'warning', message: 'Tokens de VoltAgent no encontrados' });
      return;
    }

    try {
      const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
      const token = tokens.tokens?.development?.token || tokens.tokens?.original?.token;
      
      if (!token) {
        resolve({ status: 'warning', message: 'Token de VoltAgent no encontrado en archivo' });
        return;
      }

      const options = {
        hostname: 'api.voltagent.dev',
        path: '/health',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      };

      const req = https.request(options, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          resolve({ status: 'ok', message: 'VoltAgent API accesible' });
        } else {
          resolve({ status: 'warning', message: `VoltAgent API respondió con status ${res.statusCode}` });
        }
      });

      req.on('error', () => {
        resolve({ status: 'warning', message: 'No se pudo conectar a VoltAgent API (puede ser normal si no está en uso)' });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 'warning', message: 'Timeout conectando a VoltAgent API' });
      });

      req.end();
    } catch (e) {
      resolve({ status: 'warning', message: `Error leyendo tokens: ${e.message}` });
    }
  });
}

async function checkMCPServer() {
  return new Promise((resolve) => {
    const req = http.get(`${MCP_SERVER_URL}/health`, { timeout: 3000 }, (res) => {
      res.on('data', () => {}); // Consumir datos
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ status: 'ok', message: 'MCP Server activo' });
        } else {
          resolve({ status: 'warning', message: `MCP Server respondió con status ${res.statusCode}` });
        }
      });
    });

    req.on('error', () => {
      resolve({ status: 'warning', message: 'MCP Server no disponible (puede ser normal si no está corriendo)' });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'warning', message: 'Timeout conectando a MCP Server' });
    });
  });
}

async function checkOrchestrator() {
  try {
    const orchestrator = createOrchestrator({
      groqApiKey: process.env.GROQ_API_KEY
    });

    const identity = orchestrator.getIdentity();
    if (identity && identity.name === 'Sandra IA 8.0') {
      return { status: 'ok', message: 'Orquestador inicializado correctamente' };
    } else {
      return { status: 'error', message: 'Orquestador no tiene identidad correcta' };
    }
  } catch (error) {
    return { status: 'error', message: `Error inicializando orquestador: ${error.message}` };
  }
}

async function checkConfigFiles() {
  const configFiles = [
    'config/models.json',
    'config/sandra-orchestrator.json',
    'config/subagents-sandra.json',
    'config/subagents-execution.json'
  ];

  const results = [];
  let allOk = true;

  configFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      try {
        JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        results.push({ file, status: 'ok' });
      } catch (e) {
        results.push({ file, status: 'error', message: e.message });
        allOk = false;
      }
    } else {
      results.push({ file, status: 'error', message: 'Archivo no encontrado' });
      allOk = false;
    }
  });

  return {
    status: allOk ? 'ok' : 'error',
    message: allOk ? 'Todos los archivos de configuración válidos' : 'Algunos archivos tienen errores',
    details: results
  };
}

async function main() {
  console.log('🏥 Health Check - Sandra IA 8.0\n');
  console.log('='.repeat(60));

  const checks = [
    { name: 'Groq API', fn: checkGroqAPI },
    { name: 'VoltAgent API', fn: checkVoltAgentAPI },
    { name: 'MCP Server', fn: checkMCPServer },
    { name: 'Orquestador', fn: checkOrchestrator },
    { name: 'Archivos de Configuración', fn: checkConfigFiles }
  ];

  const results = [];

  for (const check of checks) {
    console.log(`\n🔍 Verificando ${check.name}...`);
    const result = await check.fn();
    results.push({ name: check.name, ...result });

    if (result.status === 'ok') {
      console.log(`   ✅ ${result.message}`);
    } else if (result.status === 'warning') {
      console.warn(`   ⚠️  ${result.message}`);
    } else {
      console.error(`   ❌ ${result.message}`);
    }

    if (result.details) {
      result.details.forEach(detail => {
        if (detail.status === 'ok') {
          console.log(`      ✅ ${detail.file}`);
        } else {
          console.error(`      ❌ ${detail.file}: ${detail.message}`);
        }
      });
    }
  }

  // Resumen
  console.log('\n' + '='.repeat(60));
  const okCount = results.filter(r => r.status === 'ok').length;
  const warningCount = results.filter(r => r.status === 'warning').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  console.log(`\n📊 Resumen:`);
  console.log(`   ✅ OK: ${okCount}`);
  console.log(`   ⚠️  Advertencias: ${warningCount}`);
  console.log(`   ❌ Errores: ${errorCount}`);

  if (errorCount === 0) {
    console.log('\n✅ Sistema saludable');
    if (warningCount > 0) {
      console.log('⚠️  Hay algunas advertencias, pero el sistema puede funcionar');
    }
    process.exit(0);
  } else {
    console.error('\n❌ Sistema tiene errores que deben corregirse');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  checkGroqAPI,
  checkVoltAgentAPI,
  checkMCPServer,
  checkOrchestrator,
  checkConfigFiles
};

