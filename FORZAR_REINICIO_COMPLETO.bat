@echo off
title Qwen-Valencia - FORZAR REINICIO COMPLETO
cd /d C:\Qwen-Valencia

cls
echo.
echo    ╔══════════════════════════════════════════════════════════════╗
echo    ║                                                              ║
echo    ║   🔄 FORZANDO REINICIO COMPLETO                             ║
echo    ║                                                              ║
echo    ╚══════════════════════════════════════════════════════════════╝
echo.

echo [1/5] Cerrando TODOS los procesos Electron forzadamente...
taskkill /F /IM electron.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo ✅ Procesos terminados
echo.

echo [2/5] Esperando que los procesos se liberen completamente...
timeout /t 3 /nobreak >nul
echo ✅ Espera completada
echo.

echo [3/5] Limpiando caché de Electron...
if exist "%APPDATA%\Qwen-Valencia" (
    rmdir /s /q "%APPDATA%\Qwen-Valencia" >nul 2>&1
)
if exist "%LOCALAPPDATA%\Qwen-Valencia" (
    rmdir /s /q "%LOCALAPPDATA%\Qwen-Valencia" >nul 2>&1
)
echo ✅ Caché completamente limpiado
echo.

echo [4/5] Verificando archivos críticos...
if exist "src\app\renderer\index.html" (
    echo ✅ index.html encontrado
) else (
    echo ❌ ERROR: index.html NO encontrado
    pause
    exit /b 1
)

if exist "src\app\main.js" (
    echo ✅ main.js encontrado
) else (
    echo ❌ ERROR: main.js NO encontrado
    pause
    exit /b 1
)

if exist "src\app\preload.js" (
    echo ✅ preload.js encontrado
) else (
    echo ❌ ERROR: preload.js NO encontrado
    pause
    exit /b 1
)
echo.

echo [5/5] Iniciando aplicación Electron completamente limpia...
echo.
echo ═══════════════════════════════════════════════════════════════
echo ✅ REINICIO COMPLETO TERMINADO
echo ═══════════════════════════════════════════════════════════════
echo.
echo La aplicación se abrirá en 3 segundos...
echo.
echo INSTRUCCIONES:
echo   1. Espera a que la aplicación se abra completamente
echo   2. Verifica que los botones de ventana funcionan:
echo      - Minimizar (─)
echo      - Maximizar (□)
echo      - Cerrar (✕)
echo   3. Abre el menú de modelos
echo   4. Verifica los botones de producción al final del menú
echo.
timeout /t 3 /nobreak >nul

cd /d C:\Qwen-Valencia
start "Qwen-Valencia" cmd /k "call npm start"

echo.
echo ✅ Aplicación iniciada
echo.
echo Si los botones todavía no funcionan:
echo   1. Presiona F12 para abrir DevTools
echo   2. Ve a la pestaña Console
echo   3. Busca errores en rojo
echo   4. Cópialos y repórtalos
echo.
pause

