/**
 * HEYGEN TOKEN SERVICE - Servicio Backend para Obtener Tokens de HeyGen
 * 
 * Genera tokens temporales de acceso para HeyGen sin exponer la API key al frontend
 */

const axios = require('axios');
const path = require('path');
const variablesLoader = require('../utils/variables-loader');

// Cargar variables al inicializar
variablesLoader.load();

class HeyGenTokenService {
  constructor() {
    this.apiKey = variablesLoader.get('HEYGEN_API_KEY') || process.env.HEYGEN_API_KEY;
    this.baseUrl = process.env.HEYGEN_BASE_URL || 'https://api.heygen.com';
    
    if (this.apiKey) {
      console.log('✅ HeyGen Token Service inicializado');
    } else {
      console.warn('⚠️ HeyGen API Key no encontrada');
    }
  }

  /**
   * Obtener token de acceso temporal para streaming
   * @returns {Promise<{success: boolean, token?: string, error?: string}>}
   */
  async getStreamingToken() {
    try {
      if (!this.apiKey) {
        throw new Error('HeyGen API Key no configurada');
      }

      // Endpoint para crear tarea de streaming
      const response = await axios.post(
        `${this.baseUrl}/v1/streaming.task`,
        {},
        {
          headers: {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data && response.data.data && response.data.data.token) {
        return {
          success: true,
          token: response.data.data.token
        };
      }

      throw new Error('Token no recibido en la respuesta');
    } catch (error) {
      console.error('Error obteniendo token de HeyGen:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Error desconocido'
      };
    }
  }

  /**
   * Verificar si el servicio está disponible
   * @returns {boolean}
   */
  isAvailable() {
    return !!this.apiKey;
  }
}

module.exports = HeyGenTokenService;

