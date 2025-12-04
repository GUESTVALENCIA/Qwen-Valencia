@echo off
title Buscar Aplicación Qwen Instalada
echo.
echo ═══════════════════════════════════════════════════════════════
echo   BUSCANDO APLICACIONES QWEN INSTALADAS
echo ═══════════════════════════════════════════════════════════════
echo.

echo [1/4] Buscando en Program Files...
dir /s /b "C:\Program Files\*Qwen*.exe" 2>nul
dir /s /b "C:\Program Files (x86)\*Qwen*.exe" 2>nul
echo.

echo [2/4] Buscando en AppData\Local\Programs...
dir /s /b "%LOCALAPPDATA%\Programs\*Qwen*.exe" 2>nul
echo.

echo [3/4] Buscando en AppData\Local...
dir /s /b "%LOCALAPPDATA%\*Qwen*.exe" 2>nul
echo.

echo [4/4] Buscando ejecutables en el escritorio...
dir /b "%USERPROFILE%\Desktop\*.exe" 2>nul | findstr /i "Qwen"
echo.

echo ═══════════════════════════════════════════════════════════════
echo   BUSQUEDA COMPLETADA
echo ═══════════════════════════════════════════════════════════════
echo.
pause

