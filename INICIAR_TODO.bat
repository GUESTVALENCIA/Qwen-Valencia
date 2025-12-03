@echo off
title Qwen-Valencia - Iniciar Todo
cd /d C:\Qwen-Valencia

cls
echo.
echo    ╔══════════════════════════════════════════════════════════════╗
echo    ║                                                              ║
echo    ║   🚀 INICIANDO QWEN-VALENCIA                                ║
echo    ║                                                              ║
echo    ║   Servidor MCP + Aplicación Electron                        ║
echo    ║                                                              ║
echo    ╚══════════════════════════════════════════════════════════════╝
echo.

REM Verificar que .env.pro existe
if not exist .env.pro (
    echo ❌ .env.pro no encontrado
    echo.
    echo Ejecuta primero: CONFIGURAR_TODO.bat
    pause
    exit /b 1
)

REM Verificar que node_modules existe
if not exist node_modules (
    echo ❌ Dependencias no instaladas
    echo.
    echo Ejecuta primero: CONFIGURAR_TODO.bat
    pause
    exit /b 1
)

echo [1/2] Iniciando servidor MCP Universal...
start "MCP Server" cmd /k "node src/mcp/mcp-universal.js"
timeout /t 2 /nobreak >nul
echo ✅ Servidor MCP iniciado (puerto 6000)
echo.

echo [2/2] Iniciando aplicación Electron...
cd /d C:\Qwen-Valencia
start "Qwen-Valencia" cmd /k "call npm start"
timeout /t 3 /nobreak >nul
echo ✅ Aplicación Electron iniciada
echo.

echo ═══════════════════════════════════════════════════════════════
echo ✅ TODO INICIADO
echo ═══════════════════════════════════════════════════════════════
echo.
echo Servicios corriendo:
echo   - MCP Server: http://localhost:6000
echo   - Aplicación Electron: Abierta en nueva ventana
echo.
echo Para detener:
echo   - Cierra las ventanas de comandos
echo   - O ejecuta: DETENER_TODO.bat
echo.
pause

