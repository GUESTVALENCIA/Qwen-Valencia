# 🤖 Revisor Automático de Código con VoltAgent

## 📋 Descripción

Sistema de revisión automática de código que utiliza subagentes de VoltAgent para analizar y corregir código después de cada commit y push. El sistema detecta errores, bugs, vulnerabilidades de seguridad y sugiere mejoras automáticamente.

## 🚀 Características

- ✅ **Revisión automática** después de cada commit y push
- ✅ **Integración con VoltAgent** usando subagentes especializados
- ✅ **Análisis de diffs** y contenido completo de archivos
- ✅ **Detección de errores** críticos, bugs y vulnerabilidades
- ✅ **Sugerencias de mejora** con código corregido específico
- ✅ **Configuración flexible** mediante `.code-reviewer-config.json`
- ✅ **No bloquea commits** - solo informa y sugiere

## 📁 Archivos del Sistema

```
Qwen-Valencia/
├── scripts/
│   └── auto-code-reviewer.js    # Script principal de revisión
├── .husky/
│   ├── post-commit              # Hook ejecutado después de commit
│   └── post-push                # Hook ejecutado después de push
├── .code-reviewer-config.json   # Configuración del revisor
└── .code-review-last.txt        # Última revisión (generado automáticamente)
```

## ⚙️ Configuración

### Archivo `.code-reviewer-config.json`

```json
{
  "enabled": true,
  "agentId": "conversational-code-reviewer",
  "fallbackAgentId": "claude-code",
  "voltAgentTokensPath": "../VoltAgent-Composer-Workflow/tokens.json",
  "reviewOnCommit": true,
  "reviewOnPush": true,
  "fullReviewOnPush": true,
  "maxFileSize": 500000,
  "excludePatterns": [
    "node_modules/**",
    "dist/**",
    "build/**"
  ],
  "includePatterns": [
    "src/**/*.js",
    "src/**/*.html",
    "src/**/*.css"
  ]
}
```

### Parámetros de Configuración

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `enabled` | boolean | Habilitar/deshabilitar revisión automática |
| `agentId` | string | ID del subagente de VoltAgent a usar |
| `fallbackAgentId` | string | ID del agente fallback si el principal falla |
| `voltAgentTokensPath` | string | Ruta al archivo `tokens.json` de VoltAgent |
| `reviewOnCommit` | boolean | Ejecutar revisión después de commit |
| `reviewOnPush` | boolean | Ejecutar revisión después de push |
| `fullReviewOnPush` | boolean | Revisión completa (contenido de archivos) en push |
| `maxFileSize` | number | Tamaño máximo de archivo para revisión completa (bytes) |
| `excludePatterns` | string[] | Patrones de archivos a excluir |
| `includePatterns` | string[] | Patrones de archivos a incluir |

## 🎯 Uso

### Automático (Recomendado)

El sistema se ejecuta automáticamente después de cada commit y push:

```bash
git commit -m "feat: Nueva funcionalidad"
# 🔍 Ejecutando revisión automática de código...
# [Revisión automática se ejecuta aquí]
```

```bash
git push
# 🔍 Ejecutando revisión automática de código post-push...
# [Revisión completa se ejecuta aquí]
```

### Manual

También puedes ejecutar la revisión manualmente:

```bash
# Revisar archivos modificados en el último commit
node scripts/auto-code-reviewer.js

# Revisar archivos específicos
node scripts/auto-code-reviewer.js --files "src/app/main.js,src/app/renderer/components/app.js"

# Revisión completa (incluye contenido de archivos)
node scripts/auto-code-reviewer.js --full

# Usar un agente específico
node scripts/auto-code-reviewer.js --agent-id "sistema-conversacional-analyst"

# Ver ayuda
node scripts/auto-code-reviewer.js --help
```

## 🤖 Subagentes de VoltAgent

### Agentes Recomendados

1. **`conversational-code-reviewer`** (por defecto)
   - Especializado en revisión de código conversacional
   - Detecta errores de scope, callbacks asíncronos, gestión de estados

2. **`claude-code`** (fallback)
   - Asistente de código general de Claude
   - Revisión técnica completa

