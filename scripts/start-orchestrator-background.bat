@echo off
REM ════════════════════════════════════════════════════════════════════════════
REM START ORCHESTRATOR BACKGROUND - Ejecuta el orquestador en background
REM ════════════════════════════════════════════════════════════════════════════

echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║  INICIANDO ORQUESTADOR EN BACKGROUND                          ║
echo ║  Sistema de Monitoreo y Correccion Automatica                 ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0\.."

REM Crear directorio de logs si no existe
if not exist ".orchestrator-logs" mkdir ".orchestrator-logs"

REM Ejecutar orquestador en background
start /B node scripts/start-orchestrator.js > .orchestrator-logs/orchestrator-output.log 2>&1

echo ✅ Orquestador iniciado en background
echo 📊 Monitoreando sistema cada 15-60 segundos
echo 📝 Logs guardados en: .orchestrator-logs/
echo.
echo Para ver los logs en tiempo real:
echo    Get-Content .orchestrator-logs/orchestrator-output.log -Wait
echo.
echo Para detener el orquestador:
echo    taskkill /F /IM node.exe /FI "WINDOWTITLE eq *orchestrator*"
echo.

timeout /t 3 /nobreak >nul

REM Verificar que está ejecutándose
tasklist /FI "IMAGENAME eq node.exe" /FI "WINDOWTITLE eq *orchestrator*" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Orquestador ejecutándose correctamente
) else (
    echo ⚠️  Verificando estado del orquestador...
)

echo.
echo 🎊 Sistema de monitoreo activo!
echo.

