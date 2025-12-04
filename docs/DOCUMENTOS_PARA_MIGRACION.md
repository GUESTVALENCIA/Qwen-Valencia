# 📚 Documentos para Migración - Sandra IA

**Fecha:** 2025-01-11  
**Propósito:** Lista completa de documentos listos para copiar al nuevo repositorio

---

## 📋 DOCUMENTOS PRINCIPALES

### 1. Arquitectura y Funcionalidad
- **Archivo:** `docs/SANDRA_IA_ARCHITECTURE_EXTRACT.md`
- **Contenido:** Extracción completa de arquitectura, funcionalidad y sistema del workflow
- **Uso:** Referencia técnica principal

### 2. Plan de Implementación
- **Archivo:** `docs/PLAN_IMPLEMENTACION_SANDRA_IA_PROFESIONAL.md`
- **Contenido:** Plan completo de implementación con 9 fases detalladas
- **Uso:** Guía paso a paso para construcción del sistema

### 3. Configuración de Orquestación
- **Archivo:** `.orchestrator-config.json`
- **Contenido:** Configuración del sistema de orquestación actual
- **Uso:** Base para configuración en nuevo repo

### 4. Configuración Sandra 8.0
- **Archivo:** `.sandra-8.0-orchestration-config.json`
- **Contenido:** Configuración avanzada para Sandra IA 8.0
- **Uso:** Configuración específica para nuevo sistema

### 5. Definiciones de Subagentes
- **Archivo:** `docs/subagents-definitions.json`
- **Contenido:** Definiciones completas de monitores y especialistas
- **Uso:** Referencia para configuración de 117 subagentes

### 6. Documentación de Subagentes
- **Archivo:** `docs/SUBAGENTS_DEFINITIONS.md`
- **Contenido:** Documentación detallada de cada subagente
- **Uso:** Guía para creación y configuración de subagentes

---

## 📖 DOCUMENTOS DE REFERENCIA

### Orquestación
1. **`docs/ORCHESTRATION_SUMMARY.md`**
   - Resumen ejecutivo del sistema de orquestación
   - Componentes creados
   - Estado actual

2. **`docs/SUBAGENT_ORCHESTRATION_PLAN.md`**
   - Plan completo de orquestación de subagentes
   - Arquitectura del sistema
   - Flujo de trabajo

3. **`docs/OPUS_4.5_ORCHESTRATION_PLAN.md`**
   - Plan de orquestación profesional Opus 4.5
   - Subagentes disponibles
   - Arquitectura avanzada

4. **`docs/ORCHESTRATOR_QUICK_START.md`**
   - Guía de inicio rápido
   - Configuración básica
   - Verificación de funcionamiento

### VoltAgent
5. **`docs/VOLTAGENT_AUTOMATIZACION_COMPLETA.md`**
   - Documentación completa de VoltAgent
   - Configuración del MCP Server
   - 117 subagentes disponibles

6. **`docs/COMO_OBTENER_TOKEN_VOLTAGENT.md`**
   - Guía para obtener tokens de VoltAgent
   - Configuración de acceso
   - Troubleshooting

### Planes y Mejoras
7. **`docs/PLAN_SANDRA_IA_8.0_MEJORA_COMPLETA.md`**
   - Plan completo de mejora de Sandra IA 8.0
   - Organización de subagentes
   - Arquitectura de mejora

---

## 🔧 ARCHIVOS DE CONFIGURACIÓN

### Configuraciones JSON
1. **`.orchestrator-config.json`**
   - Configuración principal de orquestación
   - Monitores y especialistas
   - Rutas y tokens

2. **`.sandra-8.0-orchestration-config.json`**
   - Configuración avanzada Sandra 8.0
   - Monitores avanzados
   - Sistema de corrección y mejoras

3. **`docs/subagents-definitions.json`**
   - Definiciones de subagentes
   - System prompts
   - Herramientas y modelos

### Scripts
4. **`scripts/agent-orchestrator.js`**
   - Orquestador principal
   - Gestión de monitores
   - Invocación de especialistas

5. **`scripts/auto-code-reviewer.js`**
   - Revisor automático de código
   - Integración con VoltAgent
   - Revisión post-commit

6. **`scripts/create-subagents.js`**
   - Generador de definiciones de subagentes
   - Exportación a JSON/Markdown

---

## 📦 ESTRUCTURA RECOMENDADA PARA NUEVO REPO

