@echo off
echo ========================================
echo FORZANDO DETECCION DE CAMBIOS
echo ========================================
echo.

echo Limpiando cache de git...
git rm -r --cached .
git add .

echo.
echo Verificando estado de archivos especificos...
git status src/app/main.js
git status src/app/preload.js
git status src/app/renderer/index.html
git status src/app/renderer/utils/performance-monitor.js
git status src/orchestrator/model-router.js

echo.
echo ========================================
echo Estado completo del repositorio:
echo ========================================
git status

echo.
echo ========================================
echo Si ves archivos modificados arriba,
echo ahora deberian aparecer en GitHub Desktop
echo ========================================
echo.
echo Presiona cualquier tecla para continuar...
pause > nul

