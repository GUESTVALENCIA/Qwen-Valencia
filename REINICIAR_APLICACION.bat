@echo off
title Qwen-Valencia - Reiniciar Aplicación Limpiamente
cd /d C:\Qwen-Valencia

cls
echo.
echo    ╔══════════════════════════════════════════════════════════════╗
echo    ║                                                              ║
echo    ║   🔄 REINICIANDO QWEN-VALENCIA LIMPIAMENTE                  ║
echo    ║                                                              ║
echo    ╚══════════════════════════════════════════════════════════════╝
echo.

echo [Paso 1/4] Cerrando todos los procesos Electron...
taskkill /F /IM electron.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo ✅ Procesos Electron cerrados
echo.

echo [Paso 2/4] Limpiando caché de Electron...
if exist "%APPDATA%\Qwen-Valencia\Cache" (
    rmdir /s /q "%APPDATA%\Qwen-Valencia\Cache" >nul 2>&1
)
if exist "%LOCALAPPDATA%\Qwen-Valencia\Cache" (
    rmdir /s /q "%LOCALAPPDATA%\Qwen-Valencia\Cache" >nul 2>&1
)
echo ✅ Caché limpiado
echo.

echo [Paso 3/4] Verificando archivos modificados...
findstr /C:"Guardar a Producción" "src\app\renderer\index.html" >nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Botones encontrados en index.html
) else (
    echo ❌ ERROR: Botones NO encontrados en index.html
    pause
    exit /b 1
)

findstr /C:"saveModelsToProduction" "src\app\renderer\components\model-selector.js" >nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Funciones encontradas en model-selector.js
) else (
    echo ❌ ERROR: Funciones NO encontradas en model-selector.js
    pause
    exit /b 1
)

findstr /C:"read-models-config" "src\app\main.js" >nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ IPC handlers encontrados en main.js
) else (
    echo ❌ ERROR: IPC handlers NO encontrados en main.js
    pause
    exit /b 1
)
echo.

echo [Paso 4/4] Iniciando aplicación Electron...
echo.
echo ═══════════════════════════════════════════════════════════════
echo ✅ REINICIO COMPLETO - La aplicación se abrirá ahora
echo ═══════════════════════════════════════════════════════════════
echo.
echo INSTRUCCIONES:
echo   1. Abre el menú de modelos (clic en el selector)
echo   2. Busca los botones al final del menú:
echo      - 💾 Guardar a Producción
echo      - 📥 Cargar desde Producción
echo   3. Si no aparecen, presiona F12 para abrir DevTools
echo      y verifica errores en la consola
echo.
timeout /t 3 /nobreak >nul

cd /d C:\Qwen-Valencia
start "Qwen-Valencia" cmd /k "call npm start"

