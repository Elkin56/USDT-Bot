@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден. Установите версию 18+ с https://nodejs.org и запустите снова.
  pause
  exit /b 1
)
if not exist .env copy .env.example .env >nul
start "" http://localhost:3000
node server.js
pause
