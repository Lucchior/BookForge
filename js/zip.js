/* BookForge Web — lettura e scrittura ZIP senza librerie (per EPUB e DOCX).
   Lettura: usa DecompressionStream('deflate-raw') del browser (Safari 16.4+, Chrome, Edge, Firefox).
   Scrittura: archivio senza compressione (sufficiente per un EPUB). */
(function () {
  const BF = (window.BF = window.BF || {});
  const MAX_ENTRY = 120 * 1024 * 1024; // difesa da "zip bomb": limite per singolo file
  const MAX_TOTAL = 500 * 1024 * 1024;

  async function inflateRaw(u8) {
    if (typeof DecompressionStream === 'undefined')
      throw new Error('Il browser è troppo vecchio per aprire questo file: aggiorna Safari/Chrome.');
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([u8]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /** Apre uno zip. Ritorna { names:[], has(n), read(n)->Uint8Array, text(n)->string }. */
  BF.zipOpen = async function (buf) {
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Il file non è un archivio ZIP valido (EPUB/DOCX danneggiato?).');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const entries = new Map();
    let total = 0;
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const usize = dv.getUint32(p + 24, true);
      const nlen = dv.getUint16(p + 28, true);
      const elen = dv.getUint16(p + 30, true);
      const clen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      let name = new TextDecoder('utf-8').decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + elen + clen;
      if (name.endsWith('/')) continue;
      // niente percorsi che escono dalla cartella (non scriviamo mai su disco, ma meglio normalizzare)
      name = name.replace(/\\/g, '/').replace(/^\/+/, '');
      total += usize;
      if (usize > MAX_ENTRY || total > MAX_TOTAL) throw new Error('Archivio troppo grande o sospetto: rifiutato.');
      entries.set(name, { method, csize, usize, off });
    }
    const lower = new Map();
    entries.forEach((_, k) => lower.set(k.toLowerCase(), k));
    const resolve = (n) => (entries.has(n) ? n : lower.get(String(n).toLowerCase()));
    return {
      names: Array.from(entries.keys()),
      has: (n) => !!resolve(n),
      async read(n) {
        const key = resolve(n);
        if (!key) throw new Error('File mancante nell\'archivio: ' + n);
        const e = entries.get(key);
        if (dv.getUint32(e.off, true) !== 0x04034b50) throw new Error('Archivio danneggiato.');
        const start = e.off + 30 + dv.getUint16(e.off + 26, true) + dv.getUint16(e.off + 28, true);
        const raw = u8.subarray(start, start + e.csize);
        if (e.method === 0) return raw;
        if (e.method === 8) return inflateRaw(raw);
        throw new Error('Compressione ZIP non supportata (metodo ' + e.method + ').');
      },
      async text(n) {
        return BF.fromUtf8(await this.read(n)).replace(/^﻿/, '');
      },
    };
  };

  /** Scrive uno zip senza compressione. files: [{name, data:Uint8Array|string}] */
  BF.zipWrite = function (files) {
    const parts = [];
    const central = [];
    let offset = 0;
    const now = new Date();
    const dtime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const ddate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const f of files) {
      const name = BF.utf8(f.name);
      const data = typeof f.data === 'string' ? BF.utf8(f.data) : f.data;
      const crc = BF.crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true); // nomi in UTF-8
      lh.setUint16(8, 0, true);
      lh.setUint16(10, dtime, true);
      lh.setUint16(12, ddate, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(12, dtime, true);
      ch.setUint16(14, ddate, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const csize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, csize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  };
})();
