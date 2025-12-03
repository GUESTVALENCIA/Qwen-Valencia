/**
 * VARIABLES LOADER - Cargador de Variables para Qwen-Valencia
 * 
 * Sistema limpio y exclusivo - Archivo único: qwen-valencia.env
 * NO busca VARIABLESFULL ni .env.pro genérico
 */

const fs = require('fs');
const path = require('path');
const VariablesEncoder = require('./variables-encoder');

class VariablesLoader {
  constructor() {
    this.variables = {};
    // Archivo único para Qwen-Valencia (evita conflictos con otras apps)
    this.envFile = path.join(process.cwd(), 'qwen-valencia.env');
  }

  /**
   * Cargar variables desde qwen-valencia.env
   * @returns {object} - Objeto con variables cargadas
   */
  load() {
    try {
      // Verificar si existe qwen-valencia.env
      if (!fs.existsSync(this.envFile)) {
        console.warn('⚠️ qwen-valencia.env no encontrado, creando archivo básico...');
        this.createDefaultEnvFile();
      }

      // Cargar variables desde qwen-valencia.env usando dotenv
      require('dotenv').config({ path: this.envFile });
      
      // Cargar variables manualmente también (por si dotenv falla)
      const envContent = fs.readFileSync(this.envFile, 'utf8');
      this.parseEnvFile(envContent);
      
      // Limpiar y cargar en process.env
      for (const key in this.variables) {
        if (this.variables[key]) {
          let value = this.variables[key];
          // Limpiar API keys: eliminar espacios, comillas, saltos de línea
          if (key.includes('API_KEY') || key.includes('APIKEY') || key.includes('TOKEN') || key.includes('SECRET')) {
            value = value.trim().replace(/['"]/g, '').replace(/\s+/g, '');
            // Decodificar solo si parece estar codificado (Base64 reverso)
            // Las keys codificadas suelen ser más largas y no empiezan con el prefijo esperado
            const isLikelyEncoded = value.length > 60 && !value.startsWith('gsk_') && !value.startsWith('sk-');
            
            if (isLikelyEncoded) {
              try {
                const decoded = VariablesEncoder.decode(value);
                // Validar que la decodificación tenga sentido
                // Para API keys de Groq, deben empezar con 'gsk_' y tener al menos 20 caracteres
                if (decoded && decoded.length >= 20 && (decoded.startsWith('gsk_') || decoded.startsWith('sk-'))) {
                  value = decoded;
                  console.log(`✅ Variable ${key} decodificada correctamente (longitud: ${value.length})`);
                } else {
                  // Decodificación no válida, usar valor directo
                  console.log(`ℹ️ Variable ${key} no codificada o decodificación inválida, usando valor directo`);
                }
              } catch (e) {
                // No está codificado o error al decodificar, usar valor directo
                console.log(`ℹ️ Variable ${key} no codificada, usando valor directo`);
              }
            } else {
              // No parece codificado, usar valor directo
              console.log(`ℹ️ Variable ${key} no codificada, usando valor directo`);
            }
            // Limpiar nuevamente después de decodificar (eliminar caracteres de control)
            value = value.trim().replace(/['"]/g, '').replace(/\s+/g, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
          }
          process.env[key] = value;
          this.variables[key] = value;
        }
      }

      console.log(`✅ Variables cargadas desde qwen-valencia.env (${Object.keys(this.variables).length} variables)`);
      return this.variables;
    } catch (error) {
      console.error('❌ Error cargando variables:', error.message);
      return {};
    }
  }

  /**
   * Parsear archivo qwen-valencia.env
   * @param {string} content - Contenido del archivo
   */
  parseEnvFile(content) {
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Ignorar comentarios y líneas vacías
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Buscar formato KEY=VALUE
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Eliminar comillas si existen
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        this.variables[key] = value;
      }
    }
  }

  /**
   * Crear archivo qwen-valencia.env por defecto
   */
  createDefaultEnvFile() {
    const defaultContent = `# Qwen-Valencia - Variables de Entorno
# Archivo exclusivo para Qwen-Valencia (evita conflictos con otras apps)
# NO compartir ni subir a repositorios públicos

# Groq API Key (encriptada)
GROQ_API_KEY=

# DeepGram API Key (opcional)
# DEEPGRAM_API_KEY=

# Cartesia API Key (opcional)
# CARTESIA_API_KEY=
# CARTESIA_VOICE_ID=

# HeyGen API Key (opcional)
# HEYGEN_API_KEY=

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434

# MCP Configuration
MCP_PORT=6000
MCP_SECRET_KEY=qwen_valencia_mcp_secure_2025

# Mode Configuration
MODE=auto
`;

    fs.writeFileSync(this.envFile, defaultContent, 'utf8');
    console.log('✅ Archivo qwen-valencia.env creado');
  }

  /**
   * Obtener variable (decodificada automáticamente)
   * @param {string} key - Clave de la variable
   * @returns {string|null} - Valor decodificado o null
   */
  get(key) {
    const value = this.variables[key] || process.env[key];
    if (!value) return null;

    // Si es una API key, intentar decodificar
    if (key.includes('API_KEY') || key.includes('APIKEY') || key.includes('TOKEN') || key.includes('SECRET')) {
      try {
        const decoded = VariablesEncoder.decode(value);
        if (decoded && decoded.length > 0) {
          return decoded;
        }
      } catch (e) {
        // No está codificado, usar valor directo
      }
    }

    return value;
  }

  /**
   * Obtener todas las variables (decodificadas)
   * @returns {object} - Objeto con todas las variables
   */
  getAll() {
    const all = { ...this.variables };
    
    // Decodificar variables sensibles
    for (const key in all) {
      if (key.includes('API_KEY') || key.includes('APIKEY') || key.includes('TOKEN') || key.includes('SECRET')) {
        try {
          const decoded = VariablesEncoder.decode(all[key]);
          if (decoded && decoded.length > 0) {
            all[key] = decoded;
          }
        } catch (e) {
          // No está codificado
        }
      }
    }
    
    return all;
  }
}

// Instancia singleton
const loader = new VariablesLoader();

module.exports = loader;
module.exports.VariablesLoader = VariablesLoader;
