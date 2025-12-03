@echo off
title Qwen-Valencia - Detener Todo
cd /d C:\Qwen-Valencia

cls
echo.
echo    ╔══════════════════════════════════════════════════════════════╗
echo    ║                                                              ║
echo    ║   🛑 DETENIENDO QWEN-VALENCIA                               ║
echo    ║                                                              ║
echo    ╚══════════════════════════════════════════════════════════════╝
echo.

echo Deteniendo procesos...

REM Detener procesos Node.js relacionados
taskkill /FI "WINDOWTITLE eq MCP Server*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Qwen-Valencia*" /T /F >nul 2>&1

REM Detener procesos por puerto 6000
echo Deteniendo procesos en puerto 6000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :6000 ^| findstr LISTENING') do (
    echo   Deteniendo PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo   ✅ Proceso %%a detenido
    )
)

REM Detener procesos Electron
taskkill /IM electron.exe /F >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Procesos Electron detenidos
)

echo.
echo ✅ Todos los procesos detenidos
echo.
pause

