@echo off
title Qwen-Valencia - Iniciar Servidores
cd /d C:\Qwen-Valencia

cls
echo.
echo    ╔══════════════════════════════════════════════════════════════╗
echo    ║                                                              ║
echo    ║   🚀 INICIANDO SERVIDORES QWEN-VALENCIA                    ║
echo    ║                                                              ║
echo    ║   - MCP Universal (Puerto 6000)                             ║
echo    ║   - Ollama MCP Server (Puerto 6002)                         ║
echo    ║   - Groq API Server (Puerto 6003)                           ║
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

echo [1/3] Iniciando Ollama MCP Server (Puerto 6002)...
start "Ollama MCP Server" cmd /k "node src/mcp/ollama-mcp-server.js"
timeout /t 2 /nobreak >nul
echo ✅ Ollama MCP Server iniciado
echo.

echo [2/3] Iniciando Groq API Server (Puerto 6003)...
start "Groq API Server" cmd /k "node src/mcp/groq-api-server.js"
timeout /t 2 /nobreak >nul
echo ✅ Groq API Server iniciado
echo.

echo [3/3] Iniciando MCP Universal Server (Puerto 6000)...
start "MCP Universal Server" cmd /k "node src/mcp/mcp-universal.js"
timeout /t 2 /nobreak >nul
echo ✅ MCP Universal Server iniciado
echo.

echo ═══════════════════════════════════════════════════════════════
echo ✅ TODOS LOS SERVIDORES INICIADOS
echo ═══════════════════════════════════════════════════════════════
echo.
echo Servicios corriendo:
echo   - MCP Universal: http://localhost:6000
echo   - Ollama MCP: http://localhost:6002
echo   - Groq API: http://localhost:6003
echo.
echo Para detener:
echo   - Cierra las ventanas de comandos
echo   - O ejecuta: DETENER_TODO.bat
echo.
pause

