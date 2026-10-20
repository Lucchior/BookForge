/* BookForge Web — modello di copertina (quarta + dorso + prima) con spessore del dorso calcolato dalle pagine. */
(function () {
  const BF = (window.BF = window.BF || {});

  BF.coverDims = function (S, C, totalPages) {
    const leaves = Math.ceil(totalPages / 2);
    const spine = Math.max(0, leaves * C.paper + C.boardExtra);
    return {
      spine,
      W: 2 * S.pageW + spine + 2 * C.bleed,
      H: S.pageH + 2 * C.bleed,
      leaves,
    };
  };

  BF.renderCover = function (book, S, C, totalPages) {
    const d = BF.coverDims(S, C, totalPages);
    const el = BF.el('div', { class: 'bk-coverpage bk-scope' });
    el.style.width = d.W + 'mm';
    el.style.height = d.H + 'mm';
    el.style.background = C.bg;
    el.style.color = C.fg;
    el.style.fontFamily = BF.fontCss(C.fontKey);
    const panel = (x, w, cls) => {
      const p = BF.el('div', { class: 'panel ' + cls });
      Object.assign(p.style, { left: x + 'mm', top: C.bleed + 'mm', width: w + 'mm', height: S.pageH + 'mm' });
      el.appendChild(p);
      return p;
    };
    const backX = C.bleed, spineX = C.bleed + S.pageW, frontX = spineX + d.spine;

    // quarta di copertina
    const back = panel(backX, S.pageW, 'back');
    if (C.back && C.back.trim()) {
      const t = BF.el('div');
      t.style.cssText = 'position:absolute;left:14mm;right:14mm;top:22mm;font-size:10pt;line-height:1.5;white-space:pre-line;text-align:left;';
      t.textContent = C.back;
      back.appendChild(t);
    }
    // prima di copertina
    const front = panel(frontX, S.pageW, 'front');
    if (C.useImage && book.cover) {
      const im = BF.el('img', { src: book.cover, alt: '' });
      const fit = C.imageFit === 'contain' ? 'contain' : 'cover';
      im.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:${fit};`;
      front.appendChild(im);
    }
    if (!C.useImage || !book.cover || C.frontText) {
      const t = BF.el('div');
      t.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 12mm 14mm;';
      const h = BF.el('div', null, book.title || 'Senza titolo');
      h.style.cssText = `font-size:${C.titleSize}pt;line-height:1.12;font-weight:700;hyphens:manual;`;
      const rule = BF.el('div');
      rule.style.cssText = `width:22mm;height:0.5mm;background:${C.accent};margin:7mm 0;`;
      const a = BF.el('div', null, book.author || '');
      a.style.cssText = `font-size:${C.authorSize}pt;letter-spacing:0.08em;color:${C.accent};`;
      t.append(h, rule, a);
      front.appendChild(t);
    }
    // dorso
    if (C.spineText && d.spine >= 4) {
      const sp = panel(spineX, d.spine, 'spine');
      const t = BF.el('div', null, [book.title || '', book.author ? '  ·  ' + book.author : ''].join(''));
      t.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;writing-mode:vertical-rl;white-space:nowrap;font-size:${Math.min(13, d.spine * 0.9 * 2.83).toFixed(1)}pt;font-weight:700;letter-spacing:0.05em;`;
      sp.appendChild(t);
    }
    // linee di piega e segni di taglio
    if (C.showFolds) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${d.W} ${d.H}`);
      svg.setAttribute('width', d.W + 'mm');
      svg.setAttribute('height', d.H + 'mm');
      svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
      const ln = (x1, y1, x2, y2, extra) => {
        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        [['x1', x1], ['y1', y1], ['x2', x2], ['y2', y2]].forEach(([k, v]) => l.setAttribute(k, v));
        l.setAttribute('stroke', C.fg);
        l.setAttribute('stroke-opacity', '0.55');
        l.setAttribute('stroke-width', '0.25');
        if (extra) l.setAttribute('stroke-dasharray', '1.5 1');
        svg.appendChild(l);
      };
      const tr = Math.min(C.bleed, 3);
      if (d.spine > 0) { ln(spineX, 0, spineX, d.H, true); ln(frontX, 0, frontX, d.H, true); }
      const xs = [C.bleed, d.W - C.bleed], ys = [C.bleed, d.H - C.bleed];
      xs.forEach((x) => ys.forEach((y) => {
        ln(x, y === ys[0] ? y - tr : y, x, y === ys[0] ? y : y + tr);
        ln(x === xs[0] ? x - tr : x, y, x === xs[0] ? x : x + tr, y);
      }));
      el.appendChild(svg);
    }
    return { el, dims: d };
  };

  // ====================================================================== COPERTINA CARTONATA (immagine propria)
  const NS = 'http://www.w3.org/2000/svg';
  const num = (v, d) => (isFinite(+v) && +v >= 0 ? +v : d);

  /** Geometria del foglio di copertina e dei tre cartoni. Tutto in mm, origine in alto a sinistra del foglio. */
  BF.caseDims = function (S, C, totalPages) {
    const leaves = Math.ceil(totalPages / 2);
    const autoSpine = Math.max(0, leaves * C.paper + C.boardExtra);
    const spine = C.spineAuto ? autoSpine : num(C.spineManual, 0);
    const bw = num(C.boardW, 0) || S.pageW + 3;
    const bh = num(C.boardH, 0) || S.pageH + 6;
    const T = num(C.turnIn, 0), g = num(C.hinge, 0), M = C.showMarks ? num(C.markMargin, 0) : 0;
    const backL = T, backR = T + bw, spineL = backR + g, spineR = spineL + spine, frontL = spineR + g, frontR = frontL + bw;
    const W = frontR + T, H = bh + 2 * T;
    return {
      spine, autoSpine, leaves, bw, bh, T, g, M, W, H, pageW: W + 2 * M, pageH: H + 2 * M,
      top: T, bottom: T + bh, backL, backR, spineL, spineR, frontL, frontR,
      boards: [
        { id: 'back', name: 'Quarta', x: backL, w: bw },
        { id: 'spine', name: 'Dorso', x: spineL, w: spine },
        { id: 'front', name: 'Prima', x: frontL, w: bw },
      ],
    };
  };

  /** Rettangolo (in mm, relativo al foglio) occupato dall'immagine dell'utente. */
  BF.caseImageRect = function (C, d) {
    let l = 0, t = 0, r = 0, b = 0;
    if (C.imgMode === 'boards') { l = r = d.T; t = b = d.T; }
    else if (C.imgMode === 'custom') { l = num(C.imgL, 0); t = num(C.imgT, 0); r = num(C.imgR, 0); b = num(C.imgB, 0); }
    return { x: l, y: t, w: Math.max(1, d.W - l - r), h: Math.max(1, d.H - t - b) };
  };

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /** Tacche di taglio (continue) e di piega (tratteggiate) fuori dal foglio. o = offset (margine) */
  function drawMarks(svg, d) {
    const o = d.M;
    if (!(o > 2.5)) return;
    const gap = 1.2, len = Math.max(1.5, o - gap - 0.8);
    const cut = (x1, y1, x2, y2) => svgEl('line', { x1, y1, x2, y2, stroke: '#000', 'stroke-width': 0.2 }, svg);
    const fold = (x1, y1, x2, y2) => svgEl('line', { x1, y1, x2, y2, stroke: '#000', 'stroke-width': 0.2, 'stroke-dasharray': '1.2 0.8' }, svg);
    // angoli del foglio: taglio
    [[o, 1], [o + d.W, -1]].forEach(([x, sx]) => [[o, 1], [o + d.H, -1]].forEach(([y, sy]) => {
      cut(x - sx * gap, y, x - sx * (gap + len), y);
      cut(x, y - sy * gap, x, y - sy * (gap + len));
    }));
    // bordi dei cartoni: dove si appoggiano
    const xs = [d.backL, d.backR, d.spineL, d.spineR, d.frontL, d.frontR];
    if (d.spine <= 0) { xs.splice(2, 2, d.spineL); }
    xs.forEach((x) => {
      fold(o + x, o - gap, o + x, o - gap - len);
      fold(o + x, o + d.H + gap, o + x, o + d.H + gap + len);
    });
    [d.top, d.bottom].forEach((y) => {
      fold(o - gap, o + y, o - gap - len, o + y);
      fold(o + d.W + gap, o + y, o + d.W + gap + len, o + y);
    });
  }

  /** Tagli a 45° sugli angoli esterni, nella zona del risvolto. */
  function cornerCuts(svg, d, o, g, halo) {
    const k = g * Math.SQRT2, T = d.T;
    if (!(T > 0) || k >= 2 * T) return;
    const mk = (cx, cy, sx, sy) => {
      // (cx,cy) = angolo del cartone; sx,sy = verso dell'esterno (-1 = sinistra/alto, +1 = destra/basso)
      const a = [cx + sx * T, cy + sy * (k - T)];
      const b = [cx + sx * (k - T), cy + sy * T];
      const pts = { x1: o + a[0], y1: o + a[1], x2: o + b[0], y2: o + b[1] };
      if (halo) svgEl('line', Object.assign({ stroke: '#fff', 'stroke-width': 0.7, 'stroke-linecap': 'round' }, pts), svg);
      svgEl('line', Object.assign({ stroke: '#000', 'stroke-width': 0.25 }, pts), svg);
    };
    mk(d.backL, d.top, -1, -1); mk(d.frontR, d.top, 1, -1);
    mk(d.backL, d.bottom, -1, 1); mk(d.frontR, d.bottom, 1, 1);
  }

  /** Foglio di copertina da stampare: immagine dell'utente + segni di taglio/piega. Ritorna {el, dims}. */
  BF.renderCase = function (book, S, C, totalPages) {
    const d = BF.caseDims(S, C, totalPages);
    const o = d.M;
    const el = BF.el('div', { class: 'bk-coverpage bk-casepage bk-scope' });
    el.style.width = d.pageW + 'mm';
    el.style.height = d.pageH + 'mm';
    el.style.background = '#fff';
    // foglio (il rettangolo che verrà tagliato)
    const sheet = BF.el('div', { class: 'case-sheet' });
    Object.assign(sheet.style, { position: 'absolute', left: o + 'mm', top: o + 'mm', width: d.W + 'mm', height: d.H + 'mm', overflow: 'hidden', background: book.ownCover ? '#fff' : '#f3efe6' });
    if (book.ownCover) {
      const r = BF.caseImageRect(C, d);
      const im = BF.el('img', { src: book.ownCover, alt: '' });
      const fit = C.ownFit === 'cover' ? 'cover' : C.ownFit === 'contain' ? 'contain' : 'fill';
      im.style.cssText = `position:absolute;left:${r.x}mm;top:${r.y}mm;width:${r.w}mm;height:${r.h}mm;object-fit:${fit};`;
      sheet.appendChild(im);
    }
    el.appendChild(sheet);
    const svg = svgEl('svg', { viewBox: `0 0 ${d.pageW} ${d.pageH}`, width: d.pageW + 'mm', height: d.pageH + 'mm' });
    svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
    if (C.showBoards) {
      d.boards.forEach((b) => {
        if (b.w <= 0) return;
        const a = { x: o + b.x, y: o + d.top, width: b.w, height: d.bh || d.bottom - d.top, fill: 'none' };
        svgEl('rect', Object.assign({ stroke: '#fff', 'stroke-width': 0.6 }, a), svg);
        svgEl('rect', Object.assign({ stroke: '#000', 'stroke-width': 0.2, 'stroke-dasharray': '1.2 0.8' }, a), svg);
      });
    }
    if (!book.ownCover) {
      const t = svgEl('text', { x: o + d.W / 2, y: o + d.H / 2, 'text-anchor': 'middle', 'font-size': 5, fill: '#8a8472', 'font-family': 'sans-serif' }, svg);
      t.textContent = 'Carica la tua immagine di copertina';
    }
    cornerCuts(svg, d, o, num(C.cornerGap, 0), true);
    drawMarks(svg, d);
    el.appendChild(svg);
    return { el, dims: d };
  };

  /** Guida dei cartoni: i tre rettangoli alle posizioni reali, con le misure. */
  BF.renderGuide = function (book, S, C, totalPages) {
    const d = BF.caseDims(S, C, totalPages);
    const o = d.M;
    const el = BF.el('div', { class: 'bk-coverpage bk-casepage bk-scope' });
    el.style.width = d.pageW + 'mm';
    el.style.height = d.pageH + 'mm';
    el.style.background = '#fff';
    const svg = svgEl('svg', { viewBox: `0 0 ${d.pageW} ${d.pageH}`, width: d.pageW + 'mm', height: d.pageH + 'mm' });
    svg.style.cssText = 'position:absolute;left:0;top:0;';
    const font = 'font-family:Inter,Arial,sans-serif;';
    const fx = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
    const text = (x, y, str, size, extra) => {
      const t = svgEl('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': size, fill: '#222', style: font }, extra || {}), svg);
      t.textContent = str;
      return t;
    };
    const ln = (x1, y1, x2, y2, dash) => svgEl('line', { x1, y1, x2, y2, stroke: '#555', 'stroke-width': 0.2, 'stroke-dasharray': dash || '' }, svg);
    // foglio di copertina (tratteggiato): serve per vedere dove cadono i cartoni sul foglio
    svgEl('rect', { x: o, y: o, width: d.W, height: d.H, fill: 'none', stroke: '#999', 'stroke-width': 0.25, 'stroke-dasharray': '2 1.2' }, svg);
    d.boards.forEach((b) => {
      if (b.w <= 0) return;
      svgEl('rect', { x: o + b.x, y: o + d.top, width: b.w, height: d.bh, fill: '#f4f1ea', stroke: '#000', 'stroke-width': 0.3 }, svg);
      const cx = o + b.x + b.w / 2, cy = o + d.top + d.bh / 2;
      if (b.id === 'spine' && b.w < 30) {
        const t = text(cx, cy, 'DORSO  ' + fx(b.w) + ' × ' + fx(d.bh) + ' mm', Math.min(4, Math.max(2, b.w * 0.45)), { transform: `rotate(-90 ${cx} ${cy})` });
        void t;
      } else {
        text(cx, cy - 2, b.name.toUpperCase(), 5);
        text(cx, cy + 4, fx(b.w) + ' × ' + fx(d.bh) + ' mm', 4);
      }
    });
    // quote: spazi (cerniere) e risvolti
    const dimY = o + d.top - 0; void dimY;
    if (d.g > 0) {
      [[d.backR, d.spineL], [d.spineR, d.frontL]].forEach(([a, b]) => {
        const cy = o + d.top + d.bh * 0.12;
        ln(o + a, cy, o + b, cy);
        text((o + a + o + b) / 2, cy - 1.2, fx(d.g), 2.8);
      });
    }
    if (d.T > 0) {
      const cx = o + d.W / 2;
      ln(cx, o, cx, o + d.top); ln(cx, o + d.bottom, cx, o + d.H);
      text(cx + 6, o + d.top / 2 + 1, 'risvolto ' + fx(d.T), 2.8);
      text(cx + 6, o + d.bottom + d.T / 2 + 1, 'risvolto ' + fx(d.T), 2.8);
    }
    text(o + d.W / 2, o + d.top + d.bh * 0.93, 'Foglio ' + fx(d.W) + ' × ' + fx(d.H) + ' mm  ·  taglio a 45° a ' + fx(num(C.cornerGap, 0)) + ' mm dall\'angolo del cartone', 3);
    cornerCuts(svg, d, o, num(C.cornerGap, 0), false);
    drawMarks(svg, d);
    el.appendChild(svg);
    if (C.guideMirror) svg.style.transform = 'scaleX(-1)';
    return { el, dims: d };
  };

  /** Pixel e risoluzione effettiva dell'immagine dell'utente: serve per avvisare se è troppo piccola. */
  BF.imageInfo = (url) => new Promise((res) => {
    if (!url) return res(null);
    const im = new Image();
    im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => res(null);
    im.src = url;
  });
})();
