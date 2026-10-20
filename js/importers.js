/* BookForge Web — importazione di EPUB, DOCX, Markdown, TXT e progetti .bookforge.
   Ogni importatore restituisce: { title, author, language, cover, chapters:[{id,title,html,include}] } */
(function () {
  const BF = (window.BF = window.BF || {});
  const { esc } = BF;

  // ---------------------------------------------------------------- utilità comuni
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
  const extOf = (p) => (String(p).split('?')[0].split('.').pop() || '').toLowerCase();

  BF.guessLang = function (text) {
    const s = ' ' + String(text).slice(0, 20000).toLowerCase().replace(/[^a-zà-ÿ'\s]/g, ' ').replace(/\s+/g, ' ') + ' ';
    const sets = {
      it: [' il ', ' che ', ' di ', ' non ', ' una ', ' per ', ' con ', ' della ', ' sono ', ' era '],
      en: [' the ', ' and ', ' of ', ' to ', ' was ', ' that ', ' with ', ' his ', ' her ', ' you '],
      fr: [' le ', ' les ', ' des ', ' est ', ' que ', ' une ', ' pas ', ' dans ', ' pour ', ' il '],
      de: [' der ', ' die ', ' und ', ' nicht ', ' das ', ' ist ', ' ein ', ' mit ', ' zu ', ' ich '],
      es: [' el ', ' los ', ' las ', ' que ', ' una ', ' por ', ' con ', ' del ', ' no ', ' era '],
    };
    let best = 'it', bestN = -1;
    for (const l in sets) {
      const n = sets[l].reduce((a, w) => a + (s.split(w).length - 1), 0);
      if (n > bestN) { bestN = n; best = l; }
    }
    return best;
  };

  function finishBook(book) {
    const used = [];
    book.chapters = book.chapters
      .map((c, i) => {
        let title = (c.title || '').trim();
        let html = c.html || '';
        if (!title) {
          const r = BF.extractLeadingTitle(html);
          title = r.title;
          html = r.html;
        }
        const t = title || 'Capitolo ' + (i + 1);
        return Object.assign({ id: BF.uid(), title: t, html, include: c.include !== false, showTitle: false }, BF.autoKind(t, html));
      })
      .filter((c) => c.html.trim() || c.title);
    if (!book.chapters.length) throw new Error('Non ho trovato nessun testo nel file.');
    book.title = (book.title || '').trim();
    book.author = (book.author || '').trim();
    book.cover = book.cover || null;
    void used;
    return book;
  }

  // ---------------------------------------------------------------- rilevamento capitoli nel testo semplice
  const LABEL_RE = /^(capitolo|cap\.|chapter|chap\.|parte|part|libro|book|prologo|prologue|epilogo|epilogue|prefazione|preface|introduzione|introduction|premessa|appendice|appendix|sezione|section|canto|atto|act|lettera|letter|ringraziamenti|acknowledg|postfazione|afterword|dedica|dedication|kapitel|chapitre|capítulo|capitulo)\b/i;
  const NUM_RE = /^(?:[IVXLCDM]{1,9}|\d{1,3})[.)]?$/;

  function isHeadingLine(lines) {
    if (!lines.length || lines.length > 3) return false;
    if (lines.some((l) => l.length > 80)) return false;
    const first = lines[0].trim();
    if (LABEL_RE.test(first)) return true;
    if (lines.length === 1 && NUM_RE.test(first)) return true;
    if (lines.length === 1 && first.length >= 3 && first.length <= 50 && first === first.toUpperCase() && /[A-ZÀ-Ý]{3}/.test(first) && !/[.!?,;:]$/.test(first)) return 'maybe';
    return false;
  }

  /** paragraphs: [{ lines:[...], html }]. Restituisce capitoli. */
  function detectChapters(paragraphs, fallbackTitle) {
    const chapters = [];
    let cur = null;
    let sure = 0;
    paragraphs.forEach((p) => { if (isHeadingLine(p.lines) === true) sure++; });
    for (const p of paragraphs) {
      const h = isHeadingLine(p.lines);
      if (h === true || (h === 'maybe' && sure >= 2)) {
        cur = { title: p.lines.map((l) => l.trim()).join(' – '), html: '' };
        chapters.push(cur);
      } else {
        if (!cur) { cur = { title: chapters.length ? '' : '', html: '' }; chapters.push(cur); }
        cur.html += p.html;
      }
    }
    if (chapters.length > 1 && !chapters[0].html.trim() && !chapters[0].title) chapters.shift();
    if (chapters.length === 1 && !chapters[0].title) chapters[0].title = fallbackTitle || 'Testo';
    if (chapters.length > 1 && !chapters[0].title) chapters[0].title = 'Introduzione';
    return chapters;
  }

  // ---------------------------------------------------------------- TXT
  BF.importText = function (text, fileName) {
    text = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    let title = '', author = '';
    // intestazione e coda di Project Gutenberg
    const gs = text.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
    if (gs >= 0) {
      const head = text.slice(0, gs);
      title = (head.match(/^Title:\s*(.+)$/im) || [])[1] || '';
      author = (head.match(/^Author:\s*(.+)$/im) || [])[1] || '';
      text = text.slice(text.indexOf('\n', gs) + 1);
      const ge = text.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
      if (ge >= 0) text = text.slice(0, ge);
    }
    const raw = text.split(/\n[ \t]*\n+/).map((s) => s.replace(/^\n+|\n+$/g, '')).filter((s) => s.trim());
    const multi = raw.filter((p) => p.includes('\n'));
    const avgLen = multi.length ? multi.reduce((a, p) => a + p.length / p.split('\n').length, 0) / multi.length : 0;
    const hardWrapped = raw.length > 0 && multi.length / raw.length > 0.5 && avgLen > 35;
    const useUnderscore = (text.match(/\b_[^_\n]{1,80}_\b/g) || []).length >= 3;
    const paragraphs = raw.map((p) => {
      const lines = p.split('\n').map((l) => l.replace(/\s+$/, ''));
      const flat = hardWrapped ? [lines.map((l) => l.trim()).join(' ')] : lines;
      let html = flat.map((l) => esc(l.trim())).join('<br>');
      if (useUnderscore) html = html.replace(/\b_([^_<]{1,200})_\b/g, '<em>$1</em>');
      return { lines, html: '<p>' + html + '</p>' };
    });
    const base = (fileName || 'Libro').replace(/\.[^.]+$/, '');
    const chapters = detectChapters(paragraphs, title || base);
    // il blocco iniziale "titolo/autore" prima del primo capitolo viene tenuto come testo
    return finishBook({
      title: title || base,
      author,
      language: BF.guessLang(text),
      chapters: chapters.map((c) => ({ title: c.title, html: BF.sanitizeHtml(c.html) })),
    });
  };

  // ---------------------------------------------------------------- Markdown
  function mdInline(s) {
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '\u0001' + (codes.length - 1) + '\u0001'; });
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\((data:image\/[^)\s]+)\)/g, '<img alt="$1" src="$2">');
    s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
    s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    s = s.replace(/\*\*([^*\n]+?)\*\*|__([^_\n]+?)__/g, (_, a, b) => '<strong>' + (a || b) + '</strong>');
    s = s.replace(/(^|[^\w*])\*([^*\n]+?)\*(?!\w)/g, '$1<em>$2</em>').replace(/(^|[^\w_])_([^_\n]+?)_(?!\w)/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~\n]+?)~~/g, '<s>$1</s>');
    s = s.replace(/\\([\\`*_{}\[\]()#+\-.!>])/g, '$1');
    s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => '<code>' + esc(codes[+i]) + '</code>');
    return s;
  }

  BF.importMarkdown = function (text, fileName) {
    text = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    let title = '', author = '', language = '';
    const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
    if (fm) {
      fm[1].split('\n').forEach((l) => {
        const m = l.match(/^(title|titolo|author|autore|lang|language|lingua)\s*:\s*(.+)$/i);
        if (!m) return;
        const v = m[2].replace(/^["']|["']$/g, '').trim();
        if (/^(title|titolo)$/i.test(m[1])) title = v;
        else if (/^(author|autore)$/i.test(m[1])) author = v;
        else language = v.slice(0, 2).toLowerCase();
      });
      text = text.slice(fm[0].length);
    }
    const lines = text.split('\n');
    const items = []; // {t:'h', level, text} | {t:'html', html}
    let i = 0, para = [];
    const flushPara = () => {
      if (para.length) {
        const s = para.map((x) => x.trim()).join(' ');
        items.push({ t: 'html', html: '<p>' + mdInline(s) + '</p>' });
        para = [];
      }
    };
    while (i < lines.length) {
      const l = lines[i];
      let m;
      if (!l.trim()) { flushPara(); i++; continue; }
      if (/^```/.test(l)) {
        flushPara();
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        items.push({ t: 'html', html: '<pre>' + esc(buf.join('\n')) + '</pre>' });
      } else if ((m = l.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/))) {
        flushPara();
        items.push({ t: 'h', level: m[1].length, text: m[2] });
        i++;
      } else if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l)) {
        flushPara();
        items.push({ t: 'html', html: '<hr>' });
        i++;
      } else if (/^\s*>/.test(l)) {
        flushPara();
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
        const inner = buf.join('\n').split(/\n\s*\n/).map((p) => '<p>' + mdInline(p.replace(/\n/g, ' ')) + '</p>').join('');
        items.push({ t: 'html', html: '<blockquote>' + inner + '</blockquote>' });
      } else if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
        flushPara();
        const ordered = /^\s*\d+[.)]/.test(l);
        const buf = [];
        while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
        const tag = ordered ? 'ol' : 'ul';
        items.push({ t: 'html', html: `<${tag}>` + buf.map((x) => '<li>' + mdInline(x) + '</li>').join('') + `</${tag}>` });
      } else {
        para.push(l);
        i++;
      }
    }
    flushPara();
    // livello dei capitoli
    const cnt = {};
    items.forEach((it) => it.t === 'h' && (cnt[it.level] = (cnt[it.level] || 0) + 1));
    let chLevel = 0;
    if (cnt[1] === 1 && (cnt[2] || 0) >= 2) {
      const h1 = items.find((it) => it.t === 'h' && it.level === 1);
      if (!title) title = h1.text;
      items.splice(items.indexOf(h1), 1);
      chLevel = 2;
    } else chLevel = [1, 2, 3].find((l) => cnt[l]) || 0;
    let chapters;
    if (chLevel) {
      chapters = [];
      let cur = null;
      for (const it of items) {
        if (it.t === 'h' && it.level <= chLevel) { cur = { title: it.text.replace(/[*_`]/g, ''), html: '' }; chapters.push(cur); }
        else {
          if (!cur) { cur = { title: 'Introduzione', html: '' }; chapters.push(cur); }
          if (it.t === 'h') cur.html += '<h2>' + mdInline(it.text) + '</h2>';
          else cur.html += it.html;
        }
      }
    } else {
      const base = fileName ? fileName.replace(/\.[^.]+$/, '') : 'Libro';
      const paragraphs = items
        .filter((it) => it.t === 'html')
        .map((it) => ({ lines: [it.html.replace(/<[^>]+>/g, '')], html: it.html }));
      chapters = detectChapters(paragraphs, title || base);
    }
    const plain = chapters.map((c) => c.html.replace(/<[^>]+>/g, ' ')).join(' ');
    return finishBook({
      title: title || (fileName || 'Libro').replace(/\.[^.]+$/, ''),
      author,
      language: language || BF.guessLang(plain),
      chapters: chapters.map((c) => ({ title: c.title, html: BF.sanitizeHtml(c.html) })),
    });
  };

  // ---------------------------------------------------------------- EPUB
  const xml = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const byName = (doc, name) => Array.from(doc.getElementsByTagNameNS('*', name));
  const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');
  function resolvePath(base, href) {
    href = decodeURIComponent(String(href).split('#')[0].split('?')[0]);
    if (/^[a-z]+:/i.test(href)) return null;
    const parts = (href.startsWith('/') ? href.slice(1) : dirOf(base) + href).split('/');
    const out = [];
    for (const p of parts) {
      if (p === '..') out.pop();
      else if (p && p !== '.') out.push(p);
    }
    return out.join('/');
  }

  BF.importEpub = async function (buf, fileName) {
    const zip = await BF.zipOpen(buf);
    if (!zip.has('META-INF/container.xml')) throw new Error('Questo EPUB non è valido (manca container.xml).');
    if (zip.has('META-INF/encryption.xml')) {
      const enc = await zip.text('META-INF/encryption.xml');
      if (/EncryptedData/i.test(enc) && !/obfuscation/i.test(enc)) throw new Error('Questo EPUB è protetto da DRM e non può essere aperto.');
    }
    const container = xml(await zip.text('META-INF/container.xml'));
    const opfPath = byName(container, 'rootfile')[0].getAttribute('full-path');
    const opf = xml(await zip.text(opfPath));
    const meta = (n) => (byName(opf, n)[0] || {}).textContent || '';
    const creators = byName(opf, 'creator').map((e) => e.textContent.trim()).filter(Boolean);
    const manifest = {};
    byName(opf, 'item').forEach((it) => {
      manifest[it.getAttribute('id')] = {
        href: resolvePath(opfPath, it.getAttribute('href') || ''),
        type: it.getAttribute('media-type') || '',
        props: it.getAttribute('properties') || '',
      };
    });
    const spine = byName(opf, 'itemref').map((r) => ({ id: r.getAttribute('idref'), linear: r.getAttribute('linear') }));

    // stili: classi che significano corsivo / maiuscoletto / centrato
    const classFx = {};
    for (const id in manifest) {
      if (manifest[id].type === 'text/css' && manifest[id].href && zip.has(manifest[id].href)) {
        try { BF.cssClassFx(await zip.text(manifest[id].href), classFx); } catch (e) { /* ignora */ }
      }
    }

    // titoli dal sommario (nav o NCX) come ripiego
    const tocTitles = {};
    for (const id in manifest) {
      const m = manifest[id];
      try {
        if (/nav/.test(m.props) && zip.has(m.href)) {
          const d = new DOMParser().parseFromString(await zip.text(m.href), 'text/html');
          d.querySelectorAll('nav a[href]').forEach((a) => {
            const p = resolvePath(m.href, a.getAttribute('href'));
            if (p && !tocTitles[p]) tocTitles[p] = a.textContent.replace(/\s+/g, ' ').trim();
          });
        } else if (m.type === 'application/x-dtbncx+xml' && zip.has(m.href)) {
          const d = xml(await zip.text(m.href));
          byName(d, 'navPoint').forEach((np) => {
            const c = byName(np, 'content')[0];
            const t = byName(np, 'text')[0];
            const p = c && resolvePath(m.href, c.getAttribute('src'));
            if (p && t && !tocTitles[p]) tocTitles[p] = t.textContent.replace(/\s+/g, ' ').trim();
          });
        }
      } catch (e) { /* ignora */ }
    }

    const imgCache = new Map();
    async function loadImg(path) {
      if (!path || !zip.has(path)) return null;
      if (imgCache.has(path)) return imgCache.get(path);
      const mime = MIME[extOf(path)];
      if (!mime) return null;
      let url = await BF.fileToDataURL(new Blob([await zip.read(path)], { type: mime }));
      url = await BF.shrinkImage(url);
      imgCache.set(path, url);
      return url;
    }

    const chapters = [];
    for (const ref of spine) {
      const it = manifest[ref.id];
      if (!it || !it.href || !zip.has(it.href) || !/x?html|xml/.test(it.type) || /\bnav\b/.test(it.props)) continue;
      const src = await zip.text(it.href);
      const doc = new DOMParser().parseFromString(src, 'text/html');
      doc.querySelectorAll('style').forEach((s) => BF.cssClassFx(s.textContent, classFx));
      for (const im of Array.from(doc.querySelectorAll('img, image'))) {
        const href = im.getAttribute('src') || im.getAttribute('xlink:href') || im.getAttribute('href');
        const url = await loadImg(href && resolvePath(it.href, href));
        if (url) im.setAttribute('data-bf-src', url);
      }
      const html = BF.sanitizeNode(doc.body || doc.documentElement, { classFx });
      if (!html.trim()) continue;
      const base = it.href.split('/').pop().replace(/\.[^.]+$/, '');
      const textLen = BF.htmlToText(html).length;
      const skipName = /^(cover|titlepage|title|toc|nav|contents|copyright|colophon|imprint|halftitle|half-title|frontmatter|blank)/i.test(base);
      const lead = BF.extractLeadingTitle(html);
      chapters.push({
        title: lead.title || tocTitles[it.href] || '',
        html: lead.title ? lead.html : html,
        include: !(skipName && textLen < 1500) && ref.linear !== 'no',
      });
    }

    // copertina
    let cover = null;
    const coverMeta = byName(opf, 'meta').find((m) => m.getAttribute('name') === 'cover');
    let coverItem = Object.values(manifest).find((m) => /cover-image/.test(m.props));
    if (!coverItem && coverMeta) coverItem = manifest[coverMeta.getAttribute('content')];
    if (coverItem) cover = await loadImg(coverItem.href);

    return finishBook({
      title: meta('title'),
      author: creators.slice(0, 3).join(' e '),
      language: (meta('language') || '').slice(0, 2).toLowerCase() || BF.guessLang(chapters.map((c) => BF.htmlToText(c.html)).join(' ')),
      cover,
      chapters,
    });
  };

  // ---------------------------------------------------------------- DOCX
  BF.importDocx = async function (buf, fileName) {
    const zip = await BF.zipOpen(buf);
    if (!zip.has('word/document.xml')) throw new Error('Questo file non sembra un documento Word (.docx).');
    const W = (el, n) => Array.from(el.children).filter((c) => c.localName === n);
    const W1 = (el, n) => (el ? W(el, n)[0] : null);
    const val = (el) => (el ? el.getAttribute('w:val') || el.getAttributeNS('*', 'val') || (Array.from(el.attributes).find((a) => a.localName === 'val') || {}).value || '' : '');
    const attr = (el, n) => (Array.from(el.attributes).find((a) => a.localName === n) || {}).value || '';

    const doc = xml(await zip.text('word/document.xml'));
    // stili
    const styleNames = {};
    if (zip.has('word/styles.xml')) {
      byName(xml(await zip.text('word/styles.xml')), 'style').forEach((s) => {
        const n = W1(s, 'name');
        styleNames[attr(s, 'styleId')] = n ? val(n) : '';
      });
    }
    // numerazione
    const numFmt = {};
    if (zip.has('word/numbering.xml')) {
      const nd = xml(await zip.text('word/numbering.xml'));
      const abs = {};
      byName(nd, 'abstractNum').forEach((a) => {
        const lvl = W(a, 'lvl')[0];
        abs[attr(a, 'abstractNumId')] = lvl ? val(W1(lvl, 'numFmt')) : '';
      });
      byName(nd, 'num').forEach((n) => { numFmt[attr(n, 'numId')] = abs[val(W1(n, 'abstractNumId'))] || ''; });
    }
    // immagini
    const rels = {};
    if (zip.has('word/_rels/document.xml.rels')) {
      byName(xml(await zip.text('word/_rels/document.xml.rels')), 'Relationship').forEach((r) => {
        rels[r.getAttribute('Id')] = resolvePath('word/document.xml', r.getAttribute('Target') || '');
      });
    }
    const imgCache = new Map();
    async function imgHtml(rid) {
      const path = rels[rid];
      if (!path || !zip.has(path) || !MIME[extOf(path)]) return '';
      if (!imgCache.has(path)) {
        let url = await BF.fileToDataURL(new Blob([await zip.read(path)], { type: MIME[extOf(path)] }));
        imgCache.set(path, await BF.shrinkImage(url));
      }
      return '<img src="' + imgCache.get(path) + '">';
    }
    // metadati
    let title = '', author = '', language = '';
    if (zip.has('docProps/core.xml')) {
      const core = xml(await zip.text('docProps/core.xml'));
      title = (byName(core, 'title')[0] || {}).textContent || '';
      author = (byName(core, 'creator')[0] || {}).textContent || '';
      language = ((byName(core, 'language')[0] || {}).textContent || '').slice(0, 2).toLowerCase();
    }

    const isOn = (el) => el && !/^(0|false|off)$/i.test(val(el) || '1');
    async function runHtml(r) {
      const rPr = W1(r, 'rPr');
      const fmt = [];
      if (rPr) {
        if (isOn(W1(rPr, 'b'))) fmt.push('strong');
        if (isOn(W1(rPr, 'i'))) fmt.push('em');
        if (isOn(W1(rPr, 'strike'))) fmt.push('s');
        if (isOn(W1(rPr, 'smallCaps'))) fmt.push('sc');
        const va = val(W1(rPr, 'vertAlign'));
        if (va === 'superscript') fmt.push('sup');
        if (va === 'subscript') fmt.push('sub');
      }
      let inner = '';
      for (const ch of r.children) {
        const n = ch.localName;
        if (n === 't') inner += esc(ch.textContent);
        else if (n === 'tab') inner += ' ';
        else if (n === 'noBreakHyphen') inner += '‑';
        else if (n === 'br') { if (attr(ch, 'type') !== 'page') inner += '<br>'; }
        else if (n === 'drawing' || n === 'pict') {
          for (const b of byName(ch, 'blip')) inner += await imgHtml(attr(b, 'embed'));
          for (const b of byName(ch, 'imagedata')) inner += await imgHtml(attr(b, 'id'));
        }
      }
      return { key: fmt.join('+'), fmt, html: inner };
    }
    async function collectRuns(el, out) {
      for (const ch of el.children) {
        const n = ch.localName;
        if (n === 'r') out.push(await runHtml(ch));
        else if (n === 'hyperlink' || n === 'smartTag' || n === 'ins' || n === 'sdt' || n === 'sdtContent' || n === 'fldSimple') await collectRuns(ch, out);
      }
    }
    async function paraInner(p) {
      const runs = [];
      await collectRuns(p, runs);
      const merged = [];
      for (const r of runs) {
        const last = merged[merged.length - 1];
        if (last && last.key === r.key) last.html += r.html;
        else merged.push({ key: r.key, fmt: r.fmt, html: r.html });
      }
      return merged
        .map((r) => r.fmt.reduceRight((acc, t) => (t === 'sc' ? '<span class="sc">' + acc + '</span>' : `<${t}>${acc}</${t}>`), r.html))
        .join('');
    }

    const body = byName(doc, 'body')[0];
    const items = []; // {t:'h',level,html,text} | {t:'html',html}
    let list = null;
    const flushList = () => { if (list) { items.push({ t: 'html', html: `<${list.tag}>${list.items.join('')}</${list.tag}>` }); list = null; } };
    let docTitle = '';

    async function handleBlock(el) {
      const n = el.localName;
      if (n === 'sdt') { for (const c of W(W1(el, 'sdtContent') || el, 'p')) await handleBlock(c); return; }
      if (n === 'tbl') {
        flushList();
        let h = '<table>';
        for (const tr of W(el, 'tr')) {
          h += '<tr>';
          for (const tc of W(tr, 'tc')) {
            const cell = [];
            for (const p of W(tc, 'p')) cell.push(await paraInner(p));
            h += '<td>' + cell.filter(Boolean).join('<br>') + '</td>';
          }
          h += '</tr>';
        }
        items.push({ t: 'html', html: h + '</table>' });
        return;
      }
      if (n !== 'p') return;
      const pPr = W1(el, 'pPr');
      const styleId = val(W1(pPr, 'pStyle'));
      const sname = styleNames[styleId] || styleId || '';
      const html = await paraInner(el);
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      const hm = sname.match(/^(?:heading|titolo|überschrift|titre|encabezado|título)\s*(\d)$/i) || styleId.match(/^(?:heading|titolo)(\d)$/i);
      if (hm && text) { flushList(); items.push({ t: 'h', level: +hm[1], html, text }); return; }
      if (/^(title|titolo|titel|titre|título)$/i.test(sname) && text) { flushList(); if (!docTitle) docTitle = text; return; }
      const jc = val(W1(pPr, 'jc'));
      const numPr = W1(pPr, 'numPr');
      if (numPr && html.trim()) {
        const fmt = numFmt[val(W1(numPr, 'numId'))] || 'bullet';
        const tag = fmt === 'bullet' || fmt === 'none' ? 'ul' : 'ol';
        if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
        list.items.push('<li>' + html + '</li>');
        return;
      }
      flushList();
      if (!html.trim()) return;
      if (/quote|citazione|blockquote|cita/i.test(sname)) items.push({ t: 'html', html: '<blockquote><p>' + html + '</p></blockquote>' });
      else items.push({ t: 'html', html: '<p' + (jc === 'center' ? ' class="c"' : jc === 'right' ? ' class="r"' : '') + '>' + html + '</p>', text });
    }
    for (const el of body.children) await handleBlock(el);
    flushList();

    const cnt = {};
    items.forEach((it) => it.t === 'h' && (cnt[it.level] = (cnt[it.level] || 0) + 1));
    const chLevel = [1, 2, 3].find((l) => cnt[l]) || 0;
    let chapters;
    if (chLevel) {
      chapters = [];
      let cur = null;
      for (const it of items) {
        if (it.t === 'h' && it.level <= chLevel) { cur = { title: it.text, html: '' }; chapters.push(cur); }
        else {
          if (!cur) { cur = { title: 'Introduzione', html: '' }; chapters.push(cur); }
          cur.html += it.t === 'h' ? '<h2>' + it.html + '</h2>' : it.html;
        }
      }
    } else {
      const paragraphs = items.filter((it) => it.t === 'html').map((it) => ({ lines: [it.text || it.html.replace(/<[^>]+>/g, ' ').trim()], html: it.html }));
      chapters = detectChapters(paragraphs, title || docTitle || fileName);
    }
    const plain = chapters.map((c) => c.html.replace(/<[^>]+>/g, ' ')).join(' ');
    return finishBook({
      title: title || docTitle || (fileName || 'Libro').replace(/\.[^.]+$/, ''),
      author,
      language: language || BF.guessLang(plain),
      chapters: chapters.map((c) => ({ title: c.title, html: BF.sanitizeHtml(c.html) })),
    });
  };

  // ---------------------------------------------------------------- punto d'ingresso
  BF.importFile = async function (file) {
    const name = file.name || 'libro';
    const ext = extOf(name);
    if (file.size > 400 * 1024 * 1024) throw new Error('File troppo grande (oltre 400 MB).');
    if (ext === 'epub') return BF.importEpub(await file.arrayBuffer(), name);
    if (ext === 'docx') return BF.importDocx(await file.arrayBuffer(), name);
    if (ext === 'md' || ext === 'markdown') return BF.importMarkdown(await file.text(), name);
    if (ext === 'txt' || ext === 'text' || ext === '') return BF.importText(await file.text(), name);
    if (ext === 'doc') throw new Error('Il vecchio formato .doc non è supportato: salva il file come .docx da Word o Pages.');
    if (ext === 'pdf') throw new Error('I PDF non si possono importare: il testo andrebbe perso. Usa EPUB, DOCX, Markdown o TXT.');
    if (ext === 'mobi' || ext === 'azw3') throw new Error('Formato Kindle non supportato: convertilo in EPUB (ad es. con Calibre).');
    throw new Error('Formato ".' + ext + '" non supportato. Usa EPUB, DOCX, Markdown o TXT.');
  };
})();
