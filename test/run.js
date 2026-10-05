'use strict';

// Офлайн-тесты парсеров и агрегатора на синтетических данных (fetch подменяется).
// Запуск: npm test
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const fx = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n));
let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (e) { console.error('  ✗', name, '\n   ', e.message); process.exitCode = 1; }
};

(async () => {
  const bc = require('../lib/sources/bestchange');
  const rapira = require('../lib/sources/rapira');

  await test('info.zip: валюты, город, направления', () => {
    const info = bc.parseInfo(fx('info.zip'));
    assert.deepStrictEqual(bc.resolveIds(info), { usdt: '10', cash: '91' });
    const sell = bc.finalize(bc.rowsFromInfo(info, 'sell', '105'), 'sell');
    assert.strictEqual(sell.length, 4);
    assert.strictEqual(sell[0].name, 'City-Exchange');
    assert.strictEqual(sell[0].rate, 87.7858);
    assert.strictEqual(sell[0].min, 25000);
    const buy = bc.finalize(bc.rowsFromInfo(info, 'buy', '105'), 'buy');
    assert.strictEqual(buy[0].name, 'Zoex'); // меньше рублей за 1 USDT — лучше
    assert.strictEqual(buy[0].rate, 89.18);
  });

  await test('HTML-фолбэк BestChange', () => {
    const rows = bc.finalize(bc.parseHtml(fx('bc_sell.html').toString(), 'sell'), 'sell');
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].name, 'City-Exchange');
    assert.strictEqual(rows[0].rate, 87.7858);
    assert.strictEqual(rows[0].min, 25000);
    assert.strictEqual(rows[0].max, 500000);
    assert.strictEqual(rows[1].reserve, 5515300);
  });

  await test('Rapira: тикер и стакан', () => {
    const t = rapira.parseTicker(rapira.pickTicker({ data: [
      { symbol: 'BTC/USDT', close: 60000 },
      { symbol: 'USDT/RUB', open: 86.9, close: 88.13, bidPrice: 88.12, askPrice: 88.13 },
    ] }));
    assert.strictEqual(t.last, 88.13);
    assert.strictEqual(t.bid, 88.12);
    assert.ok(Math.abs(t.changePct - 1.4154) < 0.001);
    const d = rapira.parseDepth({ ask: { items: [{ price: 88.5 }, { price: 88.13 }] }, bid: { items: [{ price: 88.12 }, { price: 88.0 }] } });
    assert.deepStrictEqual(d, { ask: 88.13, bid: 88.12 });
  });

  await test('Агрегатор: все 4 источника с подменённым fetch', async () => {
    global.fetch = async (url) => {
      const u = String(url);
      const ok = (body, type) => ({
        ok: true, status: 200,
        json: async () => JSON.parse(body), text: async () => body,
        arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
      });
      if (u.includes('api.rapira.net/open')) return ok(JSON.stringify({ data: [{ symbol: 'USDT/RUB', open: 86.9, close: 88.13, bidPrice: 88.12, askPrice: 88.13 }] }));
      if (u.includes('info.zip')) return ok(fx('info.zip'));
      return { ok: false, status: 404 };
    };
    const { getAll } = require('../lib/aggregate');
    const data = await getAll({ force: true });
    const by = Object.fromEntries(data.sources.map((s) => [s.id, s]));
    assert.ok(by.rapira.ok && by.bc_smr.ok && by.bc_msk.ok && by.zoex.ok, JSON.stringify(data.sources.map((s) => s.error)));
    assert.strictEqual(by.rapira.sell.best.rate, 88.12);
    assert.strictEqual(by.bc_smr.sell.best.rate, 87.7858);
    assert.strictEqual(by.bc_msk.buy.best.rate, 88.9);
    assert.strictEqual(by.zoex.sell.best.rate, 87.61);
    assert.strictEqual(by.zoex.sell.best.rank, 4);
    assert.strictEqual(by.zoex.city, 'Самара');
    assert.ok(!('_all' in by.bc_smr), 'служебные поля не должны уходить наружу');
  });

  console.log(`\n${passed} тестов пройдено`);
})();
