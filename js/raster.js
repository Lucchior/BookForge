/* BookForge Web — salvataggio diretto di copertina e guida in PNG o PDF (immagine ad alta risoluzione), senza finestra di stampa. */
(function () {
  const BF = (window.BF = window.BF || {});
  const MAXSIDE = 16000, MAXPIX = 200e6;

  const loadImg = (url) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Immagine non leggibile.'));
    im.src = url;
  });
  const toBlob = (canvas, type, q) => new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Immagine troppo grande per il browser: scegli una risoluzione più bassa.'))), type, q));

  /** Disegna copertina o guida su un canvas alla risoluzione dpi. Ritorna {canvas, wMm, hMm}. */
  BF.rasterCase = async function (kind, book, S, C, total, dpi) {
    const r = (kind === 'guide' ? BF.renderGuide : BF.renderCase)(book, S, C, total);
    const d = r.dims;
    const k = dpi / 25.4;
    const w = Math.round(d.pageW * k), h = Math.round(d.pageH * k);
    if (w > MAXSIDE || h > MAXSIDE || w * h > MAXPIX) throw new Error(`A ${dpi} dpi l'immagine sarebbe ${w} × ${h} px: troppo grande. Scegli una risoluzione più bassa.`);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.save();
    if (kind === 'guide' && C.guideMirror) { g.translate(w, 0); g.scale(-1, 1); }
    if (kind !== 'guide') {
      const o = d.M;
      g.fillStyle = book.ownCover ? '#fff' : '#f3efe6';
      g.fillRect(o * k, o * k, d.W * k, d.H * k);
      if (book.ownCover) {
        const im = await loadImg(book.ownCover);
        const rc = BF.caseImageRect(C, d);
        let x = (o + rc.x) * k, y = (o + rc.y) * k, bw = rc.w * k, bh = rc.h * k;
        g.save();
        g.beginPath(); g.rect(o * k, o * k, d.W * k, d.H * k); g.clip();
        if (C.ownFit === 'cover' || C.ownFit === 'contain') {
          const s = (C.ownFit === 'cover' ? Math.max : Math.min)(bw / im.naturalWidth, bh / im.naturalHeight);
          const iw = im.naturalWidth * s, ih = im.naturalHeight * s;
          g.beginPath(); g.rect(x, y, bw, bh); g.clip();
          g.drawImage(im, x + (bw - iw) / 2, y + (bh - ih) / 2, iw, ih);
        } else g.drawImage(im, x, y, bw, bh);
        g.restore();
      }
    }
    // segni, quote, testi: sono già un SVG
    const svg = r.el.querySelector('svg');
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.removeAttribute('style');
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
    try { g.drawImage(await loadImg(url), 0, 0, w, h); } finally { URL.revokeObjectURL(url); }
    g.restore();
    return { canvas: cv, wMm: d.pageW, hMm: d.pageH };
  };

  const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);

  /** PNG con la risoluzione (dpi) scritta nel file: i programmi lo aprono già alla misura giusta. */
  BF.pngBlob = async function (canvas, dpi) {
    const src = new Uint8Array(await (await toBlob(canvas, 'image/png')).arrayBuffer());
    const ppm = Math.round(dpi / 0.0254);
    const type = BF.utf8('pHYs');
    const data = new Uint8Array(9);
    data.set(u32(ppm), 0); data.set(u32(ppm), 4); data[8] = 1;
    const td = new Uint8Array(13); td.set(type, 0); td.set(data, 4);
    const chunk = new Uint8Array(21);
    chunk.set(u32(9), 0); chunk.set(td, 4); chunk.set(u32(BF.crc32(td)), 17);
    const at = 33; // dopo la firma (8) e il blocco IHDR (25)
    const out = new Uint8Array(src.length + 21);
    out.set(src.subarray(0, at), 0); out.set(chunk, at); out.set(src.subarray(at), at + 21);
    return new Blob([out], { type: 'image/png' });
  };

  /** PDF di una pagina, grande esattamente wMm × hMm, con l'immagine a tutta pagina. */
  BF.pdfBlob = async function (canvas, wMm, hMm) {
    const jpg = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.97)).arrayBuffer());
    const wp = (wMm * 72 / 25.4).toFixed(2), hp = (hMm * 72 / 25.4).toFixed(2);
    const parts = [];
    const offs = [];
    let len = 0;
    const add = (x) => { const u = typeof x === 'string' ? BF.utf8(x) : x; parts.push(u); len += u.length; };
    const obj = (n, body) => { offs[n] = len; add(n + ' 0 obj\n'); add(body); add('\nendobj\n'); };
    add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wp} ${hp}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    offs[4] = len;
    add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
    add(jpg); add('\nendstream\nendobj\n');
    const content = `q ${wp} 0 0 ${hp} 0 0 cm /Im0 Do Q`;
    obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const xref = len;
    let x = 'xref\n0 6\n0000000000 65535 f \n';
    for (let i = 1; i <= 5; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    add(x + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  };
})();
