/**
 * ════════════════════════════════════════════════════════════════════════════
 * APP UPDATER - Actualizador Automático de Aplicación
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Actualiza la aplicación automáticamente cuando se detectan cambios en el repo.
 */

const EventEmitter = require('events');
const { exec } = require('child_process');
const path = require('path');

class AppUpdater extends EventEmitter {
  constructor(config = {}) {
    super();
    this.repoPath = config.repoPath || path.join(__dirname, '..');
    this.appPath = config.appPath || process.cwd();
    this.autoUpdate = config.autoUpdate !== false;
    this.updateDelay = config.updateDelay || 2000;
    this.isUpdating = false;
  }

  /**
   * Ejecuta git pull
   */
  async pullChanges() {
    return new Promise((resolve, reject) => {
      exec('git pull', { cwd: this.repoPath }, (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout });
        }
      });
    });
  }

  /**
   * Verifica si hay cambios
   */
  async checkForChanges() {
    return new Promise((resolve, reject) => {
      exec('git fetch && git status', { cwd: this.repoPath }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          const hasChanges = stdout.includes('Your branch is behind') || 
                           stdout.includes('Changes not staged');
          resolve(hasChanges);
        }
      });
    });
  }

  /**
   * Actualiza la aplicación
   */
  async updateApp(commitInfo = null) {
    if (this.isUpdating) {
      console.log('⏳ Actualización ya en progreso...');
      return;
    }

    this.isUpdating = true;
    console.log('\n🔄 Actualizando aplicación...');

    try {
      // Esperar delay para evitar actualizaciones múltiples
      await new Promise(resolve => setTimeout(resolve, this.updateDelay));

      // Pull cambios
      const pullResult = await this.pullChanges();
      console.log('✅ Cambios descargados del repositorio');

      // Emitir evento de actualización
      this.emit('updated', {
        commit: commitInfo,
        timestamp: new Date().toISOString(),
        pullResult
      });

      console.log('✅ Aplicación actualizada\n');

      // Reiniciar aplicación si es necesario
      if (this.autoUpdate) {
        this.emit('restartRequired');
      }

    } catch (error) {
      console.error('❌ Error actualizando aplicación:', error.message);
      this.emit('updateError', error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Maneja eventos de commit
   */
  handleCommit(commit) {
    console.log(`\n📥 Commit recibido, preparando actualización...`);
    if (this.autoUpdate) {
      this.updateApp(commit);
    } else {
      console.log('⏸️  Auto-actualización deshabilitada');
    }
  }

  /**
   * Maneja eventos de push
   */
  handlePush(push) {
    console.log(`\n📤 Push recibido, actualizando aplicación...`);
    this.updateApp(push);
  }

  /**
   * Inicia el actualizador
   */
  start() {
    console.log('🚀 Actualizador de aplicación iniciado');
    console.log(`   Auto-actualización: ${this.autoUpdate ? 'Habilitada' : 'Deshabilitada'}`);
    console.log(`   Delay: ${this.updateDelay}ms\n`);
  }
}

module.exports = AppUpdater;

