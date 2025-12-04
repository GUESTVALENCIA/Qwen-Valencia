# 🔒 Sistema de Protección de Archivos Críticos

## Archivos Protegidos

Los siguientes archivos contienen lógica y diseño críticos y **NO deben modificarse sin autorización**:

1. `src/app/renderer/index.html` - Estructura HTML y diseño
2. `src/app/renderer/components/app.js` - Lógica principal de la aplicación
3. `src/app/renderer/components/model-selector.js` - Selector de modelos
4. `src/app/renderer/styles/main.css` - Estilos principales
5. `src/app/renderer/styles/liquid-glass.css` - Efectos visuales
6. `src/app/renderer/styles/chat-input.css` - Estilos de input

## Cómo Proteger

### 1. Crear Snapshots Protegidos

```bash
# Windows PowerShell
node scripts/protect-files.js create

# O manualmente
bash scripts/create-protected-snapshots.sh
```

Esto crea copias de seguridad en `.protected/` que NO se pueden modificar.

### 2. Restaurar desde Snapshot

Si un archivo se rompe:

```bash
# Windows PowerShell
node scripts/protect-files.js restore src/app/renderer/components/app.js

# O restaurar todos
bash scripts/restore-protected.sh
```

### 3. Verificar Integridad

```bash
node scripts/protect-files.js verify
```

## Protección con Git

Los archivos protegidos están marcados en `.gitattributes` para prevenir merges automáticos.

## ⚠️ ADVERTENCIA

**NO modifiques estos archivos sin:**
1. Crear snapshot primero
2. Entender completamente el impacto
3. Tener un plan de rollback
4. Autorización explícita

## Comandos Rápidos

```bash
# Crear snapshots
node scripts/protect-files.js create

# Restaurar archivo específico
node scripts/protect-files.js restore <archivo>

# Verificar integridad
node scripts/protect-files.js verify
```

