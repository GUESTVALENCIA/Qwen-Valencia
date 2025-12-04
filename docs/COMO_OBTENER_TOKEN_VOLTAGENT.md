# 🔑 Cómo Obtener Token de VoltAgent

**Fecha:** 2025-01-11  
**Objetivo:** Guía completa para obtener y configurar tokens de VoltAgent

---

## 📋 PASOS PARA OBTENER TOKEN DE VOLTAGENT

### Paso 1: Acceder a VoltAgent Console
**URL:** https://console.voltagent.dev

### Paso 2: Iniciar Sesión
- Usa tu cuenta de VoltAgent
- Email: `sandra-coo@guestsvalencia.es` (según tu `tokens.json`)
- O crea una cuenta nueva si no tienes una

### Paso 3: Ir a Settings/API Keys
1. En el menú, ve a **"Settings"** o **"Configuración"**
2. Busca **"API Keys"** o **"Tokens"**
3. O ve directamente a: https://console.voltagent.dev/settings/projects

### Paso 4: Generar Nuevo Token
1. Haz clic en **"Create API Key"** o **"Generate Token"**
2. Selecciona el tipo de token:
   - **Development**: Para desarrollo local (válido 90 días)
   - **Production**: Para producción (válido 24 horas)
   - **Admin**: Acceso completo (válido 30 días)
3. Copia el token JWT (empieza con `eyJ...`)
4. **¡IMPORTANTE!** Guárdalo en un lugar seguro, solo se muestra una vez

### Paso 5: Actualizar tokens.json
Actualiza el archivo `C:\Users\clayt\Desktop\VoltAgent-Composer-Workflow\tokens.json` con el nuevo token.

---

## ✅ TOKENS ACTUALES (Verificados)

Según tu archivo `tokens.json`, ya tienes estos tokens configurados:

### Token Development (Recomendado para Orquestador)
- **Token:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (completo en tokens.json)
- **Expira:** 2026-01-09 (válido hasta enero 2026)
- **Propósito:** Desarrollo local y pruebas
- **Válido:** 90 días

### Token Original
- **Expira:** 2025-12-11
- **Estado:** Válido hasta diciembre 2025

### Token Admin
- **Expira:** 2025-12-11
- **Propósito:** Acceso completo con todos los permisos

---

## 🔧 CONFIGURACIÓN ACTUAL

Tu sistema está configurado para usar:
- **Ruta de tokens:** `C:\Users\clayt\Desktop\VoltAgent-Composer-Workflow\tokens.json`
- **API Base:** `https://api.voltagent.dev`
- **Token preferido:** `development` (si existe) o `original` (fallback)

---

## 📝 ACTUALIZAR TOKEN EN EL SISTEMA

### Opción 1: Actualizar tokens.json manualmente
Edita el archivo `C:\Users\clayt\Desktop\VoltAgent-Composer-Workflow\tokens.json`:

```json
{
  "tokens": {
    "development": {
      "token": "TU_NUEVO_TOKEN_AQUI",
      "expires": "2026-04-11T00:00:00Z",
      "purpose": "Desarrollo local y pruebas",
      "validity_days": 90,
      "scope": "full_access"
    }
  }
}
```

### Opción 2: Usar script de actualización
```powershell
# Crear script para actualizar token
node scripts/update-voltagent-token.js "TU_NUEVO_TOKEN"
```

---

## 🧪 VERIFICAR QUE EL TOKEN FUNCIONA

### Prueba rápida:
```powershell
# Verificar que el orquestador puede cargar el token
node scripts/start-orchestrator.js
```

**Si funciona:**
- ✅ Verás "Orquestador iniciado"
- ✅ Los monitores comenzarán a funcionar
- ✅ No verás el error "No hay token de VoltAgent"

**Si falla:**
- ⚠️ Verifica que el token sea correcto
- ⚠️ Verifica que el token no haya expirado
- ⚠️ Verifica que la ruta a `tokens.json` sea correcta

---

## 🔗 ENLACES ÚTILES

### VoltAgent Console:
- **Dashboard:** https://console.voltagent.dev
- **Settings/API Keys:** https://console.voltagent.dev/settings/projects
- **Documentación:** https://docs.voltagent.dev

### API:
- **API Base:** https://api.voltagent.dev
- **Documentación API:** https://docs.voltagent.dev/api

---

## ⚠️ SEGURIDAD

### Buenas Prácticas:
- ✅ **NUNCA** compartir tokens públicamente
- ✅ Rotar tokens periódicamente
- ✅ Usar tokens de desarrollo para local, producción para producción
- ✅ Mantener `tokens.json` en `.gitignore`
- ✅ No subir tokens a repositorios públicos

### Estructura de tokens.json:
```json
{
  "account": {
    "email": "tu-email@ejemplo.com",
    "name": "Tu Nombre",
    "agent_id": "tu-agent-id",
    "console_url": "https://console.voltagent.dev",
    "api_url": "https://api.voltagent.dev"
  },
  "tokens": {
    "development": {
      "token": "eyJ...",
      "expires": "2026-01-09T00:14:12Z",
      "purpose": "Desarrollo local",
      "scope": "full_access"
    }
  }
}
```

---

## 🎯 RESUMEN RÁPIDO

1. **Ir a:** https://console.voltagent.dev/settings/projects
2. **Crear token:** Development (90 días) o Admin (30 días)
3. **Copiar token:** JWT que empieza con `eyJ...`
4. **Actualizar:** `C:\Users\clayt\Desktop\VoltAgent-Composer-Workflow\tokens.json`
5. **Verificar:** Ejecutar `node scripts/start-orchestrator.js`

---

## ✅ CHECKLIST

- [ ] Cuenta de VoltAgent activa
- [ ] Token generado desde la consola
- [ ] Token copiado y guardado
- [ ] `tokens.json` actualizado con el nuevo token
- [ ] Orquestador puede cargar el token
- [ ] Monitores funcionando correctamente

---

**✨ Estado:** Tu sistema ya tiene tokens configurados. Si necesitas renovar o crear uno nuevo, sigue los pasos arriba.

