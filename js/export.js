/* BookForge Web — salvataggio del progetto e esportazione in TXT, HTML ed EPUB. */
(function () {
  const BF = (window.BF = window.BF || {});
  const { esc } = BF;

  BF.projectToJson = function (state, opts) {
    const book = opts && opts.noOwnCover ? Object.assign({}, state.book, { ownCover: null }) : state.book;
    return JSON.stringify({ format: 'bookforge-web', version: 1, book, settings: state.S, binding: state.B, cover: state.C }, null, 0);
  };

  /** Legge un progetto. Valida e rende sicuro l'HTML (anche se il file è stato modificato a mano). */
  BF.projectFromJson = function (text) {
    let d;
    try { d = JSON.parse(text); } catch (e) { throw new Error('Il file di progetto non è leggibile.'); }
    if (!d || d.format !== 'bookforge-web' || !d.book || !Array.isArray(d.book.chapters)) throw new Error('Questo non è un progetto BookForge Web.');
    const book = {
      title: String(d.book.title || ''), author: String(d.book.author || ''), language: String(d.book.language || 'it').slice(0, 5),
      cover: typeof d.book.cover === 'string' && /^data:image\//.test(d.book.cover) ? d.book.cover : null,
      ownCover: typeof d.book.ownCover === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,/.test(d.book.ownCover) ? d.book.ownCover : null,
      chapters: d.book.chapters.map((c) => ({
        id: BF.uid(), title: String(c.title || ''), html: c.kind === 'toc' ? '' : BF.sanitizeHtml(c.html || ''), include: c.include !== false,
        kind: c.kind === 'toc' || c.kind === 'front' ? c.kind : 'chapter', inToc: c.inToc !== false, showTitle: !!c.showTitle,
      })),
    };
    BF.ensureToc(book, (d.settings && d.settings.toc) !== false);
    const pick = (src, def) => {
      const o = Object.assign({}, def);
      for (const k in def) if (src && typeof src[k] === typeof def[k]) o[k] = src[k];
      return o;
    };
    return { book, S: pick(d.settings, BF.DEFAULTS), B: pick(d.binding, BF.DEFAULT_BINDING), C: pick(d.cover, BF.DEFAULT_COVER) };
  };

  BF.exportTxt = function (book) {
    const parts = [book.title, book.author ? 'di ' + book.author : '', ''];
    BF.realChapters(book, true).forEach((c) => {
      parts.push('', c.title.toUpperCase(), '', BF.htmlToText(c.html));
    });
    return new Blob([parts.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
  };

  BF.exportHtml = function (book) {
    const body = BF.realChapters(book, true).map((c) => '<section><h1>' + esc(c.title) + '</h1>' + c.html + '</section>').join('\n');
    const html =
      '<!doctype html><html lang="' + esc(book.language || 'it') + '"><head><meta charset="utf-8"><title>' + esc(book.title) + '</title>' +
      '<style>body{max-width:38em;margin:2em auto;padding:0 1em;font:1.1em/1.5 Georgia,serif}h1{text-align:center;margin-top:3em}p{margin:0;text-indent:1.2em}p.c{text-align:center;text-indent:0}h1+p,hr+p{text-indent:0}hr{border:0;text-align:center;margin:1em}hr::before{content:"* * *"}img{max-width:100%}</style></head><body><h1 style="font-size:2.2em">' +
      esc(book.title) + '</h1><p class="c">' + esc(book.author) + '</p>\n' + body + '\n</body></html>';
    return new Blob([html], { type: 'text/html;charset=utf-8' });
  };

  function dataUrlToBytes(url) {
    const m = url.match(/^data:([^;,]+);base64,(.*)$/s);
    if (!m) return null;
    const bin = atob(m[2].replace(/\s+/g, ''));
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return { mime: m[1], data: u8 };
  }

  BF.exportEpub = function (book) {
    const files = [];
    const imgs = [];
    const extFor = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
    const addImg = (url) => {
      const b = dataUrlToBytes(url);
      if (!b || !extFor[b.mime]) return null;
      const name = 'images/img' + (imgs.length + 1) + '.' + extFor[b.mime];
      imgs.push({ name, mime: b.mime, data: b.data });
      return name;
    };
    const chs = BF.realChapters(book, true);
    const xhtmlDocs = chs.map((c, i) => {
      const t = document.createElement('template');
      t.innerHTML = c.html;
      t.content.querySelectorAll('img').forEach((im) => {
        const n = addImg(im.getAttribute('src') || '');
        if (n) im.setAttribute('src', '../' + n); else im.remove();
      });
      const wrap = document.createElement('div');
      wrap.appendChild(t.content.cloneNode(true));
      // serializza come XHTML ben formato
      const xml = new XMLSerializer().serializeToString(new DOMParser().parseFromString('<div xmlns="http://www.w3.org/1999/xhtml">' + wrap.innerHTML.replace(/&nbsp;/g, '&#160;') + '</div>', 'text/html').body.firstChild);
      return {
        name: 'text/ch' + (i + 1) + '.xhtml',
        title: c.title,
        data:
          '<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="' + esc(book.language || 'it') + '"><head><meta charset="utf-8"/><title>' + esc(c.title) +
          '</title><link rel="stylesheet" type="text/css" href="../style.css"/></head><body><h1>' + esc(c.title) + '</h1>' + xml.replace(/^<div[^>]*>/, '<div>') + '</body></html>',
      };
    });
    let coverName = null;
    if (book.cover) coverName = addImg(book.cover);
    const id = 'urn:uuid:' + (crypto.randomUUID ? crypto.randomUUID() : BF.uid() + BF.uid());
    const css = 'body{font-family:serif;line-height:1.4}h1{text-align:center;margin:2em 0 1em}p{margin:0;text-indent:1.2em;text-align:justify}h1+p,hr+p,h2+p{text-indent:0}p.c{text-align:center;text-indent:0}p.r{text-align:right;text-indent:0}hr{border:0;margin:1em 0;text-align:center}hr:after{content:"* * *"}img{max-width:100%}blockquote{margin:1em 2em}';
    const manifest =
      '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>' +
      xhtmlDocs.map((d, i) => `<item id="c${i + 1}" href="${d.name}" media-type="application/xhtml+xml"/>`).join('') +
      imgs.map((im, i) => `<item id="i${i + 1}" href="${im.name}" media-type="${im.mime}"${coverName && im.name === coverName ? ' properties="cover-image"' : ''}/>`).join('');
    const opf =
      '<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' +
      `<dc:identifier id="bid">${id}</dc:identifier><dc:title>${esc(book.title)}</dc:title><dc:language>${esc(book.language || 'it')}</dc:language>` +
      (book.author ? `<dc:creator>${esc(book.author)}</dc:creator>` : '') +
      `<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest>${manifest}</manifest><spine>` +
      xhtmlDocs.map((_, i) => `<itemref idref="c${i + 1}"/>`).join('') + '</spine></package>';
    const nav =
      '<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><meta charset="utf-8"/><title>Indice</title></head><body><nav epub:type="toc"><h1>Indice</h1><ol>' +
      xhtmlDocs.map((d) => `<li><a href="${d.name}">${esc(d.title)}</a></li>`).join('') + '</ol></nav></body></html>';
    files.push({ name: 'mimetype', data: 'application/epub+zip' });
    files.push({ name: 'META-INF/container.xml', data: '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>' });
    files.push({ name: 'OEBPS/content.opf', data: opf }, { name: 'OEBPS/nav.xhtml', data: nav }, { name: 'OEBPS/style.css', data: css });
    xhtmlDocs.forEach((d) => files.push({ name: 'OEBPS/' + d.name, data: d.data }));
    imgs.forEach((im) => files.push({ name: 'OEBPS/' + im.name, data: im.data }));
    const blob = BF.zipWrite(files);
    return new Blob([blob], { type: 'application/epub+zip' });
  };
})();
