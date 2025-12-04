/**
 * ════════════════════════════════════════════════════════════════════════════
 * AUTO CODE REVIEWER - Revisión Automática de Código con VoltAgent
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Este script invoca automáticamente un subagente de VoltAgent para revisar
 * el código después de cada commit/push, detectando errores, bugs y mejoras.
 *
 * Uso:
 *   node scripts/auto-code-reviewer.js [--agent-id <id>] [--files <file1,file2>]
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Cargar configuración
const CONFIG_PATH = path.join(path.dirname(__dirname), '.code-reviewer-config.json');
let config = {
  enabled: true,
  agentId: 'conversational-code-reviewer',
  fallbackAgentId: 'claude-code',
  voltAgentTokensPath: path.join(
    'C:',
    'Users',
    'clayt',
    'Desktop',
    'VoltAgent-Composer-Workflow',
    'tokens.json'
  ),
  apiBase: 'https://api.voltagent.dev',
  maxFileSize: 500000
};

try {
  if (fs.existsSync(CONFIG_PATH)) {
    const userConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    config = { ...config, ...userConfig };
    // Resolver ruta relativa de tokens
    if (userConfig.voltAgentTokensPath && !path.isAbsolute(userConfig.voltAgentTokensPath)) {
      config.voltAgentTokensPath = path.resolve(
        path.dirname(__dirname),
        userConfig.voltAgentTokensPath
      );
    }
  }
} catch (e) {
  console.warn('⚠️  Error cargando configuración, usando valores por defecto');
}

// Configuración
const VOLTAGENT_TOKENS_PATH = config.voltAgentTokensPath;
const API_BASE = config.apiBase || 'https://api.voltagent.dev';
const DEFAULT_AGENT_ID = config.agentId;
const FALLBACK_AGENT_ID = config.fallbackAgentId;

// Cargar tokens de VoltAgent
function loadTokens() {
  try {
    if (fs.existsSync(VOLTAGENT_TOKENS_PATH)) {
      const tokens = JSON.parse(fs.readFileSync(VOLTAGENT_TOKENS_PATH, 'utf-8'));
      return tokens.tokens?.development?.token || tokens.tokens?.original?.token;
    }
  } catch (e) {
    console.warn('⚠️  No se encontraron tokens de VoltAgent, la revisión automática no funcionará');
  }
  return null;
}

const TOKEN = loadTokens();

// Obtener archivos modificados en el último commit
function getModifiedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf-8',
      cwd: path.dirname(__dirname)
    });
    return output
      .trim()
      .split('\n')
      .filter(f => f && f.length > 0);
  } catch (e) {
    // Si no hay staged files, obtener del último commit
    try {
      const output = execSync('git diff HEAD~1 HEAD --name-only --diff-filter=ACM', {
        encoding: 'utf-8',
        cwd: path.dirname(__dirname)
      });
      return output
        .trim()
        .split('\n')
        .filter(f => f && f.length > 0);
    } catch (e2) {
      return [];
    }
  }
}

// Obtener diff de archivos modificados
function getFileDiffs(files) {
  const diffs = {};
  for (const file of files) {
    if (!file || !fs.existsSync(path.join(path.dirname(__dirname), file))) {
      continue;
    }
    try {
      const diff = execSync(`git diff HEAD~1 HEAD -- "${file}"`, {
        encoding: 'utf-8',
        cwd: path.dirname(__dirname),
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });
      if (diff.trim()) {
        diffs[file] = diff;
      }
    } catch (e) {
      // Ignorar errores de diff
    }
  }
  return diffs;
}

// Leer contenido de archivos para revisión completa
function readFilesForReview(files) {
  const contents = {};
  const rootDir = path.dirname(__dirname);

  for (const file of files) {
    if (!file) continue;
    const fullPath = path.join(rootDir, file);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        // Limitar tamaño para evitar problemas con archivos muy grandes
        const maxSize = config.maxFileSize || 500000;
        if (content.length < maxSize) {
          contents[file] = content;
        } else {
          contents[file] =
            `[Archivo demasiado grande para revisión completa: ${content.length} caracteres]`;
        }
      } catch (e) {
        contents[file] = `[Error leyendo archivo: ${e.message}]`;
      }
    }
  }
  return contents;
}

// Hacer petición HTTP/HTTPS
function makeRequest(url, options, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: 60000 // 60 segundos timeout
    };

    const req = client.request(reqOptions, res => {
      let body = '';
      res.on('data', chunk => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Invocar agente de revisión
async function invokeReviewAgent(agentId, prompt) {
  if (!TOKEN) {
    console.log('⚠️  No hay token de VoltAgent configurado. Saltando revisión automática.');
    return null;
  }

  const endpoints = [
    {
      url: `${API_BASE}/agents/${agentId}/chat`,
      body: {
        input: [{ role: 'user', text: prompt, content: prompt }],
        options: {
          userId: 'auto-code-reviewer',
          conversationId: `review-${Date.now()}`,
          temperature: 0.3, // Baja temperatura para respuestas más precisas
          maxOutputTokens: 8000
        }
      }
    },
    {
      url: `http://localhost:3141/agents/${agentId}/chat`,
      body: {
        input: [{ role: 'user', text: prompt, content: prompt }],
        options: {
          userId: 'auto-code-reviewer',
          conversationId: `review-${Date.now()}`,
          temperature: 0.3,
          maxOutputTokens: 8000
        }
      }
    }
  ];

  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(
        endpoint.url,
        {
          method: 'POST'
        },
        endpoint.body
      );

      if (response.status === 200 || response.status === 201) {
        return response.data;
      } else {
        lastError = { status: response.status, data: response.data };
      }
    } catch (err) {
      lastError = err;
      continue;
    }
  }

  if (lastError) {
    throw new Error(`Error invocando agente: ${lastError.message || JSON.stringify(lastError)}`);
  }

  return null;
}

// Revisión automática principal
async function autoReview(options = {}) {
  // Verificar si está habilitado
  if (!config.enabled && !options.force) {
    console.log('⚠️  Revisión automática deshabilitada en configuración.\n');
    return null;
  }

  const { agentId = DEFAULT_AGENT_ID, files = null, fullReview = false } = options;

  console.log('\n🔍 INICIANDO REVISIÓN AUTOMÁTICA DE CÓDIGO\n');
  console.log(`🤖 Agente: ${agentId}\n`);

  // Obtener archivos a revisar
  let filesToReview = files;
  if (!filesToReview) {
    filesToReview = getModifiedFiles();
  } else if (typeof filesToReview === 'string') {
    filesToReview = filesToReview.split(',').map(f => f.trim());
  }

  if (filesToReview.length === 0) {
    console.log('✅ No hay archivos modificados para revisar.\n');
    return;
  }

  console.log(`📁 Archivos a revisar (${filesToReview.length}):`);
  filesToReview.forEach(file => console.log(`   • ${file}`));
  console.log('');

  // Obtener diffs y contenidos
  const diffs = getFileDiffs(filesToReview);
  const contents = fullReview ? readFilesForReview(filesToReview) : {};

  // Construir prompt para el agente
  let prompt = `Realiza una revisión crítica y profunda del código modificado en este proyecto Electron/Node.js.

CONTEXTO DEL PROYECTO:
- Aplicación Electron con arquitectura Main Process / Renderer Process
- JavaScript (CommonJS) con ESLint y Prettier
- Sistema de logging estructurado, StateManager, EventManager
- Validación IPC, sanitización XSS, gestión de recursos

ARCHIVOS MODIFICADOS:\n`;

  for (const file of filesToReview) {
    prompt += `\n### ${file}\n`;

    if (diffs[file]) {
      prompt += `\n**Cambios (diff):**\n\`\`\`diff\n${diffs[file].substring(0, 10000)}\n\`\`\`\n`;
    }

    if (contents[file]) {
      prompt += `\n**Contenido completo:**\n\`\`\`javascript\n${contents[file].substring(0, 20000)}\n\`\`\`\n`;
    }
  }

  prompt += `\n\nTAREAS DE REVISIÓN:
1. **Errores y Bugs**: Identifica errores de sintaxis, lógica, referencias indefinidas, memory leaks
2. **Seguridad**: Vulnerabilidades XSS, validación IPC, sanitización de inputs
3. **Calidad de Código**: Patrones inconsistentes, código duplicado, complejidad ciclomática
4. **Mejores Prácticas**: Uso correcto de EventManager, StateManager, ResourceCleanupManager
5. **Linting**: Problemas que ESLint debería detectar pero no lo hace
6. **Performance**: Optimizaciones posibles, memory leaks, event listeners sin cleanup

FORMATO DE RESPUESTA:
- Lista de problemas encontrados con:
  * Archivo y línea exacta
  * Severidad (CRÍTICO, ALTO, MEDIO, BAJO)
  * Descripción del problema
  * Código corregido específico
- Priorización de correcciones
- Sugerencias de mejora

IMPORTANTE:
- Sé específico y proporciona código corregido
- Respeta la lógica y funcionalidad actual
- No rompas funcionalidad existente
- Enfócate en correcciones necesarias, no refactorizaciones innecesarias`;

  try {
    console.log('⏳ Enviando código al agente para revisión...\n');

    let response = await invokeReviewAgent(agentId, prompt);

    // Si falla con el agente principal, intentar con fallback
    if (!response && agentId !== FALLBACK_AGENT_ID) {
      console.log(`⚠️  Agente ${agentId} no disponible, intentando con ${FALLBACK_AGENT_ID}...\n`);
      response = await invokeReviewAgent(FALLBACK_AGENT_ID, prompt);
    }

    if (response) {
      console.log('✅ REVISIÓN COMPLETADA\n');
      console.log('═'.repeat(80));

      let reviewText = '';
      if (response.text) {
        reviewText = response.text;
      } else if (response.message) {
        reviewText = response.message;
      } else if (response.content) {
        reviewText = response.content;
      } else if (typeof response === 'string') {
        reviewText = response;
      } else {
        reviewText = JSON.stringify(response, null, 2);
      }

      console.log(reviewText);
      console.log('═'.repeat(80));
      console.log('\n');

      // Guardar revisión en archivo
      const reviewPath = path.join(path.dirname(__dirname), '.code-review-last.txt');
      fs.writeFileSync(reviewPath, reviewText, 'utf-8');
      console.log(`💾 Revisión guardada en: ${reviewPath}\n`);

      return reviewText;
    } else {
      console.log('⚠️  No se pudo obtener respuesta del agente. Revisión omitida.\n');
      return null;
    }
  } catch (error) {
    console.error('❌ Error durante la revisión automática:', error.message);
    console.error('   La revisión se omitirá, pero el commit/push continuará.\n');
    return null;
  }
}

// Main
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agent-id' && args[i + 1]) {
      options.agentId = args[i + 1];
      i++;
    } else if (args[i] === '--files' && args[i + 1]) {
      options.files = args[i + 1].split(',').map(f => f.trim());
      i++;
    } else if (args[i] === '--full') {
      options.fullReview = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('\n📖 USO:\n');
      console.log('  node scripts/auto-code-reviewer.js [opciones]\n');
      console.log('Opciones:');
      console.log('  --agent-id <id>     ID del agente de VoltAgent a usar');
      console.log('  --files <file1,...>  Archivos específicos a revisar');
      console.log('  --full              Revisión completa (incluye contenido de archivos)');
      console.log('  --help, -h          Mostrar esta ayuda\n');
      process.exit(0);
    }
  }

  autoReview(options)
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { autoReview, invokeReviewAgent };
