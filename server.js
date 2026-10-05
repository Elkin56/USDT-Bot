'use strict';

// Локальный сервер без зависимостей: отдаёт public/ и /api/*.
// Запуск: node server.js  (или start.bat / start.command)
const http = require('http');
const fs = require('fs');
const path = require('path');

// .env (простой парсер, без dotenv)
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (_) {}

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, 'public');
const routes = {
  '/api/rates': require('./api/rates'),
  '/api/bot': require('./api/bot'),
  '/api/setup': require('./api/setup'),
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

http
  .createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (routes[pathname]) return routes[pathname](req, res);

    const file = path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(PUBLIC)) { res.statusCode = 403; return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.statusCode = 404; return res.end('Not found'); }
      res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
      res.end(buf);
    });
  })
  .listen(PORT, () => {
    console.log(`\n  ₮ Tether Rates запущен: http://localhost:${PORT}`);
    console.log(`  API:                  http://localhost:${PORT}/api/rates\n`);
  });
