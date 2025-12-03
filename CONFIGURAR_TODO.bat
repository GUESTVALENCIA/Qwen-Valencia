@echo off
title Configurar Qwen-Valencia - Setup Completo
cd /d C:\Qwen-Valencia

cls
echo.
echo    ╔══════════════════════════════════════════════════════════════╗
echo    ║                                                              ║
echo    ║   🚀 CONFIGURACIÓN AUTOMÁTICA QWEN-VALENCIA                ║
echo    ║                                                              ║
echo    ║   Configurando variables, dependencias y servidores        ║
echo    ║                                                              ║
echo    ╚══════════════════════════════════════════════════════════════╝
echo.

REM [1/6] Verificar Node.js
echo [1/6] Verificando Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js no está instalado
    echo.
    echo Descarga Node.js desde: https://nodejs.org
    pause
    exit /b 1
)
node --version
echo ✅ Node.js OK
echo.

REM [2/6] Copiar .env.example a .env.pro
echo [2/6] Configurando variables de entorno...
if not exist .env.pro (
    if exist .env.example (
        copy .env.example .env.pro >nul
        echo ✅ .env.pro creado desde .env.example
    ) else (
        echo ⚠️ .env.example no encontrado, creando .env.pro básico...
        (
            echo # QWEN-VALENCIA - Variables de Entorno
            echo GROQ_API_KEY=
            echo OLLAMA_BASE_URL=http://localhost:11434
            echo MCP_PORT=6000
            echo MCP_SECRET_KEY=qwen_valencia_mcp_secure_2025
            echo MODE=auto
        ) > .env.pro
        echo ✅ .env.pro creado
    )
) else (
    echo ✅ .env.pro ya existe
)
echo.

REM [3/6] Intentar copiar API keys desde Sandra si existen
echo [3/6] Intentando copiar API keys desde Sandra...
if exist "C:\Sandra-IA-8.0-Pro\.env.pro" (
    echo 📋 Leyendo API keys de Sandra...
    powershell -Command "$sandraEnv = Get-Content 'C:\Sandra-IA-8.0-Pro\.env.pro' -Raw; if ($sandraEnv -match 'GROQ_API_KEY=([^\r\n]+)') { $groqKey = $matches[1]; (Get-Content .env.pro) -replace 'GROQ_API_KEY=', \"GROQ_API_KEY=$groqKey\" | Set-Content .env.pro; Write-Host '✅ GROQ_API_KEY copiada' }"
    echo ✅ API keys actualizadas
) else (
    echo ⚠️ .env.pro de Sandra no encontrado, configurar manualmente
)
echo.

REM [4/6] Instalar dependencias
echo [4/6] Instalando dependencias npm...
if not exist node_modules (
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ Error instalando dependencias
        pause
        exit /b 1
    )
    echo ✅ Dependencias instaladas
) else (
    echo ✅ Dependencias ya instaladas
)
echo.

REM [5/6] Verificar Ollama (opcional)
echo [5/6] Verificando Ollama (opcional)...
where ollama >nul 2>&1
if %errorlevel% equ 0 (
    ollama --version
    echo ✅ Ollama instalado
    echo.
    echo ¿Quieres instalar los modelos ahora? (S/N)
    set /p instalar_modelos="> "
    if /i "%instalar_modelos%"=="S" (
        echo.
        echo 📥 Instalando Qwen2.5-VL:7B...
        ollama pull qwen2.5-vl:7b
        echo.
        echo 📥 Instalando DeepSeek Coder:6.7B...
        ollama pull deepseek-coder:6.7b
        echo.
        echo ✅ Modelos instalados
    )
) else (
    echo ⚠️ Ollama no instalado (opcional, puedes usar Groq API)
)
echo.

REM [6/6] Verificar puerto MCP
echo [6/6] Verificando puerto MCP (6000)...
netstat -an | findstr ":6000" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️ Puerto 6000 ya está en uso
    echo    Puede que el servidor MCP ya esté corriendo
) else (
    echo ✅ Puerto 6000 disponible
)
echo.

echo ═══════════════════════════════════════════════════════════════
echo ✅ CONFIGURACIÓN COMPLETA
echo ═══════════════════════════════════════════════════════════════
echo.
echo Próximos pasos:
echo   1. Revisar .env.pro y configurar API keys si es necesario
echo   2. Ejecutar: npm start
echo.
echo ¿Quieres iniciar la aplicación ahora? (S/N)
set /p iniciar="> "
if /i "%iniciar%"=="S" (
    echo.
    echo 🚀 Iniciando Qwen-Valencia...
    start cmd /k "npm start"
    echo.
    echo ✅ Aplicación iniciada en nueva ventana
) else (
    echo.
    echo Para iniciar manualmente: npm start
)
echo.
pause

