@echo off
echo ========================================
echo FORZANDO COMMIT DE CAMBIOS
echo ========================================
echo.

echo Agregando archivos modificados...
git add src/app/main.js
git add src/app/preload.js
git add src/app/renderer/index.html
git add src/app/renderer/utils/performance-monitor.js
git add src/orchestrator/model-router.js

echo.
echo Verificando estado...
git status

echo.
echo Haciendo commit...
git commit -m "feat: Completar tareas pendientes enterprise-level - State Sync: Sincronizacion bidireccional de estado frontend-backend via IPC - Performance Monitoring: Metricas integradas en backend y frontend - API Documentation: Documentacion JSDoc completada - Nuevo modulo: performance-monitor.js para monitoreo frontend - Metricas en route-message y get-system-memory - Handlers IPC para estado compartido y metricas"

echo.
echo ========================================
echo COMMIT COMPLETADO
echo Ahora puedes hacer PUSH desde GitHub Desktop
echo ========================================
pause

