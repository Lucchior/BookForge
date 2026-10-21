/* BookForge Web — visualizzatore a pagine affiancate (usato in "Aspetto", "Anteprima" e "Rilegatura"). */
(function () {
  const BF = (window.BF = window.BF || {});
  const { el, MM } = BF;

  /**
   * Viewer generico: mostra una "vista" alla volta (due pagine affiancate, un foglio, la copertina...).
   * provider: { count(), build(i) -> {el, w, h} (w e h in mm), label(i) }
   */
  BF.Viewer = class Viewer {
    constructor(root, opts) {
      this.root = root;
      this.opts = opts || {};
      this.i = 0;
      this.zoom = 'fit';
      this.provider = null;
      root.classList.add('viewer');
      this.bar = el('div', { class: 'vbar' });
      this.stage = el('div', { class: 'vstage' });
      this.scaler = el('div', { class: 'vscaler' });
      this.stage.appendChild(this.scaler);
      root.append(this.bar, this.stage);
      this.prev = el('button', { class: 'btn small', 'aria-label': 'Precedente', onclick: () => this.go(this.i - 1) }, '◀');
      this.next = el('button', { class: 'btn small', 'aria-label': 'Successiva', onclick: () => this.go(this.i + 1) }, '▶');
      this.first = el('button', { class: 'btn small', 'aria-label': 'Prima', onclick: () => this.go(0) }, '⏮');
      this.last = el('button', { class: 'btn small', 'aria-label': 'Ultima', onclick: () => this.go(1e9) }, '⏭');
      this.num = el('input', { type: 'number', min: 1, class: 'vnum', 'aria-label': 'Vai alla vista numero', onchange: () => this.go(parseInt(this.num.value, 10) - 1) });
      this.of = el('span', { class: 'muted' });
      this.lab = el('span', { class: 'vlabel' });
      this.zoomSel = el('select', { 'aria-label': 'Zoom', onchange: (e) => { this.zoom = e.target.value; this.fit(); } },
        [['fit', 'Adatta'], ['0.5', '50%'], ['0.75', '75%'], ['1', '100%'], ['1.5', '150%']].map((z) => el('option', { value: z[0] }, z[1])));
      this.extra = el('span', { class: 'vextra' });
      this.bar.append(this.first, this.prev, this.num, this.of, this.next, this.last, this.lab, el('span', { class: 'grow' }), this.extra, el('label', { class: 'zl' }, 'Zoom ', this.zoomSel));
      if (opts && opts.extra) opts.extra(this.extra, this);
      this._ro = new ResizeObserver(() => { if (this.zoom === 'fit') this.fit(); });
      this._ro.observe(this.stage);
      root.addEventListener('keydown', (e) => {
        if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
        if (e.key === 'ArrowRight') this.go(this.i + 1);
        if (e.key === 'ArrowLeft') this.go(this.i - 1);
      });
      root.tabIndex = 0;
    }
    setProvider(p, keepIndex) {
      this.provider = p;
      this.go(keepIndex ? this.i : p.start ? p.start() : 0);
    }
    clear(msg) {
      this.provider = null;
      this.scaler.innerHTML = '';
      this.scaler.appendChild(el('div', { class: 'empty' }, msg || ''));
      this.scaler.style.width = this.scaler.style.height = '';
      this.scaler.style.transform = '';
      this.of.textContent = '';
      this.lab.textContent = '';
    }
    go(i) {
      const p = this.provider;
      if (!p) return;
      const n = p.count();
      this.i = BF.clamp(isFinite(i) ? i : 0, 0, Math.max(0, n - 1));
      const v = p.build(this.i);
      this.scaler.innerHTML = '';
      this.inner = v.el;
      this.natW = v.w * MM;
      this.natH = v.h * MM;
      this.scaler.appendChild(v.el);
      this.num.value = this.i + 1;
      this.num.max = n;
      this.of.textContent = '/ ' + n;
      this.lab.textContent = p.label ? p.label(this.i) : '';
      this.prev.disabled = this.first.disabled = this.i <= 0;
      this.next.disabled = this.last.disabled = this.i >= n - 1;
      this.fit();
    }
    refresh() { if (this.provider) this.go(this.i); }
    fit() {
      if (!this.inner) return;
      let z = parseFloat(this.zoom);
      if (this.zoom === 'fit' || !isFinite(z)) {
        const w = this.stage.clientWidth - 32, h = this.stage.clientHeight - 32;
        z = Math.max(0.1, Math.min(w / this.natW, h / this.natH, 3));
        if (!isFinite(z) || w <= 0) z = 0.6;
      }
      this.z = z;
      this.scaler.style.width = this.natW * z + 'px';
      this.scaler.style.height = this.natH * z + 'px';
      this.inner.style.transformOrigin = '0 0';
      this.inner.style.transform = 'scale(' + z + ')';
    }
  };

  /** Fornitore "pagine affiancate" per un libro impaginato. */
  BF.spreadProvider = function (L, S, book, opts) {
    opts = opts || {};
    const n = L.total;
    const spreads = Math.floor((n + 1) / 2) + 1; // 0: pagina 1 da sola a destra; poi coppie (2,3), (4,5)...
    const single = !!opts.single;
    return {
      count: () => (single ? n : spreads),
      start: () => (opts.startPage != null ? (single ? opts.startPage : Math.floor((opts.startPage + 1) / 2)) : 0),
      label(i) {
        if (single) return L.pages[i] && L.pages[i].label != null ? 'pagina ' + L.pages[i].label : 'pagina ' + (i + 1) + ' (inizio)';
        const [a, b] = this.pair(i);
        const t = (x) => (x == null || x >= n ? '—' : L.pages[x].label != null ? L.pages[x].label : 'ini.');
        return 'pagine ' + t(a) + ' e ' + t(b);
      },
      pair(i) { return i === 0 ? [null, 0] : [2 * i - 1, 2 * i]; },
      build(i) {
        const wrap = el('div', { class: 'bk-spread' });
        wrap.style.cssText = 'display:flex;gap:0;';
        const idxs = single ? [i] : this.pair(i);
        idxs.forEach((x, k) => {
          const holder = el('div', { class: 'pg-shadow' });
          if (x == null || x >= n) holder.appendChild(single ? BF.blankPage(S) : el('div', { class: 'bk-page', style: 'background:transparent' }));
          else holder.appendChild(BF.renderPage(L, x, S, book));
          if ((x == null || x >= n) && !single) { holder.style.boxShadow = 'none'; holder.firstChild.style.background = 'transparent'; holder.firstChild.className = 'bk-page'; BF.applyVars(holder.firstChild, S); }
          wrap.appendChild(holder);
        });
        return { el: wrap, w: S.pageW * idxs.length, h: S.pageH };
      },
    };
  };
})();
