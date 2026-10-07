@echo off
chcp 65001 >nul
title Barbecue Garage - servidor local
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js no esta instalado.
  echo  Descargalo en https://nodejs.org y vuelve a abrir este archivo.
  echo.
  pause
  exit /b 1
)

rem Arranca el servidor y abre el sitio en el navegador (http://localhost:5173)
node server.mjs --open

echo.
echo  El servidor se detuvo.
pause
