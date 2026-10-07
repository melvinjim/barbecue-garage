@echo off
chcp 65001 >nul
title Barbecue Garage - panel administrativo
cd /d "%~dp0admin"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js no esta instalado.
  echo  Descargalo en https://nodejs.org y vuelve a abrir este archivo.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo  Instalando dependencias del panel (solo la primera vez)...
  call npm install
)

rem Abre el panel en el navegador y arranca el servidor (http://localhost:3000)
start "" http://localhost:3000
call npm run dev

echo.
echo  El panel se detuvo.
pause
