'use strict';

// GET /api/setup?key=WEBHOOK_SECRET — однократная настройка бота после деплоя:
// ставит вебхук на /api/bot, кнопку меню «Курсы» и список команд.
const { tg } = require('../lib/telegram');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const url = new URL(req.url, 'http://x');
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || url.searchParams.get('key') !== secret) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Укажите ?key= со значением WEBHOOK_SECRET' }));
  }
  try {
    const appUrl = process.env.WEBAPP_URL;
    if (!appUrl) throw new Error('Не задан WEBAPP_URL');
    const base = new URL(appUrl).origin;
    const steps = {};
    steps.webhook = await tg('setWebhook', { url: `${base}/api/bot`, secret_token: secret, allowed_updates: ['message'] });
    steps.menu = await tg('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Курсы', web_app: { url: appUrl } } });
    steps.commands = await tg('setMyCommands', {
      commands: [
        { command: 'start', description: 'Открыть курсы USDT' },
        { command: 'rate', description: 'Сводка курсов текстом' },
      ],
    });
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, steps }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: e.message }));
  }
};
