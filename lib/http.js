'use strict';

// Общие HTTP-утилиты: таймаут, браузерный User-Agent, ретраи.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

async function request(url, { method = 'GET', headers = {}, body, timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method,
      body,
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept-Language': 'ru-RU,ru;q=0.9', ...headers },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} от ${new URL(url).host}`);
    return res;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Таймаут ${timeout / 1000} c: ${new URL(url).host}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function getJson(url, opts) {
  const res = await request(url, { ...opts, headers: { Accept: 'application/json', ...(opts && opts.headers) } });
  return res.json();
}

async function getBuffer(url, opts) {
  const res = await request(url, opts);
  return Buffer.from(await res.arrayBuffer());
}

async function getText(url, opts) {
  const res = await request(url, opts);
  return res.text();
}

// Пробует URL по очереди, возвращает первый успешный результат.
async function firstOk(urls, fn) {
  const errors = [];
  for (const u of urls) {
    try {
      return await fn(u);
    } catch (e) {
      errors.push(`${u}: ${e.message}`);
    }
  }
  throw new Error(errors.join(' | '));
}

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\s| /g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

module.exports = { request, getJson, getBuffer, getText, firstOk, num };
