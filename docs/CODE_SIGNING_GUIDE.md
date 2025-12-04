# 🔐 Guía de Code Signing - Qwen-Valencia

## Resumen

Esta guía explica cómo configurar code signing para Qwen-Valencia en Windows y macOS para distribuciones enterprise.

## Configuración Actual

El archivo `electron-builder.yml` ya está configurado con soporte para code signing. Solo necesitas configurar las variables de entorno y certificados.

---

## Windows Code Signing

### Requisitos

1. Certificado de firma de código (.pfx o .p12)
2. `signtool.exe` (incluido en Windows SDK)

### Configuración

#### Opción 1: Variables de Entorno (Recomendado)

```bash
# Windows PowerShell
$env:CSC_LINK="C:\path\to\certificate.pfx"
$env:CSC_KEY_PASSWORD="tu_password_del_certificado"
```

#### Opción 2: Configuración en electron-builder.yml

Descomenta y configura en `electron-builder.yml`:

```yaml
win:
  sign: null  # Cambiar a null para deshabilitar
  # O configurar:
  certificateFile: path/to/certificate.pfx
  certificatePassword: ${CSC_KEY_PASSWORD}
  signingHashAlgorithms: ['sha256']
```

### Obtener Certificado

1. **Certificado Comercial** (Recomendado para producción):
   - Comprar de una CA reconocida (DigiCert, Sectigo, etc.)
   - Costo: ~$200-400/año

2. **Certificado de Prueba** (Solo para desarrollo):
   - Generar con `makecert.exe` (Windows SDK)
   - No válido para distribución pública

### Proceso de Firma

El code signing se ejecuta automáticamente durante `npm run build` si:
- `CSC_LINK` está configurado
- El certificado es válido
- `CSC_KEY_PASSWORD` es correcto

---

## macOS Code Signing

### Requisitos

1. Apple Developer Account ($99/año)
2. Certificado "Developer ID Application" desde Apple Developer Portal
3. App-specific password para notarization

### Configuración

#### Variables de Entorno

```bash
# macOS/Linux
export APPLE_ID="tu-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TU_TEAM_ID"
```

#### Configuración en electron-builder.yml

Descomenta y configura:

```yaml
mac:
  identity: "Developer ID Application: GUESTVALENCIA"
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  notarize:
    teamId: ${APPLE_TEAM_ID}
```

### Proceso de Firma y Notarization

1. **Firma**: Se ejecuta automáticamente durante el build
2. **Notarization**: Se ejecuta después del build si está configurado
   - Puede tardar 5-30 minutos
   - Requiere conexión a internet

### Obtener Certificado

1. Ir a [Apple Developer Portal](https://developer.apple.com/account)
2. Certificates, Identifiers & Profiles
3. Crear nuevo certificado "Developer ID Application"
4. Descargar e instalar en Keychain

---

## Verificación

### Windows

```powershell
# Verificar firma
signtool verify /pa dist\Qwen-Valencia-Setup-1.0.0.exe
```

### macOS

```bash
# Verificar firma
codesign --verify --deep --strict --verbose=2 dist/Qwen-Valencia-1.0.0.dmg

# Verificar notarization
spctl --assess --verbose dist/Qwen-Valencia-1.0.0.dmg
```

---

## Troubleshooting

### Windows: "SignTool Error: No certificates were found"

- Verificar que `CSC_LINK` apunta al archivo correcto
- Verificar que el certificado está instalado en el Keychain de Windows
- Verificar que `CSC_KEY_PASSWORD` es correcto

### macOS: "No identity found"

- Verificar que el certificado está en Keychain
- Verificar que `identity` en electron-builder.yml coincide con el nombre del certificado
- Ejecutar: `security find-identity -v -p codesigning`

### macOS: Notarization Fails

- Verificar que `APPLE_ID` y `APPLE_APP_SPECIFIC_PASSWORD` son correctos
- Verificar que `APPLE_TEAM_ID` es correcto
- Revisar logs en: `~/Library/Logs/electron-builder-notarize.log`

---

## Deshabilitar Code Signing (Solo Desarrollo)

Para deshabilitar code signing temporalmente:

**Windows:**
```yaml
win:
  sign: null
```

**macOS:**
```yaml
mac:
  identity: null
```

---

## Referencias

- [Electron Builder Code Signing](https://www.electron.build/code-signing)
- [Windows Code Signing](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)
- [Apple Code Signing](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)

---

**Nota**: Code signing es crítico para distribución enterprise. Sin firma, los usuarios verán advertencias de seguridad al instalar la aplicación.

