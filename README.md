# 🚀 Qwen-Valencia - Ejecutor Puro Sin Bloqueos

## 🎯 OBJETIVO

Repositorio **100% LIMPIO** con Qwen + DeepSeek ejecutores en su **máximo esplendor**, sin contaminación descriptiva de ChatGPT/Claude.

**NO HAY BLOQUEOS. NO HAY DESCRIPCIONES. SOLO EJECUCIÓN REAL.**

---

## 🧠 MODELOS

### Optimización de Memoria RAM
Qwen-Valencia está optimizado con **7 modelos API de Groq** y **solo 2 modelos locales ligeros** para reducir el uso de memoria RAM.

### Modelos API (Groq) - 7 modelos disponibles

#### Qwen (4 modelos)
- **Qwen 2.5 72B**: `qwen-2.5-72b-instruct` ⭐ Más potente
- **Qwen 2.5 32B**: `qwen-2.5-32b-instruct` - Balanceado
- **Qwen 2.5 14B**: `qwen-2.5-14b-instruct` - Rápido
- **Qwen 2.5 7B**: `qwen-2.5-7b-instruct` - Ultra rápido

#### DeepSeek (3 modelos)
- **DeepSeek R1 70B**: `deepseek-r1-distill-llama-70b` ⭐ Razonamiento profundo
- **DeepSeek R1 7B**: `deepseek-r1-distill-qwen-7b` - Razonamiento rápido
- **DeepSeek R1 8B**: `deepseek-r1-distill-llama-8b` - Razonamiento balanceado

### Modelos Locales (Ollama) - 2 modelos ligeros

- **Qwen 2.5 7B**: `qwen2.5:7b-instruct` - Conversacional ligero (~4GB RAM)
- **DeepSeek Coder 6.7B**: `deepseek-coder:6.7b` - Especializado en código (~3GB RAM)

**Nota**: Los modelos pesados (`qwen2.5vl:3b`, `deepseek-r1:7b`) fueron eliminados para optimizar memoria.

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
# Solo 2 modelos ligeros necesarios
ollama pull qwen2.5:7b-instruct      # Qwen ligero
ollama pull deepseek-coder:6.7b      # DeepSeek Coder ligero

# 5. Iniciar aplicación
npm start
```

---

## ⚙️ CONFIGURACIÓN

### Variables de Entorno (`qwen-valencia.env`)

```env
# Groq API (requerido para modelos API)
GROQ_API_KEY=tu_api_key_aqui

# Ollama (opcional, para modelos locales)
OLLAMA_BASE_URL=http://localhost:11434

# MCP Universal Server
MCP_PORT=6000
MCP_SECRET_KEY=tu_secret_key_aqui

# Modo por defecto
MODE=auto  # auto, groq, ollama
```

**Nota**: El archivo de configuración es `qwen-valencia.env` (no `.env.pro`).

---

## 🎯 CARACTERÍSTICAS

✅ **Ejecución Real**: NO describe, EJECUTA
✅ **Sin Bloqueos**: Sin webhooks de ChatGPT/Claude
✅ **Multimodal**: Qwen procesa imágenes y texto
✅ **Especializado**: DeepSeek para código y razonamiento
✅ **Flexible**: 7 modelos API + 2 modelos locales ligeros
✅ **Optimizado**: Verificación de memoria RAM automática
✅ **Modo Auto**: Selección inteligente de modelos según tarea
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

