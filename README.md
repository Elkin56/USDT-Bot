# ₮ Tether Rates — Telegram Mini App

Курс USDT/RUB на покупку и продажу из четырёх мест в одном окне:

| Источник | Что берём | Откуда |
|---|---|---|
| **Rapira** | лучший bid (продать) и ask (купить) из стакана, последняя сделка, изменение за сутки | открытый API `api.rapira.net/open/market/rates`, запасной вариант — стакан `/market/exchange-plate-mini` |
| **BestChange · Самара** | лучший обменник Tether TRC20 ↔ Наличные RUB + топ-10 с лимитами и резервом | официальная выгрузка `api.bestchange.ru/info.zip`, запасной вариант — HTML страниц мониторинга |
| **BestChange · Москва** | то же для Москвы | то же |
| **ZOEX** (zoex.ru, Самара) | курс ZOEX в обе стороны и его место в рейтинге | данные BestChange: сайт ZOEX подгружает курс скриптом и публичного API не даёт, а в мониторинге он стоит |

«Продать» — сколько рублей вы получите за 1 USDT (выше — лучше).
«Покупать» — сколько рублей отдадите за 1 USDT (ниже — лучше).

## Что умеет приложение

- Переключатель «Продаю / Покупаю USDT» и карточка лучшего курса среди всех источников.
- Для каждого источника: курс, разница с биржей Rapira в ₽ и %, мини-график за последние обновления.
- Тап по BestChange раскрывает топ-10 обменников; звёздочкой можно закрепить свой (например, MultiKassa) — его курс будет виден в строке источника.
- Калькулятор: сумма в USDT → итог в рублях по каждому источнику. Для BestChange выбирается лучший обменник, чьи лимиты подходят под сумму.
- Автообновление каждые 30 секунд, тема и хаптика Telegram.
- Если сервер курсов недоступен, показываются демо-данные с плашкой «Демо» (или принудительно: `?demo=1`).

## Запуск на компьютере

Нужен Node.js 18 или новее. Зависимостей нет, `npm install` не требуется.

- **Windows:** двойной клик по `start.bat`
- **macOS / Linux:** двойной клик по `start.command` (один раз: `chmod +x start.command`)
- или в терминале: `npm start` → http://localhost:3000

Проверка парсеров без интернета: `npm test`.

## Деплой на Vercel

1. Залейте папку в GitHub-репозиторий и импортируйте его на vercel.com (Framework: Other). Либо `npx vercel --prod` из папки.
2. В Settings → Environment Variables добавьте `BOT_TOKEN`, `WEBAPP_URL` (адрес деплоя со слешем на конце) и `WEBHOOK_SECRET`.
3. Сделайте Redeploy, затем один раз откройте в браузере:
   `https://ВАШ-ДОМЕН/api/setup?key=ВАШ_WEBHOOK_SECRET`
   Это поставит вебхук бота, кнопку меню «Курсы» и команды `/start`, `/rate`.
4. В @BotFather для красоты: `/setdescription`, `/setuserpic`. Если нужна ссылка вида `t.me/bot/app` — `/newapp` и тот же `WEBAPP_URL`.

API: `GET /api/rates` (кэш 30 с, `?force=1` — без кэша).

### Если источник отвечает ошибкой с Vercel

Rapira и BestChange иногда ограничивают зарубежные дата-центры. Тогда запустите тот же проект на российском VPS:

```bash
git clone … && cd tether-rates
cp .env.example .env   # заполните
npx pm2 start server.js --name tether-rates
```

и поставьте перед ним nginx с HTTPS (Telegram открывает Mini App только по https). Вебхук настраивается тем же `/api/setup?key=…`.

## Структура

```
api/rates.js            GET /api/rates — сводка всех источников
api/bot.js              вебхук бота (/start, /rate)
api/setup.js            одноразовая настройка бота
lib/aggregate.js        параллельный сбор и кэш
lib/sources/rapira.js   Rapira API + стакан
lib/sources/bestchange.js  info.zip (cp1251) + HTML-фолбэк
lib/sources/zoex.js     ZOEX из данных BestChange
lib/zip.js              распаковка ZIP без зависимостей
public/index.html       Mini App (один файл)
server.js               локальный сервер
test/                   офлайн-тесты на синтетических данных
```

## Настройки

- Период автообновления — константа `PERIOD` в `public/index.html`.
- Кэш на сервере — `CACHE_SECONDS` в `.env`.
- Другой город BestChange — добавьте его в `CITIES` в `lib/sources/bestchange.js` (slug как в адресе страницы, например `spb`) и в `lib/aggregate.js`.