3. **`sistema-conversacional-analyst`**
   - Analista de sistemas conversacionales
   - Ideal para análisis arquitectónico profundo

4. **`deepgram-stt-specialist`**
   - Especialista en Deepgram STT
   - Para problemas específicos de audio/transcripción

5. **`frontend-audio-specialist`**
   - Especialista en audio frontend
   - Para problemas de Web Audio API, Electron

### Crear Nuevos Subagentes

Para crear un nuevo subagente especializado en VoltAgent:

1. Accede a [VoltAgent Console](https://console.voltagent.dev)
2. Ve a "Agents" → "Create New Agent"
3. Configura el System Prompt con especialización en revisión de código
4. Actualiza `agentId` en `.code-reviewer-config.json`

## 📊 Qué Revisa el Sistema

El revisor automático analiza:

### 1. Errores y Bugs
- Errores de sintaxis
- Referencias indefinidas
- Memory leaks
- Problemas de lógica

### 2. Seguridad
- Vulnerabilidades XSS
- Validación IPC
- Sanitización de inputs
- Content Security Policy

### 3. Calidad de Código
- Patrones inconsistentes
- Código duplicado
- Complejidad ciclomática
- Mejores prácticas

### 4. Mejores Prácticas
- Uso correcto de EventManager
- Uso correcto de StateManager
- ResourceCleanupManager
- Logging estructurado

### 5. Performance
- Optimizaciones posibles
- Memory leaks
- Event listeners sin cleanup
- Operaciones costosas

## 📝 Formato de Salida

La revisión se guarda en `.code-review-last.txt` y muestra:

```
🔍 INICIANDO REVISIÓN AUTOMÁTICA DE CÓDIGO

🤖 Agente: conversational-code-reviewer

📁 Archivos a revisar (3):
   • src/app/main.js
   • src/app/renderer/components/app.js
   • src/app/renderer/index.html

⏳ Enviando código al agente para revisión...

✅ REVISIÓN COMPLETADA
════════════════════════════════════════════════════════════════════════════
[Análisis detallado del agente con problemas encontrados y soluciones]
════════════════════════════════════════════════════════════════════════════

💾 Revisión guardada en: .code-review-last.txt
```

## 🔧 Solución de Problemas

### El revisor no se ejecuta

1. Verifica que `.code-reviewer-config.json` existe y `enabled: true`
2. Verifica que `tokens.json` de VoltAgent existe y es válido
3. Verifica que los hooks de git están instalados: `npm run prepare`

### Error: "No se encontraron tokens de VoltAgent"

1. Verifica la ruta en `voltAgentTokensPath` en la configuración
2. Asegúrate de que `tokens.json` existe en la ruta especificada
3. Verifica que el token es válido y no ha expirado

### El agente no responde

1. Verifica tu conexión a internet
2. Verifica que el `agentId` existe en VoltAgent
3. El sistema intentará automáticamente con el `fallbackAgentId`

### Revisión muy lenta

1. Reduce `maxFileSize` en la configuración
2. Usa `--files` para revisar solo archivos específicos
3. Deshabilita `fullReviewOnPush` si no necesitas revisión completa

## 🚫 Deshabilitar Revisión Automática

### Temporalmente

```bash
# Editar .code-reviewer-config.json
{
  "enabled": false
}
```

### Para un commit específico

```bash
# El hook no bloquea, pero puedes omitirlo con:
git commit --no-verify -m "mensaje"
```

## 📚 Referencias

- [VoltAgent Console](https://console.voltagent.dev)
- [Documentación de Husky](https://typicode.github.io/husky/)
- [Git Hooks](https://git-scm.com/docs/githooks)

## ✅ Ventajas

1. **Detección temprana** de errores antes de que lleguen a producción
2. **Aprendizaje continuo** con sugerencias de mejores prácticas
3. **No bloquea el flujo** - solo informa y sugiere
4. **Configuración flexible** según necesidades del proyecto
5. **Integración transparente** con el flujo de trabajo existente

---

**Nota**: El sistema de revisión automática es una herramienta de asistencia. Siempre revisa manualmente los cambios críticos antes de hacer push a producción.

