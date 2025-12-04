# 🚀 Guía de Optimización DX (Developer Experience)

## 📋 Resumen

Esta guía documenta las mejoras enterprise-level implementadas para optimizar la experiencia de desarrollo en Qwen-Valencia.

## 🎯 Objetivos Alcanzados

- ✅ Build times optimizados con caché incremental
- ✅ Hot reload y watch mode para desarrollo
- ✅ Herramientas de calidad de código (ESLint, Prettier)
- ✅ Scripts optimizados para workflows comunes
- ✅ Pre-commit hooks para mantener calidad
- ✅ Documentación completa de workflows

---

## 🛠️ Herramientas Implementadas

### 1. ESLint
Linter de código JavaScript para mantener calidad y consistencia.

**Configuración**: `.eslintrc.js`
- Reglas recomendadas de ESLint
- Configurado para Electron (browser + node)
- Warnings en lugar de errores para desarrollo

**Uso**:
```bash
npm run lint          # Lint y auto-fix
npm run lint:check    # Solo verificar sin modificar
```

### 2. Prettier
Formateador automático de código para consistencia visual.

**Configuración**: `.prettierrc`
- 100 caracteres por línea
- 2 espacios de indentación
- Comillas simples
- Semicolones habilitados

**Uso**:
```bash
npm run format        # Formatear todo el código
npm run format:check  # Verificar formato sin modificar
```

### 3. Nodemon
Watch mode para desarrollo con auto-reload.

**Configuración**: `nodemon.json`
- Observa cambios en `src/`
- Extiende: `.js`, `.json`, `.html`, `.css`
- Delay de 1 segundo para evitar múltiples recargas
- Ignora archivos generados

**Uso**:
```bash
npm run dev:watch     # Desarrollo con watch mode
```

### 4. Concurrently
Ejecutar múltiples procesos en paralelo.

**Uso**:
```bash
npm run servers       # Iniciar todos los servidores MCP
npm run dev:full      # Desarrollo completo (watch + servidores)
```

### 5. Husky + Lint-Staged
Pre-commit hooks para mantener calidad de código.

**Configuración**: `.lintstagedrc.js`
- Ejecuta ESLint y Prettier antes de commit
- Solo en archivos modificados
- Auto-fix cuando es posible

---

## 📜 Scripts Disponibles

### Desarrollo

```bash
# Desarrollo básico
npm start              # Iniciar aplicación Electron
npm run dev            # Desarrollo con flag --dev

# Desarrollo con watch mode
npm run dev:watch      # Auto-reload en cambios
npm run dev:full       # Watch + servidores MCP

# Servidores MCP
npm run servers        # Iniciar todos los servidores
npm run servers:watch  # Servidores con watch mode
npm run mcp            # Solo MCP Universal
npm run mcp:ollama     # Solo Ollama MCP
npm run mcp:groq       # Solo Groq API
```

### Build

```bash
# Builds
npm run build          # Build para plataforma actual
npm run build:win      # Build para Windows
npm run build:mac      # Build para macOS
npm run build:linux    # Build para Linux
npm run build:all      # Build para todas las plataformas

# Limpieza
npm run clean          # Limpiar builds y caché
npm run clean:all      # Limpiar todo (incluye node_modules)
```

### Calidad de Código

```bash
# Linting
npm run lint           # Lint y auto-fix
npm run lint:check     # Solo verificar

# Formateo
npm run format         # Formatear código
npm run format:check   # Verificar formato
```

---

## 🔄 Workflows Recomendados

### Desarrollo Diario

1. **Iniciar desarrollo completo**:
   ```bash
   npm run dev:full
   ```
   Esto inicia:
   - Electron en modo desarrollo con watch
   - Todos los servidores MCP con watch

2. **Hacer cambios**:
   - Modificar archivos en `src/`
   - Nodemon detecta cambios y recarga automáticamente
   - Ver resultados instantáneamente

3. **Antes de commit**:
   ```bash
   npm run lint:check
   npm run format:check
   ```
   O simplemente hacer commit (Husky lo hará automáticamente)

### Build para Producción

1. **Verificar código**:
   ```bash
   npm run lint:check
   npm run format:check
   ```

2. **Limpiar builds anteriores**:
   ```bash
   npm run clean
   ```

3. **Build**:
   ```bash
   npm run build:win    # Para Windows
   # o
   npm run build:mac    # Para macOS
   # o
   npm run build:all    # Para todas las plataformas
   ```

---

## ⚡ Optimizaciones de Build

### Electron-Builder

**Caché Incremental**:
- Builds subsecuentes son más rápidos
- Solo reconstruye lo que cambió
- Caché en `.electron-builder-cache`

**Configuración**:
```yaml
cache: .electron-builder-cache
incremental: true
```

### Watch Mode

**Nodemon**:
- Observa cambios en `src/`
- Delay de 1 segundo para evitar múltiples recargas
- Ignora archivos generados y node_modules

---

## 🎨 Configuración de IDE

### VS Code

**Recomendado**: Instalar extensiones:
- ESLint
- Prettier
- EditorConfig

**Configuración** (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": ["javascript"],
  "files.eol": "\n"
}
```

---

## 📊 Métricas de Mejora

### Antes
- ❌ Sin watch mode
- ❌ Sin herramientas de calidad
- ❌ Builds sin caché
- ❌ Scripts limitados
- ❌ Sin pre-commit hooks

### Después
- ✅ Watch mode con auto-reload
- ✅ ESLint + Prettier configurados
- ✅ Build caching incremental
- ✅ Scripts completos y optimizados
- ✅ Pre-commit hooks automáticos

---

## 🐛 Troubleshooting

### Nodemon no detecta cambios
- Verificar que `nodemon.json` esté configurado correctamente
- Verificar que los archivos estén en `src/`
- Verificar que no estén en `.gitignore` o `nodemon.json` ignore

### ESLint muestra muchos errores
- Ejecutar `npm run lint` para auto-fix
- Verificar `.eslintrc.js` para reglas personalizadas

### Prettier formatea diferente
- Verificar `.prettierrc` para configuración
- Ejecutar `npm run format` para formatear todo

### Build lento
- Verificar que `.electron-builder-cache` exista
- Limpiar caché: `npm run clean`
- Verificar que `incremental: true` esté en `electron-builder.yml`

---

## 📚 Referencias

- [ESLint Documentation](https://eslint.org/docs/latest/)
- [Prettier Documentation](https://prettier.io/docs/en/)
- [Nodemon Documentation](https://nodemon.io/)
- [Electron Builder Documentation](https://www.electron.build/)
- [Husky Documentation](https://typicode.github.io/husky/)

---

## 🔄 Mantenimiento

### Actualizar Dependencias

```bash
npm outdated
npm update
```

### Verificar Configuración

```bash
npm run lint:check
npm run format:check
```

### Limpiar Todo

```bash
npm run clean:all
npm install
```

---

**Última actualización**: 2025-01-27
**Versión**: 1.0.0

