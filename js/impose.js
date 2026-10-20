/* BookForge Web — disposizione delle pagine sui fogli per la rilegatura a mano (fascicoli piegati e cuciti).
   Ogni foglio ha due pagine affiancate per lato. Con N pagine in un fascicolo (multiplo di 4), il foglio j ha:
     fronte: [ultima-2j , 2j]      retro: [2j+1 , penultima-2j]   (pagine contate da 0 dentro il fascicolo) */
(function () {
  const BF = (window.BF = window.BF || {});

  BF.sheetDims = (B) => {
    const s = BF.SHEET_SIZES.find((x) => x[0] === B.sheet) || BF.SHEET_SIZES[0];
    return { W: s[2], H: s[3] };
  };

  /** Piano di imposizione. Ritorna { sheets:[{front:[l,r], back:[l,r], sig}], sigs:[{sheets,pages}], blanks } con indici di pagina (null = bianca). */
  BF.imposePlan = function (total, B) {
    const sheets = [], sigs = [];
    const perSig = B.mode === 'signatures' ? Math.max(1, Math.round(B.sigSheets)) * 4 : Math.ceil(total / 4) * 4;
    let blanks = 0;
    for (let s = 0, sigNo = 0; s < total; s += perSig, sigNo++) {
      const used = Math.min(perSig, total - s);
      const P = Math.ceil(used / 4) * 4;
      const at = (i) => { const g = s + i; return g < total ? g : null; };
      sigs.push({ sheets: P / 4, pages: P });
      for (let j = 0; j < P / 4; j++) {
        sheets.push({
          sig: sigNo,
          front: [at(P - 1 - 2 * j), at(2 * j)],
          back: [at(2 * j + 1), at(P - 2 - 2 * j)],
        });
      }
      blanks += P - used;
    }
    return { sheets, sigs, blanks };
  };

  BF.imposeSummary = function (L, S, B) {
    const { W, H } = BF.sheetDims(B);
    const plan = BF.imposePlan(L.total, B);
    const fits = S.pageW * 2 <= W + 0.01 && S.pageH <= H + 0.01;
    const k = fits || !B.fit ? 1 : Math.min(W / (2 * S.pageW), H / S.pageH);
    const flip = W > H ? 'LATO CORTO' : 'LATO LUNGO';
    const sizeTxt = B.sheet.endsWith('l') || B.sheet.endsWith('p') ? W.toFixed(0) + ' × ' + H.toFixed(0) + ' mm' : '';
    return {
      plan, W, H, k, fits, flip,
      text:
        `${plan.sheets.length} fogli (${sizeTxt}), ${plan.sigs.length} ${plan.sigs.length === 1 ? 'fascicolo' : 'fascicoli'}` +
        (plan.sigs.length > 1 ? ` da ${plan.sigs[0].sheets} fogli` : '') +
        `; ${plan.blanks} pagine bianche aggiunte per completare l'ultimo fascicolo.`,
    };
  };

  /** Disegna un lato di un foglio. side = 'front' | 'back'. */
  BF.renderSheet = function (sheet, side, L, S, B, book, sheetNo, info) {
    const { W, H } = info;
    const k = info.k;
    const pw = S.pageW * k, ph = S.pageH * k;
    const x0 = (W - 2 * pw) / 2, y0 = (H - ph) / 2;
    const el = BF.el('div', { class: 'bk-sheet bk-scope' });
    el.style.width = W + 'mm';
    el.style.height = H + 'mm';
    const inner = BF.el('div');
    inner.style.cssText = 'position:absolute;inset:0;' + (side === 'back' && B.rotateBacks ? 'transform:rotate(180deg);' : '');
    const pair = sheet[side];
    pair.forEach((idx, i) => {
      const slot = BF.el('div', { class: 'slot' });
      Object.assign(slot.style, { left: x0 + i * pw + 'mm', top: y0 + 'mm', width: pw + 'mm', height: ph + 'mm' });
      const page = idx == null ? BF.blankPage(S) : BF.renderPage(L, idx, S, book);
      page.style.transformOrigin = '0 0';
      if (k !== 1) page.style.transform = 'scale(' + k + ')';
      slot.appendChild(page);
      inner.appendChild(slot);
    });
    const mark = (x, y, w, h) => {
      const m = BF.el('div', { class: 'mark' });
      Object.assign(m.style, { left: x + 'mm', top: y + 'mm', width: w + 'mm', height: h + 'mm' });
      inner.appendChild(m);
    };
    const cx = W / 2;
    // segni di piega e di cucitura: sul lato interno della piega (il "retro" di ogni foglio)
    if (side === 'back') {
      if (B.foldMarks) {
        mark(cx - 0.1, 0, 0.2, Math.min(5, y0 > 6 ? y0 - 1 : 4));
        mark(cx - 0.1, H - Math.min(5, y0 > 6 ? y0 - 1 : 4), 0.2, Math.min(5, y0 > 6 ? y0 - 1 : 4));
      }
      if (B.sewingMarks && B.sewing >= 2) {
        const n = Math.round(B.sewing);
        for (let i = 0; i < n; i++) mark(cx - 2, y0 + ph * (0.1 + 0.8 * (i / (n - 1))) - 0.15, 4, 0.3);
      }
    }
    if (B.cropMarks && y0 > 4 && x0 > 4) {
      const c = 3, g = 1.5;
      [[x0, y0], [x0 + 2 * pw, y0], [x0, y0 + ph], [x0 + 2 * pw, y0 + ph]].forEach(([x, y], i) => {
        const left = i % 2 === 0, top = i < 2;
        mark(left ? x - g - c : x + g, y - 0.1, c, 0.2);
        mark(x - 0.1, top ? y - g - c : y + g, 0.2, c);
      });
    }
    if (B.labels !== false) {
      const lab = BF.el('div', { class: 'label' }, `${side === 'front' ? 'Fronte' : 'Retro'} · foglio ${sheetNo} · fascicolo ${sheet.sig + 1}`);
      Object.assign(lab.style, { left: '3mm', top: '1.5mm' });
      inner.appendChild(lab);
    }
    el.appendChild(inner);
    return el;
  };
})();
