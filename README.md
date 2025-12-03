# 🚀 Qwen-Valencia - Ejecutor Puro Sin Bloqueos

## 🎯 OBJETIVO

Repositorio **100% LIMPIO** con Qwen + DeepSeek ejecutores en su **máximo esplendor**, sin contaminación descriptiva de ChatGPT/Claude.

**NO HAY BLOQUEOS. NO HAY DESCRIPCIONES. SOLO EJECUCIÓN REAL.**

---

## 🧠 MODELOS

### Qwen2.5-VL (Multimodal Ejecutor)
- **Groq API**: `qwen2.5-72b-instruct` (Más fuerte)
- **Ollama Local**: `qwen2.5-vl:7b` (Equilibrado)
- **Capacidades**: Texto + Imágenes + Ejecución de código

### DeepSeek Coder (Especializado Código)
- **Groq API**: `deepseek-coder-33b-instruct` (Mejor ejecución)
- **Ollama Local**: `deepseek-coder:6.7b` (Rápido)
- **Capacidades**: Ejecución de código al 100%

---

## 🚀 INSTALACIÓN

```bash
# 1. Clonar repo
git clone https://github.com/GUESTVALENCIA/Qwen-Valencia.git
cd Qwen-Valencia

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.pro
# Editar .env.pro con tus API keys

# 4. Instalar modelos Ollama (opcional, para uso local)
ollama pull qwen2.5-vl:7b
ollama pull deepseek-coder:6.7b

# 5. Iniciar aplicación
npm start
```

---

## ⚙️ CONFIGURACIÓN

### Variables de Entorno (`.env.pro`)

```env
# Groq API (para modelos más fuertes)
GROQ_API_KEY=tu_api_key_aqui

# Ollama (local, opcional)
OLLAMA_BASE_URL=http://localhost:11434

# MCP Universal Server
MCP_PORT=6000
MCP_SECRET_KEY=tu_secret_key_aqui
```

---

## 🎯 CARACTERÍSTICAS

✅ **Ejecución Real**: NO describe, EJECUTA
✅ **Sin Bloqueos**: Sin webhooks de ChatGPT/Claude
✅ **Multimodal**: Qwen procesa imágenes
✅ **Especializado**: DeepSeek para código
✅ **Flexible**: Groq API u Ollama local
✅ **100% Limpio**: Sin contaminación descriptiva

---

## 📋 ESTRUCTURA

```
Qwen-Valencia/
├── src/
│   ├── core/
│   │   ├── qwen-executor.js      # Núcleo ejecutor Qwen
│   │   └── deepseek-executor.js  # Núcleo ejecutor DeepSeek
│   ├── orchestrator/
│   │   └── model-router.js       # Routing inteligente
│   ├── mcp/
│   │   └── mcp-universal.js      # Servidor MCP
│   └── app/
│       ├── main.js               # Electron main
│       ├── preload.js            # IPC bridge
│       └── renderer/
│           ├── index.html        # UI
│           └── app.js            # Frontend
├── .env.pro                      # Variables de entorno
└── package.json
```

---

## 🔥 DIFERENCIAS CON SANDRA

| Característica | Sandra | Qwen-Valencia |
|----------------|--------|---------------|
| **Núcleo** | Descriptivo (ChatGPT) | Ejecutor puro (Qwen) |
| **Bloqueos** | ✅ Sí (webhooks) | ❌ NO |
| **Ejecución** | Describe acciones | Ejecuta acciones |
| **Modelos** | GPT/Claude/Gemini | Qwen/DeepSeek |
| **Contaminación** | ✅ Sí | ❌ NO |

---

## 🚀 USO

```javascript
// Ejemplo: Ejecutar código Python
const qwen = new QwenExecutor();
const result = await qwen.executeCode('python', 'print("Hola mundo")');
console.log(result); // Ejecuta REALMENTE, no describe
```

---

## 📝 LICENCIA

MIT - Libre para uso personal y comercial

---

**Creado con ❤️ para ejecución REAL sin bloqueos**

