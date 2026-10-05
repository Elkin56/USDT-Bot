#!/bin/bash
# Двойной клик на macOS (или ./start.command в Linux)
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js не найден. Установите версию 18+ с https://nodejs.org и запустите снова."
  read -n 1; exit 1
fi
[ -f .env ] || cp .env.example .env
( sleep 1; open "http://localhost:3000" 2>/dev/null || xdg-open "http://localhost:3000" 2>/dev/null ) &
node server.js
