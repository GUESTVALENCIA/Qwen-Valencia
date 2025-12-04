# Plan: Sistema de EXCLUSIVIDAD TOTAL de Puertos

## Objetivo

Implementar sistema de **EXCLUSIVIDAD ABSOLUTA** de puertos con protección blindada. Cada puerto es EXCLUSIVO - si está en uso, la aplicación FALLA inmediatamente. NO busca alternativos, NO comparte, EXCLUSIVIDAD O ERROR.

## Principios Críticos

1. **EXCLUSIVIDAD O ERROR** - No buscar puertos alternativos
2. **PROTECCIÓN BLINDADA** - Shield activo de puertos con verificación continua
3. **NUMERACIÓN CLARA** - Cada instancia tiene puertos predefinidos y exclusivos
4. **LOCK EXCLUSIVO** - Solo una instancia por puerto, siempre

## Análisis Crítico del Sistema Actual

### Problemas Críticos

1. **FALTA DE EXCLUSIVIDAD**
   - `findAvailablePort()` busca puertos alternativos - INCORRECTO
   - Permite "compartir" puertos entre instancias
   - No hay bloqueo exclusivo

2. **Puertos Sin Protección**
   - No hay lock exclusivo de puertos
   - Cualquier aplicación puede tomar los puertos
   - No hay verificación de propiedad

3. **Código Permisivo**
   - `killProcessOnPort()` intenta matar procesos - INCORRECTO
   - Busca alternativos en lugar de FALLAR
   - Permite "compartir" recursos

## Arquitectura: EXCLUSIVIDAD TOTAL

### 1. Sistema de Lock Exclusivo de Puertos

**Archivo**: `src/utils/port-exclusive-lock.js` (nuevo)

**Funcionalidad**:
- Cada puerto tiene un LOCK FILE EXCLUSIVO en `%TEMP%/qwen-valencia-ports/`
- Lock file: `port-{PORT}.lock.json`
- Contenido: `{ port, pid, instanceId, timestamp, exclusive: true }`
- Solo UNA instancia puede tener el lock
- Si puerto tiene lock activo → ERROR FATAL: "Puerto X está en uso exclusivo por proceso Y"
- NO buscar puertos alternativos
- NO intentar matar procesos
- Verificar PID del lock antes de usar puerto
- Si PID está muerto, limpiar lock automáticamente

**Métodos críticos**:
- `acquireExclusiveLock(port, pid, instanceId)` - Adquirir lock exclusivo o FALLAR
- `releaseExclusiveLock(port)` - Liberar lock al cerrar
- `verifyLockOwnership(port, pid)` - Verificar que el lock sigue siendo nuestro
- `isPortExclusivelyLocked(port)` - Verificar si puerto está en uso exclusivo

### 2. Shield/Protección Activa de Puertos

**Archivo**: `src/utils/port-shield.js` (nuevo)

**Funcionalidad**:
- Crear "escudo" de puerto - protección activa
- Verificar cada 10 segundos que el lock sigue activo
- Si otro proceso intenta usar el puerto, detectar y ERROR FATAL
- Liberar lock solo al cerrar la aplicación
- Heartbeat del lock cada 30 segundos
- Si pierde el lock → ERROR y cerrar aplicación

**Comportamiento**:
- Activar shield al adquirir lock
- Monitoreo continuo del lock
- Detección de intrusión
- Cierre automático si se pierde exclusividad

### 3. Asignación Enumerada de Puertos

**Estrategia**: Cada instancia tiene puertos EXCLUSIVOS numerados
- Instancia 1: Base 6000 (MCP: 6000, Ollama: 6002, Groq: 6003, Sandra: 6004, API: 9000)
- Instancia 2: Base 6100 (MCP: 6100, Ollama: 6102, Groq: 6103, Sandra: 6104, API: 9100)
- Instancia 3: Base 6200 (MCP: 6200, Ollama: 6202, Groq: 6203, Sandra: 6204, API: 9200)
- Patrón: `basePort = 6000 + (instanceNumber - 1) * 100`

**EXCLUSIVIDAD**:
- Cada puerto se protege con lock exclusivo
- Antes de usar puerto, ADQUIRIR LOCK
- Si lock existe y está activo → ERROR FATAL
- No iniciar servicio si no puede adquirir lock

