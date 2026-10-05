'use strict';

// ZOEX (zoex.ru) — наличный обменник в Самаре.
// Сайт подгружает курс скриптом и открытого API не публикует, но ZOEX стоит
// в мониторинге BestChange. Поэтому курс ZOEX берём из тех же данных BestChange
// (Самара, затем Москва) — это ровно те цифры, что ZOEX отдаёт в мониторинг.
const NAME_RE = new RegExp(process.env.ZOEX_NAME || 'zoex', 'i');

function findIn(list) {
  const row = (list || []).find((r) => NAME_RE.test(r.name));
  return row ? { ...row, of: list.length } : null;
}

function getZoex(bcSources) {
  for (const bc of bcSources) {
    if (!bc || !bc._all) continue;
    const sell = findIn(bc._all.sell);
    const buy = findIn(bc._all.buy);
    if (sell || buy) {
      return {
        id: 'zoex',
        name: 'ZOEX',
        kind: 'exchanger',
        city: bc.city,
        label: `Обменник · ${bc.city}`,
        via: `BestChange (${bc.via})`,
        url: 'https://zoex.ru/',
        sell: { best: sell },
        buy: { best: buy },
      };
    }
  }
  const tried = bcSources.filter((b) => b && b._all).map((b) => b.city).join(', ');
  throw new Error(
    tried
      ? `ZOEX сейчас не выставил курс на BestChange (${tried}). Обычно это вне часов работы офиса, 11:00–19:00`
      : 'Нет данных BestChange, поэтому курс ZOEX получить не удалось'
  );
}

module.exports = { getZoex };
