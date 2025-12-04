# 🔑 Variables Necesarias para Sandra IA 8.0

**Fecha:** 2025-01-11  
**Versión:** 8.0

---

## ✅ Variable Requerida

### GROQ_API_KEY

**Descripción:** API Key de Groq necesaria para que Sandra IA pueda invocar modelos online (Qwen y DeepSeek).

**Ubicaciones donde se busca:**
1. `qwen-valencia.env` (archivo de configuración de Qwen Valencia)
2. `.env.pro` (archivo de entorno profesional)
3. Variables de entorno del sistema (`process.env.GROQ_API_KEY`)

**Formato:**
- Debe empezar con `gsk_`
- Longitud mínima: 20 caracteres
- Sin espacios, comillas ni caracteres especiales

**Ejemplo:**
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🔧 Cómo Configurar

### Opción 1: Archivo qwen-valencia.env

1. Abre el archivo `qwen-valencia.env` en la raíz del proyecto
2. Agrega o actualiza la línea:
   ```
   GROQ_API_KEY=tu-api-key-aqui
   ```
3. Guarda el archivo
4. Reinicia la aplicación

### Opción 2: Variables de Entorno del Sistema

**Windows (PowerShell):**
```powershell
$env:GROQ_API_KEY="tu-api-key-aqui"
```

**Windows (CMD):**
```cmd
set GROQ_API_KEY=tu-api-key-aqui
```

**Linux/Mac:**
```bash
export GROQ_API_KEY="tu-api-key-aqui"
```

---

## ✅ Verificación

Para verificar que la variable está configurada correctamente:

```bash
node scripts/test-sandra-connection.js
```

Este script:
1. Verifica que `GROQ_API_KEY` esté configurada
2. Verifica que el servidor de Sandra IA esté activo
3. Envía un saludo de prueba
4. Muestra la respuesta de Sandra IA

---

## 📝 Notas

- **Solo texto por ahora:** Por el momento, Sandra IA solo necesita `GROQ_API_KEY` para funcionar con texto.
- **Otras variables:** En el futuro se pueden agregar más variables para funcionalidades adicionales (audio, visión, etc.), pero por ahora solo se necesita Groq.
- **Compartida:** La misma `GROQ_API_KEY` se usa tanto para QWEN Valencia como para Sandra IA.

---

## 🐛 Troubleshooting

### Error: "GROQ_API_KEY no encontrada"

**Solución:**
1. Verifica que el archivo `qwen-valencia.env` existe
2. Verifica que la variable esté escrita correctamente (sin espacios extra)
3. Reinicia la aplicación después de agregar la variable

### Error: "Formato incorrecto"

**Solución:**
- Asegúrate de que la API key empiece con `gsk_`
- Elimina espacios, comillas o caracteres especiales
- Verifica que no haya saltos de línea

### Error: "No se pudo conectar al servidor"

**Solución:**
- Asegúrate de que la aplicación esté corriendo
- Verifica que el servidor de Sandra IA esté iniciado (puerto 6004)
- Revisa los logs de la aplicación

---

**Sandra IA 8.0 - Variables de Configuración**  
Creado por Clay

