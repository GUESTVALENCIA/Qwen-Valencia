# 🔧 Solución Error 404 - Qwen-Valencia

## ❌ Problema

Error: `Request failed with status code 404` al intentar usar Qwen.

## 🔍 Causas Posibles

1. **GROQ_API_KEY no configurada o inválida**
2. **Ollama no está corriendo**
3. **Modelos no instalados en Ollama**
4. **URLs incorrectas en la configuración**

## ✅ Soluciones

### Opción 1: Usar Groq API (Recomendado - Más rápido)

1. **Obtener API Key de Groq:**
   - Ve a: https://console.groq.com/
   - Crea cuenta o inicia sesión
   - Genera una API Key

2. **Configurar en .env.pro:**
   ```env
   GROQ_API_KEY=tu_api_key_aqui
   MODE=groq
   ```

3. **Reiniciar aplicación**

### Opción 2: Usar Ollama Local (Gratis)

1. **Instalar Ollama:**
   - Descarga desde: https://ollama.com
   - Instala y ejecuta Ollama

2. **Instalar modelos:**
   ```bash
   ollama pull qwen2.5-vl:7b
   ollama pull deepseek-coder:6.7b
   ```

3. **Verificar que Ollama está corriendo:**
   ```bash
   ollama list
   ```

4. **Configurar en .env.pro:**
   ```env
   MODE=ollama
   OLLAMA_BASE_URL=http://localhost:11434
   ```

5. **Reiniciar aplicación**

### Opción 3: Modo Auto (Recomendado)

1. **Configura ambas opciones:**
   ```env
   GROQ_API_KEY=tu_api_key_groq
   MODE=auto
   OLLAMA_BASE_URL=http://localhost:11434
   ```

2. **El sistema intentará Groq primero, luego Ollama si falla**

## 🚀 Reiniciar Aplicación

1. **Detener todo:**
   ```bash
   DETENER_TODO.bat
   ```

2. **Iniciar de nuevo:**
   ```bash
   INICIAR_TODO.bat
   ```

## ✅ Verificación

Después de configurar, verifica:

- **Groq:** Debe responder sin error 404
- **Ollama:** Debe estar corriendo en http://localhost:11434
- **Modelos:** Deben estar instalados (`ollama list`)

## 📝 Notas

- Si usas Groq, necesitas API key válida
- Si usas Ollama, necesitas tenerlo corriendo y modelos instalados
- El modo `auto` intenta Groq primero, luego Ollama

