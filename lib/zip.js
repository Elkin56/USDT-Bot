'use strict';

// Минимальный распаковщик ZIP без зависимостей (store + deflate).
// Достаточно для info.zip BestChange. Файлы распаковываются лениво.
const zlib = require('zlib');

function readZip(buf) {
  let eocd = -1;
  const stop = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= stop; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP повреждён: не найден конец архива');

  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = {};

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('ZIP повреждён: неверная запись каталога');
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const nlen = buf.readUInt16LE(off + 28);
    const xlen = buf.readUInt16LE(off + 30);
    const clen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    const name = buf.subarray(off + 46, off + 46 + nlen).toString('latin1');

    entries[name] = () => {
      const lnlen = buf.readUInt16LE(lho + 26);
      const lxlen = buf.readUInt16LE(lho + 28);
      const start = lho + 30 + lnlen + lxlen;
      const data = buf.subarray(start, start + csize);
      if (method === 0) return data;
      if (method === 8) return zlib.inflateRawSync(data);
      throw new Error(`ZIP: метод сжатия ${method} не поддерживается`);
    };
    off += 46 + nlen + xlen + clen;
  }
  return entries;
}

module.exports = { readZip };
