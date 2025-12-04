# ⚠️ INSTRUCCIONES CRÍTICAS PARA PLATFORM ENGINEER Y TODOS LOS AGENTES

## 🚫 REGLA FUNDAMENTAL ABSOLUTA

### **PROHIBIDO ROMPER LA APLICACIÓN**

**NUNCA, BAJO NINGUNA CIRCUNSTANCIA, DEBES:**
- ❌ Romper la funcionalidad existente
- ❌ Modificar código crítico sin entender el impacto completo
- ❌ Eliminar funcionalidades que están en uso
- ❌ Cambiar la lógica de negocio sin consultar primero
- ❌ Introducir cambios que puedan causar errores en producción

## 🎯 OBJETIVO DEL PLATFORM ENGINEER

El Platform Engineer debe **SUPERVISAR Y COMPLETAR** el sistema de pools de puertos exclusivos, asegurando que:

1. ✅ Todo funciona correctamente
2. ✅ No se rompe ninguna funcionalidad existente
3. ✅ Se completa la integración pendiente
4. ✅ Se valida que todo está a nivel enterprise

## 📋 ESTADO ACTUAL DEL PROYECTO

### ✅ COMPLETADO (75%)

**Sistemas Base:**
- ✅ `src/utils/port-exclusive-lock.js` - Sistema de locks exclusivos
- ✅ `src/utils/port-pool-manager.js` - Gestión de pools con rotación automática
- ✅ `src/utils/instance-manager.js` - Detección de instancias y cálculo de pools
- ✅ `src/utils/port-shield.js` - Protección activa de puertos

**Configuración:**
- ✅ `src/config/index.js` - Integración con pools dinámicos
- ✅ `src/app/main.js` - Inicialización del instance manager

**Servidores Integrados:**
- ✅ `src/mcp/mcp-universal.js` - Pool de 3 puertos
- ✅ `src/mcp/ollama-mcp-server.js` - Pool de 3 puertos
- ✅ `src/mcp/groq-api-server.js` - Pool de 3 puertos
- ✅ `src/mcp/sandra-ia-mcp-server.js` - Pool de 4 puertos

### ⏳ PENDIENTE DE COMPLETAR (25%)

1. **API Server en `src/app/main.js`** - Integrar pool de 3 puertos exclusivos
   - Función: `startAPIServer()`
   - Línea aproximada: 693-884
   - Debe usar `PortPoolManager` igual que los otros servidores
   - Pool: `getServicePortPool('api-server')`

2. **Eliminar código permisivo restante en `src/app/main.js`**
   - Buscar y eliminar cualquier uso de `findAvailablePort()`
   - Eliminar lógica de puertos alternativos en `startAPIServer()`
   - Reemplazar por sistema de pools exclusivos

3. **Sistema Conversacional** (opcional, baja prioridad)
   - Si tiene puertos propios, integrar pool de 5 puertos
   - Archivo: `src/services/conversation-service.js`

## 🔧 PATRÓN DE IMPLEMENTACIÓN

### Cómo integrar pools en un servidor:

```javascript
// 1. Agregar imports al inicio del archivo
const { getServicePortPool } = require('../config');
const { PortPoolManager } = require('../utils/port-pool-manager');
const { getPortShieldManager } = require('../utils/port-shield');
const { getInstanceManager } = require('../utils/instance-manager');

// 2. En constructor, cambiar puerto estático por pool
constructor() {
  // ANTES: this.port = serviceConfig.port || 6000;
  // AHORA:
  const portPool = getServicePortPool('nombre-servicio');
  this.portPoolManager = null;
  this.port = null; // Se asignará al adquirir del pool
  this.shield = null;
}

// 3. En método start(), adquirir puerto del pool
async start() {
  try {
    const portPool = getServicePortPool('nombre-servicio');
    const instanceManager = getInstanceManager();
    
    if (!instanceManager || !instanceManager.instanceNumber) {
      throw new Error('Instance manager no inicializado.');
    }
    
    this.portPoolManager = new PortPoolManager(
      'nombre-servicio',
      portPool,
      process.pid,
      instanceManager.instanceId
    );
    
    this.port = await this.portPoolManager.acquirePortFromPool();
    
    if (!this.port) {
      throw new Error(`No se pudo adquirir ningún puerto del pool: [${portPool.join(', ')}]`);
    }
    
    // Activar shield
    const shieldManager = getPortShieldManager();
    this.shield = shieldManager.createShield(
      this.port,
      process.pid,
      instanceManager.instanceId,
      (port) => {
        this.logger.error(`SHIELD PERDIDO: Puerto ${port}. Cerrando servidor.`);
        this.stop();
      }
    );
    
    // Iniciar servidor en puerto adquirido
    this.server = this.app.listen(this.port, () => {
      this.logger.info(`✅ Servidor escuchando en puerto ${this.port}`);
    });
    
  } catch (error) {
    // Liberar recursos en caso de error
    if (this.portPoolManager && this.port) {
      this.portPoolManager.releasePort();
    }
    if (this.shield && this.port) {
      const shieldManager = getPortShieldManager();
      shieldManager.removeShield(this.port);
    }
    throw error;
  }
}

// 4. En método stop(), liberar recursos
async stop() {
  if (this.server) {
    this.server.close(() => {
      // Liberar shield
      if (this.shield && this.port) {
        const shieldManager = getPortShieldManager();
        shieldManager.removeShield(this.port);
      }
      // Liberar puerto del pool
      if (this.portPoolManager) {
        this.portPoolManager.releasePort();
        this.logger.info(`Puerto ${this.port} liberado del pool`);
      }
    });
  }
}
```

