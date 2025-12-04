# 📖 LEER PRIMERO - Network Engineer / Platform Engineer

## 🎯 TU MISIÓN

Completar la integración del sistema de pools de puertos exclusivos en Qwen-Valencia.

**Estado Actual:** 75% completado
**Tu Tarea:** Completar el 25% restante
**Regla Fundamental:** ⚠️ **PROHIBIDO ROMPER LA APLICACIÓN**

---

## 📋 DOCUMENTOS QUE DEBES LEER (EN ORDEN)

### 1. Este Documento (LEER_PRIMERO)
   - Resumen ejecutivo
   - Visión general rápida

### 2. PRESENTACION_TAREAS_NETWORK_ENGINEER.md
   - Presentación completa de tareas
   - Análisis detallado
   - Objetivos específicos

### 3. TAREAS_NETWORK_ENGINEER_COMPLETAR.md
   - Tareas detalladas paso a paso
   - Código específico a modificar
   - Ejemplos de implementación

### 4. WORKFLOW_COMPLETO_NETWORK_ENGINEER.md
   - Workflow completo de trabajo
   - Fases detalladas
   - Checklist paso a paso

### 5. INSTRUCCIONES_PLATFORM_ENGINEER.md
   - Instrucciones técnicas detalladas
   - Patrón de implementación
   - Reglas críticas

---

## ✅ LO QUE YA ESTÁ HECHO (NO TOCAR)

### 4 Servidores Funcionando Perfectamente:
1. ✅ MCP Universal Server - Pool [6000, 6001, 6002]
2. ✅ Ollama MCP Server - Pool [6010, 6011, 6012]
3. ✅ Groq API Server - Pool [6020, 6021, 6022]
4. ✅ Sandra IA Server - Pool [6030, 6031, 6032, 6033]

**Estos son tu REFERENCIA PERFECTA. Usa su código como guía.**

---

## ⏳ LO QUE TIENES QUE HACER (3 TAREAS)

### TAREA 1: API Server (CRÍTICA - 45 min)

**Archivo:** `src/app/main.js`
**Función:** `startAPIServer()` (línea ~693)
**Acción:** Integrar pool de puertos [9000, 9001, 9002]

**Patrón a Seguir:**
- Ver `src/mcp/groq-api-server.js` línea ~569
- Seguir exactamente el mismo patrón
- NO inventar nada nuevo

### TAREA 2: Limpiar Código (MEDIA - 10 min)

**Archivo:** `src/app/main.js`
**Acción:** Eliminar funciones permisivas comentadas

### TAREA 3: Conversacional (OPCIONAL - 30 min)

**Solo si es necesario después de analizar**

---

## 🎯 WORKFLOW RESUMIDO

1. **Analizar** (30 min)
   - Leer código de referencia
   - Entender patrón
   - Mapear dependencias

2. **Implementar** (45 min)
   - Seguir patrón exacto
   - Testing continuo
   - Validar cada paso

3. **Testear** (30 min)
   - Múltiples instancias
   - Rotación de puertos
   - Funcionalidad completa

4. **Validar** (15 min)
   - Código enterprise
   - Sin regresiones
   - Documentación

**Tiempo Total: ~2.5 horas**

---

## 🚨 REGLAS CRÍTICAS

### ⚠️ PROHIBIDO

- ❌ Romper funcionalidad existente
- ❌ Buscar alternativos fuera del pool
- ❌ Modificar otros servicios
- ❌ Omitir testing

### ✅ PERMITIDO

- ✅ Seguir patrón de referencia
- ✅ Usar código existente como guía
- ✅ Probar exhaustivamente
- ✅ Consultar si hay dudas

---

## 📚 CÓDIGO DE REFERENCIA

**Usa estos archivos como guía perfecta:**

1. `src/mcp/mcp-universal.js` - Línea ~633 (método start)
2. `src/mcp/groq-api-server.js` - Línea ~569 (método start)
3. `src/mcp/ollama-mcp-server.js` - Línea ~645 (método start)

**Todos siguen el mismo patrón. Cópialo exactamente.**

---

## 🎯 RESULTADO ESPERADO

Al completar:

```
✅ API Server usando pools exclusivos
✅ Código permisivo eliminado
✅ 100% de servidores integrados
✅ Sistema enterprise-level completo
✅ Sin regresiones
```

---

## 📞 QUÉ HACER SI TIENES DUDAS

1. **LEE** los documentos en orden
2. **REVISA** el código de referencia
3. **SIGUE** el patrón establecido
4. **PROBA** exhaustivamente
5. **NO INVENTES** nada nuevo

---

## ⚡ INICIO RÁPIDO

```bash
# 1. Leer documentación (15 min)
cat PRESENTACION_TAREAS_NETWORK_ENGINEER.md
cat TAREAS_NETWORK_ENGINEER_COMPLETAR.md

# 2. Revisar código de referencia (10 min)
grep -A 50 "async start()" src/mcp/groq-api-server.js

# 3. Analizar código actual (10 min)
grep -A 100 "function startAPIServer" src/app/main.js

# 4. Comenzar implementación
# Seguir WORKFLOW_COMPLETO_NETWORK_ENGINEER.md
```

---

**RECUERDA: Los 4 servidores ya integrados son tu REFERENCIA PERFECTA.**
**NO INVENTES. SIGUE EL PATRÓN EXACTO.**

**⚠️ PROHIBIDO ROMPER LA APLICACIÓN. Valida que todo funciona.**

