# Plan: Sistema de Pools de Puertos Exclusivos con Rotación Automática

## Objetivo

Implementar sistema de **POOLS DE PUERTOS EXCLUSIVOS** donde cada servicio importante tiene entre 3-5 puertos reservados exclusivamente. Si un puerto falla, rotación automática al siguiente del pool. Todos los puertos del pool están protegidos con locks exclusivos.

## Principios Críticos

1. **EXCLUSIVIDAD POR PUERTO** - Cada puerto individual es exclusivo
2. **MÚLTIPLES PUERTOS POR SERVICIO** - Cada servicio tiene 3-5 puertos exclusivos en su pool
3. **ROTACIÓN AUTOMÁTICA** - Si un puerto del pool falla, intentar el siguiente automáticamente
4. **REINTENTOS ENTRE PUERTOS DEL POOL** - Rotar entre todos los puertos del pool hasta encontrar uno disponible
5. **PROTECCIÓN BLINDADA** - Shield activo del puerto en uso

## Configuración de Pools de Puertos

### Instancia 1 (Base 6000)

**MCP Universal**: Pool [6000, 6001, 6002] - 3 puertos exclusivos
**Ollama MCP**: Pool [6010, 6011, 6012] - 3 puertos exclusivos
**Groq API**: Pool [6020, 6021, 6022] - 3 puertos exclusivos
**Sandra IA**: Pool [6030, 6031, 6032, 6033] - 4 puertos exclusivos
**Sistema Conversacional/Llamada**: Pool [7000, 7001, 7002, 7003, 7004] - 5 puertos exclusivos
**API Server**: Pool [9000, 9001, 9002] - 3 puertos exclusivos

### Instancia 2 (Base 6100)

**MCP Universal**: Pool [6100, 6101, 6102]
**Ollama MCP**: Pool [6110, 6111, 6112]
**Groq API**: Pool [6120, 6121, 6122]
**Sandra IA**: Pool [6130, 6131, 6132, 6133]
**Sistema Conversacional**: Pool [7100, 7101, 7102, 7103, 7104]
**API Server**: Pool [9100, 9101, 9102]

### Patrón de Enumeración

- Base para instancia N: `6000 + (N - 1) * 100`
- Pools separados para evitar solapamiento
- Cada servicio tiene su rango dedicado

## Arquitectura

### 1. Sistema de Pool de Puertos Exclusivos

**Archivo**: `src/utils/port-pool-manager.js` (nuevo)

- Gestiona pools de puertos por servicio
- Adquirir lock exclusivo del primer puerto disponible del pool
- Si falla, rotar automáticamente al siguiente
- Si todos fallan → ERROR FATAL
- Todos los puertos del pool están protegidos exclusivamente

### 2. Lock Exclusivo por Puerto

**Archivo**: `src/utils/port-exclusive-lock.js` (nuevo)

- Cada puerto tiene lock file exclusivo
- Verificar si puerto está disponible (sin lock activo)
- Adquirir lock exclusivo
- Verificar PID del lock antes de usar

### 3. Rotación Automática

- Intentar puerto 1 del pool
- Si falla → intentar puerto 2
- Si falla → intentar puerto 3
- Continuar hasta encontrar uno disponible
- Si TODOS fallan → ERROR FATAL

## Implementación

### Archivos a Crear

1. `src/utils/port-exclusive-lock.js` - Locks exclusivos individuales
2. `src/utils/port-pool-manager.js` - Gestión de pools con rotación
3. `src/utils/port-shield.js` - Protección activa
4. `src/utils/instance-manager.js` - Gestión de instancias y cálculo de pools

### Archivos a Modificar

1. `src/config/index.js` - Configurar pools de puertos por servicio
2. Todos los servidores MCP - Usar port pool manager
3. Sistema conversacional - Pool de 5 puertos
4. API Server - Pool de 3 puertos