### 4. Sistema de Instancias con Exclusividad

**Archivo**: `src/utils/instance-manager.js` (nuevo)

**Funcionalidad**:
- Detectar número de instancia (1, 2, 3, etc.)
- Calcular puertos EXCLUSIVOS para esa instancia
- Adquirir locks de TODOS los puertos antes de iniciar
- Si NO puede adquirir TODOS los locks → ERROR y NO INICIAR
- Registrar instancia solo si tiene todos los locks

**Flujo**:
1. Detectar número de instancia
2. Calcular puertos asignados
3. Intentar adquirir lock exclusivo de TODOS los puertos
4. Si algún puerto falla → ERROR FATAL y NO INICIAR
5. Si todos los locks adquiridos → Iniciar servicios
6. Mantener locks activos durante toda la ejecución
7. Liberar locks solo al cerrar aplicación

### 5. Gestión de Errores Estricta

**Comportamiento**:
- Si puerto está en uso → ERROR FATAL: "Puerto X en uso exclusivo por proceso Y (PID: Z)"
- NO buscar alternativos
- NO intentar matar procesos
- NO iniciar servicios parcialmente
- Cerrar aplicación si pierde lock de puerto
- Logs claros de errores de exclusividad

## Implementación

### Archivos a Crear

1. **`src/utils/port-exclusive-lock.js`**
   - Sistema de locks exclusivos de puertos
   - Adquisición y liberación de locks
   - Verificación de propiedad

2. **`src/utils/port-shield.js`**
   - Protección activa de puertos
   - Monitoreo continuo
   - Detección de intrusión

3. **`src/utils/instance-manager.js`**
   - Gestión de instancias
   - Cálculo de puertos
   - Adquisición de todos los locks

### Archivos a Modificar

1. **`src/config/index.js`**
   - Agregar función para calcular puertos por instancia
   - Integrar sistema de exclusividad

2. **`src/app/main.js`**
   - Integrar instance manager al inicio
   - Adquirir todos los locks antes de iniciar
   - Manejo de errores estrictos

3. **`src/mcp/mcp-universal.js`**
   - Usar puerto con lock exclusivo
   - Eliminar `killProcessOnPort3001()` y `findAvailablePort()`
   - ERROR si no puede adquirir lock

4. **`src/mcp/ollama-mcp-server.js`**
   - Usar puerto con lock exclusivo
   - ERROR si puerto ocupado

5. **`src/mcp/groq-api-server.js`**
   - Usar puerto con lock exclusivo
   - ERROR si puerto ocupado

6. **`src/mcp/sandra-ia-mcp-server.js`**
   - Usar puerto con lock exclusivo
   - ERROR si puerto ocupado

7. **`src/app/main.js` - startAPIServer()**
   - Usar puerto con lock exclusivo
   - ERROR si puerto ocupado

## Eliminaciones Críticas

- **ELIMINAR** `findAvailablePort()` - No buscar alternativos
- **ELIMINAR** `killProcessOnPort()` - No matar procesos
- **ELIMINAR** `killProcessOnPort3001()` - Código legacy
- **ELIMINAR** lógica de puertos alternativos
- **ELIMINAR** intentos de compartir puertos

## Flujo de Inicio Estricto

1. Detectar número de instancia
2. Calcular puertos asignados a esa instancia
3. **Intentar adquirir lock exclusivo de TODOS los puertos**
4. **Si algún puerto falla → ERROR FATAL y NO INICIAR**
5. Si todos los locks adquiridos → Activar shields
6. Iniciar servicios solo con puertos con locks
7. Mantener locks activos durante toda la ejecución
8. Liberar locks solo al cerrar aplicación

## Mensajes de Error Claros

```
ERROR FATAL: Puerto 6000 está en uso exclusivo por proceso 12345 (Instancia 1)
No se puede iniciar la aplicación. Cierre la otra instancia o use una instancia diferente.
```

```
ERROR FATAL: No se pueden adquirir todos los locks exclusivos de puertos requeridos.
Puertos bloqueados: 6000 (PID: 12345), 6002 (PID: 12345)
```

## Testing

- Probar múltiples instancias - cada una con puertos exclusivos
- Intentar iniciar instancia con puertos ocupados - debe FALLAR
- Verificar que no busca alternativos
- Confirmar que locks se liberan al cerrar

