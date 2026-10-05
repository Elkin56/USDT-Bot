'use strict';

// Rapira — спотовая биржа, пара USDT/RUB.
// Основной источник: открытый API /open/market/rates (лимит 100 запросов/мин).
// Если в ответе нет bid/ask — берём верх стакана из /market/exchange-plate-mini.
const { getJson, request, num } = require('../http');

const RATES_URL = 'https://api.rapira.net/open/market/rates';
const DEPTH_URL = 'https://api.rapira.net/market/exchange-plate-mini';
const PAGE_URL = 'https://rapira.net/ru/exchange/USDT_RUB';
const SYMBOL = 'USDT/RUB';

function pickTicker(payload) {
  const list = Array.isArray(payload) ? payload : payload && (payload.data || payload.result || payload.rates);
  if (!Array.isArray(list)) throw new Error('Rapira: неожиданный формат ответа /open/market/rates');
  const t = list.find((x) => String(x.symbol || '').toUpperCase().replace('_', '/') === SYMBOL);
  if (!t) throw new Error('Rapira: пара USDT/RUB не найдена');
  return t;
}

// Достаёт цены из стороны стакана: {items:[{price,amount}]} | [{price}] | [[price, amount]]
function sidePrices(side) {
  const arr = Array.isArray(side) ? side : side && (side.items || side.list || side.data);
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => (Array.isArray(x) ? num(x[0]) : num(x && (x.price ?? x.p))))
    .filter((p) => p && p > 0);
}

function parseDepth(payload) {
  const d = (payload && payload.data) || payload || {};
  const asks = sidePrices(d.ask || d.asks || d.sell);
  const bids = sidePrices(d.bid || d.bids || d.buy);
  return {
    ask: asks.length ? Math.min(...asks) : null,
    bid: bids.length ? Math.max(...bids) : null,
  };
}

function parseTicker(t) {
  const last = num(t.close ?? t.last ?? t.lastPrice);
  const open = num(t.open);
  let changePct = null;
  if (last && open) changePct = ((last - open) / open) * 100;
  else if (num(t.chg) !== null) {
    const c = num(t.chg);
    changePct = Math.abs(c) < 1 ? c * 100 : c; // chg может прийти долей
  }
  return {
    last,
    open,
    high: num(t.high),
    low: num(t.low),
    bid: num(t.bidPrice ?? t.bid),
    ask: num(t.askPrice ?? t.ask),
    changePct,
  };
}

async function getRapira() {
  const ticker = parseTicker(pickTicker(await getJson(RATES_URL)));

  if (!ticker.bid || !ticker.ask) {
    try {
      const form = new URLSearchParams({ symbol: SYMBOL });
      const res = await request(DEPTH_URL, {
        method: 'POST',
        body: form,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      });
      const depth = parseDepth(await res.json());
      ticker.bid = ticker.bid || depth.bid;
      ticker.ask = ticker.ask || depth.ask;
    } catch (_) {
      /* стакан не обязателен */
    }
  }
  if (!ticker.last && !ticker.bid) throw new Error('Rapira: в ответе нет цены');

  const bid = ticker.bid || ticker.last;
  const ask = ticker.ask || ticker.last;
  return {
    id: 'rapira',
    name: 'Rapira',
    kind: 'exchange',
    label: 'Биржа · стакан USDT/RUB',
    url: PAGE_URL,
    ...ticker,
    spread: bid && ask ? +(ask - bid).toFixed(4) : null,
    // Продать USDT = по лучшему bid, купить = по лучшему ask
    sell: { best: { name: 'Стакан Rapira', rate: bid } },
    buy: { best: { name: 'Стакан Rapira', rate: ask } },
  };
}

module.exports = { getRapira, parseTicker, pickTicker, parseDepth };
