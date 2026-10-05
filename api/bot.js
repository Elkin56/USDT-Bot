'use strict';

// POST /api/bot — вебхук Telegram-бота.
//   /start — кнопка открытия Mini App
//   /rate  — сводка курсов текстом
const { getAll } = require('../lib/aggregate');
const { tg, summary } = require('../lib/telegram');

const readBody = (req) =>
  req.body !== undefined
    ? Promise.resolve(typeof req.body === 'string' ? JSON.parse(req.body) : req.body)
    : new Promise((ok, fail) => {
        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', () => { try { ok(JSON.parse(raw || '{}')); } catch (e) { fail(e); } });
      });

module.exports = async (req, res) => {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    res.statusCode = 401;
    return res.end('unauthorized');
  }
  try {
    const update = await readBody(req);
    const msg = update.message;
    if (msg && msg.text) {
      const chat_id = msg.chat.id;
      const appUrl = process.env.WEBAPP_URL;
      const openBtn = appUrl ? { inline_keyboard: [[{ text: '₮ Открыть курсы', web_app: { url: appUrl } }]] } : undefined;

      if (/^\/start/.test(msg.text)) {
        await tg('sendMessage', {
          chat_id,
          parse_mode: 'HTML',
          text: 'Курс USDT/RUB с Rapira, BestChange (Самара и Москва) и ZOEX в одном окне.\n\nКоманда /rate пришлёт сводку текстом.',
          reply_markup: openBtn,
        });
      } else if (/^\/rate/.test(msg.text)) {
        const data = await getAll();
        await tg('sendMessage', { chat_id, parse_mode: 'HTML', text: summary(data), reply_markup: openBtn });
      }
    }
  } catch (e) {
    console.error('bot error:', e.message);
  }
  res.statusCode = 200;
  res.end('ok');
};
