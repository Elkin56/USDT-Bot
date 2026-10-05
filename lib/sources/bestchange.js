'use strict';

// BestChange — мониторинг обменников. Направления:
//   Продать USDT: Tether TRC20 → Наличные RUB  (выше — лучше)
//   Купить  USDT: Наличные RUB → Tether TRC20  (ниже — лучше)
//
// Основной способ — официальная выгрузка info.zip (её BestChange даёт партнёрам
// и обновляет раз в несколько секунд). Запасной — разбор HTML страницы мониторинга.
const { getBuffer, getText, firstOk, num } = require('../http');
const { readZip } = require('../zip');

const INFO_URLS = ['http://api.bestchange.ru/info.zip', 'https://api.bestchange.ru/info.zip', 'http://api.bestchange.com/info.zip'];
const PAGE_HOSTS = ['https://www.bestchange.ru', 'https://www.bestchange.net', 'https://www.bestchange.com'];

const CITIES = {
  smr: { slug: 'smr', name: 'Самара', match: /^самара$/i },
  msk: { slug: 'msk', name: 'Москва', match: /^москва$/i },
};

const pageUrl = (dir, slug, host = 'https://www.bestchange.net') =>
  dir === 'sell'
    ? `${host}/tether-trc20-to-cash-ruble-in-${slug}.html`
    : `${host}/cash-ruble-to-tether-trc20-in-${slug}.html`;

// ---------- info.zip ----------

const decoder = (() => {
  try { return new TextDecoder('windows-1251'); } catch (_) { return null; }
})();
const decode = (buf) => (decoder ? decoder.decode(buf) : buf.toString('latin1'));
const lines = (text) => text.split(/\r?\n/).filter(Boolean).map((l) => l.split(';'));

function parseInfo(zipBuf) {
  const z = readZip(zipBuf);
  const need = (n) => {
    if (!z[n]) throw new Error(`info.zip: нет файла ${n}`);
    return lines(decode(z[n]()));
  };

  const currencies = new Map(need('bm_cy.dat').map((r) => [r[0], r[2] || r[1]]));
  const codes = z['bm_cycodes.dat'] ? new Map(lines(decode(z['bm_cycodes.dat']())).map((r) => [r[0], r[1]])) : new Map();
  const exchangers = new Map(need('bm_exch.dat').map((r) => [r[0], r[1]]));
  const cities = new Map(need('bm_cities.dat').map((r) => [r[0], r[1]]));
  const rates = need('bm_rates.dat');
  return { currencies, codes, exchangers, cities, rates };
}

function findId(map, test) {
  for (const [id, v] of map) if (test(String(v || '').trim())) return id;
  return null;
}

function resolveIds(info) {
  const usdt =
    findId(info.codes, (c) => /^USDTTRC20$/i.test(c)) ||
    findId(info.currencies, (n) => /tether/i.test(n) && /trc\s?-?20/i.test(n));
  const cash =
    findId(info.codes, (c) => /^CASHRUB$/i.test(c)) ||
    findId(info.currencies, (n) => /налич/i.test(n) && /(rub|руб)/i.test(n));
  if (!usdt || !cash) throw new Error('info.zip: не найдены валюты USDT TRC20 / Наличные RUB');
  return { usdt, cash };
}

// Строка bm_rates.dat: отдаю;получаю;обменник;курс_отдаю;курс_получаю;резерв;отзывы;флаг;мин;макс;город
function rowsFromInfo(info, dir, cityId) {
  const { usdt, cash } = resolveIds(info);
  const from = dir === 'sell' ? usdt : cash;
  const to = dir === 'sell' ? cash : usdt;
  const out = [];
  for (const r of info.rates) {
    if (r[0] !== from || r[1] !== to) continue;
    if (String(r[10] ?? '0') !== String(cityId)) continue;
    const give = num(r[3]);
    const get = num(r[4]);
    if (!give || !get) continue;
    out.push({
      exchangerId: r[2],
      name: info.exchangers.get(r[2]) || `#${r[2]}`,
      rate: dir === 'sell' ? get / give : give / get,
      reserve: num(r[5]),
      min: num(r[8]),
      max: num(r[9]),
    });
  }
  return out;
}

// ---------- HTML-фолбэк ----------

const strip = (s) =>
  s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const firstNumber = (s) => {
  const m = strip(s).match(/\d[\d\s ]*(?:[.,]\d+)?/);
  return m ? num(m[0]) : null;
};
const numberAfter = (s, word) => {
  const m = strip(s).match(new RegExp(word + '\\s*(\\d[\\d\\s\\u00a0]*(?:[.,]\\d+)?)', 'i'));
  return m ? num(m[1]) : null;
};

