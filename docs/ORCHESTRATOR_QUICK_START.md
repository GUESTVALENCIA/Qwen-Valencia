# 🚀 Inicio Rápido - Sistema de Orquestación de Subagentes

## 📋 Resumen

Sistema completo de monitoreo y corrección automática que utiliza subagentes de VoltAgent para mantener el proyecto libre de errores y funcionando correctamente.

## ⚡ Inicio Rápido (5 minutos)

### 1. Verificar Configuración

```bash
# Verificar que existe la configuración
cat .orchestrator-config.json

# Verificar tokens de VoltAgent
ls ../VoltAgent-Composer-Workflow/tokens.json
```

### 2. Crear Subagentes en VoltAgent (Primera vez)

```bash
# El script te guiará para crear los subagentes necesarios
node scripts/create-subagents.js
```

O manualmente en [VoltAgent Console](https://console.voltagent.dev):
- Ve a "Agents" → "Create New Agent"
- Crea los siguientes subagentes:
  - `multimodal-chat-monitor`
  - `conversation-flow-monitor`
  - `app-functionality-monitor`
  - `app-performance-monitor`
  - `git-repo-monitor`
  - `frontend-specialist`
  - `event-handler-specialist`
  - `code-reviewer`

### 3. Iniciar el Orquestador

```bash
# Iniciar en modo desarrollo (consola)
npm run orchestrator

# O iniciar en background
npm run orchestrator &
```

### 4. Verificar que Funciona

```bash
# Ver logs
tail -f .orchestrator-logs/errors.json

# Ver estadísticas
node -e "const {getOrchestrator} = require('./scripts/agent-orchestrator'); console.log(getOrchestrator().getStats());"
```

## 🎯 Qué Hace el Sistema

### Monitoreo Automático

1. **Sistema Conversacional** (cada 30 segundos)
   - Verifica funciones globales
   - Detecta problemas de STT/TTS/Avatar
   - Monitorea flujo conversacional

2. **Aplicación Completa** (cada 15 segundos)
   - Verifica que todos los botones funcionen
   - Detecta funciones onclick no definidas
   - Monitorea event listeners

3. **Repositorio Git** (cada 60 segundos)
   - Revisa commits
   - Detecta errores de linting
   - Sugiere mejoras

### Corrección Automática

Cuando se detecta un error:
1. El monitor identifica el tipo de error
2. Invoca al subagente especializado apropiado
3. El especialista analiza y genera corrección
4. La corrección se guarda en logs para revisión

## 🔧 Configuración

### Habilitar/Deshabilitar Monitores

Edita `.orchestrator-config.json`:

```json
{
  "monitors": {
    "conversational": { "enabled": true },
    "application": { "enabled": true },
    "git": { "enabled": false }
  }
}
```

### Cambiar Intervalos

```json
{
  "monitors": {
    "conversational": { "interval": 30000 },  // 30 segundos
    "application": { "interval": 15000 }      // 15 segundos
  }
}
```

## 📊 Ver Resultados

### Logs de Errores

```bash
cat .orchestrator-logs/errors.json | jq
```

### Correcciones Aplicadas

```bash
ls .orchestrator-logs/correction-*.json
```

### Estadísticas en Tiempo Real

El orquestador muestra estadísticas en consola cada vez que se ejecuta un monitor.

## 🛠️ Solución de Problemas

### El orquestador no inicia

1. Verifica tokens:
   ```bash
   cat ../VoltAgent-Composer-Workflow/tokens.json
   ```

2. Verifica configuración:
   ```bash
   node -e "console.log(require('./.orchestrator-config.json'))"
   ```

### Los monitores no detectan errores

1. Verifica que los monitores estén habilitados
2. Revisa los logs en `.orchestrator-logs/`
3. Aumenta el nivel de logging en la configuración

### Los especialistas no responden

1. Verifica que los subagentes existan en VoltAgent
2. Verifica la conexión a internet
3. Revisa los tokens de API

## 📝 Próximos Pasos

1. **Personalizar Monitores**: Edita los monitores en `agent-orchestrator.js`
2. **Agregar Especialistas**: Crea nuevos subagentes en VoltAgent
3. **Configurar Auto-Corrección**: Habilita corrección automática en configuración
4. **Dashboard**: Implementa dashboard web para visualización

## 🔗 Referencias

- [Plan Completo de Orquestación](./SUBAGENT_ORCHESTRATION_PLAN.md)
- [Documentación del Orquestador](./AUTO_CODE_REVIEWER.md)
- [VoltAgent Console](https://console.voltagent.dev)

## ✅ Checklist de Inicio

- [ ] Tokens de VoltAgent configurados
- [ ] Subagentes creados en VoltAgent Console
- [ ] Configuración del orquestador revisada
- [ ] Orquestador iniciado y funcionando
- [ ] Monitores detectando errores
- [ ] Logs generándose correctamente

---

**¡Listo!** El sistema está monitoreando tu proyecto automáticamente. 🎉

