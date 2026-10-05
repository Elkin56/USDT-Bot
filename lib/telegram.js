'use strict';

// Мини-клиент Telegram Bot API и текстовая сводка для команды /rate.
const TOKEN = process.env.BOT_TOKEN;

async function tg(method, payload) {
  if (!TOKEN) throw new Error('Не задан BOT_TOKEN');
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method}: ${data.description}`);
  return data.result;
}

const fmt = (n) => (n == null ? '—' : n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

function summary(data) {
  const lines = ['<b>USDT/RUB</b> · ' + new Date(data.updatedAt).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }) + ' МСК', ''];
  lines.push('<code>Источник            Продать  Купить</code>');
  for (const s of data.sources) {
    const title = (s.name + (s.city ? ' ' + s.city : '')).padEnd(18).slice(0, 18);
    if (!s.ok) { lines.push(`<code>${title}  нет данных</code>`); continue; }
    const sell = s.sell && s.sell.best ? fmt(s.sell.best.rate) : '—';
    const buy = s.buy && s.buy.best ? fmt(s.buy.best.rate) : '—';
    lines.push(`<code>${title}  ${sell.padStart(6)}  ${buy.padStart(6)}</code>`);
  }
  lines.push('', '<i>Продать — сколько ₽ получите за 1 USDT. Купить — сколько ₽ отдадите за 1 USDT.</i>');
  return lines.join('\n');
}

module.exports = { tg, summary };
