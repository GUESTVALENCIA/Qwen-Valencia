/**
 * AI LAB - Laboratorio de IAs para Ejecutar Código
 * 
 * Permite ejecutar código fuera del entorno de la aplicación
 * con total libertad y seguridad controlada
 */

const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

class AILab {
  constructor() {
    // Directorio del laboratorio (fuera de la app)
    this.labDir = path.join(os.homedir(), 'qwen-valencia-lab');
    this.timeout = 30000; // 30 segundos por defecto
    
    // Crear directorio del laboratorio si no existe
    this.ensureLabDir();
  }
  
  /**
   * Asegurar que el directorio del laboratorio existe
   */
  async ensureLabDir() {
    try {
      await fs.mkdir(this.labDir, { recursive: true });
      console.log(`✅ Laboratorio de IAs: ${this.labDir}`);
    } catch (error) {
      console.error('Error creando directorio del laboratorio:', error);
    }
  }
  
  /**
   * Ejecutar código en el laboratorio
   */
  async executeCode(language, code, options = {}) {
    try {
      const timeout = options.timeout || this.timeout;
      
      switch (language.toLowerCase()) {
        case 'python':
        case 'py':
          return await this.executePython(code, timeout);
        
        case 'javascript':
        case 'js':
        case 'node':
          return await this.executeJavaScript(code, timeout);
        
        case 'bash':
        case 'shell':
        case 'sh':
          return await this.executeBash(code, timeout);
        
        case 'powershell':
        case 'ps1':
          return await this.executePowerShell(code, timeout);
        
        default:
          return {
            success: false,
            error: `Lenguaje no soportado: ${language}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Ejecutar código Python
   */
  async executePython(code, timeout) {
    const filePath = path.join(this.labDir, `script_${Date.now()}.py`);
    
    try {
      // Escribir código a archivo
      await fs.writeFile(filePath, code, 'utf8');
      
      // Ejecutar Python
      const { stdout, stderr } = await Promise.race([
        execAsync(`python "${filePath}"`, {
          cwd: this.labDir,
          timeout,
          maxBuffer: 1024 * 1024 * 10 // 10MB
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);
      
      // Limpiar archivo
      await fs.unlink(filePath).catch(() => {});
      
      return {
        success: true,
        output: stdout || '',
        error: stderr || '',
        exitCode: 0
      };
    } catch (error) {
      // Limpiar archivo en caso de error
      await fs.unlink(filePath).catch(() => {});
      
      return {
        success: false,
        error: error.message,
        output: error.stdout || '',
        stderr: error.stderr || ''
      };
    }
  }
  
  /**
   * Ejecutar código JavaScript/Node
   */
  async executeJavaScript(code, timeout) {
    const filePath = path.join(this.labDir, `script_${Date.now()}.js`);
    
    try {
      // Escribir código a archivo
      await fs.writeFile(filePath, code, 'utf8');
      
      // Ejecutar Node.js
      const { stdout, stderr } = await Promise.race([
        execAsync(`node "${filePath}"`, {
          cwd: this.labDir,
          timeout,
          maxBuffer: 1024 * 1024 * 10
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);
      
      // Limpiar archivo
      await fs.unlink(filePath).catch(() => {});
      
      return {
        success: true,
        output: stdout || '',
        error: stderr || '',
        exitCode: 0
      };
    } catch (error) {
      // Limpiar archivo en caso de error
      await fs.unlink(filePath).catch(() => {});
      
      return {
        success: false,
        error: error.message,
        output: error.stdout || '',
        stderr: error.stderr || ''
      };
    }
  }
  
  /**
   * Ejecutar código Bash
   */
  async executeBash(code, timeout) {
    if (process.platform === 'win32') {
      // En Windows, usar PowerShell
      return await this.executePowerShell(code, timeout);
    }
    
    const filePath = path.join(this.labDir, `script_${Date.now()}.sh`);
    
    try {
      // Escribir código a archivo
      await fs.writeFile(filePath, code, 'utf8');
      await fs.chmod(filePath, 0o755); // Hacer ejecutable
      
      // Ejecutar bash
      const { stdout, stderr } = await Promise.race([
        execAsync(`bash "${filePath}"`, {
          cwd: this.labDir,
          timeout,
          maxBuffer: 1024 * 1024 * 10
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);
      
      // Limpiar archivo
      await fs.unlink(filePath).catch(() => {});
      
      return {
        success: true,
        output: stdout || '',
        error: stderr || '',
        exitCode: 0
      };
    } catch (error) {
      // Limpiar archivo en caso de error
      await fs.unlink(filePath).catch(() => {});
      
      return {
        success: false,
        error: error.message,
        output: error.stdout || '',
        stderr: error.stderr || ''
      };
    }
  }
  
  /**
   * Ejecutar código PowerShell
   */
  async executePowerShell(code, timeout) {
    const filePath = path.join(this.labDir, `script_${Date.now()}.ps1`);
    
    try {
      // Escribir código a archivo
      await fs.writeFile(filePath, code, 'utf8');
      
      // Ejecutar PowerShell
      const { stdout, stderr } = await Promise.race([
        execAsync(`powershell -ExecutionPolicy Bypass -File "${filePath}"`, {
          cwd: this.labDir,
          timeout,
          maxBuffer: 1024 * 1024 * 10
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);
      
      // Limpiar archivo
      await fs.unlink(filePath).catch(() => {});
      
      return {
        success: true,
        output: stdout || '',
        error: stderr || '',
        exitCode: 0
      };
    } catch (error) {
      // Limpiar archivo en caso de error
      await fs.unlink(filePath).catch(() => {});
      
      return {
        success: false,
        error: error.message,
        output: error.stdout || '',
        stderr: error.stderr || ''
      };
    }
  }
  
  /**
   * Limpiar archivos temporales del laboratorio
   */
  async cleanup() {
    try {
      const files = await fs.readdir(this.labDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(this.labDir, file);
        const stats = await fs.stat(filePath);
        
        // Eliminar archivos más antiguos de 1 hora
        if (now - stats.mtimeMs > 3600000) {
          await fs.unlink(filePath).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Error limpiando laboratorio:', error);
    }
  }
}

module.exports = AILab;

