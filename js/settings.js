/* BookForge Web — impostazioni predefinite, formati carta, font e schema dei moduli. */
(function () {
  const BF = (window.BF = window.BF || {});

  BF.PAGE_SIZES = [
    ['a6', 'A6 (105 × 148 mm)', 105, 148],
    ['pocket', 'Tascabile (108 × 175 mm)', 108, 175],
    ['b6', 'B6 (125 × 176 mm)', 125, 176],
    ['5x8', '5 × 8 pollici (127 × 203 mm)', 127, 203.2],
    ['a5', 'A5 (148 × 210 mm)', 148, 210],
    ['digest', 'Digest / Half Letter (140 × 216 mm)', 139.7, 215.9],
    ['trade', 'Trade 6 × 9 pollici (152 × 229 mm)', 152.4, 228.6],
    ['b5', 'B5 (176 × 250 mm)', 176, 250],
    ['a4', 'A4 (210 × 297 mm)', 210, 297],
    ['letter', 'Letter (216 × 279 mm)', 215.9, 279.4],
    ['custom', 'Personalizzato…', 0, 0],
  ];

  BF.SHEET_SIZES = [
    ['a4l', 'A4 (297 × 210 mm, orizzontale)', 297, 210],
    ['a3l', 'A3 (420 × 297 mm, orizzontale)', 420, 297],
    ['letterl', 'Letter (279 × 216 mm, orizzontale)', 279.4, 215.9],
    ['tabloidl', 'Tabloid / 11×17" (432 × 279 mm)', 431.8, 279.4],
    ['a4p', 'A4 (210 × 297 mm, verticale)', 210, 297],
    ['letterp', 'Letter (216 × 279 mm, verticale)', 215.9, 279.4],
  ];

  BF.FONTS = [
    ['ebgaramond', 'EB Garamond', "'BF EB Garamond', Garamond, 'Times New Roman', serif"],
    ['cormorant', 'Cormorant Garamond', "'BF Cormorant Garamond', Garamond, serif"],
    ['crimson', 'Crimson Pro', "'BF Crimson Pro', Georgia, serif"],
    ['alegreya', 'Alegreya', "'BF Alegreya', Georgia, serif"],
    ['baskervville', 'Baskervville', "'BF Baskervville', Baskerville, serif"],
    ['librebask', 'Libre Baskerville', "'BF Libre Baskerville', Baskerville, serif"],
    ['caslon', 'Libre Caslon Text', "'BF Libre Caslon Text', Georgia, serif"],
    ['gelasio', 'Gelasio (tipo Georgia)', "'BF Gelasio', Georgia, serif"],
    ['literata', 'Literata', "'BF Literata', Georgia, serif"],
    ['lora', 'Lora', "'BF Lora', Georgia, serif"],
    ['sourceserif', 'Source Serif 4', "'BF Source Serif 4', Georgia, serif"],
    ['playfair', 'Playfair Display', "'BF Playfair Display', Georgia, serif"],
    ['fell', 'IM Fell English (antico)', "'BF IM Fell English', Georgia, serif"],
    ['cinzel', 'Cinzel (solo titoli)', "'BF Cinzel', 'Times New Roman', serif"],
    ['georgia', 'Georgia (di sistema)', "Georgia, 'Times New Roman', serif"],
    ['times', 'Times (di sistema)', "'Times New Roman', Times, serif"],
  ];
  BF.fontCss = (key) => (BF.FONTS.find((f) => f[0] === key) || BF.FONTS[0])[2];
  // nomi dei @font-face da caricare per ciascun font (i font di sistema non servono)
  BF.fontFaceName = (key) => {
    const m = BF.fontCss(key).match(/^'(BF [^']+)'/);
    return m ? m[1] : null;
  };

  BF.LANGS = [
    ['it', 'Italiano'], ['en', 'Inglese'], ['fr', 'Francese'], ['de', 'Tedesco'], ['es', 'Spagnolo'], ['pt', 'Portoghese'], ['nl', 'Olandese'], ['la', 'Latino'],
  ];

  BF.DEFAULTS = {
    // pagina
    pageSize: 'a5', pageW: 148, pageH: 210,
    mTop: 18, mBottom: 20, mInner: 20, mOuter: 15, mirror: true,
    // testo
    font: 'ebgaramond', headFont: 'same', fontSize: 11, lineHeight: 1.38,
    parStyle: 'indent', indent: 1.2, justify: true, hyphenate: true, lang: 'it',
    // capitoli
    chSink: 30, chTitleSize: 1.9, chTitleCase: 'normal', ornament: true, ornamentGlyph: '❦', chAfter: 12,
    dropCap: true, dropCapLines: 3, sceneBreak: '* * *', chapterRecto: true,
    // intestazioni e numeri di pagina
    headers: true, headerVerso: 'author', pageNum: 'bottom-center',
    // pagine iniziali
    titlePage: true, copyrightPage: true, copyrightText: '', toc: true, tocTitle: 'Indice', numFrom: 'chapter',
  };

  BF.DEFAULT_BINDING = {
    mode: 'booklet', // none | booklet | signatures
    sheet: 'a4l', sigSheets: 4, fit: true, rotateBacks: false, foldMarks: true, cropMarks: false, sewing: 3, sewingMarks: true, labels: true,
    reverseBacks: false,
  };

  BF.DEFAULT_COVER = {
    paper: 0.1, boardExtra: 0, // dorso calcolato dalle pagine: carta interna (mm per foglio) + extra
    // misure in mm (0 = automatico dal formato della pagina)
    boardW: 0, boardH: 0, spineAuto: true, spineManual: 10, hinge: 7, turnIn: 15, cornerGap: 2,
    imgMode: 'sheet', imgL: 0, imgT: 0, imgR: 0, imgB: 0, ownFit: 'stretch',
    markMargin: 10, showMarks: true, showBoards: false, guideMirror: false,
  };

  /** Valori CSS per la pagina. */
  BF.bookVars = function (S) {
    const tw = S.pageW - S.mInner - S.mOuter;
    const th = S.pageH - S.mTop - S.mBottom;
    const L = S.lineHeight;
    const dcSize = ((S.dropCapLines - 1) * L + 0.66) / 0.66;
    const headFont = S.headFont === 'same' ? S.font : S.headFont;
    return {
      '--bk-pw': S.pageW + 'mm', '--bk-ph': S.pageH + 'mm', '--bk-tw': tw + 'mm', '--bk-th': th + 'mm',
      '--bk-font': BF.fontCss(S.font), '--bk-head-font': BF.fontCss(headFont),
      '--bk-fs': S.fontSize + 'pt', '--bk-lh': String(L),
      '--bk-indent': S.parStyle === 'indent' ? S.indent + 'em' : '0em',
      '--bk-par-gap': S.parStyle === 'space' ? '0.6em' : '0em',
      '--bk-align': S.justify ? 'justify' : 'left',
      '--bk-hyph': S.hyphenate ? 'auto' : 'manual',
      '--bk-ch-sink': S.chSink + 'mm', '--bk-ch-size': S.chTitleSize + 'em', '--bk-ch-after': S.chAfter + 'mm',
      '--bk-ch-case': S.chTitleCase === 'upper' ? 'uppercase' : 'none',
      '--bk-ch-variant': S.chTitleCase === 'smallcaps' ? 'small-caps' : 'normal',
      '--bk-ch-spacing': S.chTitleCase === 'normal' ? '0' : '0.06em',
      '--bk-dc-size': dcSize.toFixed(3) + 'em',
      '--bk-scene': JSON.stringify(S.sceneBreak === 'line' ? '' : S.sceneBreak),
    };
  };
  BF.applyVars = function (el, S) {
    const v = BF.bookVars(S);
    for (const k in v) el.style.setProperty(k, v[k]);
    el.setAttribute('lang', S.lang || 'it');
    el.classList.toggle('bk-dropcap', !!S.dropCap);
    el.classList.toggle('bk-scene-line', S.sceneBreak === 'line');
  };

  BF.pageDims = (S) => ({
    pw: S.pageW, ph: S.pageH, tw: S.pageW - S.mInner - S.mOuter, th: S.pageH - S.mTop - S.mBottom,
  });

  /** Schema dei campi dei moduli (usato per generare l'interfaccia). */
  BF.SCHEMA = [
    { group: 'Pagina', items: [
      { key: 'pageSize', label: 'Formato', type: 'select', options: BF.PAGE_SIZES.map((p) => [p[0], p[1]]) },
      { key: 'pageW', label: 'Larghezza (mm)', type: 'number', min: 60, max: 400, step: 0.5, show: (s) => s.pageSize === 'custom' },
      { key: 'pageH', label: 'Altezza (mm)', type: 'number', min: 80, max: 500, step: 0.5, show: (s) => s.pageSize === 'custom' },
      { key: 'mTop', label: 'Margine sopra (mm)', type: 'number', min: 5, max: 60, step: 0.5 },
      { key: 'mBottom', label: 'Margine sotto (mm)', type: 'number', min: 5, max: 60, step: 0.5 },
      { key: 'mInner', label: 'Margine interno / rilegatura (mm)', type: 'number', min: 5, max: 60, step: 0.5, help: 'Il lato verso il dorso: lascialo più largo.' },
      { key: 'mOuter', label: 'Margine esterno (mm)', type: 'number', min: 5, max: 60, step: 0.5 },
      { key: 'mirror', label: 'Margini speculari (pagine fronte/retro)', type: 'checkbox' },
    ] },
    { group: 'Testo', items: [
      { key: 'font', label: 'Carattere del testo', type: 'select', options: BF.FONTS.map((f) => [f[0], f[1]]) },
      { key: 'fontSize', label: 'Dimensione (pt)', type: 'number', min: 7, max: 20, step: 0.25 },
      { key: 'lineHeight', label: 'Interlinea', type: 'number', min: 1, max: 2.2, step: 0.02 },
      { key: 'parStyle', label: 'Paragrafi', type: 'select', options: [['indent', 'Con rientro della prima riga'], ['space', 'Separati da uno spazio']] },
      { key: 'indent', label: 'Rientro (em)', type: 'number', min: 0, max: 4, step: 0.1, show: (s) => s.parStyle === 'indent' },
      { key: 'justify', label: 'Testo giustificato', type: 'checkbox' },
      { key: 'hyphenate', label: 'Sillabazione automatica', type: 'checkbox', help: 'Usa la lingua scelta nei dati del libro.' },
    ] },
    { group: 'Capitoli', items: [
      { key: 'headFont', label: 'Carattere dei titoli', type: 'select', options: [['same', 'Come il testo']].concat(BF.FONTS.map((f) => [f[0], f[1]])) },
      { key: 'chTitleSize', label: 'Dimensione titolo (em)', type: 'number', min: 1, max: 4, step: 0.1 },
      { key: 'chTitleCase', label: 'Stile titolo', type: 'select', options: [['normal', 'Normale'], ['upper', 'MAIUSCOLO'], ['smallcaps', 'Maiuscoletto']] },
      { key: 'chSink', label: 'Spazio sopra il titolo (mm)', type: 'number', min: 0, max: 100, step: 1 },
      { key: 'chAfter', label: 'Spazio dopo il titolo (mm)', type: 'number', min: 0, max: 60, step: 1 },
      { key: 'ornament', label: 'Ornamento sotto il titolo', type: 'checkbox' },
      { key: 'ornamentGlyph', label: 'Simbolo ornamento', type: 'select', show: (s) => s.ornament, options: [['❦', '❦ foglia'], ['❧', '❧ foglia rovesciata'], ['◆', '◆ rombo'], ['✦', '✦ stella'], ['❖', '❖ fiore'], ['•', '• punto'], ['—', '— linea']] },
      { key: 'dropCap', label: 'Capolettera', type: 'checkbox' },
      { key: 'dropCapLines', label: 'Altezza capolettera (righe)', type: 'number', min: 2, max: 6, step: 1, show: (s) => s.dropCap },
      { key: 'sceneBreak', label: 'Separatore di scena', type: 'select', options: [['* * *', '* * *'], ['•••', '• • •'], ['❖', '❖'], ['◆', '◆'], ['line', 'Linea sottile']] },
      { key: 'chapterRecto', label: 'Ogni capitolo inizia a pagina destra', type: 'checkbox', help: 'Aggiunge una pagina bianca quando serve.' },
    ] },
    { group: 'Intestazioni e numeri di pagina', items: [
      { key: 'headers', label: 'Intestazione corrente (titolo in alto)', type: 'checkbox' },
      { key: 'headerVerso', label: 'Pagine sinistre mostrano', type: 'select', show: (s) => s.headers, options: [['author', 'Autore'], ['title', 'Titolo del libro']] },
      { key: 'pageNum', label: 'Numero di pagina', type: 'select', options: [['bottom-center', 'In basso al centro'], ['bottom-outer', 'In basso, lato esterno'], ['top-outer', 'In alto, lato esterno'], ['none', 'Nessuno']] },
    ] },
    { group: 'Pagine iniziali', items: [
      { key: 'titlePage', label: 'Frontespizio', type: 'checkbox' },
      { key: 'copyrightPage', label: 'Pagina del copyright', type: 'checkbox' },
      { key: 'copyrightText', label: 'Testo del copyright (vuoto = automatico)', type: 'textarea', show: (s) => s.copyrightPage },
      { key: 'tocTitle', label: 'Titolo dell\'indice', type: 'text', help: 'L\'indice si sposta e si accende/spegne nell\'elenco dei capitoli.' },
      { key: 'numFrom', label: 'La numerazione parte', type: 'select', options: [['chapter', 'Dal primo capitolo dopo l\'indice'], ['toc', 'Dall\'indice (l\'indice è pagina 1)']], help: 'Le pagine prima dell\'indice non hanno mai il numero.' },
    ] },
  ];

  /** Costruisce un modulo da uno schema. obj viene modificato; onChange(key) a ogni cambio. */
  BF.buildForm = function (container, schema, obj, onChange, opts) {
    opts = opts || {};
    container.innerHTML = '';
    const rows = [];
    const groups = [];
    const refresh = () => {
      rows.forEach((r) => (r.el.hidden = r.show ? !r.show(obj) : false));
      groups.forEach((g) => (g.el.hidden = g.show ? !g.show(obj) : false));
    };
    schema.forEach((g) => {
      const items = g.items;
      const details = BF.el('details', { class: 'fgroup', open: opts.open !== false });
      details.appendChild(BF.el('summary', null, g.group));
      const body = BF.el('div', { class: 'fbody' });
      items.forEach((it) => {
        const id = 'f_' + (opts.prefix || '') + it.key;
        let input;
        const set = (v) => {
          obj[it.key] = v;
          if (it.key === 'pageSize') {
            const p = BF.PAGE_SIZES.find((x) => x[0] === v);
            if (p && p[2]) { obj.pageW = p[2]; obj.pageH = p[3]; syncAll(); }
          }
          refresh();
          onChange && onChange(it.key);
        };
        if (it.type === 'select') {
          input = BF.el('select', { id, onchange: (e) => set(isNaN(it.options[0][0]) ? e.target.value : +e.target.value) }, it.options.map((o) => BF.el('option', { value: o[0] }, o[1])));
        } else if (it.type === 'checkbox') {
          input = BF.el('input', { id, type: 'checkbox', onchange: (e) => set(e.target.checked) });
        } else if (it.type === 'textarea') {
          input = BF.el('textarea', { id, rows: 3, oninput: (e) => set(e.target.value) });
        } else if (it.type === 'color') {
          input = BF.el('input', { id, type: 'color', oninput: (e) => set(e.target.value) });
        } else if (it.type === 'text') {
          input = BF.el('input', { id, type: 'text', oninput: (e) => set(e.target.value) });
        } else {
          input = BF.el('input', { id, type: 'number', min: it.min, max: it.max, step: it.step || 1, oninput: (e) => { const v = parseFloat(e.target.value); if (isFinite(v)) set(BF.clamp(v, it.min != null ? it.min : -1e9, it.max != null ? it.max : 1e9)); } });
        }
        input.dataset.key = it.key;
        const label = BF.el('label', { for: id }, it.label);
        const row = BF.el('div', { class: 'frow ' + (it.type === 'checkbox' ? 'check' : '') }, it.type === 'checkbox' ? [input, label] : [label, input], it.help ? BF.el('small', null, it.help) : null);
        rows.push({ el: row, show: it.show });
        body.appendChild(row);
      });
      details.appendChild(body);
      groups.push({ el: details, show: g.show });
      container.appendChild(details);
    });
    function syncAll() {
      container.querySelectorAll('[data-key]').forEach((inp) => {
        const v = obj[inp.dataset.key];
        if (inp.type === 'checkbox') inp.checked = !!v;
        else if (v != null) inp.value = v;
      });
    }
    syncAll();
    refresh();
    container._sync = () => { syncAll(); refresh(); };
  };
})();
