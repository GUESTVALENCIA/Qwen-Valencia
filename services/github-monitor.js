/**
 * ════════════════════════════════════════════════════════════════════════════
 * GITHUB MONITOR - Monitoreo Continuo de Commits y Pushes
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Monitorea el repositorio GitHub en tiempo real para detectar commits y pushes.
 * Previene cuellos de botella y activa actualización automática de la aplicación.
 */

const https = require('https');
const http = require('http');
const EventEmitter = require('events');

class GitHubMonitor extends EventEmitter {
  constructor(config = {}) {
    super();
    this.repo = config.repo || 'GUESTVALENCIA/IA-SANDRA';
    this.owner = config.owner || 'GUESTVALENCIA';
    this.repoName = config.repoName || 'IA-SANDRA';
    this.githubToken = config.githubToken || process.env.GITHUB_TOKEN;
    this.commitInterval = config.commitInterval || 5000;
    this.pushInterval = config.pushInterval || 3000;
    this.webhookPort = config.webhookPort || 3012;
    this.lastCommitSha = null;
    this.lastPushSha = null;
    this.isRunning = false;
  }

  /**
   * Obtiene el último commit del repositorio
   */
  async getLatestCommit() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.repo}/commits?per_page=1`,
        method: 'GET',
        headers: {
          'User-Agent': 'Sandra-IA-8.0',
          'Accept': 'application/vnd.github.v3+json',
          ...(this.githubToken && { 'Authorization': `token ${this.githubToken}` })
        }
      };

      https.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const commits = JSON.parse(data);
            if (commits.length > 0) {
              resolve(commits[0]);
            } else {
              resolve(null);
            }
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Monitorea commits periódicamente
   */
  async startCommitMonitoring() {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('🔍 Iniciando monitoreo de commits...');

    // Obtener commit inicial
    try {
      const initialCommit = await this.getLatestCommit();
      if (initialCommit) {
        this.lastCommitSha = initialCommit.sha;
        console.log(`📌 Commit inicial: ${initialCommit.sha.substring(0, 7)}`);
      }
    } catch (error) {
      console.warn('⚠️  No se pudo obtener commit inicial:', error.message);
    }

    // Monitoreo periódico
    this.commitIntervalId = setInterval(async () => {
      try {
        const commit = await this.getLatestCommit();
        if (commit && commit.sha !== this.lastCommitSha) {
          console.log(`\n🆕 Nuevo commit detectado: ${commit.sha.substring(0, 7)}`);
          console.log(`   Mensaje: ${commit.commit.message.split('\n')[0]}`);
          console.log(`   Autor: ${commit.commit.author.name}`);
          
          this.lastCommitSha = commit.sha;
          this.emit('commit', commit);
        }
      } catch (error) {
        console.error('❌ Error monitoreando commits:', error.message);
      }
    }, this.commitInterval);
  }

  /**
   * Monitorea pushes periódicamente
   */
  async startPushMonitoring() {
    this.pushIntervalId = setInterval(async () => {
      try {
        const commit = await this.getLatestCommit();
        if (commit && commit.sha !== this.lastPushSha) {
          if (this.lastPushSha !== null) {
            console.log(`\n🚀 Nuevo push detectado: ${commit.sha.substring(0, 7)}`);
            this.emit('push', commit);
          }
          this.lastPushSha = commit.sha;
        }
      } catch (error) {
        console.error('❌ Error monitoreando pushes:', error.message);
      }
    }, this.pushInterval);
  }

  /**
   * Detecta cuellos de botella
   */
  detectBottleneck(commitTime, pushTime) {
    const delay = pushTime - commitTime;
    const threshold = 2000; // 2 segundos

    if (delay > threshold) {
      console.warn(`⚠️  Posible cuello de botella detectado: ${delay}ms de retraso`);
      this.emit('bottleneck', { delay, commitTime, pushTime });
      return true;
    }

    return false;
  }

  /**
   * Inicia el servidor webhook
   */
  startWebhookServer() {
    const server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/webhooks/github') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body);
            if (payload.commits) {
              console.log(`\n🔔 Webhook: ${payload.commits.length} commit(s) recibido(s)`);
              this.emit('webhook', payload);
            }
          } catch (e) {
            console.error('❌ Error procesando webhook:', e.message);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ received: true }));
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(this.webhookPort, () => {
      console.log(`📡 Webhook server escuchando en puerto ${this.webhookPort}`);
    });
  }

  /**
   * Inicia todo el monitoreo
   */
  async start() {
    await this.startCommitMonitoring();
    await this.startPushMonitoring();
    this.startWebhookServer();
    console.log('✅ Monitor de GitHub iniciado\n');
  }

  /**
   * Detiene el monitoreo
   */
  stop() {
    if (this.commitIntervalId) clearInterval(this.commitIntervalId);
    if (this.pushIntervalId) clearInterval(this.pushIntervalId);
    this.isRunning = false;
    console.log('⏹️  Monitor de GitHub detenido');
  }
}

module.exports = GitHubMonitor;

