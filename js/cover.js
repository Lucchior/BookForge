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
})();