## 🚨 PRINCIPIOS CRÍTICOS A RESPETAR

### 1. **EXCLUSIVIDAD TOTAL**
- Cada puerto es EXCLUSIVO
- Si está en uso, ERROR FATAL (NO buscar alternativos fuera del pool)
- Rotación SOLO dentro del pool asignado

### 2. **NO BUSCAR ALTERNATIVOS**
- ❌ NO usar `findAvailablePort()` fuera del pool
- ❌ NO intentar matar procesos en puertos
- ❌ NO buscar puertos aleatorios
- ✅ Rotar SOLO dentro del pool asignado

### 3. **ERROR FATAL SI FALLA**
- Si todos los puertos del pool fallan → ERROR FATAL
- NO continuar con funcionalidad parcial
- NO iniciar servicios sin puerto válido

### 4. **PROTECCIÓN ACTIVA**
- Activar shield al adquirir puerto
- Monitoreo continuo
- Cierre automático si se pierde lock

## 📊 CONFIGURACIÓN DE POOLS

**Instancia 1 (Base 6000):**
- MCP Universal: [6000, 6001, 6002] - 3 puertos
- Ollama MCP: [6010, 6011, 6012] - 3 puertos
- Groq API: [6020, 6021, 6022] - 3 puertos
- Sandra IA: [6030, 6031, 6032, 6033] - 4 puertos
- Conversacional: [7000, 7001, 7002, 7003, 7004] - 5 puertos
- API Server: [9000, 9001, 9002] - 3 puertos

**Patrón:** Cada instancia N tiene basePort = 6000 + (N - 1) * 100

## ✅ CHECKLIST DE VALIDACIÓN

Antes de completar cualquier tarea, verifica:

- [ ] ¿Funciona la aplicación sin errores?
- [ ] ¿Se pueden ejecutar múltiples instancias sin conflictos?
- [ ] ¿Los puertos se liberan correctamente al cerrar?
- [ ] ¿No hay código permisivo restante (findAvailablePort, killProcess)?
- [ ] ¿Los errores son claros y específicos?
- [ ] ¿La documentación está actualizada?

## 📝 ARCHIVOS CLAVE

- `src/utils/port-exclusive-lock.js` - Sistema de locks
- `src/utils/port-pool-manager.js` - Gestión de pools
- `src/utils/instance-manager.js` - Detección de instancias
- `src/utils/port-shield.js` - Protección activa
- `src/config/index.js` - Configuración y pools
- `src/app/main.js` - Punto de entrada principal

## 🎯 TAREAS ESPECÍFICAS PARA PLATFORM ENGINEER

1. **Integrar pool en API Server** (`src/app/main.js`, función `startAPIServer()`)
   - Reemplazar puerto estático 9000
   - Usar `PortPoolManager` con pool de 3 puertos
   - Eliminar lógica de puertos alternativos (líneas 834-874)

2. **Eliminar funciones permisivas** (si aún existen)
   - `findAvailablePort()` - Ya eliminada (debe estar comentada)
   - `ensureMCPServerPort()` - Ya eliminada (debe estar comentada)
   - Cualquier lógica de puertos alternativos en `startAPIServer()`

3. **Validar integridad del sistema**
   - Probar múltiples instancias
   - Verificar que los pools funcionan correctamente
   - Confirmar que no hay regresiones

4. **Documentar cambios finales**
   - Actualizar este documento con estado final
   - Crear resumen de implementación completada

## 🔒 GARANTÍAS REQUERIDAS

Antes de considerar el trabajo completado, el Platform Engineer debe garantizar:

1. ✅ **NO se rompió ninguna funcionalidad existente**
2. ✅ **Todos los servidores usan pools exclusivos**
3. ✅ **No hay código permisivo restante**
4. ✅ **Los errores son claros y útiles**
5. ✅ **El sistema funciona con múltiples instancias**
6. ✅ **La aplicación inicia correctamente**

## 📞 SOPORTE

Si encuentras problemas o necesitas clarificación:

1. **LEE PRIMERO** toda esta documentación
2. **REVISA** el código existente de los servidores ya integrados
3. **SIGUE** el patrón exacto implementado
4. **TESTEA** exhaustivamente antes de completar
5. **DOCUMENTA** cualquier cambio adicional

---

## ⚠️ RECORDATORIO FINAL

**NUNCA ROMPAS LA APLICACIÓN. SIEMPRE VALIDA QUE TODO FUNCIONA ANTES DE COMPLETAR.**

El objetivo es **MEJORAR** y **COMPLETAR**, no rehacer desde cero ni cambiar lo que ya funciona.