```
IA-SANDRA/
├── docs/
│   ├── ARCHITECTURE.md                    # SANDRA_IA_ARCHITECTURE_EXTRACT.md
│   ├── IMPLEMENTATION_PLAN.md             # PLAN_IMPLEMENTACION_SANDRA_IA_PROFESIONAL.md
│   ├── ORCHESTRATION_SUMMARY.md           # ORCHESTRATION_SUMMARY.md
│   ├── SUBAGENT_ORCHESTRATION_PLAN.md     # SUBAGENT_ORCHESTRATION_PLAN.md
│   ├── OPUS_4.5_ORCHESTRATION_PLAN.md     # OPUS_4.5_ORCHESTRATION_PLAN.md
│   ├── ORCHESTRATOR_QUICK_START.md        # ORCHESTRATOR_QUICK_START.md
│   ├── VOLTAGENT_AUTOMATIZACION.md        # VOLTAGENT_AUTOMATIZACION_COMPLETA.md
│   ├── COMO_OBTENER_TOKEN_VOLTAGENT.md    # COMO_OBTENER_TOKEN_VOLTAGENT.md
│   ├── PLAN_SANDRA_IA_8.0.md              # PLAN_SANDRA_IA_8.0_MEJORA_COMPLETA.md
│   ├── SUBAGENTS_DEFINITIONS.md           # SUBAGENTS_DEFINITIONS.md
│   └── DOCUMENTOS_PARA_MIGRACION.md       # Este archivo
├── config/
│   ├── models.json                        # Nuevo - basado en workflow
│   ├── subagents.json                     # Nuevo - basado en subagents-definitions.json
│   ├── orchestration.json                 # Basado en .orchestrator-config.json
│   └── sandra-8.0.json                    # Basado en .sandra-8.0-orchestration-config.json
└── scripts/
    ├── agent-orchestrator.js              # Copiar desde scripts/
    ├── auto-code-reviewer.js              # Copiar desde scripts/
    └── create-subagents.js                # Copiar desde scripts/
```

---

## ✅ CHECKLIST DE MIGRACIÓN

### Documentos Principales
- [ ] Copiar `SANDRA_IA_ARCHITECTURE_EXTRACT.md` → `docs/ARCHITECTURE.md`
- [ ] Copiar `PLAN_IMPLEMENTACION_SANDRA_IA_PROFESIONAL.md` → `docs/IMPLEMENTATION_PLAN.md`
- [ ] Copiar `DOCUMENTOS_PARA_MIGRACION.md` → `docs/DOCUMENTOS_PARA_MIGRACION.md`

### Documentos de Referencia
- [ ] Copiar `ORCHESTRATION_SUMMARY.md`
- [ ] Copiar `SUBAGENT_ORCHESTRATION_PLAN.md`
- [ ] Copiar `OPUS_4.5_ORCHESTRATION_PLAN.md`
- [ ] Copiar `ORCHESTRATOR_QUICK_START.md`
- [ ] Copiar `VOLTAGENT_AUTOMATIZACION_COMPLETA.md`
- [ ] Copiar `COMO_OBTENER_TOKEN_VOLTAGENT.md`
- [ ] Copiar `PLAN_SANDRA_IA_8.0_MEJORA_COMPLETA.md`
- [ ] Copiar `SUBAGENTS_DEFINITIONS.md`

### Configuraciones
- [ ] Adaptar `.orchestrator-config.json` → `config/orchestration.json`
- [ ] Adaptar `.sandra-8.0-orchestration-config.json` → `config/sandra-8.0.json`
- [ ] Adaptar `subagents-definitions.json` → `config/subagents.json`
- [ ] Crear `config/models.json` basado en workflow

### Scripts
- [ ] Copiar `scripts/agent-orchestrator.js`
- [ ] Copiar `scripts/auto-code-reviewer.js`
- [ ] Copiar `scripts/create-subagents.js`
- [ ] Adaptar scripts a nueva estructura

---

## 🔄 PROCESO DE MIGRACIÓN RECOMENDADO

### Paso 1: Preparación
1. Crear nuevo repositorio `IA-SANDRA`
2. Crear estructura de directorios
3. Inicializar Git

### Paso 2: Documentación
1. Copiar todos los documentos de referencia
2. Adaptar nombres y rutas
3. Actualizar referencias internas

### Paso 3: Configuración
1. Crear archivos de configuración
2. Adaptar rutas y paths
3. Validar JSON

### Paso 4: Scripts
1. Copiar scripts existentes
2. Adaptar imports y rutas
3. Actualizar referencias a configuraciones

### Paso 5: Implementación
1. Seguir plan de implementación
2. Implementar fases en orden
3. Validar cada fase antes de continuar

### Paso 6: Testing
1. Ejecutar tests unitarios
2. Ejecutar tests de integración
3. Ejecutar tests e2e

### Paso 7: Despliegue
1. Configurar producción
2. Ejecutar health checks
3. Verificar funcionamiento completo

---

## 📝 NOTAS IMPORTANTES

1. **Adaptar Rutas:** Todos los paths deben adaptarse a la nueva estructura
2. **Actualizar Referencias:** Las referencias entre documentos deben actualizarse
3. **Validar JSON:** Todos los archivos JSON deben validarse antes de usar
4. **Mantener Compatibilidad:** Mantener compatibilidad con sistema existente durante migración
5. **Documentar Cambios:** Documentar todos los cambios realizados durante migración

---

**Fin del Documento de Migración**

