/**
 * ════════════════════════════════════════════════════════════════════════════
 * START SANDRA MONITORING - Inicia Monitoreo Completo de GitHub y MCP
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Inicia todos los monitores para GitHub y MCP, y el actualizador de aplicación.
 */

const GitHubMonitor = require('../services/github-monitor');
const MCPMonitor = require('../services/mcp-monitor');
const AppUpdater = require('../services/app-updater');
const fs = require('fs');
const path = require('path');

// Cargar configuración
const EXECUTION_CONFIG = path.join(__dirname, '..', 'config', 'subagents-execution.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(EXECUTION_CONFIG, 'utf-8'));
  } catch (e) {
    return {
      monitoring: {
        github: { enabled: true, pollInterval: 3000 },
        mcp: { enabled: true, healthCheckInterval: 10000 },
        appUpdate: { enabled: true, autoUpdate: true }
      }
    };
  }
}

async function main() {
  const config = loadConfig();
  const monitoring = config.monitoring || {};

  console.log('🚀 Iniciando Sistema de Monitoreo de Sandra IA 8.0\n');

  // GitHub Monitor
  if (monitoring.github?.enabled !== false) {
    const githubMonitor = new GitHubMonitor({
      repo: 'GUESTVALENCIA/IA-SANDRA',
      commitInterval: monitoring.github?.pollInterval || 5000,
      pushInterval: monitoring.github?.pollInterval || 3000,
      webhookPort: monitoring.github?.webhookPort || 3012
    });

    // App Updater
    const appUpdater = new AppUpdater({
      autoUpdate: monitoring.appUpdate?.autoUpdate !== false,
      updateDelay: monitoring.appUpdate?.updateDelay || 2000
    });

    // Conectar eventos
    githubMonitor.on('commit', (commit) => {
      console.log('📥 Commit detectado, preparando actualización...');
      appUpdater.handleCommit(commit);
    });

    githubMonitor.on('push', (push) => {
      console.log('📤 Push detectado, actualizando aplicación...');
      appUpdater.handlePush(push);
    });

    githubMonitor.on('bottleneck', (data) => {
      console.warn(`⚠️  Cuello de botella detectado: ${data.delay}ms`);
    });

    await githubMonitor.start();
    appUpdater.start();
  }

  // MCP Monitor
  if (monitoring.mcp?.enabled !== false) {
    const mcpMonitor = new MCPMonitor({
      mcpServerUrl: 'http://localhost:3141',
      healthCheckInterval: monitoring.mcp?.healthCheckInterval || 10000,
      queueMonitorInterval: monitoring.mcp?.queueMonitorInterval || 5000
    });

    mcpMonitor.on('unhealthy', (health) => {
      console.error('❌ MCP Server no saludable:', health);
    });

    mcpMonitor.on('queueWarning', (data) => {
      console.warn(`⚠️  Cola MCP grande: ${data.size} tareas`);
    });

    await mcpMonitor.start();
  }

  console.log('\n✅ Sistema de monitoreo iniciado correctamente');
  console.log('   Presiona Ctrl+C para detener\n');

  // Manejo de señales
  process.on('SIGINT', () => {
    console.log('\n⏹️  Deteniendo monitoreo...');
    process.exit(0);
  });
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };

