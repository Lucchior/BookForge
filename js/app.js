/* BookForge Web — logica principale dell'applicazione. */
(function () {
  const BF = (window.BF = window.BF || {});
  const { $, $$, el, esc } = BF;

  const state = {
    book: null,
    S: Object.assign({}, BF.DEFAULTS, BF.store.get('S', {})),
    B: Object.assign({}, BF.DEFAULT_BINDING, BF.store.get('B', {})),
    C: Object.assign({}, BF.DEFAULT_COVER, { frontText: false }, BF.store.get('C', {})),
    layout: null,
    cur: 0, // capitolo selezionato
    dirty: false,
    undo: null,
    tab: 'import',
  };
  BF.app = { state };

  // ------------------------------------------------------------------ attesa
  const busyEl = $('#busy');
  function busy(msg, frac) {
    busyEl.hidden = false;
    $('#busyMsg').textContent = msg || 'Attendi…';
    $('#busyBar').style.width = Math.round((frac || 0) * 100) + '%';
  }
  const unbusy = () => (busyEl.hidden = true);

  // ------------------------------------------------------------------ modifiche
  const saveLookSoon = BF.debounce(() => {
    BF.store.set('S', state.S);
    BF.store.set('B', state.B);
    BF.store.set('C', state.C);
  }, 400);
  const autosaveSoon = BF.debounce(() => {
    if (!state.book) return;
    try {
      const json = BF.projectToJson(state);
      if (json.length < 4500000) BF.store.set('autosave', json);
    } catch (e) { /* ok */ }
  }, 2500);

  function changed(what) {
    state.dirty = true;
    state.layout = null;
    saveLookSoon();
    autosaveSoon();
    void what;
  }

  // ------------------------------------------------------------------ schede
  function showTab(name) {
    if ((name !== 'import') && !state.book) { BF.toast('Prima importa un libro (o prova quello di esempio).'); name = 'import'; }
    state.tab = name;
    $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    $$('.tab').forEach((t) => t.classList.toggle('on', t.id === 'tab-' + name));
    if (name === 'text') renderChapters();
    if (name === 'look') refreshLook();
    if (name === 'preview') refreshPreview();
    if (name === 'bind') refreshBind();
    if (name === 'cover') refreshCover();
    try { history.replaceState(null, '', '#' + name); } catch (e) { /* file:// */ }
  }
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab); });
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-goto]'); if (b) showTab(b.dataset.goto); });

  // ------------------------------------------------------------------ importazione
  async function loadBook(book, keepSettings) {
    state.book = book;
    state.cur = 0;
    state.undo = null;
    if (!keepSettings) {
      state.S.lang = BF.LANGS.some((l) => l[0] === book.language) ? book.language : 'it';
      state.S.copyrightText = '';
      state.S.tocTitle = state.S.lang === 'en' ? 'Contents' : state.S.lang === 'fr' ? 'Table des matières' : state.S.lang === 'de' ? 'Inhalt' : state.S.lang === 'es' ? 'Índice' : 'Indice';
    }
    state.dirty = !keepSettings;
    state.layout = null;
    syncBookInfo();
    showTab('import');
  }

  async function handleFile(file) {
    if (!file) return;
    busy('Leggo «' + file.name + '»…', 0.3);
    try {
      if (/\.(bookforge|json)$/i.test(file.name)) {
        const p = BF.projectFromJson(await file.text());
        Object.assign(state.S, p.S);
        Object.assign(state.B, p.B);
        Object.assign(state.C, p.C);
        await loadBook(p.book, true);
        rebuildForms();
        BF.toast('Progetto aperto.');
      } else {
        const book = await BF.importFile(file);
        await loadBook(book);
        BF.toast('Libro importato: ' + book.chapters.length + ' capitoli.');
      }
    } catch (e) {
      console.error(e);
      BF.toast(e.message || 'Impossibile aprire il file.', 'err');
    } finally {
      unbusy();
    }
  }

  const fileIn = $('#fileIn');
  fileIn.addEventListener('change', () => { handleFile(fileIn.files[0]); fileIn.value = ''; });
  const drop = $('#drop');
  drop.addEventListener('click', (e) => { e.preventDefault(); fileIn.click(); });
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
  // evita che un file lasciato fuori dall'area venga aperto dal browser al posto dell'app
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => { if (!e.target.closest('#drop')) { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); } });

  $('#btnSample').addEventListener('click', () => loadBook(BF.sampleBook()));
  const restoreBtn = $('#btnRestore');
  restoreBtn.hidden = !BF.store.get('autosave', null);
  restoreBtn.addEventListener('click', () => {
    try {
      const p = BF.projectFromJson(BF.store.get('autosave', ''));
      Object.assign(state.S, p.S); Object.assign(state.B, p.B); Object.assign(state.C, p.C);
      loadBook(p.book, true).then(rebuildForms);
    } catch (e) { BF.toast(e.message, 'err'); }
  });

  // dati del libro
  const langSel = $('#bkLang');
  BF.LANGS.forEach((l) => langSel.appendChild(el('option', { value: l[0] }, l[1])));
  function syncBookInfo() {
    const b = state.book;
    $('#bookInfo').hidden = !b;
    if (!b) return;
    $('#bkTitle').value = b.title;
    $('#bkAuthor').value = b.author;
    langSel.value = state.S.lang;
    const th = $('#coverThumb');
    th.innerHTML = '';
    if (b.cover) th.appendChild(el('img', { src: b.cover, alt: 'Copertina' })); else th.textContent = 'nessuna';
    const words = b.chapters.filter((c) => c.include).reduce((a, c) => a + BF.wordCount(c.html), 0);
    $('#bookStats').textContent = `${b.chapters.filter((c) => c.include).length} capitoli inclusi su ${b.chapters.length} · circa ${words.toLocaleString('it-IT')} parole`;
  }
  $('#bkTitle').addEventListener('input', (e) => { state.book.title = e.target.value; changed(); });
  $('#bkAuthor').addEventListener('input', (e) => { state.book.author = e.target.value; changed(); });
  langSel.addEventListener('change', (e) => { state.S.lang = e.target.value; state.book.language = e.target.value; changed(); });

  // esportazioni e progetto
  const fname = (ext) => BF.safeName(state.book.title) + ext;
  $('#expTxt').addEventListener('click', () => BF.download(BF.exportTxt(state.book), fname('.txt')));
  $('#expHtml').addEventListener('click', () => BF.download(BF.exportHtml(state.book), fname('.html')));
  $('#expEpub').addEventListener('click', () => {
    try { BF.download(BF.exportEpub(state.book), fname('.epub')); } catch (e) { BF.toast('Esportazione EPUB non riuscita: ' + e.message, 'err'); }
  });
  $('#btnSave').addEventListener('click', () => {
    if (!state.book) return BF.toast('Non c\'è ancora nessun libro da salvare.');
    flushEditor();
    BF.download(new Blob([BF.projectToJson(state)], { type: 'application/json' }), fname('.bookforge'));
    state.dirty = false;
    BF.toast('Progetto salvato nei download.');
  });
  window.addEventListener('beforeunload', (e) => { if (state.dirty && state.book) { e.preventDefault(); e.returnValue = ''; } });

  // ------------------------------------------------------------------ capitoli ed editor
  const list = $('#chList'), editor = $('#editor');
  let edTimer = null;

  function flushEditor() {
    clearTimeout(edTimer);
    const ch = state.book && state.book.chapters[state.cur];
    if (!ch || $('#edBox').hidden) return;
    const html = BF.sanitizeHtml(editor.innerHTML);
    if (html !== ch.html) { ch.html = html; changed(); }
  }

  function renderChapters() {
    const b = state.book;
    list.innerHTML = '';
    $('#edBox').hidden = !b;
    $('#edEmpty').hidden = !!b;
    if (!b) return;
    $('#chCount').textContent = b.chapters.length + ' totali';
    state.cur = BF.clamp(state.cur, 0, b.chapters.length - 1);
    b.chapters.forEach((c, i) => {
      const words = BF.wordCount(c.html);
      const row = el('li', { class: 'chrow' + (i === state.cur ? ' on' : '') + (c.include ? '' : ' off'), 'data-i': i },
        el('input', { type: 'checkbox', 'aria-label': 'Includi nel libro', checked: c.include, 'data-act': 'inc' }),
        el('span', { class: 'ttl' }, c.title || '(senza titolo)'),
        el('span', { class: 'meta' },
          el('span', null, words.toLocaleString('it-IT') + ' parole'),
          el('span', { class: 'grow' }),
          el('button', { class: 'btn', 'data-act': 'up', title: 'Sposta su', disabled: i === 0 }, '↑'),
          el('button', { class: 'btn', 'data-act': 'down', title: 'Sposta giù', disabled: i === b.chapters.length - 1 }, '↓'),
          el('button', { class: 'btn', 'data-act': 'merge', title: 'Unisci al capitolo successivo', disabled: i === b.chapters.length - 1 }, '⤓'),
          el('button', { class: 'btn', 'data-act': 'del', title: 'Elimina capitolo' }, '✕')));
      list.appendChild(row);
    });
    loadEditor();
  }

  function loadEditor() {
    const ch = state.book.chapters[state.cur];
    $('#edTitle').value = ch ? ch.title : '';
    editor.innerHTML = ch ? ch.html : '';
    editor.scrollTop = 0;
  }

  list.addEventListener('click', (e) => {
    const row = e.target.closest('.chrow');
    if (!row) return;
    flushEditor();
    const i = +row.dataset.i;
    const act = e.target.dataset && e.target.dataset.act;
    const b = state.book;
    if (act === 'inc') { b.chapters[i].include = e.target.checked; changed(); }
    else if (act === 'up') { BF.chapters.move(b, i, -1); state.cur = i - 1; changed(); }
    else if (act === 'down') { BF.chapters.move(b, i, 1); state.cur = i + 1; changed(); }
    else if (act === 'merge') {
      if (confirm('Unire «' + b.chapters[i].title + '» con il capitolo successivo?')) { BF.chapters.mergeNext(b, i); state.cur = i; changed(); }
    } else if (act === 'del') {
      if (confirm('Eliminare il capitolo «' + b.chapters[i].title + '»? (Puoi sempre ricaricare il file originale.)')) { BF.chapters.remove(b, i); state.cur = Math.max(0, i - 1); changed(); }
    } else state.cur = i;
    if (!b.chapters.length) { BF.chapters.add(b, -1); state.cur = 0; }
    renderChapters();
  });

  $('#edTitle').addEventListener('input', (e) => {
    const ch = state.book.chapters[state.cur];
    ch.title = e.target.value;
    const t = list.querySelector('.chrow.on .ttl');
    if (t) t.textContent = ch.title || '(senza titolo)';
    changed();
  });
  editor.addEventListener('input', () => { clearTimeout(edTimer); edTimer = setTimeout(flushEditor, 500); });
  editor.addEventListener('blur', flushEditor);
  editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const cd = e.clipboardData;
    const html = cd.getData('text/html');
    const txt = cd.getData('text/plain');
    const clean = html ? BF.sanitizeHtml(html) : txt.split(/\n\s*\n/).map((p) => '<p>' + esc(p.replace(/\s*\n\s*/g, ' ').trim()) + '</p>').join('');
    document.execCommand('insertHTML', false, clean);
  });
  $('.ed-tools').addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); }); // non perdere il cursore
  $('.ed-tools').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd]');
    if (!b) return;
    editor.focus();
    const c = b.dataset.cmd;
    if (c === 'bold' || c === 'italic' || c === 'undo' || c === 'redo') document.execCommand(c);
    else if (c === 'h2') document.execCommand('formatBlock', false, 'h2');
    else if (c === 'p') document.execCommand('formatBlock', false, 'p');
    else if (c === 'quote') document.execCommand('formatBlock', false, 'blockquote');
    else if (c === 'hr') document.execCommand('insertHorizontalRule');
    flushEditorSoon();
  });
  const flushEditorSoon = () => { clearTimeout(edTimer); edTimer = setTimeout(flushEditor, 300); };

  $('#edSplit').addEventListener('click', () => {
    const sel = getSelection();
    if (!sel.rangeCount || !editor.contains(sel.anchorNode)) return BF.toast('Clicca nel testo, nel punto in cui il nuovo capitolo deve cominciare.');
    let n = sel.anchorNode;
    while (n && n.parentNode !== editor) n = n.parentNode;
    if (!n) return;
    flushEditor();
    // l'indice va calcolato sul testo già ripulito: ripetiamo la pulizia sul contenuto corrente
    const t = document.createElement('template');
    t.innerHTML = BF.sanitizeHtml(editor.innerHTML);
    const pos = Array.from(editor.children).indexOf(n);
    const title = prompt('Titolo del nuovo capitolo:', 'Nuovo capitolo');
    if (title == null) return;
    const blocks = Array.from(editor.children);
    // indice nei blocchi puliti: contiamo i blocchi non vuoti prima della posizione
    let idx = 0;
    for (let i = 0; i < pos; i++) if (blocks[i].textContent.trim() || blocks[i].querySelector('img') || blocks[i].tagName === 'HR') idx++;
    if (BF.chapters.splitAt(state.book, state.cur, idx, title)) { changed(); renderChapters(); BF.toast('Capitolo diviso.'); }
    else BF.toast('Non posso dividere proprio lì: scegli un punto in mezzo al testo.');
  });
  $('#chAdd').addEventListener('click', () => { if (!state.book) return; flushEditor(); BF.chapters.add(state.book, state.cur); state.cur++; changed(); renderChapters(); });

  // pulizia tipografica
  $('#btnClean').addEventListener('click', () => {
    if (!state.book) return;
    flushEditor();
    const q = state.S.lang === 'fr' ? 'guillemets' : state.S.lang === 'de' ? 'german' : state.S.lang === 'it' ? 'guillemets' : 'curly';
    const body = el('div', null,
      el('p', { class: 'fine' }, 'Corregge la tipografia del testo. Puoi annullare subito dopo.'),
      el('div', { class: 'frow check' }, el('input', { type: 'checkbox', id: 'cl1', checked: true }), el('label', { for: 'cl1' }, 'Togli spazi doppi e spazi prima della punteggiatura')),
      el('div', { class: 'frow check' }, el('input', { type: 'checkbox', id: 'cl2', checked: true }), el('label', { for: 'cl2' }, 'Tre puntini → … (puntini di sospensione)')),
      el('div', { class: 'frow check' }, el('input', { type: 'checkbox', id: 'cl3', checked: true }), el('label', { for: 'cl3' }, 'Apostrofi dritti → apostrofo tipografico (’)')),
      el('div', { class: 'frow' }, el('label', { for: 'cl4' }, 'Virgolette doppie'), el('select', { id: 'cl4' },
        [['none', 'Non cambiare'], ['guillemets', '«caporali»'], ['curly', '“inglesi”'], ['german', '„tedesche“']].map((o) => el('option', { value: o[0], selected: o[0] === q }, o[1])))),
      el('div', { class: 'frow' }, el('label', { for: 'cl5' }, 'Trattini di dialogo'), el('select', { id: 'cl5' },
        [['none', 'Non cambiare'], ['en', 'Trattino medio – '], ['em', 'Trattino lungo — ']].map((o) => el('option', { value: o[0] }, o[1])))),
      el('div', { class: 'frow' }, el('label', { for: 'cl6' }, 'Dove'), el('select', { id: 'cl6' }, [['all', 'Tutti i capitoli'], ['one', 'Solo il capitolo aperto']].map((o) => el('option', { value: o[0] }, o[1])))));
    BF.modal('Pulizia tipografica', body, [{ label: 'Annulla' }, { label: 'Applica', primary: true, onclick: () => {
      const ops = { spaces: $('#cl1').checked, ellipsis: $('#cl2').checked, apostrophe: $('#cl3').checked, quotes: $('#cl4').value, dashes: $('#cl5').value };
      const only = $('#cl6').value === 'one';
      state.undo = state.book.chapters.map((c) => c.html);
      state.book.chapters.forEach((c, i) => { if (!only || i === state.cur) c.html = BF.cleanHtml(c.html, ops); });
      $('#btnUndo').disabled = false;
      changed(); renderChapters(); BF.toast('Pulizia applicata.');
    } }]);
  });
  $('#btnUndo').addEventListener('click', () => {
    if (!state.undo) return;
    state.book.chapters.forEach((c, i) => { if (state.undo[i] != null) c.html = state.undo[i]; });
    state.undo = null;
    $('#btnUndo').disabled = true;
    changed(); renderChapters(); BF.toast('Pulizia annullata.');
  });

  // cerca e sostituisci
  $('#btnFind').addEventListener('click', () => {
    if (!state.book) return;
    flushEditor();
    const body = el('div', null,
      el('div', { class: 'frow' }, el('label', { for: 'fr1' }, 'Cerca'), el('input', { id: 'fr1', type: 'text' })),
      el('div', { class: 'frow' }, el('label', { for: 'fr2' }, 'Sostituisci con'), el('input', { id: 'fr2', type: 'text' })),
      el('div', { class: 'frow check' }, el('input', { type: 'checkbox', id: 'fr3' }), el('label', { for: 'fr3' }, 'Espressione regolare')),
      el('div', { class: 'frow check' }, el('input', { type: 'checkbox', id: 'fr4' }), el('label', { for: 'fr4' }, 'Distingui maiuscole')),
      el('div', { class: 'frow' }, el('label', { for: 'fr5' }, 'Dove'), el('select', { id: 'fr5' }, [['all', 'Tutti i capitoli'], ['one', 'Solo il capitolo aperto']].map((o) => el('option', { value: o[0] }, o[1])))),
      el('p', { id: 'frRes', class: 'fine' }, 'La ricerca funziona dentro un tratto di testo con la stessa formattazione.'));
    const targets = () => ($('#fr5').value === 'one' ? [state.book.chapters[state.cur]] : state.book.chapters);
    const opts = () => ({ regex: $('#fr3').checked, caseSens: $('#fr4').checked });
    BF.modal('Cerca e sostituisci', body, [
      { label: 'Chiudi' },
      { label: 'Conta', onclick: () => { $('#frRes').textContent = targets().reduce((a, c) => a + BF.countInHtml(c.html, $('#fr1').value, opts()), 0) + ' occorrenze trovate.'; return false; } },
      { label: 'Sostituisci tutto', primary: true, onclick: () => {
        const f = $('#fr1').value;
        if (!f) return false;
        try {
          state.undo = state.book.chapters.map((c) => c.html);
          let n = 0;
          targets().forEach((c) => { const r = BF.replaceInHtml(c.html, f, $('#fr2').value, opts()); c.html = r.html; n += r.count; });
          $('#btnUndo').disabled = false;
          changed(); renderChapters(); BF.toast(n + ' sostituzioni.');
        } catch (e) { BF.toast(e.message, 'err'); return false; }
      } }]);
  });

  // ------------------------------------------------------------------ layout completo
  let layoutBusy = null;
  async function ensureLayout() {
    if (state.layout) return state.layout;
    if (layoutBusy) return layoutBusy;
    flushEditor();
    layoutBusy = (async () => {
      busy('Impagino il libro…', 0);
      try {
        const L = await BF.layout(state.book, state.S, { onProgress: (m, f) => busy(m, f) });
        state.layout = L;
        return L;
      } finally { unbusy(); layoutBusy = null; }
    })();
    return layoutBusy;
  }
  BF.app.ensureLayout = ensureLayout;

  // ------------------------------------------------------------------ ASPETTO
  let lookViewer, lookForm = $('#lookForm');
  function rebuildForms() {
    BF.buildForm(lookForm, BF.SCHEMA, state.S, () => { changed(); lookSoon(); });
    BF.buildForm($('#bindForm'), BIND_SCHEMA, state.B, () => { changed(); refreshBind(); }, { prefix: 'b_' });
    BF.buildForm($('#coverForm'), COVER_SCHEMA, state.C, () => { changed(); refreshCover(); }, { prefix: 'c_' });
    addCoverUpload();
    syncBookInfo();
  }
  const lookSoon = BF.debounce(() => refreshLook(), 350);
  let lookToken = 0;
  async function refreshLook() {
    if (!state.book) return;
    if (!lookViewer) {
      lookViewer = new BF.Viewer($('#lookView'));
    }
    const token = ++lookToken;
    lookViewer.clear('Impagino…');
    try {
      const L = await BF.layout(state.book, state.S, { limit: 2 });
      if (token !== lookToken) return;
      const first = L.chapters[0].page;
      lookViewer.setProvider(BF.spreadProvider(L, state.S, state.book, { startPage: first + 1 }));
    } catch (e) { lookViewer.clear(e.message); }
  }
  $('#resetLook').addEventListener('click', () => {
    const lang = state.S.lang;
    Object.assign(state.S, BF.DEFAULTS, { lang, tocTitle: state.S.tocTitle });
    BF.buildForm(lookForm, BF.SCHEMA, state.S, () => { changed(); lookSoon(); });
    changed(); refreshLook();
  });

  // ------------------------------------------------------------------ ANTEPRIMA
  let prevViewer, prevSingle = false, chSel, singleBox;
  async function refreshPreview(keep) {
    if (!state.book) return;
    if (!prevViewer) {
      prevViewer = new BF.Viewer($('#prevView'), { extra: (box) => {
        chSel = el('select', { 'aria-label': 'Vai al capitolo', onchange: (e) => {
          const L = state.layout;
          if (!L || e.target.value === '') return;
          const p = L.chapters[+e.target.value].page;
          prevViewer.go(prevSingle ? p : Math.floor((p + 1) / 2));
        } });
        singleBox = el('input', { type: 'checkbox', id: 'pvSingle', onchange: (e) => { prevSingle = e.target.checked; show(true); } });
        box.append(chSel, el('label', { class: 'zl' }, singleBox, ' Una pagina'),
          el('button', { class: 'btn primary small', onclick: () => printJob('pages') }, 'Stampa / Salva PDF'));
      } });
    }
    const show = (k) => {
      const L = state.layout;
      prevViewer.setProvider(BF.spreadProvider(L, state.S, state.book, { single: prevSingle }), k);
      chSel.innerHTML = '';
      chSel.appendChild(el('option', { value: '' }, 'Vai al capitolo…'));
      L.chapters.forEach((c, i) => chSel.appendChild(el('option', { value: i }, (i + 1) + '. ' + (c.title.length > 34 ? c.title.slice(0, 33) + '…' : c.title))));
    };
    prevViewer.clear('');
    try {
      await ensureLayout();
      show(keep);
      BF.app.prevInfo = state.layout;
    } catch (e) { prevViewer.clear(e.message); }
  }

  // ------------------------------------------------------------------ RILEGATURA
  const BIND_SCHEMA = [
    { group: 'Fogli e fascicoli', items: [
      { key: 'mode', label: 'Come disporre le pagine', type: 'select', options: [['booklet', 'Un solo fascicolo (libretto)'], ['signatures', 'Più fascicoli (libro cucito)']] },
      { key: 'sigSheets', label: 'Fogli per fascicolo', type: 'number', min: 1, max: 12, step: 1, show: (b) => b.mode === 'signatures', help: 'Di solito 3–5 fogli: con carta 80 g, 4 fogli = 16 pagine.' },
      { key: 'sheet', label: 'Carta da stampare', type: 'select', options: BF.SHEET_SIZES.map((s) => [s[0], s[1]]) },
      { key: 'fit', label: 'Riduci le pagine se non entrano', type: 'checkbox' },
      { key: 'rotateBacks', label: 'Ruota di 180° i retri', type: 'checkbox', help: 'Se la stampante gira il foglio sull\'altro lato.' },
    ] },
    { group: 'Segni', items: [
      { key: 'foldMarks', label: 'Segni di piega (sul lato interno)', type: 'checkbox' },
      { key: 'sewingMarks', label: 'Segni per la cucitura', type: 'checkbox' },
      { key: 'sewing', label: 'Numero di fori di cucitura', type: 'number', min: 2, max: 12, step: 1, show: (b) => b.sewingMarks },
      { key: 'cropMarks', label: 'Segni di taglio agli angoli', type: 'checkbox' },
      { key: 'labels', label: 'Etichetta piccola su ogni foglio (per rimetterli in ordine)', type: 'checkbox' },
      { key: 'reverseBacks', label: 'Retri in ordine inverso (stampa solo retri)', type: 'checkbox', help: 'Dipende da come la stampante impila i fogli: fai una prova.' },
    ] },
  ];
  let bindViewer;
  async function refreshBind() {
    if (!state.book) return;
    if (!bindViewer) bindViewer = new BF.Viewer($('#bindView'));
    bindViewer.clear('Impagino…');
    try {
      const L = await ensureLayout();
      const info = BF.imposeSummary(L, state.S, state.B);
      const sum = $('#bindSummary');
      sum.className = 'summary' + (info.fits || state.B.fit ? '' : ' warn');
      sum.innerHTML = '';
      sum.append(el('div', null, info.text),
        el('div', { style: 'margin-top:6px' }, `Stampa fronte/retro girando sul ${info.flip}.`),
        info.fits ? '' : el('div', { style: 'margin-top:6px' }, state.B.fit ? `Le pagine sono ridotte al ${Math.round(info.k * 100)}% per entrare nel foglio.` : 'Attenzione: le pagine sono più grandi del foglio e verranno tagliate.'));
      const sheets = info.plan.sheets;
      bindViewer.setProvider({
        count: () => sheets.length * 2,
        label: (i) => `foglio ${(i >> 1) + 1} di ${sheets.length} · ${i % 2 ? 'retro' : 'fronte'} · fascicolo ${sheets[i >> 1].sig + 1}`,
        build: (i) => {
          const holder = el('div', { class: 'pg-shadow' });
          holder.appendChild(BF.renderSheet(sheets[i >> 1], i % 2 ? 'back' : 'front', L, state.S, state.B, state.book, (i >> 1) + 1, info));
          holder.firstChild.style.boxShadow = 'none';
          return { el: holder, w: info.W, h: info.H };
        },
      }, true);
    } catch (e) { bindViewer.clear(e.message); }
  }

  // ------------------------------------------------------------------ COPERTINA
  const COVER_SCHEMA = [
    { group: 'Dorso', items: [
      { key: 'paper', label: 'Carta interna', type: 'select', options: [['0.09', '70 g — 0,09 mm per foglio'], ['0.1', '80 g — 0,10 mm per foglio'], ['0.115', '90 g — 0,115 mm per foglio'], ['0.15', '120 g — 0,15 mm per foglio']] },
      { key: 'boardExtra', label: 'Spessore extra del dorso (mm)', type: 'number', min: 0, max: 20, step: 0.1, help: 'Per colla o cartoncino della copertina.' },
      { key: 'bleed', label: 'Abbondanza (mm)', type: 'number', min: 0, max: 10, step: 0.5 },
    ] },
    { group: 'Aspetto', items: [
      { key: 'bg', label: 'Colore di sfondo', type: 'color' },
      { key: 'fg', label: 'Colore del testo', type: 'color' },
      { key: 'accent', label: 'Colore del dettaglio', type: 'color' },
      { key: 'fontKey', label: 'Carattere', type: 'select', options: BF.FONTS.map((f) => [f[0], f[1]]) },
      { key: 'titleSize', label: 'Dimensione titolo (pt)', type: 'number', min: 10, max: 60, step: 1 },
      { key: 'authorSize', label: 'Dimensione autore (pt)', type: 'number', min: 6, max: 30, step: 1 },
      { key: 'spineText', label: 'Scrivi titolo sul dorso', type: 'checkbox' },
      { key: 'useImage', label: 'Usa immagine di copertina', type: 'checkbox' },
      { key: 'imageFit', label: 'Adattamento immagine', type: 'select', options: [['cover', 'Riempi la copertina'], ['contain', 'Mostra intera']] },
      { key: 'frontText', label: 'Scrivi titolo e autore sopra l\'immagine', type: 'checkbox' },
      { key: 'showFolds', label: 'Linee di piega e segni di taglio', type: 'checkbox' },
      { key: 'back', label: 'Testo della quarta di copertina', type: 'textarea' },
    ] },
  ];
  function addCoverUpload() {
    const f = $('#coverForm');
    const inp = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true });
    inp.addEventListener('change', async () => {
      const file = inp.files[0];
      if (!file) return;
      if (file.size > 25 * 1024 * 1024) return BF.toast('Immagine troppo grande (oltre 25 MB).', 'err');
      state.book.cover = await BF.shrinkImage(await BF.fileToDataURL(file));
      state.C.useImage = true;
      changed(); rebuildForms(); refreshCover();
    });
    const row = el('div', { class: 'row-actions pad' },
      el('button', { class: 'btn small', onclick: () => inp.click() }, 'Scegli immagine…'),
      el('button', { class: 'btn small', onclick: () => { state.book.cover = null; changed(); rebuildForms(); refreshCover(); } }, 'Togli immagine'), inp);
    f.appendChild(row);
  }
  let coverViewer;
  async function refreshCover() {
    if (!state.book) return;
    if (!coverViewer) coverViewer = new BF.Viewer($('#coverView'));
    coverViewer.clear('Calcolo il dorso…');
    try {
      const L = await ensureLayout();
      const total = Math.ceil(L.total / 4) * 4; // il libro rilegato ha sempre un multiplo di 4 pagine
      const r = BF.renderCover(state.book, state.S, state.C, state.B.mode === 'none' ? L.total : total);
      $('#coverSummary').innerHTML = '';
      $('#coverSummary').append(el('div', null, `Copertina aperta: ${r.dims.W.toFixed(1)} × ${r.dims.H.toFixed(1)} mm`),
        el('div', null, `Dorso: ${r.dims.spine.toFixed(1)} mm (${r.dims.leaves} fogli di carta, ${total} pagine)`));
      coverViewer.setProvider({
        count: () => 1,
        label: () => 'quarta · dorso · prima',
        build: () => { const holder = el('div', { class: 'pg-shadow' }); const c = BF.renderCover(state.book, state.S, state.C, total).el; c.style.boxShadow = 'none'; holder.appendChild(c); return { el: holder, w: r.dims.W, h: r.dims.H }; },
      });
    } catch (e) { coverViewer.clear(e.message); }
  }

  // ------------------------------------------------------------------ STAMPA
  /** Prepara i fogli da stampare in .bk-print-root e imposta la dimensione della pagina. Ritorna {root, W, H}. */
  async function preparePrint(kind) {
    const L = await ensureLayout();
    document.querySelectorAll('.bk-print-root, #bk-print-style').forEach((e) => e.remove());
    const root = el('div', { class: 'bk-print-root' });
    document.body.appendChild(root);
    const S = state.S, B = state.B;
    let W = S.pageW, H = S.pageH;
    const nodes = []; // funzioni che creano un nodo alla volta (per non bloccare il browser)
    if (kind === 'cover') {
      const total = Math.ceil(L.total / 4) * 4;
      const r = BF.renderCover(state.book, S, state.C, total);
      W = r.dims.W; H = r.dims.H;
      nodes.push(() => r.el);
    } else if (kind === 'pages' || B.mode === 'none') {
      L.pages.forEach((_, i) => nodes.push(() => BF.renderPage(L, i, S, state.book)));
    } else {
      const info = BF.imposeSummary(L, S, B);
      W = info.W; H = info.H;
      const sheets = info.plan.sheets;
      const front = (j) => () => BF.renderSheet(sheets[j], 'front', L, S, B, state.book, j + 1, info);
      const back = (j) => () => BF.renderSheet(sheets[j], 'back', L, S, B, state.book, j + 1, info);
      if (kind === 'sheets') sheets.forEach((_, j) => { nodes.push(front(j), back(j)); });
      else if (kind === 'fronts') sheets.forEach((_, j) => nodes.push(front(j)));
      else if (kind === 'backs') { const order = sheets.map((_, j) => j); if (B.reverseBacks) order.reverse(); order.forEach((j) => nodes.push(back(j))); }
    }
    const st = el('style', { id: 'bk-print-style' });
    st.textContent = '@page{size:' + W + 'mm ' + H + 'mm;margin:0}';
    document.head.appendChild(st);
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]();
      n.style.width = W + 'mm';
      n.style.height = H - 0.4 + 'mm'; // un soffio in meno: evita pagine bianche per arrotondamenti
      n.style.overflow = 'hidden';
      root.appendChild(n);
      if (i % 6 === 5) { busy('Preparo la stampa… ' + (i + 1) + ' di ' + nodes.length, i / nodes.length); await BF.nextFrame(); }
    }
    return { root, W, H, count: nodes.length };
  }
  BF.app.preparePrint = preparePrint;

  async function printJob(kind) {
    try {
      busy('Preparo la stampa…', 0);
      const r = await preparePrint(kind);
      unbusy();
      if (!r.count) return BF.toast('Niente da stampare.');
      const cleanup = () => { document.querySelectorAll('.bk-print-root, #bk-print-style').forEach((e) => e.remove()); window.removeEventListener('afterprint', cleanup); };
      window.addEventListener('afterprint', cleanup);
      await BF.sleep(150);
      window.print();
    } catch (e) {
      unbusy();
      console.error(e);
      BF.toast(e.message || 'Stampa non riuscita.', 'err');
    }
  }
  $('#prAll').addEventListener('click', () => printJob('sheets'));
  $('#prFronts').addEventListener('click', () => printJob('fronts'));
  $('#prBacks').addEventListener('click', () => printJob('backs'));
  $('#prPages').addEventListener('click', () => printJob('pages'));
  $('#prCover').addEventListener('click', () => printJob('cover'));

  // ------------------------------------------------------------------ avvio
  rebuildForms();
  const startTab = (location.hash || '').slice(1);
  if (startTab && $('#tab-' + startTab) && startTab !== 'import') { /* senza libro si resta su "Importa" */ }
  showTab('import');
})();
