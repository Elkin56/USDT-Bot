'use strict';

// GET /api/rates — курсы USDT/RUB со всех источников (Vercel serverless и локальный сервер)
const { getAll } = require('../lib/aggregate');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
  try {
    const force = /[?&]force=1/.test(req.url || '');
    const data = await getAll({ force });
    res.statusCode = 200;
    res.end(JSON.stringify(data));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
};
