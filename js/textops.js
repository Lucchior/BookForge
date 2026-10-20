/* BookForge Web — operazioni sul testo: pulizia tipografica, cerca/sostituisci, capitoli (unisci, dividi...). */
(function () {
  const BF = (window.BF = window.BF || {});

  // ------------------------------------------------------------------ percorso dei nodi di testo di un capitolo
  function textNodes(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const out = [];
    let n;
    while ((n = w.nextNode())) out.push(n);
    return out;
  }
  const blockOf = (n) => {
    while (n.parentNode && !/^(P|H[1-6]|LI|BLOCKQUOTE|TD|TH|PRE)$/.test(n.parentNode.nodeName)) n = n.parentNode;
    return n.parentNode;
  };

  /** Pulizia tipografica. ops: {spaces, ellipsis, dashes:'none'|'en'|'em', quotes:'none'|'curly'|'guillemets'|'german'} */
  BF.cleanHtml = function (html, ops) {
    const t = document.createElement('template');
    t.innerHTML = html;
    const OPEN = { curly: ['“', '”'], guillemets: ['«', '»'], german: ['„', '“'] }[ops.quotes];
    let prevBlock = null, prevChar = '';
    for (const n of textNodes(t.content)) {
      let s = n.nodeValue;
      const blk = blockOf(n);
      if (blk !== prevBlock) { prevBlock = blk; prevChar = ''; }
      if (ops.spaces) {
        s = s.replace(/[ \t ]{2,}/g, ' ').replace(/ +([,.;:!?…»”])/g, '$1');
        if (!prevChar || /\s/.test(prevChar)) s = s.replace(/^\s+/, '');
      }
      if (ops.ellipsis) s = s.replace(/\.{3,}/g, '…');
      if (ops.dashes === 'en') s = s.replace(/(^|\s)(-{1,2}|—)(?=\s|$)/g, '$1–');
      else if (ops.dashes === 'em') s = s.replace(/(^|\s)(-{1,2}|–)(?=\s|$)/g, '$1—');
      if (OPEN || ops.apostrophe) {
        let r = '';
        for (let i = 0; i < s.length; i++) {
          const c = s[i];
          const before = i ? s[i - 1] : prevChar;
          const after = s[i + 1] || '';
          if (c === '"' && OPEN) r += !before || /[\s(\[{—–‘‘]/.test(before) ? OPEN[0] : OPEN[1];
          else if (c === "'" && (OPEN || ops.apostrophe)) {
            if (/[\p{L}\p{N}]/u.test(before) && /[\p{L}\p{N}]/u.test(after)) r += '’';
            else if (!before || /[\s(\[{—–“„«]/.test(before)) r += after && /[\p{L}]/u.test(after) && !/\s/.test(after) ? '‘' : '’';
            else r += '’';
          } else r += c;
        }
        s = r;
      }
      n.nodeValue = s;
      prevChar = s.slice(-1) || prevChar;
    }
    return t.innerHTML;
  };

  /** Cerca e sostituisci nel testo. Ritorna { html, count }. */
  BF.replaceInHtml = function (html, find, repl, o) {
    const t = document.createElement('template');
    t.innerHTML = html;
    let re;
    try {
      re = new RegExp(o.regex ? find : find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g' + (o.caseSens ? '' : 'i'));
    } catch (e) {
      throw new Error('Espressione regolare non valida.');
    }
    let count = 0;
    for (const n of textNodes(t.content)) {
      n.nodeValue = n.nodeValue.replace(re, (...m) => { count++; return o.regex ? repl.replace(/\$(\d)/g, (_, d) => (typeof m[+d] === 'string' ? m[+d] : '')) : repl; });
    }
    return { html: t.innerHTML, count };
  };

  BF.countInHtml = function (html, find, o) {
    const t = document.createElement('template');
    t.innerHTML = html;
    let re;
    try { re = new RegExp(o.regex ? find : find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g' + (o.caseSens ? '' : 'i')); } catch (e) { return 0; }
    return textNodes(t.content).reduce((a, n) => a + (n.nodeValue.match(re) || []).length, 0);
  };

  // ------------------------------------------------------------------ capitoli
  BF.chapters = {
    move(book, i, d) {
      const j = i + d;
      if (j < 0 || j >= book.chapters.length) return false;
      const [c] = book.chapters.splice(i, 1);
      book.chapters.splice(j, 0, c);
      return true;
    },
    remove(book, i) {
      if (book.chapters[i] && book.chapters[i].kind === 'toc') return false;
      book.chapters.splice(i, 1);
      return true;
    },
    mergeNext(book, i) {
      const a = book.chapters[i], b = book.chapters[i + 1];
      if (!a || !b || a.kind === 'toc' || b.kind === 'toc') return false;
      a.html += (b.title ? '<h2>' + BF.esc(b.title) + '</h2>' : '') + b.html;
      book.chapters.splice(i + 1, 1);
      return true;
    },
    add(book, i) {
      const c = { id: BF.uid(), title: 'Nuovo capitolo', html: '<p></p>', include: true, kind: 'chapter', inToc: true, showTitle: false };
      book.chapters.splice(i + 1, 0, c);
      return c;
    },
    /** Divide il capitolo i nel punto (indice del blocco) blockIndex: i blocchi da lì in poi diventano un nuovo capitolo. */
    splitAt(book, i, blockIndex, title) {
      const c = book.chapters[i];
      if (!c || c.kind === 'toc') return false;
      const t = document.createElement('template');
      t.innerHTML = c.html;
      const blocks = Array.from(t.content.children);
      if (blockIndex <= 0 || blockIndex >= blocks.length) return false;
      const tail = blocks.slice(blockIndex);
      const head = document.createElement('div');
      blocks.slice(0, blockIndex).forEach((b) => head.appendChild(b.cloneNode(true)));
      const rest = document.createElement('div');
      tail.forEach((b) => rest.appendChild(b.cloneNode(true)));
      c.html = head.innerHTML;
      book.chapters.splice(i + 1, 0, { id: BF.uid(), title: title || 'Nuovo capitolo', html: rest.innerHTML, include: true, kind: 'chapter', inToc: true, showTitle: false });
      return true;
    },
  };
})();

/* ---- indice e tipi di capitolo ---- */
(function () {
  const BF = window.BF;

  /** Capitoli veri (esclude la voce speciale "Indice"). */
  BF.realChapters = (book, onlyIncluded) => book.chapters.filter((c) => c.kind !== 'toc' && (!onlyIncluded || c.include));

  /** Riconosce dediche, copyright, frontespizi: pagine iniziali che non vanno nell'indice. */
  const FRONT_RE = /(dedic|epigraf|copyright|colophon|frontespizio|title\s*-?page|titlepage|half\s*-?title|presentazione|dedication|epigraph|all rights|diritti riservati|^\s*(cover|copertina)\b)/i;
  BF.autoKind = function (title, html) {
    const words = BF.wordCount(html);
    if (FRONT_RE.test(title || '') && words < 400) return { kind: 'front', inToc: false };
    return { kind: 'chapter', inToc: true };
  };

  /** Garantisce che esista la voce "Indice" nell'elenco (di default dopo le pagine iniziali). */
  BF.ensureToc = function (book, includeDefault) {
    book.chapters.forEach((c) => {
      if (!c.kind) Object.assign(c, { kind: 'chapter' });
      if (c.kind !== 'toc' && c.inToc === undefined) c.inToc = true;
      if (c.showTitle === undefined) c.showTitle = false;
    });
    if (book.chapters.some((c) => c.kind === 'toc')) return book;
    let i = 0;
    while (i < book.chapters.length && (book.chapters[i].kind === 'front' || book.chapters[i].inToc === false || !book.chapters[i].include)) i++;
    book.chapters.splice(i, 0, { id: BF.uid(), title: 'Indice', html: '', include: includeDefault !== false, kind: 'toc', inToc: false, showTitle: false });
    return book;
  };
})();
