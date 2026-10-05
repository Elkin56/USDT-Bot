'use strict';

// Сводит все источники в один ответ. Кэш в памяти, чтобы не нагружать
// источники (Rapira: не чаще 100 запросов/мин; BestChange просит не дёргать info.zip чаще ~30 с).
const { getRapira } = require('./sources/rapira');
const { getBestChange } = require('./sources/bestchange');
const { getZoex } = require('./sources/zoex');

const TTL = Number(process.env.CACHE_SECONDS || 30) * 1000;
let cache = { at: 0, promise: null };

const settle = async (fn) => {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

async function collect() {
  const [rapira, bcSmr, bcMsk] = await Promise.all([
    settle(getRapira),
    settle(() => getBestChange('smr', { ttlMs: TTL })),
    settle(() => getBestChange('msk', { ttlMs: TTL })),
  ]);
  const zoex = await settle(async () => getZoex([bcSmr, bcMsk]));
  const sources = [rapira, bcSmr, bcMsk, zoex].map(({ _all, ...s }) => s);
  if (!sources[0].id) Object.assign(sources[0], { id: 'rapira', name: 'Rapira', url: 'https://rapira.net/ru/exchange/USDT_RUB' });
  if (!sources[1].id) Object.assign(sources[1], { id: 'bc_smr', name: 'BestChange', city: 'Самара', url: 'https://www.bestchange.net/tether-trc20-to-cash-ruble-in-smr.html' });
  if (!sources[2].id) Object.assign(sources[2], { id: 'bc_msk', name: 'BestChange', city: 'Москва', url: 'https://www.bestchange.net/tether-trc20-to-cash-ruble-in-msk.html' });
  if (!sources[3].id) Object.assign(sources[3], { id: 'zoex', name: 'ZOEX', city: 'Самара', url: 'https://zoex.ru/' });

  return { updatedAt: new Date().toISOString(), ttl: TTL / 1000, pair: 'USDT/RUB', sources };
}

function getAll({ force = false } = {}) {
  if (!force && cache.promise && Date.now() - cache.at < TTL) return cache.promise;
  cache = { at: Date.now(), promise: collect() };
  return cache.promise;
}

module.exports = { getAll };
