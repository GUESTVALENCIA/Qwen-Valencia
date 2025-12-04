@echo off
title Cerrar Aplicaciones Qwen Instaladas
cd /d C:\Qwen-Valencia

cls
echo.
echo    ╔══════════════════════════════════════════════════════════════╗
echo    ║                                                              ║
echo    ║   🚨 CERRANDO APLICACIONES QWEN INSTALADAS                  ║
echo    ║                                                              ║
echo    ╚══════════════════════════════════════════════════════════════╝
echo.

echo [1/3] Cerrando procesos Electron...
taskkill /F /IM electron.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo ✅ Procesos Electron cerrados
echo.

echo [2/3] Cerrando aplicaciones Qwen instaladas...
taskkill /F /IM "Qwen.exe" >nul 2>&1
taskkill /F /IM "Qwen Chat (Groq).exe" >nul 2>&1
timeout /t 2 /nobreak >nul
echo ✅ Aplicaciones instaladas cerradas
echo.

echo [3/3] Limpiando caché de aplicaciones instaladas...
if exist "%APPDATA%\Qwen" (
    rmdir /s /q "%APPDATA%\Qwen" >nul 2>&1
)
if exist "%LOCALAPPDATA%\Programs\Qwen" (
    echo ⚠️  Carpeta de aplicación instalada encontrada (no se eliminará)
)
echo ✅ Limpieza completada
echo.

echo ═══════════════════════════════════════════════════════════════
echo ✅ TODAS LAS APLICACIONES CERRADAS
echo ═══════════════════════════════════════════════════════════════
echo.
echo IMPORTANTE: Ahora abre SOLO la versión de código fuente:
echo.
echo   cd C:\Qwen-Valencia
echo   npm start
echo.
echo O ejecuta: INICIAR_TODO.bat
echo.
echo ⚠️  NO uses los ejecutables instalados (.exe)
echo ✅ USA solo la versión de desarrollo (npm start)
echo.
pause

