/* BookForge Web — utilità comuni. Nessuna dipendenza esterna. */
(function () {
  const BF = (window.BF = window.BF || {});

  BF.$ = (s, r) => (r || document).querySelector(s);
  BF.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /** Crea un elemento: el('div', {class:'x', onclick:fn}, figli...) */
  BF.el = function (tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v === false || v == null) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) {
      if (c == null || c === false) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  };

  BF.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  BF.uid = () => 'c' + Math.random().toString(36).slice(2, 9);
  BF.MM = 96 / 25.4; // px per mm (CSS)
  BF.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  BF.num = (v, d) => (isFinite(parseFloat(v)) ? parseFloat(v) : d);
  BF.nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  BF.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  BF.debounce = function (fn, ms) {
    let t;
    return function (...a) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, a), ms);
    };
  };

  /** Archiviazione locale "a prova di errore" (può mancare in finestre private). */
  BF.store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('bfweb.' + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('bfweb.' + k, JSON.stringify(v));
        return true;
      } catch (e) {
        return false;
      }
    },
  };

  BF.download = function (blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 2000);
  };

  BF.safeName = (s) => (String(s || 'libro').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim() || 'libro').slice(0, 80);

  let toastTimer;
  BF.toast = function (msg, kind) {
    let t = BF.$('#toast');
    if (!t) {
      t = BF.el('div', { id: 'toast', role: 'status' });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = ''), kind === 'err' ? 7000 : 3500);
  };

  /** CRC32 (serve per scrivere zip/EPUB). */
  const CRC_T = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  BF.crc32 = function (u8) {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  BF.utf8 = (s) => new TextEncoder().encode(s);
  BF.fromUtf8 = (u8) => new TextDecoder('utf-8').decode(u8);

  BF.fileToDataURL = (blobOrFile) =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(blobOrFile);
    });

  /** Rimpicciolisce le immagini molto grandi (per non appesantire progetto e stampa). */
  BF.shrinkImage = function (dataUrl, maxSide) {
    maxSide = maxSide || 1800;
    return new Promise((res) => {
      if (!/^data:image\/(png|jpe?g|webp)/i.test(dataUrl) || dataUrl.length < 600000) return res(dataUrl);
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, maxSide / Math.max(im.naturalWidth, im.naturalHeight));
        if (k >= 1 && dataUrl.length < 3000000) return res(dataUrl);
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.naturalWidth * k));
        c.height = Math.max(1, Math.round(im.naturalHeight * k));
        const g = c.getContext('2d');
        const png = /^data:image\/png/i.test(dataUrl);
        if (!png) {
          g.fillStyle = '#fff';
          g.fillRect(0, 0, c.width, c.height);
        }
        g.drawImage(im, 0, 0, c.width, c.height);
        try {
          res(png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.88));
        } catch (e) {
          res(dataUrl);
        }
      };
      im.onerror = () => res(dataUrl);
      im.src = dataUrl;
    });
  };

  BF.wordCount = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html || '';
    const s = (t.content.textContent || '').trim();
    return s ? s.split(/\s+/).length : 0;
  };

  /** Piccola finestra modale. Ritorna {close, body}. */
  BF.modal = function (title, bodyNode, buttons) {
    const back = BF.el('div', { class: 'modal-back' });
    const box = BF.el('div', { class: 'modal', role: 'dialog', 'aria-label': title });
    const head = BF.el('div', { class: 'modal-head' }, BF.el('h3', null, title));
    const foot = BF.el('div', { class: 'modal-foot' });
    const close = () => back.remove();
    (buttons || [{ label: 'Chiudi' }]).forEach((b) =>
      foot.appendChild(
        BF.el('button', { class: 'btn ' + (b.primary ? 'primary' : ''), onclick: () => { if (!b.onclick || b.onclick() !== false) close(); } }, b.label)
      )
    );
    box.append(head, bodyNode, foot);
    back.appendChild(box);
    document.body.appendChild(back);
    return { close, box };
  };
})();
