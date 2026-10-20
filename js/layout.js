/* BookForge Web — motore di impaginazione.
   Idea: ogni capitolo viene composto in un contenitore a colonne CSS alto quanto l'area di testo e largo una colonna per pagina.
   Il numero di colonne = numero di pagine. Per disegnare la pagina i basta mostrare la colonna i (traslazione + ritaglio).
   Anteprima e stampa usano lo stesso identico flusso, quindi "quello che vedi è quello che stampi". */
(function () {
  const BF = (window.BF = window.BF || {});
  const { esc } = BF;

  let holder = null;
  function getHolder(S) {
    if (!holder) {
      holder = BF.el('div', { id: 'bk-measure', class: 'bk-scope', 'aria-hidden': 'true' });
      holder.style.cssText = 'position:fixed;left:-30000px;top:0;visibility:hidden;pointer-events:none;';
      document.body.appendChild(holder);
    }
    holder.innerHTML = '';
    BF.applyVars(holder, S);
    return holder;
  }

  async function loadFonts(S) {
    const names = new Set([BF.fontFaceName(S.font), BF.fontFaceName(S.headFont === 'same' ? S.font : S.headFont)]);
    const tasks = [];
    names.forEach((n) => {
      if (!n) return;
      ['400', 'italic 400', '700', 'italic 700'].forEach((v) => tasks.push(document.fonts.load(v + ' 12pt "' + n + '"').catch(() => {})));
    });
    await Promise.all(tasks);
    try { await document.fonts.ready; } catch (e) { /* ok */ }
  }

  async function makeFlow(html, host) {
    const f = BF.el('div', { class: 'bk-flow' });
    f.innerHTML = html;
    host.appendChild(f);
    const imgs = Array.from(f.querySelectorAll('img'));
    await Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : null)));
    void f.offsetWidth;
    const w = f.getBoundingClientRect().width || 1;
    const pages = Math.max(1, Math.round(f.scrollWidth / w));
    return { tpl: f, pages };
  }

  function chapterHtml(ch, S) {
    const orn = S.ornament ? '<div class="ch-orn">' + esc(S.ornamentGlyph) + '</div>' : '';
    return '<div class="ch-head"><h1 class="ch-title">' + esc(ch.title) + '</h1>' + orn + '</div>' + ch.html;
  }

  function tocHtml(entries, S) {
    return (
      '<div class="toc-head"><h1>' + esc(S.tocTitle || 'Indice') + '</h1></div><ul class="toc">' +
      entries.map((e) => '<li><span class="t">' + esc(e.title) + '</span><span class="d"></span><span class="n">' + e.num + '</span></li>').join('') +
      '</ul>'
    );
  }

  BF.defaultCopyright = function (book) {
    const y = new Date().getFullYear();
    return [book.title, '© ' + y + (book.author ? ' ' + book.author : ''), 'Tutti i diritti riservati.'].filter(Boolean).join('\n');
  };

  /** Impagina il libro. Ritorna { pages:[...], chapters:[{title, page, label}], bodyStart, blanks, total } */
  BF.layout = async function (book, S, opts) {
    opts = opts || {};
    const progress = opts.onProgress || (() => {});
    const host = getHolder(S);
    await loadFonts(S);
    let chs = book.chapters.filter((c) => c.include);
    if (opts.limit) chs = chs.slice(0, opts.limit);
    if (!chs.length) throw new Error('Nessun capitolo selezionato: spunta almeno un capitolo.');

    // 1) ogni capitolo in un flusso a colonne
    const secs = [];
    for (let i = 0; i < chs.length; i++) {
      progress('Impagino il capitolo ' + (i + 1) + ' di ' + chs.length + '…', i / chs.length);
      const f = await makeFlow(chapterHtml(chs[i], S), host);
      secs.push({ title: chs[i].title, tpl: f.tpl, count: f.pages });
      if (i % 4 === 3) await BF.nextFrame();
    }

    // 2) indice: due passate (la prima con numeri "finti" per sapere quante pagine occupa)
    async function buildToc(nums) {
      const f = await makeFlow(tocHtml(chs.map((c, i) => ({ title: c.title, num: nums ? nums[i] : '000' })), S), host);
      return { tpl: f.tpl, count: f.pages };
    }

    function assemble(toc) {
      const seq = [];
      const blank = () => seq.push({ type: 'blank' });
      if (S.titlePage) seq.push({ type: 'title' });
      if (S.copyrightPage) {
        if (seq.length % 2 === 0) blank();
        seq.push({ type: 'copyright' });
      }
      const section = (sec, kind, title) => {
        if (S.chapterRecto && seq.length % 2 === 1) blank();
        const start = seq.length;
        for (let i = 0; i < sec.count; i++) seq.push({ type: 'flow', kind, tpl: sec.tpl, index: i, count: sec.count, title, first: i === 0 });
        return start;
      };
      if (toc) section(toc, 'toc', S.tocTitle);
      const starts = secs.map((s) => section(s, 'chapter', s.title));
      return { seq, starts };
    }

    let toc = null, asm;
    if (S.toc) {
      progress('Preparo l\'indice…', 0.9);
      toc = await buildToc(null);
      for (let k = 0; k < 3; k++) {
        asm = assemble(toc);
        const bodyStart = asm.starts[0];
        const nums = asm.starts.map((st) => String(st - bodyStart + 1));
        const next = await buildToc(nums);
        if (next.count === toc.count) { toc = next; break; }
        toc = next;
      }
      asm = assemble(toc);
    } else asm = assemble(null);

    const bodyStart = asm.starts[0];
    asm.seq.forEach((p, i) => { p.label = i >= bodyStart && p.type === 'flow' ? i - bodyStart + 1 : null; });
    const blanks = asm.seq.filter((p) => p.type === 'blank').length;
    progress('Fatto', 1);
    return {
      pages: asm.seq,
      bodyStart,
      blanks,
      total: asm.seq.length,
      chapters: secs.map((s, i) => ({ title: s.title, page: asm.starts[i], label: asm.starts[i] - bodyStart + 1, count: s.count })),
    };
  };

  // ------------------------------------------------------------------ disegno di una pagina
  /** Crea l'elemento DOM della pagina idx (0 = prima pagina, a destra). */
  BF.renderPage = function (L, idx, S, book) {
    const d = L.pages[idx];
    const recto = S.mirror ? idx % 2 === 0 : true;
    const page = BF.el('div', { class: 'bk-page bk-scope ' + (recto ? 'recto' : 'verso') + (d && d.type === 'blank' ? ' bk-blank' : '') });
    BF.applyVars(page, S);
    if (!d) return page;
    const left = recto ? S.mInner : S.mOuter;
    const dims = BF.pageDims(S);
    const area = (cls) => {
      const e = BF.el('div', { class: cls });
      Object.assign(e.style, { left: left + 'mm', top: S.mTop + 'mm', width: dims.tw + 'mm', height: dims.th + 'mm' });
      return e;
    };

    if (d.type === 'title') {
      const t = area('bk-title-page');
      t.innerHTML =
        '<h1>' + esc(book.title || 'Senza titolo') + '</h1>' +
        (S.ornament ? '<div class="orn">' + esc(S.ornamentGlyph) + '</div>' : '<div class="orn"></div>') +
        (book.author ? '<div class="by">' + esc(book.author) + '</div>' : '');
      t.style.paddingBottom = '12%';
      page.appendChild(t);
    } else if (d.type === 'copyright') {
      const t = area('bk-copy-page');
      t.textContent = (S.copyrightText && S.copyrightText.trim()) || BF.defaultCopyright(book);
      page.appendChild(t);
    } else if (d.type === 'flow') {
      const box = area('bk-text');
      const clone = d.tpl.cloneNode(true);
      clone.style.transform = 'translateX(-' + d.index * 100 + '%)';
      box.appendChild(clone);
      page.appendChild(box);
    }

    // intestazione e numero di pagina
    const num = d.label != null ? String(d.label) : null;
    const showHead = S.headers && d.type === 'flow' && d.kind === 'chapter' && !d.first;
    const numTop = num && S.pageNum === 'top-outer';
    if (showHead || numTop) {
      const head = BF.el('div', { class: 'bk-head' });
      const txt = recto ? d.title : S.headerVerso === 'author' ? book.author || book.title : book.title;
      const sideL = BF.el('span', { class: 'side' }, numTop && !recto ? num : '');
      const sideR = BF.el('span', { class: 'side r' }, numTop && recto ? num : '');
      head.append(sideL, BF.el('span', { class: 'mid' }, showHead ? txt || '' : ''), sideR);
      Object.assign(head.style, { left: left + 'mm', width: dims.tw + 'mm', top: Math.max(4, S.mTop * 0.42 - 1) + 'mm' });
      page.appendChild(head);
    }
    if (num && (S.pageNum === 'bottom-center' || S.pageNum === 'bottom-outer')) {
      const foot = BF.el('div', { class: 'bk-foot' });
      if (S.pageNum === 'bottom-center') foot.appendChild(BF.el('span', { class: 'mid' }, num));
      else foot.append(BF.el('span', { class: 'side' }, recto ? '' : num), BF.el('span', { class: 'mid' }, ''), BF.el('span', { class: 'side r' }, recto ? num : ''));
      Object.assign(foot.style, { left: left + 'mm', width: dims.tw + 'mm', bottom: Math.max(4, S.mBottom * 0.42 - 1) + 'mm' });
      page.appendChild(foot);
    }
    return page;
  };

  /** Pagina bianca vuota (per riempire i fogli). */
  BF.blankPage = function (S) {
    const p = BF.el('div', { class: 'bk-page bk-scope bk-blank' });
    BF.applyVars(p, S);
    return p;
  };
})();
