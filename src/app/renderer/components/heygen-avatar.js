/**
 * HEYGEN AVATAR COMPONENT - Componente Frontend para Avatar Streaming
 * 
 * DESHABILITADO TEMPORALMENTE
 * 
 * Usa el SDK de HeyGen desde CDN para streaming de avatar en tiempo real
 * Avatar público: Elena (e710fd953c094f398dd7e94c3554254f)
 * Voice ID: Español (2d5b0e6cf361460aa7fc47e3cee4b30c)
 */

// FLAG DE HABILITACIÓN - DESHABILITADO
const HEYGEN_ENABLED = false;

// Configuración del avatar público
const AVATAR_CONFIG = {
  avatarId: 'e710fd953c094f398dd7e94c3554254f', // Elena (público)
  voiceId: '2d5b0e6cf361460aa7fc47e3cee4b30c', // Español
  quality: 'high'
};

class HeyGenAvatar {
  constructor() {
    if (!HEYGEN_ENABLED) {
      console.warn('⚠️ HeyGen Avatar deshabilitado');
      return;
    }
    
    this.avatar = null;
    this.isInitialized = false;
    this.isStreaming = false;
    this.videoElement = null;
    this.sdkLoaded = false;
  }

  /**
   * Cargar SDK de HeyGen desde CDN
   */
  async loadSDK() {
    if (!HEYGEN_ENABLED) {
      return false;
    }
    
    if (this.sdkLoaded) {
      return true;
    }

    return new Promise((resolve, reject) => {
      // Verificar si ya está cargado
      if (window.StreamingAvatar) {
        this.sdkLoaded = true;
        resolve(true);
        return;
      }

      // Cargar desde CDN
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import StreamingAvatar, { AvatarQuality, TaskType } from 'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@1.0.11/+esm';
        window.StreamingAvatar = StreamingAvatar;
        window.AvatarQuality = AvatarQuality;
        window.TaskType = TaskType;
        window.dispatchEvent(new Event('heygen-sdk-loaded'));
      `;
      
      script.onerror = () => {
        console.error('❌ Error cargando SDK de HeyGen');
        reject(new Error('Error cargando SDK de HeyGen'));
      };

      window.addEventListener('heygen-sdk-loaded', () => {
        this.sdkLoaded = true;
        console.log('✅ SDK de HeyGen cargado');
        resolve(true);
      }, { once: true });

      document.head.appendChild(script);
    });
  }

  /**
   * Obtener token de acceso desde el backend
   */
  async fetchAccessToken() {
    try {
      // Usar el endpoint expuesto por el main process
      const response = await fetch('http://localhost:3000/api/heygen/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error obteniendo token: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.token) {
        return data.token;
      }

      throw new Error(data.error || 'Token no recibido');
    } catch (error) {
      console.error('Error obteniendo token de HeyGen:', error);
      throw error;
    }
  }

  /**
   * Inicializar avatar
   * @param {string} videoElementId - ID del elemento video
   */
  async init(videoElementId = 'avatar-video') {
    try {
      if (this.isInitialized) {
        console.log('Avatar ya inicializado');
        return { success: true };
      }

      // Cargar SDK
      await this.loadSDK();

      // Obtener token
      const token = await this.fetchAccessToken();

      // Obtener elemento video
      this.videoElement = document.getElementById(videoElementId);
      if (!this.videoElement) {
        throw new Error(`Elemento video con ID "${videoElementId}" no encontrado`);
      }

      // Inicializar SDK
      const { StreamingAvatar, AvatarQuality } = window;
      this.avatar = new StreamingAvatar({ token });

      // Crear sesión de avatar
      const sessionData = await this.avatar.createStartAvatar({
        quality: AvatarQuality.High,
        avatarName: AVATAR_CONFIG.avatarId
      });

      // Conectar stream al elemento video
      if (this.avatar.stream) {
        this.videoElement.srcObject = this.avatar.stream;
        await this.videoElement.play();
        this.isStreaming = true;
      }

      this.isInitialized = true;
      console.log('✅ Avatar HeyGen inicializado');

      return {
        success: true,
        session: sessionData
      };
    } catch (error) {
      console.error('Error inicializando avatar:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Hacer hablar al avatar
   * @param {string} text - Texto a pronunciar
   */
  async speak(text) {
    try {
      if (!this.isInitialized || !this.avatar) {
        throw new Error('Avatar no inicializado. Llama a init() primero.');
      }

      if (!text || text.trim().length === 0) {
        return { success: false, error: 'Texto vacío' };
      }

      const { TaskType } = window;
      
      await this.avatar.speak({
        text: text.trim(),
        task_type: TaskType.TALK
      });

      console.log('✅ Avatar hablando:', text.substring(0, 50) + '...');
      return { success: true };
    } catch (error) {
      console.error('Error haciendo hablar al avatar:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Detener avatar
   */
  async stop() {
    try {
      if (this.avatar) {
        await this.avatar.stopAvatar();
        this.avatar = null;
        this.isInitialized = false;
        this.isStreaming = false;

        if (this.videoElement) {
          this.videoElement.srcObject = null;
        }

        console.log('✅ Avatar detenido');
      }
    } catch (error) {
      console.error('Error deteniendo avatar:', error);
    }
  }

  /**
   * Verificar si está inicializado
   */
  isReady() {
    return this.isInitialized && this.isStreaming;
  }
}

// Instancia global
let avatarInstance = null;

/**
 * Inicializar avatar globalmente
 */
async function initAvatar(videoElementId = 'avatar-video') {
  if (!avatarInstance) {
    avatarInstance = new HeyGenAvatar();
  }
  return await avatarInstance.init(videoElementId);
}

/**
 * Hacer hablar al avatar (función global para usar desde otros componentes)
 */
async function speakWithAvatar(text) {
  if (!avatarInstance) {
    console.warn('Avatar no inicializado. Inicializando...');
    await initAvatar();
  }
  return await avatarInstance.speak(text);
}

/**
 * Detener avatar
 */
async function stopAvatar() {
  if (avatarInstance) {
    await avatarInstance.stop();
  }
}

// Exportar para uso global
window.initAvatar = initAvatar;
window.speakWithAvatar = speakWithAvatar;
window.stopAvatar = stopAvatar;
window.HeyGenAvatar = HeyGenAvatar;

// Exportar para módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HeyGenAvatar,
    initAvatar,
    speakWithAvatar,
    stopAvatar
  };
}

