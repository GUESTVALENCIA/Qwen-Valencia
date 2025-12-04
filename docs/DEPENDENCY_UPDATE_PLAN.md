# 📦 Plan de Actualización de Dependencias - Qwen-Valencia

## Estado Actual

Última verificación: 2025-01-03

### Dependencias Desactualizadas

| Paquete | Actual | Latest | Prioridad | Riesgo |
|---------|--------|--------|-----------|--------|
| `@deepgram/sdk` | 3.5.0 | 4.11.2 | MEDIA | MEDIO |
| `dotenv` | 16.6.1 | 17.2.3 | BAJA | BAJO |
| `electron` | 28.3.3 | 39.2.4 | ALTA | ALTO |
| `electron-builder` | 24.13.3 | 26.0.12 | MEDIA | MEDIO |
| `electron-store` | 8.2.0 | 11.0.2 | MEDIA | MEDIO |
| `express` | 4.22.1 | 5.2.1 | ALTA | ALTO |

---

## Plan de Actualización Gradual

### FASE 1: Actualizaciones de Bajo Riesgo (Inmediato)

#### 1.1 dotenv (16.6.1 → 17.2.3)
- **Riesgo**: BAJO
- **Cambios breaking**: Mínimos
- **Acción**: Actualizar directamente
```bash
npm install dotenv@latest
```

#### 1.2 electron-store (8.2.0 → 11.0.2)
- **Riesgo**: MEDIO
- **Cambios breaking**: Posibles cambios en API
- **Acción**: 
  1. Revisar changelog
  2. Actualizar
  3. Verificar que `store.get()` y `store.set()` funcionen igual

---

### FASE 2: Actualizaciones de Medio Riesgo (Después de Fase 1)

#### 2.1 @deepgram/sdk (3.5.0 → 4.11.2)
- **Riesgo**: MEDIO
- **Cambios breaking**: Posibles cambios en API de SDK
- **Acción**:
  1. Revisar [changelog de Deepgram](https://github.com/deepgram/deepgram-node-sdk/releases)
  2. Actualizar
  3. Verificar que `deepgram-service.js` funcione correctamente
  4. Probar transcripción de audio

#### 2.2 electron-builder (24.13.3 → 26.0.12)
- **Riesgo**: MEDIO
- **Cambios breaking**: Posibles cambios en configuración
- **Acción**:
  1. Revisar changelog
  2. Actualizar `electron-builder.yml` si es necesario
  3. Probar build: `npm run build`

---

### FASE 3: Actualizaciones de Alto Riesgo (Requiere Testing Extensivo)

#### 3.1 Electron (28.3.3 → 39.2.4)
- **Riesgo**: ALTO
- **Cambios breaking**: Múltiples cambios en API de Electron
- **Acción**:
  1. **NO actualizar directamente**
  2. Actualizar gradualmente:
     - Primero: 28 → 30
     - Luego: 30 → 35
     - Finalmente: 35 → 39
  3. Revisar [Electron Breaking Changes](https://www.electronjs.org/docs/latest/breaking-changes)
  4. Verificar:
     - `BrowserWindow` options
     - `ipcMain` / `ipcRenderer` API
     - `contextBridge` API
     - `webPreferences` options
  5. Testing completo de todas las funcionalidades

#### 3.2 Express (4.22.1 → 5.2.1)
- **Riesgo**: ALTO
- **Cambios breaking**: Express 5 tiene cambios significativos
- **Acción**:
  1. **NO actualizar directamente**
  2. Revisar [Express 5 Migration Guide](https://github.com/expressjs/express/blob/master/5.0-upgrade-guide.md)
  3. Verificar:
     - Middleware API
     - Router API
     - Error handling
  4. Actualizar todos los servidores MCP:
     - `mcp-universal.js`
     - `ollama-mcp-server.js`
     - `groq-api-server.js`

---

## Checklist de Actualización

### Antes de Actualizar
- [ ] Hacer backup del código
- [ ] Crear branch para actualización
- [ ] Revisar changelogs de todas las dependencias
- [ ] Identificar cambios breaking

### Durante la Actualización
- [ ] Actualizar una dependencia a la vez
- [ ] Ejecutar tests después de cada actualización
- [ ] Verificar que la aplicación inicia correctamente
- [ ] Probar funcionalidades críticas

### Después de Actualizar
- [ ] Ejecutar `npm audit` para verificar vulnerabilidades
- [ ] Probar build: `npm run build`
- [ ] Probar todas las funcionalidades:
  - [ ] Envío de mensajes
  - [ ] Ejecución de código
  - [ ] Transcripción de audio
  - [ ] Servidores MCP
  - [ ] Auto-updater
  - [ ] System tray
  - [ ] Multi-window

---

## Comandos Útiles

```bash
# Ver dependencias desactualizadas
npm outdated

# Actualizar una dependencia específica
npm install package@latest

# Verificar vulnerabilidades
npm audit

# Fix vulnerabilidades automáticamente (si es seguro)
npm audit fix

# Verificar que todo funciona
npm start
npm run build
```

---

## Notas Importantes

1. **Electron 28 → 39**: Es un salto de 11 versiones mayores. Requiere testing extensivo.
2. **Express 4 → 5**: Cambios significativos en API. Considerar mantener Express 4 si no hay vulnerabilidades críticas.
3. **Priorizar seguridad**: Si hay vulnerabilidades críticas, actualizar inmediatamente.
4. **Testing**: Cada actualización debe ir acompañada de testing completo.

---

## Referencias

- [Electron Breaking Changes](https://www.electronjs.org/docs/latest/breaking-changes)
- [Express 5 Upgrade Guide](https://github.com/expressjs/express/blob/master/5.0-upgrade-guide.md)
- [npm outdated](https://docs.npmjs.com/cli/v8/commands/npm-outdated)
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit)

---

**Recomendación**: Actualizar primero las dependencias de bajo riesgo (dotenv, electron-store), luego las de medio riesgo, y finalmente las de alto riesgo (Electron, Express) con testing extensivo.

