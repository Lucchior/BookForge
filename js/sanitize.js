/* BookForge Web — pulizia (sanificazione) dell'HTML importato.
   Il libro importato è un file di terzi: qui tutto ciò che non è in una lista di elementi ammessi viene scartato
   (script, stili, eventi, link, iframe...). Il risultato è una sequenza PIATTA di blocchi: p, h1-h6, blockquote,
   ul/ol, hr, pre, table, immagini. Le immagini sono ammesse solo come data: URL. */
(function () {
  const BF = (window.BF = window.BF || {});

  const SKIP = new Set(['script', 'style', 'head', 'title', 'meta', 'link', 'noscript', 'iframe', 'object', 'embed', 'audio', 'video', 'form', 'button', 'input', 'select', 'textarea', 'template', 'canvas', 'math', 'nav']);
  const CONTAINER = new Set(['div', 'section', 'article', 'main', 'body', 'html', 'header', 'footer', 'aside', 'figure', 'figcaption', 'center', 'address', 'details', 'summary', 'dl', 'dd', 'dt', 'fieldset', 'tbody', 'thead', 'tfoot']);
  const INLINE_MAP = { em: 'em', i: 'em', cite: 'em', dfn: 'em', var: 'em', strong: 'strong', b: 'strong', u: 'u', ins: 'u', s: 's', strike: 's', del: 's', sup: 'sup', sub: 'sub', small: 'small', code: 'code', kbd: 'code', samp: 'code', tt: 'code' };
  const OK_IMG = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/i;
  const OK_CLASS = new Set(['c', 'r', 'sc', 'noind']);

  const collapse = (t) => t.replace(/[ \t\r\n\f​]+/g, ' ');

  /** Effetti di stile derivati da attributo style/classe (es. corsivo, maiuscoletto, centrato). */
  function fx(node, ctx) {
    const r = { i: false, b: false, sc: false, c: false, r: false, ind: false };
    const apply = (o) => { for (const k in o) if (o[k]) r[k] = true; };
    const cls = (node.getAttribute && node.getAttribute('class')) || '';
    if (ctx && ctx.classFx) cls.split(/\s+/).forEach((c) => c && ctx.classFx[c] && apply(ctx.classFx[c]));
    cls.split(/\s+/).forEach((c) => { if (OK_CLASS.has(c)) r[c === 'sc' ? 'sc' : c] = true; });
    const st = ((node.getAttribute && node.getAttribute('style')) || '').toLowerCase();
    if (st) apply(parseDecl(st));
    const al = ((node.getAttribute && node.getAttribute('align')) || '').toLowerCase();
    if (al === 'center') r.c = true;
    if (al === 'right') r.r = true;
    return r;
  }
  function parseDecl(decl) {
    const o = {};
    if (/font-style\s*:\s*(italic|oblique)/.test(decl)) o.i = true;
    if (/font-weight\s*:\s*(bold|[6-9]00)/.test(decl)) o.b = true;
    if (/font-variant[a-z-]*\s*:\s*[^;]*small-caps/.test(decl)) o.sc = true;
    if (/text-align\s*:\s*center/.test(decl)) o.c = true;
    if (/text-align\s*:\s*right/.test(decl)) o.r = true;
    if (/margin-left\s*:\s*[2-9](\.\d+)?(em|rem)|margin-left\s*:\s*[1-9]\d%/.test(decl)) o.ind = true;
    return o;
  }

  /** Legge le regole CSS semplici ".classe { ... }" di un foglio di stile (per gli EPUB prodotti da Calibre ecc.). */
  BF.cssClassFx = function (cssText, into) {
    into = into || {};
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(String(cssText).replace(/\/\*[\s\S]*?\*\//g, '')))) {
      const effects = parseDecl(m[2].toLowerCase());
      if (!Object.keys(effects).length) continue;
      m[1].split(',').forEach((sel) => {
        const mm = sel.trim().match(/^(?:[a-z0-9]+)?\.([\w-]+)$/i);
        if (mm) into[mm[1]] = Object.assign(into[mm[1]] || {}, effects);
      });
    }
    return into;
  };

  function newDoc() {
    return document.implementation.createHTMLDocument('');
  }

  /** Copia pulita dei contenuti "inline" di src dentro dst. */
  function cleanInline(src, dst, doc, ctx, depth) {
    if (depth > 40) return;
    for (const ch of src.childNodes) {
      if (ch.nodeType === 3) {
        dst.appendChild(doc.createTextNode(collapse(ch.nodeValue)));
        continue;
      }
      if (ch.nodeType !== 1) continue;
      const tag = ch.tagName.toLowerCase();
      if (SKIP.has(tag)) continue;
      if (tag === 'br') { dst.appendChild(doc.createElement('br')); continue; }
      if (tag === 'img' || tag === 'image' || tag === 'svg') {
        const im = makeImg(ch, doc, ctx);
        if (im) dst.appendChild(im);
        continue;
      }
      if (tag === 'ul' || tag === 'ol') { dst.appendChild(makeList(ch, doc, ctx, depth + 1)); continue; }
      const f = fx(ch, ctx);
      let target = dst;
      const wrappers = [];
      const base = INLINE_MAP[tag];
      if (base) wrappers.push(base);
      if (f.i && base !== 'em') wrappers.push('em');
      if (f.b && base !== 'strong') wrappers.push('strong');
      let node = dst;
      for (const w of wrappers) {
        const e = doc.createElement(w);
        node.appendChild(e);
        node = e;
      }
      if (f.sc) {
        const e = doc.createElement('span');
        e.className = 'sc';
        node.appendChild(e);
        node = e;
      }
      cleanInline(ch, node, doc, ctx, depth + 1);
      if (node === dst) continue; // nessun wrapper: contenuti già inseriti
      // elimina wrapper vuoti
      if (!node.textContent && !node.querySelector('img,br')) {
        let top = node;
        while (top.parentNode && top.parentNode !== dst) top = top.parentNode;
        if (top.parentNode === dst) dst.removeChild(top);
      }
    }
  }

  function makeImg(node, doc, ctx) {
    const tag = node.tagName.toLowerCase();
    let src = node.getAttribute('data-bf-src') || '';
    if (!src && tag === 'img') src = node.getAttribute('src') || '';
    if (!src && tag === 'svg') {
      const inner = node.querySelector('image');
      if (inner) src = inner.getAttribute('data-bf-src') || '';
    }
    if (!src && tag === 'image') src = node.getAttribute('data-bf-src') || '';
    if (!OK_IMG.test(src)) return null; // niente immagini remote né altri protocolli
    const im = doc.createElement('img');
    im.setAttribute('src', src.replace(/\s+/g, ''));
    const alt = node.getAttribute && node.getAttribute('alt');
    if (alt) im.setAttribute('alt', alt.slice(0, 200));
    return im;
  }

  function makeList(node, doc, ctx, depth) {
    const list = doc.createElement(node.tagName.toLowerCase() === 'ol' ? 'ol' : 'ul');
    for (const li of node.children) {
      if (li.tagName.toLowerCase() !== 'li') continue;
      const e = doc.createElement('li');
      cleanInline(li, e, doc, ctx, depth + 1);
      if (e.textContent.trim() || e.querySelector('img')) list.appendChild(e);
    }
    return list;
  }

  function makeTable(node, doc, ctx) {
    const t = doc.createElement('table');
    for (const tr of node.querySelectorAll('tr')) {
      const r = doc.createElement('tr');
      for (const c of tr.children) {
        const ct = c.tagName.toLowerCase();
        if (ct !== 'td' && ct !== 'th') continue;
        const cell = doc.createElement(ct);
        cleanInline(c, cell, doc, ctx, 0);
        r.appendChild(cell);
      }
      if (r.children.length) t.appendChild(r);
    }
    return t.children.length ? t : null;
  }

  const hasContent = (e) => !!(e.textContent.replace(/[\s ]/g, '') || (e.querySelector && e.querySelector('img,hr,table')));

  function trimEdges(p) {
    // toglie spazi e <br> a inizio/fine paragrafo
    const isBlankText = (n) => n.nodeType === 3 && !n.nodeValue.trim();
    while (p.firstChild && (isBlankText(p.firstChild) || p.firstChild.nodeName === 'BR')) p.removeChild(p.firstChild);
    while (p.lastChild && (isBlankText(p.lastChild) || p.lastChild.nodeName === 'BR')) p.removeChild(p.lastChild);
    if (p.firstChild && p.firstChild.nodeType === 3) p.firstChild.nodeValue = p.firstChild.nodeValue.replace(/^\s+/, '');
    if (p.lastChild && p.lastChild.nodeType === 3) p.lastChild.nodeValue = p.lastChild.nodeValue.replace(/\s+$/, '');
  }

  const SCENE_RE = /^[\s*•·◆◇❖✦✧~#=_\-–—.+]{3,}$/;

  /** Costruisce la lista piatta di blocchi a partire da un nodo sorgente. */
  function buildBlocks(root, doc, ctx) {
    const out = [];
    let cur = null;
    const flush = () => {
      if (cur) {
        trimEdges(cur);
        if (hasContent(cur)) out.push(cur);
        cur = null;
      }
    };
    const ensure = (f) => {
      if (!cur) {
        cur = doc.createElement('p');
        if (f && f.c) cur.className = 'c';
      }
      return cur;
    };
    function pushBlock(e) {
      flush();
      if (e && hasContent(e)) out.push(e);
    }
    function walk(node, depth) {
      if (depth > 60) return;
      for (const ch of node.childNodes) {
        if (ch.nodeType === 3) {
          const t = collapse(ch.nodeValue);
          if (cur || t.trim()) ensure().appendChild(doc.createTextNode(t));
          continue;
        }
        if (ch.nodeType !== 1) continue;
        const tag = ch.tagName.toLowerCase();
        if (SKIP.has(tag)) continue;
        const f = fx(ch, ctx);
        if (tag === 'p' || /^h[1-6]$/.test(tag)) {
          flush();
          const e = doc.createElement(tag);
          const cl = [];
          if (f.c) cl.push('c');
          if (f.r) cl.push('r');
          if (f.sc && tag === 'p') cl.push('sc');
          if (cl.length) e.className = cl.join(' ');
          let target = e;
          if (tag === 'p' && f.i) { target = doc.createElement('em'); e.appendChild(target); }
          cleanInline(ch, target, doc, ctx, 0);
          trimEdges(e);
          if (tag === 'p' && f.ind && !e.className.includes('c')) {
            const bq = doc.createElement('blockquote');
            bq.appendChild(e);
            pushBlock(bq);
          } else if (hasContent(e)) {
            const txt = e.textContent.trim();
            if (tag === 'p' && SCENE_RE.test(txt) && !e.querySelector('img')) out.push(doc.createElement('hr'));
            else out.push(e);
          }
        } else if (tag === 'blockquote') {
          flush();
          const bq = doc.createElement('blockquote');
          buildBlocks(ch, doc, ctx).forEach((b) => bq.appendChild(b));
          pushBlock(bq);
        } else if (tag === 'ul' || tag === 'ol') {
          flush();
          const l = makeList(ch, doc, ctx, 0);
          if (l.children.length) out.push(l);
        } else if (tag === 'hr') {
          flush();
          out.push(doc.createElement('hr'));
        } else if (tag === 'pre') {
          flush();
          const pre = doc.createElement('pre');
          pre.textContent = ch.textContent.replace(/\s+$/, '');
          pushBlock(pre);
        } else if (tag === 'table') {
          flush();
          const t = makeTable(ch, doc, ctx);
          if (t) out.push(t);
        } else if (tag === 'img' || tag === 'image' || tag === 'svg') {
          const im = makeImg(ch, doc, ctx);
          if (im) {
            flush();
            const p = doc.createElement('p');
            p.className = 'img';
            p.appendChild(im);
            out.push(p);
          }
        } else if (tag === 'br') {
          if (cur) cur.appendChild(doc.createElement('br'));
        } else if (CONTAINER.has(tag)) {
          flush();
          if (f.ind) {
            const bq = doc.createElement('blockquote');
            buildBlocks(ch, doc, ctx).forEach((b) => bq.appendChild(b));
            pushBlock(bq);
          } else walk(ch, depth + 1);
          flush();
        } else if (tag === 'li') {
          flush();
          const p = doc.createElement('p');
          cleanInline(ch, p, doc, ctx, 0);
          pushBlock(p);
        } else {
          // elemento inline (a, span, em, strong...) o sconosciuto: finisce nel paragrafo corrente
          const holder = ensure(f);
          const tmp = doc.createElement('div');
          tmp.appendChild(ch.cloneNode(true));
          cleanInline(tmp, holder, doc, ctx, 0);
        }
      }
    }
    walk(root, 0);
    flush();
    return out;
  }

  /** API: da un Element sorgente a stringa HTML sicura e piatta. */
  BF.sanitizeNode = function (root, ctx) {
    const doc = newDoc();
    const blocks = buildBlocks(root, doc, ctx || {});
    const wrap = doc.createElement('div');
    blocks.forEach((b) => wrap.appendChild(b));
    return wrap.innerHTML;
  };

  /** API: da una stringa HTML qualsiasi a stringa HTML sicura e piatta. */
  BF.sanitizeHtml = function (html, ctx) {
    const d = new DOMParser().parseFromString('<!doctype html><body>' + String(html || ''), 'text/html');
    return BF.sanitizeNode(d.body, ctx);
  };

  /** Se il primo blocco è un titolo (h1-h6 breve) lo toglie dal corpo e lo restituisce. */
  BF.extractLeadingTitle = function (html) {
    const t = document.createElement('template');
    t.innerHTML = html;
    const first = t.content.firstElementChild;
    if (first && /^H[1-3]$/.test(first.tagName) && !first.querySelector('img')) {
      const title = first.textContent.replace(/\s+/g, ' ').trim();
      if (title && title.length <= 140) {
        first.remove();
        return { title, html: t.innerHTML };
      }
    }
    return { title: '', html };
  };

  BF.htmlToText = function (html) {
    const t = document.createElement('template');
    t.innerHTML = html;
    const out = [];
    for (const b of t.content.children) {
      const tag = b.tagName;
      if (tag === 'HR') out.push('* * *');
      else if (tag === 'UL' || tag === 'OL') out.push(Array.from(b.children).map((li, i) => (tag === 'OL' ? i + 1 + '. ' : '- ') + li.textContent.trim()).join('\n'));
      else out.push(b.textContent.replace(/\s+/g, ' ').trim());
    }
    return out.filter(Boolean).join('\n\n');
  };
})();