function parseHtml(html, dir) {
  const table = html.match(/<table[^>]*id=["']content_table["'][\s\S]*?<\/table>/i);
  const scope = table ? table[0] : html;
  const out = [];
  for (const tr of scope.split(/<tr[\s>]/i).slice(1)) {
    const nameM = tr.match(/class=["'][^"']*\bca\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|a)>/i);
    const cells = [...tr.matchAll(/<td[^>]*class=["'][^"']*\bbi\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (!nameM || cells.length < 2) continue;
    const give = firstNumber(cells[0]);
    const get = firstNumber(cells[1]);
    if (!give || !get) continue;
    const reserveM = tr.match(/<td[^>]*class=["'][^"']*\bar\b[^"']*["'][^>]*>([\s\S]*?)<\/td>/i);
    out.push({
      name: strip(nameM[1]),
      rate: dir === 'sell' ? get / give : give / get,
      reserve: reserveM ? firstNumber(reserveM[1]) : null,
      min: numberAfter(cells[0], 'от'),
      max: numberAfter(cells[0], 'до'),
    });
  }
  if (!out.length) throw new Error('страница BestChange не содержит таблицы курсов (возможна защита от ботов)');
  return out;
}

// ---------- сборка ----------

function finalize(rows, dir) {
  rows.sort((a, b) => (dir === 'sell' ? b.rate - a.rate : a.rate - b.rate));
  return rows.map((r, i) => ({ rank: i + 1, ...r, rate: +r.rate.toFixed(4) }));
}

let infoCache = { at: 0, promise: null };
async function loadInfo(ttlMs) {
  if (infoCache.promise && Date.now() - infoCache.at < ttlMs) return infoCache.promise;
  infoCache = { at: Date.now(), promise: firstOk(INFO_URLS, (u) => getBuffer(u, { timeout: 15000 })).then(parseInfo) };
  infoCache.promise.catch(() => { infoCache = { at: 0, promise: null }; });
  return infoCache.promise;
}

async function getCityDirections(citySlug, { ttlMs = 40000 } = {}) {
  const city = CITIES[citySlug];
  const result = { via: null, sell: [], buy: [] };

  try {
    const info = await loadInfo(ttlMs);
    const cityId = findId(info.cities, (n) => city.match.test(n));
    if (!cityId) throw new Error(`info.zip: город ${city.name} не найден`);
    result.sell = finalize(rowsFromInfo(info, 'sell', cityId), 'sell');
    result.buy = finalize(rowsFromInfo(info, 'buy', cityId), 'buy');
    result.via = 'info.zip';
    if (result.sell.length || result.buy.length) return result;
  } catch (e) {
    result.infoError = e.message;
  }

  // Фолбэк: HTML страниц мониторинга
  const errors = [];
  for (const dir of ['sell', 'buy']) {
    try {
      const html = await firstOk(PAGE_HOSTS.map((h) => pageUrl(dir, city.slug, h)), (u) => getText(u));
      result[dir] = finalize(parseHtml(html, dir), dir);
    } catch (e) {
      errors.push(`${dir}: ${e.message}`);
    }
  }
  if (!result.sell.length && !result.buy.length) {
    throw new Error(`BestChange (${city.name}) недоступен. info.zip: ${result.infoError || '—'}; HTML: ${errors.join('; ')}`);
  }
  result.via = 'html';
  return result;
}

async function getBestChange(citySlug, opts = {}) {
  const city = CITIES[citySlug];
  const { top = 10 } = opts;
  const data = await getCityDirections(citySlug, opts);
  const pack = (dir) => ({
    best: data[dir][0] || null,
    count: data[dir].length,
    top: data[dir].slice(0, top),
    unitMin: dir === 'sell' ? 'USDT' : 'RUB',
    unitReserve: dir === 'sell' ? 'RUB' : 'USDT',
  });
  return {
    id: `bc_${city.slug}`,
    name: 'BestChange',
    kind: 'monitor',
    city: city.name,
    label: `Наличные RUB · ${city.name}`,
    via: data.via,
    url: pageUrl('sell', city.slug),
    urls: { sell: pageUrl('sell', city.slug), buy: pageUrl('buy', city.slug) },
    sell: pack('sell'),
    buy: pack('buy'),
    _all: data, // полные списки — нужны для поиска ZOEX, наружу не отдаются
  };
}

module.exports = { getBestChange, parseInfo, rowsFromInfo, parseHtml, finalize, resolveIds, pageUrl, CITIES };
