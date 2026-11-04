/* StickStudio – editor application */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const f = n => Math.round(n * 100) / 100;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rot = (x, y, deg) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [x * c - y * s, x * s + y * c]; };
  let uidN = 0;
  const uid = () => 'i' + Date.now().toString(36) + (uidN++).toString(36);

  const FORMATS = {
    a4p:     { name: 'A4 portrait',   w: 794,  h: 1123 },
    a4l:     { name: 'A4 landscape',  w: 1123, h: 794 },
    letterp: { name: 'Letter portrait', w: 816, h: 1056 },
    letterl: { name: 'Letter landscape', w: 1056, h: 816 },
    square:  { name: 'Square',        w: 900,  h: 900 },
    strip:   { name: 'Comic strip (wide)', w: 1500, h: 520 },
  };
  const DEFAULT_TEXT = { speech: 'Hello!', rounded: 'Hi there!', thought: 'Hmm...', shout: 'AAARGH!', whisper: 'psst...', caption: 'Meanwhile...', text: 'Text', sfx: 'BOOM!' };
  const SFX_PRESETS = ['BOOM!', 'POW!', 'ZOOOM', 'WHOOSH', 'CRASH!', 'SPLASH!', 'GRR!', 'ROAR!', 'AAARGH!', 'HELLO', '!?', 'ZZZ...'];
  const STORE_KEY = 'stickstudio.doc.v1';
  const INDEX_KEY = 'stickstudio.projects.v1', PROJ_PREFIX = 'stickstudio.proj.', PRESET_KEY = 'stickstudio.mychars.v1', HELP_KEY = 'stickstudio.helpSeen';
  // layout presets: cols per row, optional row heights and per-row panel width ratios
  const LAYOUTS = [
    { name: 'Single panel', cols: [1] },
    { name: 'Strip of 3', cols: [3] },
    { name: '2 × 2', cols: [2, 2] },
    { name: '3 rows × 2', cols: [2, 2, 2] },
    { name: '3 × 3', cols: [3, 3, 3] },
    { name: '4 rows × 2', cols: [2, 2, 2, 2] },
    { name: 'Classic page', cols: [3, 2, 3] },
    { name: 'Splash on top', cols: [1, 3], heights: [1.8, 1] },
    { name: 'Big finish', cols: [3, 1], heights: [1, 1.8] },
    { name: 'Big middle', cols: [2, 1, 2], heights: [1, 1.5, 1] },
    { name: '2 + 1', cols: [2, 1] },
    { name: '1 + 2', cols: [1, 2] },
    { name: 'Staggered', cols: [2, 2, 2], widths: [[2, 1], [1, 2], [2, 1]] },
    { name: 'Wide + narrow', cols: [2, 2], widths: [[1, 2], [2, 1]] },
    { name: '4-koma (vertical)', cols: [1, 1, 1, 1] },
    { name: 'Webcomic strip of 4', cols: [4] },
  ];

  // ------------------------------------------------------------------ document model
  function defaultLayout(rows = 2, cols = 2) {
    return { rows, cols: Array(rows).fill(cols), heights: Array(rows).fill(1), widths: [], margin: 28, gutter: 14, border: 4, radius: 0, borderColor: '#1d1d1d', title: '', titleSize: 34, titleFont: 'Comic Sans MS, Comic Neue, cursive', pageBg: '#ffffff' };
  }
  const newPage = layout => ({ id: uid(), layout: layout ? JSON.parse(JSON.stringify(layout)) : defaultLayout(), panels: {}, items: [] });
  const newDoc = () => ({ id: uid(), title: 'My cartoon', format: 'a4p', mono: false, pages: [newPage()] });

  let doc = null;
  const state = { page: 0, sel: null, selPanel: null, zoom: 1, tab: 'characters', libChar: 'boy', libExpr: 'happy', dragId: null, clipboard: null, guides: [] };

  const fmt = (pg = page()) => FORMATS[(pg && pg.format) || doc.format] || FORMATS.a4p;
  const page = () => doc.pages[state.page];
  const selItem = () => state.sel ? page().items.find(i => i.id === state.sel) || null : null;

  function normLayout(L) {
    L.rows = clamp(Math.round(L.rows) || 1, 1, 10);
    if (!Array.isArray(L.cols)) L.cols = [];
    if (!Array.isArray(L.heights)) L.heights = [];
    if (!Array.isArray(L.widths)) L.widths = [];
    while (L.cols.length < L.rows) L.cols.push(L.cols[L.cols.length - 1] || 2);
    while (L.heights.length < L.rows) L.heights.push(1);
    L.cols.length = L.rows; L.heights.length = L.rows;
    L.cols = L.cols.map(c => clamp(Math.round(c) || 1, 1, 10));
    L.heights = L.heights.map(h => clamp(+h || 1, 0.2, 5));
    L.widths.length = L.rows;
    for (let r = 0; r < L.rows; r++) {
      const w = Array.isArray(L.widths[r]) ? L.widths[r] : [];
      while (w.length < L.cols[r]) w.push(1);
      w.length = L.cols[r];
      L.widths[r] = w.map(x => clamp(+x || 1, 0.2, 5));
    }
    return L;
  }

  function computePanels(pg) {
    const F = fmt(pg), L = normLayout(pg.layout);
    const m = +L.margin, g = +L.gutter;
    const titleH = L.title ? L.titleSize * 1.5 : 0;
    const x0 = m, y0 = m + titleH, aw = F.w - 2 * m, ah = F.h - 2 * m - titleH;
    const hs = L.heights.reduce((a, b) => a + b, 0);
    const availH = ah - g * (L.rows - 1);
    const list = []; let y = y0;
    for (let r = 0; r < L.rows; r++) {
      const rh = availH * L.heights[r] / hs, n = L.cols[r];
      const ws = L.widths[r], wsum = ws.reduce((a, b) => a + b, 0), availW = aw - g * (n - 1);
      let x = x0;
      for (let c = 0; c < n; c++) { const cw = availW * ws[c] / wsum; list.push({ key: `${r}-${c}`, r, c, x, y, w: cw, h: rh }); x += cw + g; }
      y += rh + g;
    }
    const map = {}; list.forEach(p => map[p.key] = p);
    return { list, map, L };
  }

  function panelFor(it, PM) {
    let P = PM.map[it.panel];
    if (!P) {
      const [r, c] = String(it.panel || '0-0').split('-').map(Number);
      const L = PM.L;
      const rr = clamp(r || 0, 0, L.rows - 1), cc = clamp(c || 0, 0, L.cols[rr] - 1);
      it.panel = `${rr}-${cc}`; P = PM.map[it.panel];
    }
    // keep the composition when the panel changes size (layout / format / margins edits)
    if (it.pw && it.ph && (Math.abs(it.pw - P.w) > 0.01 || Math.abs(it.ph - P.h) > 0.01)) {
      const rw = P.w / it.pw, rh = P.h / it.ph, k = Math.min(rw, rh);
      it.x *= rw; it.y *= rh; it.w *= k; it.h *= k;
      if (it.type === 'balloon') { it.tx *= k; it.ty *= k; it.size *= k; }
    }
    it.pw = P.w; it.ph = P.h;
    return P;
  }

  function panelAt(p, PM) {
    let best = null, bd = Infinity;
    for (const P of PM.list) {
      const dx = Math.max(P.x - p[0], 0, p[0] - (P.x + P.w)), dy = Math.max(P.y - p[1], 0, p[1] - (P.y + P.h));
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = P; }
    }
    return best;
  }

  const nat = it => it.type === 'figure' ? [FIG.NW, FIG.NH] : it.type === 'object' ? [(OBJ.OBJECTS[it.obj] || { w: 50 }).w, (OBJ.OBJECTS[it.obj] || { h: 50 }).h] : [it.w, it.h];

  // ------------------------------------------------------------------ rendering
  function itemTransform(it, P) {
    const ax = P.x + it.x, ay = P.y + it.y;
    if (it.type === 'balloon') return `translate(${f(ax)},${f(ay)}) rotate(${f(it.rot || 0)})`;
    const [nw, nh] = nat(it);
    const sx = (it.flipX ? -1 : 1) * it.w / nw, sy = (it.flipY ? -1 : 1) * it.h / nh;
    return `translate(${f(ax)},${f(ay)}) rotate(${f(it.rot || 0)}) scale(${f(sx * 1000) / 1000},${f(sy * 1000) / 1000}) translate(${f(-nw / 2)},${f(-nh / 2)})`;
  }

  function itemSvg(it, P, editor) {
    let inner = '', hit = '';
    const [nw, nh] = nat(it);
    if (it.type === 'figure') inner = FIG.draw(it);
    else if (it.type === 'object') {
      const o = OBJ.OBJECTS[it.obj];
      inner = o ? `<g fill="none" stroke="${it.color || '#1d1d1d'}" stroke-width="${it.lw || 3}" stroke-linecap="round" stroke-linejoin="round">${o.svg(it)}</g>` : '';
    } else inner = BAL.draw(it);
    if (editor) hit = it.type === 'balloon'
      ? `<rect x="${f(-it.w / 2)}" y="${f(-it.h / 2)}" width="${f(it.w)}" height="${f(it.h)}" fill="transparent" stroke="none"/>`
      : `<rect x="0" y="0" width="${nw}" height="${nh}" fill="transparent" stroke="none"/>`;
    const op = it.opacity != null && it.opacity < 1 ? ` opacity="${it.opacity}"` : '';
    const mono = it.mono ? ' filter="url(#mono)"' : '';
    const lock = editor && it.locked ? ' pointer-events="none"' : '';
    return `<g class="item" data-id="${it.id}" transform="${itemTransform(it, P)}"${op}${mono}${lock}>${hit}${inner}</g>`;
  }

  function sceneSvg(pd, P, rad) {
    const sc = OBJ.SCENES[pd.scene];
    if (!sc || pd.scene === 'none') return '';
    const z = pd.sceneZoom || 1;
    const vw = 400 / z, vh = 300 / z;
    const vx = 200 - vw / 2 + (pd.sceneX || 0), vy = 300 - vh;
    const content = pd.sceneFlip ? `<g transform="translate(400,0) scale(-1,1)">${sc.svg()}</g>` : sc.svg();
    return `<svg x="${f(P.x)}" y="${f(P.y)}" width="${f(P.w)}" height="${f(P.h)}" viewBox="${f(vx)} ${f(vy)} ${f(vw)} ${f(vh)}" preserveAspectRatio="xMidYMax slice" overflow="hidden"><g fill="none" stroke="${pd.sceneColor || '#3a3a3a'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="${pd.sceneOpacity != null ? pd.sceneOpacity : 1}"${pd.sceneMono ? ' filter="url(#mono)"' : ''}>${content}</g></svg>`;
  }

  function pageContent(pg, opts = {}) {
    const editor = !opts.export;
    const F = fmt(pg), L = pg.layout, PM = computePanels(pg);
    let defs = `<filter id="mono"><feColorMatrix type="saturate" values="0"/></filter>`;
    let body = `<rect x="0" y="0" width="${F.w}" height="${F.h}" fill="${L.pageBg || '#fff'}"/>`;
    if (L.title) body += `<text x="${F.w / 2}" y="${f(L.margin + L.titleSize * 1.05)}" text-anchor="middle" font-family="${esc(L.titleFont)}" font-size="${L.titleSize}" font-weight="bold" fill="${L.borderColor || '#1d1d1d'}">${esc(L.title)}</text>`;
    const rad = +L.radius || 0;
    const unclipped = [];
    let dragged = '';
    const byPanel = {};
    for (const it of pg.items) {
      const P = panelFor(it, PM);
      if (editor && it.id === state.dragId) { dragged = itemSvg(it, P, editor); continue; }
      if (it.clip === false) { unclipped.push(itemSvg(it, P, editor)); continue; }
      (byPanel[P.key] = byPanel[P.key] || []).push(itemSvg(it, P, editor));
    }
    for (const P of PM.list) {
      const pd = pg.panels[P.key] || {};
      const cid = `clip-${pg.id}-${P.key}`;
      defs += `<clipPath id="${cid}"><rect x="${f(P.x)}" y="${f(P.y)}" width="${f(P.w)}" height="${f(P.h)}" rx="${rad}"/></clipPath>`;
      let inner = `<rect class="panel-bg" data-panel="${P.key}" x="${f(P.x)}" y="${f(P.y)}" width="${f(P.w)}" height="${f(P.h)}" fill="${pd.bg || '#ffffff'}"/>`;
      inner += sceneSvg(pd, P, rad);
      inner += (byPanel[P.key] || []).join('');
      const bw = pd.noBorder ? 0 : +L.border;
      const border = bw > 0 ? `<rect x="${f(P.x)}" y="${f(P.y)}" width="${f(P.w)}" height="${f(P.h)}" rx="${rad}" fill="none" stroke="${L.borderColor}" stroke-width="${bw}" pointer-events="none"/>` : '';
      body += `<g class="panel" data-panel="${P.key}"><g clip-path="url(#${cid})">${inner}</g>${border}</g>`;
    }
    body += unclipped.join('') + dragged;
    const mono = opts.mono || doc.mono;
    let out = `<defs>${defs}</defs><g${mono ? ' filter="url(#mono)"' : ''}>${body}</g>`;
    if (editor) out += `<g id="overlay">${overlaySvg(PM)}</g>`;
    return out;
  }

  function overlaySvg(PM) {
    const z = state.zoom, hs = 9 / z, sw = 1.5 / z;
    let o = '';
    for (const g of state.guides) o += `<line x1="${f(g[0])}" y1="${f(g[1])}" x2="${f(g[2])}" y2="${f(g[3])}" stroke="#ff3fa4" stroke-width="${sw}" stroke-dasharray="${4 / z} ${3 / z}" pointer-events="none"/>`;
    const it = selItem();
    if (!it && state.selPanel && PM.map[state.selPanel]) {
      const P = PM.map[state.selPanel];
      o += `<rect x="${f(P.x - 3 / z)}" y="${f(P.y - 3 / z)}" width="${f(P.w + 6 / z)}" height="${f(P.h + 6 / z)}" fill="none" stroke="#2f6fed" stroke-width="${2 / z}" stroke-dasharray="${6 / z} ${4 / z}" pointer-events="none"/>`;
    }
    if (!it) return o;
    const P = panelFor(it, PM);
    const c = [P.x + it.x, P.y + it.y], r = it.rot || 0;
    const pt = (x, y) => { const v = rot(x, y, r); return [c[0] + v[0], c[1] + v[1]]; };
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({ sx, sy, p: pt(sx * it.w / 2, sy * it.h / 2) }));
    o += `<polygon points="${corners.map(k => f(k.p[0]) + ',' + f(k.p[1])).join(' ')}" fill="none" stroke="#2f6fed" stroke-width="${sw}" stroke-dasharray="${5 / z} ${3 / z}" pointer-events="none"/>`;
    if (it.locked) return o;
    const top = pt(0, -it.h / 2), rh = pt(0, -it.h / 2 - 26 / z);
    o += `<line x1="${f(top[0])}" y1="${f(top[1])}" x2="${f(rh[0])}" y2="${f(rh[1])}" stroke="#2f6fed" stroke-width="${sw}" pointer-events="none"/>`;
    o += `<circle data-h="rot" cx="${f(rh[0])}" cy="${f(rh[1])}" r="${f(hs * 0.7)}" fill="#fff" stroke="#2f6fed" stroke-width="${sw}"/>`;
    corners.forEach(k => o += `<rect data-h="corner" data-sx="${k.sx}" data-sy="${k.sy}" x="${f(k.p[0] - hs / 2)}" y="${f(k.p[1] - hs / 2)}" width="${f(hs)}" height="${f(hs)}" fill="#fff" stroke="#2f6fed" stroke-width="${sw}"/>`);
    if (it.type === 'balloon' && it.tail !== false && BAL.STYLES[it.style].tail) {
      const tp = pt(it.tx, it.ty);
      o += `<circle data-h="tail" cx="${f(tp[0])}" cy="${f(tp[1])}" r="${f(hs * 0.75)}" fill="#ffb020" stroke="#fff" stroke-width="${sw}"><title>Drag to aim the tail</title></circle>`;
    }
    return o;
  }

  const svg = $('#page');
  function renderCanvas() {
    const F = fmt();
    svg.setAttribute('viewBox', `0 0 ${F.w} ${F.h}`);
    svg.setAttribute('width', Math.round(F.w * state.zoom));
    svg.setAttribute('height', Math.round(F.h * state.zoom));
    svg.innerHTML = pageContent(page());
    $('#zoomLabel').textContent = Math.round(state.zoom * 100) + '%';
  }
  function renderOverlay() {
    const g = svg.querySelector('#overlay');
    if (g) g.innerHTML = overlaySvg(computePanels(page()));
  }
  function renderAll() { renderCanvas(); renderPageTabs(); renderInspector(); }

  // ------------------------------------------------------------------ history & persistence
  let history = [], hIndex = -1, commitTimer = null, fileSnap = null, thumbTimer = null;
  function snapshot() { return JSON.stringify(doc); }
  function commit() {
    clearTimeout(commitTimer); commitTimer = null;
    const s = snapshot();
    if (history[hIndex] === s) return;
    history = history.slice(0, hIndex + 1); history.push(s);
    if (history.length > 150) history.shift();
    hIndex = history.length - 1;
    save(); afterChange();
  }
  const commitSoon = () => { clearTimeout(commitTimer); commitTimer = setTimeout(commit, 450); };
  function restore(s) {
    doc = JSON.parse(s);
    state.page = clamp(state.page, 0, doc.pages.length - 1);
    if (!selItem()) state.sel = null;
    renderAll(); save(); afterChange();
  }
  function undo() { if (commitTimer) commit(); if (hIndex > 0) { hIndex--; restore(history[hIndex]); } }
  function redo() { if (hIndex < history.length - 1) { hIndex++; restore(history[hIndex]); } }
  function resetHistory() { history = []; hIndex = -1; commit(); }
  // after each change: refresh undo buttons, unsaved marker and (debounced) page thumbnails
  function afterChange() {
    $('#btnUndo').disabled = hIndex <= 0;
    $('#btnRedo').disabled = hIndex >= history.length - 1;
    const dirty = fileSnap !== null ? fileSnap !== history[hIndex] : true;
    $('#dirtyMark').hidden = !dirty;
    document.title = (dirty ? '● ' : '') + (doc.title || 'Cartoon') + ' – StickStudio';
    clearTimeout(thumbTimer); thumbTimer = setTimeout(renderPageTabs, 300);
  }
  const markFileSaved = () => { fileSnap = history[hIndex] || snapshot(); afterChange(); };

  // ---- browser storage: the open cartoon + a list of recent projects
  const readJSON = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const projIndex = () => readJSON(INDEX_KEY, []);
  function save() {
    try {
      if (!doc.id) doc.id = uid();
      const s = snapshot();
      localStorage.setItem(STORE_KEY, s);
      localStorage.setItem(PROJ_PREFIX + doc.id, s);
      const idx = projIndex().filter(p => p.id !== doc.id);
      idx.unshift({ id: doc.id, title: doc.title || 'Untitled', updated: Date.now(), pages: doc.pages.length });
      localStorage.setItem(INDEX_KEY, JSON.stringify(idx.slice(0, 40)));
    } catch (e) { if (!save.warned) { save.warned = true; toast('Browser storage is full – use Save to keep a file copy', 5000); } }
  }

  /** Make any loaded document safe to use (old versions, hand-edited or partly broken files). */
  function migrateDoc(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.pages) || !d.pages.length) throw new Error('this is not a StickStudio project');
    d.id = d.id || uid();
    d.title = typeof d.title === 'string' ? d.title : 'My cartoon';
    if (!FORMATS[d.format]) d.format = 'a4p';
    d.mono = !!d.mono;
    d.pages = d.pages.filter(p => p && typeof p === 'object').map(p => {
      p.id = p.id || uid();
      p.layout = Object.assign(defaultLayout(), p.layout || {});
      normLayout(p.layout);
      if (p.format && !FORMATS[p.format]) delete p.format;
      p.panels = p.panels && typeof p.panels === 'object' ? p.panels : {};
      p.items = (Array.isArray(p.items) ? p.items : []).filter(it => it && typeof it === 'object' && (
        (it.type === 'figure' && FIG.CHARACTERS[it.char]) || (it.type === 'object' && OBJ.OBJECTS[it.obj]) || (it.type === 'balloon' && BAL.STYLES[it.style])));
      p.items.forEach(it => {
        it.id = it.id || uid();
        if (it.type === 'figure' && !FIG.POSES[it.pose]) it.pose = 'stand';
        if (it.type === 'figure' && !FIG.EXPRESSIONS[it.expr]) it.expr = 'happy';
        ['x', 'y', 'w', 'h'].forEach(k => { if (!isFinite(+it[k])) it[k] = k === 'w' || k === 'h' ? 80 : 50; else it[k] = +it[k]; });
      });
      return p;
    });
    if (!d.pages.length) throw new Error('the project has no pages');
    return d;
  }
  function loadDoc(d, fromFile) {
    if (commitTimer) commit();
    doc = migrateDoc(d); state.page = 0; state.sel = null; state.selPanel = null;
    fileSnap = null; resetHistory(); if (fromFile) markFileSaved();
    renderAll(); zoomFit();
  }

  function toast(msg, ms = 2200, action) {
    const t = $('#toast'); t.innerHTML = esc(msg); t.hidden = false;
    if (action) {
      const b = document.createElement('button'); b.textContent = action.label;
      b.onclick = () => { t.hidden = true; action.fn(); }; t.appendChild(b);
    }
    clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, ms);
  }

  // ------------------------------------------------------------------ item factories
  function makeItem(spec, P, at) {
    const cx = at ? at[0] - P.x : P.w / 2, cy = at ? at[1] - P.y : P.h * 0.55;
    const figH = clamp(Math.min(P.h * 0.58, P.w * 1.1), 60, 420);
    const s = figH / FIG.NH;
    let it;
    if (spec.kind === 'figure') {
      it = { type: 'figure', char: spec.char, pose: spec.pose, expr: spec.expr || 'happy', fx: (FIG.POSES[spec.pose] && FIG.POSES[spec.pose].fxAuto) ? FIG.POSES[spec.pose].fxAuto.slice() : [], w: FIG.NW * s, h: FIG.NH * s, lw: 4, color: '#1d1d1d' };
      if (spec.style) Object.assign(it, spec.style); // saved "my character" look
    } else if (spec.kind === 'object') {
      const o = OBJ.OBJECTS[spec.obj];
      let k = s;
      if (o.h * k > P.h * 0.92) k = P.h * 0.92 / o.h;
      if (o.w * k > P.w * 0.95) k = P.w * 0.95 / o.w;
      it = { type: 'object', obj: spec.obj, w: o.w * k, h: o.h * k, lw: 3, color: '#1d1d1d' };
    } else if (spec.kind === 'balloon') {
      const style = spec.style;
      it = { type: 'balloon', style, text: spec.text || DEFAULT_TEXT[style], font: style === 'sfx' ? 'Impact, Arial Black, sans-serif' : 'Comic Sans MS, Comic Neue, cursive', size: style === 'sfx' ? 44 : 17, bold: style === 'shout', italic: false, upper: false, align: 'center', color: '#1d1d1d', fill: BAL.STYLES[style].fill, stroke: '#1d1d1d', lw: 2.5, tail: BAL.STYLES[style].tail, autoFit: true, clip: false, rot: style === 'sfx' ? -8 : 0 };
      if (style === 'whisper') it.italic = true;
      Object.assign(it, BAL.fit(it));
      it.tx = -it.w * 0.18; it.ty = it.h / 2 + 34;
    }
    Object.assign(it, { id: uid(), panel: P.key, pw: P.w, ph: P.h, x: cx, y: cy, rot: it.rot || 0, flipX: false, flipY: false });
    return it;
  }

  function addFromSpec(spec, pagePt) {
    const pg = page(), PM = computePanels(pg);
    if (spec.kind === 'scene') {
      const P = pagePt ? panelAt(pagePt, PM) : PM.map[state.selPanel] || PM.list[0];
      pg.panels[P.key] = Object.assign(pg.panels[P.key] || {}, { scene: spec.scene });
      state.selPanel = P.key; state.sel = null;
      commit(); renderAll(); return;
    }
    let P;
    if (pagePt) P = panelAt(pagePt, PM);
    else {
      const cur = selItem();
      P = PM.map[state.selPanel] || (cur && PM.map[cur.panel]) || PM.list[0];
    }
    const it = makeItem(spec, P, pagePt);
    pg.items.push(it);
    state.sel = it.id; state.selPanel = P.key;
    commit(); renderAll();
  }

  // ------------------------------------------------------------------ pointer interaction
  function toPage(e) {
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [q.x, q.y];
  }
  let drag = null, lastClick = { id: null, t: 0 };

  svg.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    closeInline(true);
    const p = toPage(e);
    const PM = computePanels(page());
    const hEl = e.target.closest('[data-h]');
    const it = selItem();
    if (hEl && it) {
      const P = panelFor(it, PM), c = [P.x + it.x, P.y + it.y], r = it.rot || 0;
      const t = hEl.dataset.h;
      if (t === 'corner') {
        const sx = +hEl.dataset.sx, sy = +hEl.dataset.sy;
        const a = rot(-sx * it.w / 2, -sy * it.h / 2, r);
        const tipv = it.type === 'balloon' ? rot(it.tx, it.ty, r) : [0, 0];
        drag = { t, sx, sy, anchor: [c[0] + a[0], c[1] + a[1]], w0: it.w, h0: it.h, tip0: [c[0] + tipv[0], c[1] + tipv[1]], size0: it.size };
      } else drag = { t, c };
    } else {
      const el = e.target.closest('.item');
      if (el) {
        const id = el.dataset.id;
        const now = Date.now();
        if (lastClick.id === id && now - lastClick.t < 380) {
          const clicked = page().items.find(i => i.id === id);
          if (clicked && clicked.type === 'balloon') { lastClick = { id: null, t: 0 }; openInline(clicked); e.preventDefault(); return; }
        }
        lastClick = { id, t: now };
        if (state.sel !== id) { state.sel = id; const ci = selItem(); state.selPanel = ci.panel; renderCanvas(); renderInspector(); }
        const ci = selItem();
        if (e.altKey) { const copy = cloneItem(ci); page().items.push(copy); state.sel = copy.id; }
        const cur = selItem();
        drag = { t: 'move', p0: p, x0: cur.x, y0: cur.y, moved: false };
      } else {
        const P = panelAt(p, PM);
        const inside = P && p[0] >= P.x && p[0] <= P.x + P.w && p[1] >= P.y && p[1] <= P.y + P.h;
        state.sel = null; state.selPanel = inside ? P.key : null;
        renderCanvas(); renderInspector();
        return;
      }
    }
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    const it = selItem(); if (!it) return;
    const p = toPage(e);
    const PM = computePanels(page());
    const P = panelFor(it, PM);
    const r = it.rot || 0;
    if (drag.t === 'move') {
      const dx = p[0] - drag.p0[0], dy = p[1] - drag.p0[1];
      if (!drag.moved && Math.hypot(dx, dy) * state.zoom < 3) return;
      drag.moved = true; state.dragId = it.id;
      it.x = drag.x0 + dx; it.y = drag.y0 + dy;
      // snapping: centre of item to panel centre lines and to other items' centres (hold Ctrl to disable)
      state.guides = [];
      if (!e.ctrlKey && !e.metaKey) {
        const th = 6 / state.zoom, cx = P.x + it.x, cy = P.y + it.y;
        const xs = [[P.x + P.w / 2, P]], ys = [[P.y + P.h / 2, P]];
        for (const o of page().items) {
          if (o === it) continue;
          const Q = panelFor(o, PM); xs.push([Q.x + o.x, Q]); ys.push([Q.y + o.y, Q]);
        }
        let bx = null, by = null;
        for (const [x] of xs) if (Math.abs(x - cx) < th && (bx === null || Math.abs(x - cx) < Math.abs(bx - cx))) bx = x;
        for (const [y] of ys) if (Math.abs(y - cy) < th && (by === null || Math.abs(y - cy) < Math.abs(by - cy))) by = y;
        if (bx !== null) { it.x = bx - P.x; state.guides.push([bx, P.y, bx, P.y + P.h]); }
        if (by !== null) { it.y = by - P.y; state.guides.push([P.x, by, P.x + P.w, by]); }
      }
    } else if (drag.t === 'corner') {
      const v = rot(p[0] - drag.anchor[0], p[1] - drag.anchor[1], -r);
      let w = Math.max(12, v[0] * drag.sx), h = Math.max(12, v[1] * drag.sy);
      const keep = it.type === 'balloon' ? (it.style === 'sfx' ? !e.shiftKey : e.shiftKey) : !e.shiftKey;
      if (keep) { const s = Math.max(w / drag.w0, h / drag.h0); w = drag.w0 * s; h = drag.h0 * s; }
      it.w = w; it.h = h;
      const cv = rot(drag.sx * w / 2, drag.sy * h / 2, r);
      const c = [drag.anchor[0] + cv[0], drag.anchor[1] + cv[1]];
      it.x = c[0] - P.x; it.y = c[1] - P.y;
      if (it.type === 'balloon') {
        const t = rot(drag.tip0[0] - c[0], drag.tip0[1] - c[1], -r); it.tx = t[0]; it.ty = t[1];
        if (it.style === 'sfx') it.size = Math.max(8, Math.round(drag.size0 * h / drag.h0));
        it.autoFit = false;
      }
    } else if (drag.t === 'rot') {
      let a = Math.atan2(p[1] - drag.c[1], p[0] - drag.c[0]) * 180 / Math.PI + 90;
      if (a > 180) a -= 360;
      if (e.shiftKey) a = Math.round(a / 15) * 15; else if (Math.abs(a) < 4) a = 0;
      it.rot = Math.round(a);
    } else if (drag.t === 'tail') {
      const t = rot(p[0] - drag.c[0], p[1] - drag.c[1], -r);
      it.tx = t[0]; it.ty = t[1];
    }
    renderCanvas();
  });

  function endDrag() {
    if (!drag) return;
    const it = selItem();
    if (it && drag.t === 'move' && drag.moved) {
      const PM = computePanels(page()), P = panelFor(it, PM);
      const c = [P.x + it.x, P.y + it.y];
      const inside = PM.list.find(Q => c[0] >= Q.x && c[0] <= Q.x + Q.w && c[1] >= Q.y && c[1] <= Q.y + Q.h);
      if (inside && inside.key !== P.key) { it.panel = inside.key; it.x = c[0] - inside.x; it.y = c[1] - inside.y; it.pw = inside.w; it.ph = inside.h; state.selPanel = inside.key; }
    }
    const changed = drag.t !== 'move' || drag.moved;
    drag = null; state.dragId = null; state.guides = [];
    if (changed) { commit(); renderCanvas(); renderInspector(); }
  }
  svg.addEventListener('dblclick', e => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const g = el && el.closest && el.closest('.item');
    const it = g && page().items.find(i => i.id === g.dataset.id);
    if (it && it.type === 'balloon' && inlineId !== it.id) { state.sel = it.id; openInline(it); }
  });
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  // Ctrl + wheel zoom
  $('#stageScroll').addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(state.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }, { passive: false });

  function setZoom(z) { state.zoom = clamp(z, 0.2, 4); closeInline(true); renderCanvas(); }
  function zoomFit() {
    const sc = $('#stageScroll'), F = fmt();
    const z = Math.min((sc.clientWidth - 60) / F.w, (sc.clientHeight - 60) / F.h);
    setZoom(z > 0 ? z : 1);
  }

  // ------------------------------------------------------------------ inline balloon text editor
  const inline = $('#inlineEditor');
  let inlineId = null;
  function openInline(it) {
    const PM = computePanels(page()), P = panelFor(it, PM);
    const inner = BAL.innerSize(it);
    const z = state.zoom;
    const w = Math.max(inner.w * z + 16, 140), h = Math.max(inner.h * z + 16, 50);
    const sr = svg.getBoundingClientRect(), wr = $('#canvasWrap').getBoundingClientRect();
    const cx = sr.left - wr.left + (P.x + it.x) * z, cy = sr.top - wr.top + (P.y + it.y) * z;
    Object.assign(inline.style, {
      left: (cx - w / 2) + 'px', top: (cy - h / 2) + 'px', width: w + 'px', height: h + 'px',
      fontFamily: it.font, fontSize: (it.size * z) + 'px', fontWeight: it.bold ? 'bold' : 'normal', fontStyle: it.italic ? 'italic' : 'normal',
      textAlign: it.align || 'center', textTransform: it.upper ? 'uppercase' : 'none', color: it.style === 'sfx' ? '#1d1d1d' : it.color
    });
    inline.value = it.text || '';
    inline.hidden = false; inlineId = it.id;
    inline.focus(); inline.select();
  }
  function closeInline(keep) {
    if (!inlineId) return;
    inline.hidden = true; inlineId = null;
    if (keep) { commit(); renderInspector(); }
  }
  inline.addEventListener('input', () => {
    const it = page().items.find(i => i.id === inlineId); if (!it) return;
    it.text = inline.value;
    if (it.autoFit !== false) refit(it);
    renderCanvas();
    const ta = $('#inspector textarea[data-k="text"]'); if (ta) ta.value = it.text;
  });
  inline.addEventListener('blur', () => closeInline(true));
  inline.addEventListener('keydown', e => {
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); closeInline(true); }
    e.stopPropagation();
  });

  function refit(it) {
    const PM = computePanels(page()), P = panelFor(it, PM);
    const r = it.rot || 0;
    const c = [P.x + it.x, P.y + it.y];
    const tv = rot(it.tx || 0, it.ty || 0, r);
    const tip = [c[0] + tv[0], c[1] + tv[1]];
    Object.assign(it, BAL.fit(it));
    const t = rot(tip[0] - c[0], tip[1] - c[1], -r); it.tx = t[0]; it.ty = t[1];
  }

  // ------------------------------------------------------------------ library (left)
  function thumbSvg(inner, w, h, pad = 6) { return `<svg viewBox="${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`; }
  const figThumb = (char, pose, expr, extra = {}) => thumbSvg(FIG.draw(Object.assign({ char, pose, expr, fx: (FIG.POSES[pose].fxAuto || []), lw: 4.5 }, extra)), FIG.NW, FIG.NH, 4);
  const objThumb = id => { const o = OBJ.OBJECTS[id]; return thumbSvg(`<g fill="none" stroke="#1d1d1d" stroke-width="${Math.max(3, Math.max(o.w, o.h) / 40)}" stroke-linecap="round" stroke-linejoin="round">${o.svg({})}</g>`, o.w, o.h); };
  const sceneThumb = id => `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"><rect width="400" height="300" fill="#fff"/><g fill="none" stroke="#3a3a3a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${OBJ.SCENES[id].svg()}</g></svg>`;
  const balThumb = (style, text) => {
    const it = { style, text: text || DEFAULT_TEXT[style], font: style === 'sfx' ? 'Impact, Arial Black, sans-serif' : 'Comic Sans MS, cursive', size: style === 'sfx' ? 34 : 16, bold: style === 'shout', italic: style === 'whisper', align: 'center', color: '#1d1d1d', fill: BAL.STYLES[style].fill, stroke: '#1d1d1d', lw: 2.5 };
    Object.assign(it, BAL.fit(it)); it.tx = -it.w * 0.2; it.ty = it.h / 2 + 22;
    const W = it.w + 30, H = it.h + 50;
    return `<svg viewBox="${-W / 2} ${-it.h / 2 - 12} ${W} ${H}" preserveAspectRatio="xMidYMid meet">${BAL.draw(it)}</svg>`;
  };

  function thumbHtml(spec, svgHtml, label, cls = '') {
    return `<div class="thumb ${cls}" draggable="true" data-spec='${esc(JSON.stringify(spec))}' title="${esc(label)}">${svgHtml}<span>${esc(label)}</span></div>`;
  }

  function renderLibrary() {
    $$('.lib-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
    let h = '';
    if (state.tab === 'characters') {
      const mine = readJSON(PRESET_KEY, []);
      if (mine.length) {
        h += `<div class="lib-section">My characters</div><div class="grid">`;
        mine.forEach((m, i) => {
          const spec = { kind: 'figure', char: m.char, pose: 'stand', expr: state.libExpr, style: m.style };
          h += `<div class="thumb mine" draggable="true" data-spec='${esc(JSON.stringify(spec))}' title="${esc(m.name)}">${figThumb(m.char, 'stand', state.libExpr, m.style)}<span>${esc(m.name)}</span><button class="del-mine" data-delmine="${i}" title="Remove from My characters">×</button></div>`;
        });
        h += `</div>`;
      }
      h += `<div class="lib-section">Character</div><div class="grid small">`;
      for (const [id, c] of Object.entries(FIG.CHARACTERS))
        h += `<div class="thumb ${id === state.libChar ? 'sel' : ''}" data-libchar="${id}" title="${c.name}">${figThumb(id, 'stand', 'happy')}<span>${c.name}</span></div>`;
      h += `</div><div class="lib-row"><span class="hint">Face</span><select id="libExpr">${Object.entries(FIG.EXPRESSIONS).map(([k, v]) => `<option value="${k}" ${k === state.libExpr ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`;
      h += `<div class="lib-section">${FIG.CHARACTERS[state.libChar].name} – poses</div><div class="grid">`;
      for (const [pid, p] of Object.entries(FIG.POSES))
        h += thumbHtml({ kind: 'figure', char: state.libChar, pose: pid, expr: state.libExpr }, figThumb(state.libChar, pid, state.libExpr), p.name);
      h += `</div>`;
    } else if (state.tab === 'objects') {
      const cats = {};
      for (const [id, o] of Object.entries(OBJ.OBJECTS)) (cats[o.cat] = cats[o.cat] || []).push([id, o]);
      for (const [cat, list] of Object.entries(cats)) {
        h += `<div class="lib-section">${cat}</div><div class="grid">`;
        list.forEach(([id, o]) => h += thumbHtml({ kind: 'object', obj: id }, objThumb(id), o.name));
        h += `</div>`;
      }
    } else if (state.tab === 'scenes') {
      h += `<p class="hint" style="margin-top:0">Drop a scene on a panel to set its background. Fine-tune it in the <b>Panel</b> section on the right.</p><div class="grid wide">`;
      for (const [id, s] of Object.entries(OBJ.SCENES)) h += thumbHtml({ kind: 'scene', scene: id }, sceneThumb(id), s.name);
      h += `</div>`;
    } else {
      h += `<div class="lib-section">Balloons &amp; captions</div><div class="grid wide">`;
      for (const [id, s] of Object.entries(BAL.STYLES)) h += thumbHtml({ kind: 'balloon', style: id }, balThumb(id), s.name);
      h += `</div><div class="lib-section">Sound effects</div><div class="grid">`;
      SFX_PRESETS.forEach(t => h += thumbHtml({ kind: 'balloon', style: 'sfx', text: t }, balThumb('sfx', t), t));
      h += `</div><div class="lib-section">Quick speech</div><div class="grid">`;
      ['HELLO', 'GRR!', '?!', 'Help!', 'Wow!', 'Oops...'].forEach(t => h += thumbHtml({ kind: 'balloon', style: t === 'GRR!' || t === 'Help!' ? 'shout' : 'speech', text: t }, balThumb(t === 'GRR!' || t === 'Help!' ? 'shout' : 'speech', t), t));
      h += `</div>`;
    }
    $('#libBody').innerHTML = h;
    const ex = $('#libExpr'); if (ex) ex.onchange = () => { state.libExpr = ex.value; renderLibrary(); };
  }

  $('.lib-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.tab = b.dataset.tab; renderLibrary(); });
  $('#libBody').addEventListener('click', e => {
    const dm = e.target.closest('[data-delmine]');
    if (dm) {
      e.stopPropagation();
      const mine = readJSON(PRESET_KEY, []); const m = mine[+dm.dataset.delmine];
      if (m && confirm(`Remove "${m.name}" from My characters?`)) { mine.splice(+dm.dataset.delmine, 1); localStorage.setItem(PRESET_KEY, JSON.stringify(mine)); renderLibrary(); }
      return;
    }
    const ch = e.target.closest('[data-libchar]');
    if (ch) { state.libChar = ch.dataset.libchar; renderLibrary(); return; }
    const t = e.target.closest('.thumb[data-spec]');
    if (t) addFromSpec(JSON.parse(t.dataset.spec));
  });
  $('#libBody').addEventListener('dragstart', e => {
    const t = e.target.closest('.thumb[data-spec]'); if (!t) return;
    e.dataTransfer.setData('text/plain', t.dataset.spec);
    e.dataTransfer.effectAllowed = 'copy';
  });
  const stageScroll = $('#stageScroll');
  stageScroll.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; stageScroll.classList.add('drop-hover'); });
  stageScroll.addEventListener('dragleave', e => { if (e.target === stageScroll) stageScroll.classList.remove('drop-hover'); });
  stageScroll.addEventListener('drop', e => {
    e.preventDefault(); stageScroll.classList.remove('drop-hover');
    let spec; try { spec = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) { return; }
    if (!spec || !spec.kind) return;
    addFromSpec(spec, toPage(e));
  });

  // ------------------------------------------------------------------ inspector (right)
  const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${esc(k)}" ${k === cur ? 'selected' : ''}>${esc(typeof v === 'string' ? v : v.name)}</option>`).join('');
  const range = (label, attr, key, val, min, max, step = 1, extra = '') => `<label class="row"><span class="lbl">${label}</span><input type="range" ${attr}="${key}" min="${min}" max="${max}" step="${step}" value="${val}" ${extra}><span class="val">${Math.round(val * 100) / 100}</span></label>`;
  const color = (label, attr, key, val) => `<label class="row"><span class="lbl">${label}</span><input type="color" ${attr}="${key}" value="${val}"></label>`;
  const check = (label, attr, key, val) => `<label class="row check"><input type="checkbox" ${attr}="${key}" ${val ? 'checked' : ''}> ${label}</label>`;

  function renderInspector() {
    const pg = page(), L = pg.layout, it = selItem();
    let h = '';
    if (it) h += itemInspector(it);
    const PM = computePanels(pg);
    const pk = state.selPanel && PM.map[state.selPanel] ? state.selPanel : null;
    if (pk) h += panelInspector(pk);
    h += `<div class="sec"><h3>Page layout<small>page ${state.page + 1} of ${doc.pages.length}</small></h3>
      <div class="lib-section">Quick layouts</div>
      <div class="layout-gallery">${LAYOUTS.map((p, i) => `<button data-act="preset" data-i="${i}" title="${esc(p.name)}">${layoutIcon(p)}</button>`).join('')}</div>
      <label class="row"><span class="lbl">Rows</span><input type="number" min="1" max="10" data-l="rows" value="${L.rows}" data-rebuild>
        <span class="lbl" style="width:auto">Panels / row</span><input type="number" min="1" max="10" data-l="allcols" value="${L.cols[0]}" data-rebuild></label>
      <div class="rowcols"><span>Row</span><span>Panels (l→r)</span><span>Height</span>
      ${L.cols.map((c, r) => `<span>${r + 1}</span><input type="number" min="1" max="10" data-row="${r}" data-rk="cols" value="${c}"><input type="number" min="0.2" max="5" step="0.1" data-row="${r}" data-rk="heights" value="${L.heights[r]}">`).join('')}</div>
      <p class="hint">Click a panel to change its width, split it or merge it with the next one.</p>
      <label class="row"><span class="lbl">Format</span><select data-doc="format" data-rebuild>${opt(FORMATS, doc.format)}</select></label>
      <label class="row"><span class="lbl">This page</span><select data-pgfmt data-rebuild><option value="">Same as cartoon</option>${opt(FORMATS, pg.format || '')}</select></label>
      ${range('Margin', 'data-l', 'margin', L.margin, 0, 120)}
      ${range('Gutter', 'data-l', 'gutter', L.gutter, 0, 60)}
      ${range('Border', 'data-l', 'border', L.border, 0, 14, 0.5)}
      ${range('Corners', 'data-l', 'radius', L.radius, 0, 40)}
      ${color('Border colour', 'data-l', 'borderColor', L.borderColor)}
      ${color('Page colour', 'data-l', 'pageBg', L.pageBg)}
      <label class="row"><span class="lbl">Page title</span><input type="text" data-l="title" value="${esc(L.title)}" placeholder="(none)"></label>
      ${L.title ? range('Title size', 'data-l', 'titleSize', L.titleSize, 14, 90) + `<label class="row"><span class="lbl">Title font</span><select data-l="titleFont">${opt(BAL.FONTS, L.titleFont)}</select></label>` : ''}
      ${check('Black &amp; white (whole cartoon)', 'data-doc', 'mono', doc.mono)}
      <div class="btns"><button data-act="layoutAll" title="Copy this page's layout settings to every page">Use this layout on all pages</button></div>
      <p class="hint">Tip: click an empty spot in a panel to select it and pick a scene. Press <b>?</b> at the top for help.</p>
    </div>`;
    $('#inspector').innerHTML = h;
  }
  function layoutIcon(p) {
    const W = 40, H = 52, m = 3, g = 2.5, rows = p.cols.length, hs = p.heights || Array(rows).fill(1), hsum = hs.reduce((a, b) => a + b, 0);
    let y = m, s = '';
    for (let r = 0; r < rows; r++) {
      const rh = (H - 2 * m - g * (rows - 1)) * hs[r] / hsum, n = p.cols[r], ws = (p.widths && p.widths[r]) || Array(n).fill(1), wsum = ws.reduce((a, b) => a + b, 0);
      let x = m;
      for (let c = 0; c < n; c++) { const cw = (W - 2 * m - g * (n - 1)) * ws[c] / wsum; s += `<rect x="${f(x)}" y="${f(y)}" width="${f(cw)}" height="${f(rh)}" rx="1"/>`; x += cw + g; }
      y += rh + g;
    }
    return `<svg viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" rx="3" fill="#fff"/><g fill="#dfe6f3" stroke="#1d1d1d" stroke-width="1.2">${s}</g></svg>`;
  }

  function itemInspector(it) {
    let h = `<div class="sec"><h3>${it.type === 'figure' ? FIG.CHARACTERS[it.char].name : it.type === 'object' ? OBJ.OBJECTS[it.obj].name : BAL.STYLES[it.style].name}<small>${it.locked ? '🔒 locked' : ''}</small></h3>`;
    if (it.type === 'figure') {
      h += `<label class="row"><span class="lbl">Character</span><select data-k="char" data-rebuild>${opt(FIG.CHARACTERS, it.char)}</select></label>`;
      h += `<div class="lib-section">Pose</div><div class="grid small">${Object.entries(FIG.POSES).map(([pid, p]) => `<div class="thumb ${pid === it.pose ? 'sel' : ''}" data-setk="pose" data-v="${pid}" title="${p.name}">${figThumb(it.char, pid, it.expr, { handL: it.handL, handR: it.handR })}</div>`).join('')}</div>`;
      h += `<div class="lib-section">Face</div><div class="grid small">${Object.entries(FIG.EXPRESSIONS).map(([k, v]) => `<div class="thumb ${k === it.expr ? 'sel' : ''}" data-setk="expr" data-v="${k}" title="${v}">${faceThumb(it, k)}</div>`).join('')}</div>`;
      h += `<div class="lib-section">Effects</div><div class="fx-chips">${Object.entries(FIG.FX).map(([k, v]) => `<button data-fx="${k}" class="${(it.fx || []).includes(k) ? 'on' : ''}">${esc(v)}</button>`).join('')}</div>`;
      const ch = FIG.CHARACTERS[it.char];
      h += `<label class="row"><span class="lbl">Right hand</span><select data-k="handR">${opt(FIG.HAND_ITEMS, it.handR !== undefined ? it.handR : (ch.handR || 'none'))}</select></label>`;
      h += `<label class="row"><span class="lbl">Left hand</span><select data-k="handL">${opt(FIG.HAND_ITEMS, it.handL !== undefined ? it.handL : (ch.handL || 'none'))}</select></label>`;
      h += color('Line colour', 'data-k', 'color', it.color || '#1d1d1d');
      h += `<label class="row"><span class="lbl">Clothes colour</span><input type="color" data-k="cloth" value="${it.cloth || '#ffffff'}"><button data-act="clearCloth" title="Back to default">Default</button></label>`;
      h += `<label class="row"><span class="lbl">Hair colour</span><input type="color" data-k="hairColor" value="${it.hairColor || '#ffffff'}"><button data-act="clearHair" title="Back to default">Default</button></label>`;
      h += range('Line width', 'data-k', 'lw', it.lw || 4, 1, 10, 0.5);
      h += `<div class="btns"><button data-act="saveChar" title="Keep this look (character, colours, held items) in the library">★ Save as “My character”</button></div>`;
    } else if (it.type === 'object') {
      h += `<label class="row"><span class="lbl">Object</span><select data-k="obj" data-rebuild>${opt(OBJ.OBJECTS, it.obj)}</select></label>`;
      h += color('Line colour', 'data-k', 'color', it.color || '#1d1d1d');
      h += range('Line width', 'data-k', 'lw', it.lw || 3, 0.5, 10, 0.5);
    } else {
      h += `<label class="row"><span class="lbl">Style</span><select data-k="style" data-rebuild>${opt(BAL.STYLES, it.style)}</select></label>`;
      h += `<textarea class="text-edit" data-k="text" placeholder="Type the text… *bold* _italic_">${esc(it.text)}</textarea>`;
      h += `<label class="row"><span class="lbl">Font</span><select data-k="font">${opt(BAL.FONTS, it.font)}</select></label>`;
      h += range('Text size', 'data-k', 'size', it.size, 8, 120);
      h += `<div class="btns">
        <button data-toggle="bold" class="${it.bold ? 'on' : ''}"><b>B</b></button>
        <button data-toggle="italic" class="${it.italic ? 'on' : ''}"><i>I</i></button>
        <button data-toggle="upper" class="${it.upper ? 'on' : ''}">ABC</button>
        <button data-setk="align" data-v="left" class="${it.align === 'left' ? 'on' : ''}">⯇ Left</button>
        <button data-setk="align" data-v="center" class="${(it.align || 'center') === 'center' ? 'on' : ''}">Center</button>
        <button data-setk="align" data-v="right" class="${it.align === 'right' ? 'on' : ''}">Right ⯈</button></div>`;
      h += it.style === 'sfx' ? color('Fill', 'data-k', 'fill', it.fill || '#ffd23c') + color('Outline', 'data-k', 'stroke', it.stroke || '#1d1d1d')
        : color('Text colour', 'data-k', 'color', it.color || '#1d1d1d') + (it.style !== 'text' ? color('Balloon fill', 'data-k', 'fill', it.fill && it.fill !== 'none' ? it.fill : '#ffffff') + color('Outline', 'data-k', 'stroke', it.stroke || '#1d1d1d') + range('Outline width', 'data-k', 'lw', it.lw || 2.5, 0.5, 8, 0.5) : '');
      if (BAL.STYLES[it.style].tail) {
        h += check('Show tail', 'data-k', 'tail', it.tail !== false);
        if (it.style !== 'thought' && it.style !== 'shout') h += range('Tail curve', 'data-k', 'bend', it.bend !== undefined ? it.bend : 0.4, -1.5, 1.5, 0.1);
      }
      h += check('Auto-size to text', 'data-k', 'autoFit', it.autoFit !== false);
      h += `<div class="btns"><button data-act="fit">Fit balloon to text</button><button data-act="editInline">Edit on canvas</button></div>`;
    }
    // common
    h += range('Rotation', 'data-k', 'rot', it.rot || 0, -180, 180);
    h += range('Opacity', 'data-k', 'opacity', it.opacity != null ? it.opacity : 1, 0.1, 1, 0.05);
    h += `<div class="btns">
      ${it.type !== 'balloon' ? `<button data-act="flipX" class="${it.flipX ? 'on' : ''}" title="Flip horizontally (H)">⇆ Flip</button><button data-act="flipY" class="${it.flipY ? 'on' : ''}" title="Flip vertically (V)">⇅ Flip</button>` : `<button data-act="mirrorTail" title="Mirror the tail">⇆ Mirror tail</button>`}
      <button data-act="bigger" title="Larger">＋ Size</button><button data-act="smaller" title="Smaller">－ Size</button></div>
      <div class="btns"><button data-act="front" title="Bring to front">⤒ Front</button><button data-act="forward" title="Forward ( ] )">↑</button><button data-act="backward" title="Backward ( [ )">↓</button><button data-act="back" title="Send to back">⤓ Back</button></div>
      ${check('Clip to panel border', 'data-k', 'clip', it.clip !== false)}
      ${it.type !== 'balloon' ? check('Black &amp; white', 'data-k', 'mono', !!it.mono) : ''}
      ${check('Lock (click-through)', 'data-k', 'locked', !!it.locked)}
      <div class="btns"><button data-act="duplicate">Duplicate</button><button data-act="delete" class="danger">Delete</button></div></div>`;
    return h;
  }

  function faceThumb(it, expr) {
    // draw a plain (hat-less) head and crop the view around it
    const char = FIG.CHARACTERS[it.char].prop === 'kid' ? 'boy' : 'man';
    const [hx, hy, r] = FIG.headAt(char, 'stand');
    const full = FIG.draw({ char: char === 'man' ? 'doctor' : 'baby', pose: 'stand', expr, lw: 4 });
    const [hx2, hy2, r2] = FIG.headAt(char === 'man' ? 'doctor' : 'baby', 'stand');
    const m = r2 * 1.5;
    return `<svg viewBox="${hx2 - m} ${hy2 - m} ${2 * m} ${2 * m}">${full}</svg>`;
  }

  function panelInspector(key) {
    const pd = page().panels[key] || {};
    const items = page().items.filter(i => i.panel === key);
    const [r, c] = key.split('-').map(Number);
    const L = page().layout, n = L.cols[r];
    let h = `<div class="sec"><h3>Panel ${r + 1}.${c + 1}<small>row ${r + 1}, panel ${c + 1}</small></h3>
      ${n > 1 ? range('Width', 'data-pw', 'w', L.widths[r][c], 0.2, 5, 0.1) : ''}
      <div class="btns"><button data-act="splitPanel" title="Split this panel in two (left / right)">⇹ Split</button>${c < n - 1 ? `<button data-act="mergePanel" title="Merge with the panel to the right">⇥ Merge right</button>` : ''}${n > 1 ? `<button data-act="evenWidths" title="Make all panels in this row equally wide">Even widths</button>` : ''}</div>
      <label class="row"><span class="lbl">Scene</span><select data-p="scene">${opt(OBJ.SCENES, pd.scene || 'none')}</select></label>
      ${range('Scene zoom', 'data-p', 'sceneZoom', pd.sceneZoom || 1, 0.5, 3, 0.05)}
      ${range('Scene shift', 'data-p', 'sceneX', pd.sceneX || 0, -200, 200, 2)}
      ${range('Scene fade', 'data-p', 'sceneOpacity', pd.sceneOpacity != null ? pd.sceneOpacity : 1, 0.1, 1, 0.05)}
      ${check('Mirror scene', 'data-p', 'sceneFlip', !!pd.sceneFlip)}
      ${check('Scene in black &amp; white', 'data-p', 'sceneMono', !!pd.sceneMono)}
      ${color('Background', 'data-p', 'bg', pd.bg || '#ffffff')}
      ${check('Hide border', 'data-p', 'noBorder', !!pd.noBorder)}
      <div class="btns"><button data-act="sceneAll">Use scene on all panels</button><button data-act="copyNext" title="Copy scene and contents to the next panel – handy for the next moment in the same place">Copy to next panel</button><button data-act="clearPanel" class="danger">Empty panel</button></div>
      <div class="lib-section">Layers in this panel (top first)</div>
      <ul class="layers">${items.slice().reverse().map(i => `<li data-selid="${i.id}" class="${i.id === state.sel ? 'sel' : ''}"><span class="nm">${esc(itemLabel(i))}</span><button data-lock="${i.id}" title="Lock / unlock">${i.locked ? '🔒' : '🔓'}</button></li>`).join('') || '<li class="hint">Empty – drag something in!</li>'}</ul>
    </div>`;
    return h;
  }
  const itemLabel = i => i.type === 'figure' ? `${FIG.CHARACTERS[i.char].name} – ${FIG.POSES[i.pose].name}` : i.type === 'object' ? OBJ.OBJECTS[i.obj].name : `${BAL.STYLES[i.style].name}: “${(i.text || '').slice(0, 24)}”`;

  const insp = $('#inspector');
  function readInput(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'range' || el.type === 'number') return parseFloat(el.value);
    return el.value;
  }
  function onInspectorInput(e) {
    const el = e.target;
    const pg = page(), L = pg.layout, it = selItem();
    const v = readInput(el);
    if (el.type === 'range') { const s = el.parentElement.querySelector('.val'); if (s) s.textContent = Math.round(v * 100) / 100; }
    let rebuild = el.hasAttribute('data-rebuild');
    if (el.dataset.k && it) {
      const k = el.dataset.k;
      if (k === 'opacity' || k === 'rot' || k === 'lw' || k === 'size' || k === 'bend') { if (isNaN(v)) return; }
      it[k] = v;
      if (k === 'char') { delete it.handL; delete it.handR; }
      if (k === 'obj') { const o = OBJ.OBJECTS[v]; it.h = it.w * o.h / o.w; }
      if (it.type === 'balloon' && ['text', 'size', 'font', 'style', 'upper'].includes(k) && it.autoFit !== false) refit(it);
      if (k === 'style') { const S = BAL.STYLES[v]; it.tail = S.tail; if (v === 'sfx') { it.font = 'Impact, Arial Black, sans-serif'; it.fill = S.fill; it.size = Math.max(it.size, 36); } else if (it.fill === '#ffd23c' || v === 'caption' || it.fill === '#fff6c2') it.fill = S.fill; refit(it); }
      if (k === 'autoFit' && v) refit(it);
      if (k === 'locked' || k === 'tail') rebuild = true;
    } else if (el.dataset.l) {
      const k = el.dataset.l;
      if (k === 'allcols') { if (!isNaN(v)) { L.cols = L.cols.map(() => v); normLayout(L); warnOrphans(pg); } }
      else if (k === 'rows') { if (!isNaN(v)) { L.rows = v; normLayout(L); warnOrphans(pg); } }
      else { L[k] = (el.type === 'range') ? v : v; if (k === 'title' && (!!v) !== (!!el.defaultValue)) rebuild = true; }
    } else if (el.dataset.row !== undefined) {
      if (isNaN(v)) return;
      L[el.dataset.rk][+el.dataset.row] = v; normLayout(L);
      if (el.dataset.rk === 'cols') { rebuild = false; warnOrphans(pg); }
    } else if (el.dataset.pw) {
      if (isNaN(v)) return;
      const [r, c] = state.selPanel.split('-').map(Number);
      L.widths[r][c] = v;
    } else if (el.hasAttribute('data-pgfmt')) {
      if (v) pg.format = v; else delete pg.format;
      setTimeout(zoomFit, 0);
    } else if (el.dataset.p) {
      const key = state.selPanel;
      pg.panels[key] = pg.panels[key] || {};
      pg.panels[key][el.dataset.p] = v;
    } else if (el.dataset.doc) {
      doc[el.dataset.doc] = v;
      if (el.dataset.doc === 'format') setTimeout(zoomFit, 0);
    } else return;
    renderCanvas();
    if (rebuild && e.type === 'change') renderInspector();
    else if (rebuild && el.tagName === 'SELECT') renderInspector();
    commitSoon();
  }
  insp.addEventListener('input', onInspectorInput);
  insp.addEventListener('change', e => {
    const el = e.target;
    if (el.hasAttribute('data-rebuild') && el.tagName !== 'SELECT') renderInspector();
    if (el.dataset.row !== undefined || el.dataset.l === 'title' || el.dataset.k === 'locked' || el.dataset.k === 'tail') renderInspector();
    commit();
  });
  insp.addEventListener('keydown', e => e.stopPropagation());
  insp.addEventListener('click', e => {
    const it = selItem();
    const s = e.target.closest('[data-setk]');
    if (s && it) { it[s.dataset.setk] = s.dataset.v; if (s.dataset.setk === 'pose') { const P = FIG.POSES[s.dataset.v]; it.fx = (it.fx || []).filter(x => x !== 'speed'); if (P.fxAuto) P.fxAuto.forEach(x => { if (!it.fx.includes(x)) it.fx.push(x); }); } commit(); renderCanvas(); renderInspector(); return; }
    const t = e.target.closest('[data-toggle]');
    if (t && it) { it[t.dataset.toggle] = !it[t.dataset.toggle]; if (it.autoFit !== false) refit(it); commit(); renderCanvas(); renderInspector(); return; }
    const fx = e.target.closest('[data-fx]');
    if (fx && it) { it.fx = it.fx || []; const k = fx.dataset.fx; it.fx = it.fx.includes(k) ? it.fx.filter(x => x !== k) : it.fx.concat(k); commit(); renderCanvas(); renderInspector(); return; }
    const lk = e.target.closest('[data-lock]');
    if (lk) { const i = page().items.find(x => x.id === lk.dataset.lock); if (i) { i.locked = !i.locked; commit(); renderCanvas(); renderInspector(); } e.stopPropagation(); return; }
    const li = e.target.closest('[data-selid]');
    if (li) { state.sel = li.dataset.selid; renderCanvas(); renderInspector(); return; }
  });

  // ------------------------------------------------------------------ actions
  function cloneItem(it) { const c = JSON.parse(JSON.stringify(it)); c.id = uid(); return c; }
  function layer(dir) {
    const items = page().items, it = selItem(); if (!it) return;
    const i = items.indexOf(it); items.splice(i, 1);
    const j = dir === 'front' ? items.length : dir === 'back' ? 0 : clamp(i + (dir === 'forward' ? 1 : -1), 0, items.length);
    items.splice(j, 0, it); commit(); renderCanvas(); renderInspector();
  }
  function resizeSel(k) {
    const it = selItem(); if (!it) return;
    it.w *= k; it.h *= k;
    if (it.type === 'balloon') { it.tx *= k; it.ty *= k; it.size = Math.round(it.size * k * 10) / 10; }
    commit(); renderCanvas(); renderInspector();
  }
  function deleteSel() {
    const it = selItem(); if (!it) return;
    page().items = page().items.filter(i => i !== it); state.sel = null;
    commit(); renderCanvas(); renderInspector();
  }
  function duplicateSel() {
    const it = selItem(); if (!it) return;
    const c = cloneItem(it); c.x += 18; c.y += 18; page().items.push(c); state.sel = c.id;
    commit(); renderCanvas(); renderInspector();
  }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const fileBase = () => (doc.title || 'cartoon').replace(/[\\/:*?"<>|]+/g, '').trim() || 'cartoon';

  function renderPageTabs() {
    clearTimeout(thumbTimer);
    $('#pageTabs').innerHTML = doc.pages.map((p, i) => {
      const F = fmt(p);
      return `<button data-page="${i}" draggable="true" class="page-thumb ${i === state.page ? 'active' : ''}" title="Page ${i + 1} – drag to reorder">
        <svg viewBox="0 0 ${F.w} ${F.h}" style="aspect-ratio:${F.w}/${F.h}">${pageContent(p, { export: true, thumb: true })}</svg><span>${i + 1}</span></button>`;
    }).join('');
    $('#docTitle').value = doc.title || '';
    const a = $('#pageTabs .active'); if (a) a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  $('#pageTabs').addEventListener('click', e => { const b = e.target.closest('[data-page]'); if (!b) return; goPage(+b.dataset.page); });
  function goPage(i) {
    if (i < 0 || i >= doc.pages.length) return;
    state.page = i; state.sel = null; state.selPanel = null; closeInline(true); renderAll();
    if (Math.abs(fmt().w * state.zoom - svg.clientWidth) > 2) zoomFit();
  }
  // drag page thumbnails to reorder
  let pageDrag = null;
  $('#pageTabs').addEventListener('dragstart', e => { const b = e.target.closest('[data-page]'); if (!b) return; pageDrag = +b.dataset.page; e.dataTransfer.setData('text/x-stickstudio-page', String(pageDrag)); e.dataTransfer.effectAllowed = 'move'; });
  $('#pageTabs').addEventListener('dragover', e => { if (pageDrag === null) return; e.preventDefault(); const b = e.target.closest('[data-page]'); $$('.page-thumb').forEach(x => x.classList.toggle('drop-target', x === b)); });
  $('#pageTabs').addEventListener('drop', e => {
    if (pageDrag === null) return; e.preventDefault();
    const b = e.target.closest('[data-page]'); const to = b ? +b.dataset.page : doc.pages.length - 1, from = pageDrag;
    pageDrag = null;
    if (to === from) { renderPageTabs(); return; }
    const cur = doc.pages[state.page];
    const [pg] = doc.pages.splice(from, 1); doc.pages.splice(to, 0, pg);
    state.page = doc.pages.indexOf(cur); commit(); renderAll(); toast(`Moved page ${from + 1} to position ${to + 1}`);
  });
  $('#pageTabs').addEventListener('dragend', () => { pageDrag = null; $$('.page-thumb').forEach(x => x.classList.remove('drop-target')); });
  $('#docTitle').addEventListener('input', e => { doc.title = e.target.value; commitSoon(); });

  // ---- layout editing helpers
  /** after a layout change: tell the user when items ended up in panels that no longer exist (with undo) */
  function warnOrphans(pg) {
    const PM = computePanels(pg);
    const lost = pg.items.filter(i => !PM.map[i.panel]).length;
    if (lost) toast(`${lost} item${lost > 1 ? 's were' : ' was'} in removed panels and got moved into the nearest panel.`, 6000, { label: 'Undo', fn: undo });
  }
  /** move items & panel settings to new keys while keeping their position on the page */
  function remapPanels(pg, oldPM, keyMap) {
    const PM = computePanels(pg), panels = {};
    for (const [k, pd] of Object.entries(pg.panels)) { const nk = keyMap(k); if (nk && PM.map[nk] && !panels[nk]) panels[nk] = pd; }
    pg.panels = panels;
    for (const it of pg.items) {
      const O = oldPM.map[it.panel]; if (!O) continue;
      const nk = keyMap(it.panel), P = PM.map[nk]; if (!P) continue;
      const ax = O.x + it.x, ay = O.y + it.y;
      it.panel = nk; it.x = ax - P.x; it.y = ay - P.y; it.pw = P.w; it.ph = P.h;
    }
  }
  const keyRC = k => k.split('-').map(Number);
  function readingNext(pg, key) { const L = computePanels(pg).list; const i = L.findIndex(P => P.key === key); return i >= 0 && i < L.length - 1 ? L[i + 1].key : null; }

  // ---- export dialog
  function openExport(type) {
    $('#exType').value = type; $('#pdfMono').checked = !!doc.mono; $('#pdfStatus').textContent = '';
    $('#exName').value = fileBase(); syncExportDialog(); openModal('#modal');
  }
  function syncExportDialog() {
    const t = $('#exType').value;
    $('#rangeRow').hidden = $('#pdfPages').value !== 'range';
    $('#dpiRow').hidden = t === 'vector';
    $('#marksRow').hidden = t !== 'pdf';
    $('#vectorHint').hidden = t !== 'vector';
    $('#exGo').textContent = t === 'vector' ? 'Open print dialog' : t === 'pdf' ? 'Create PDF' : 'Export images';
  }
  ['#exType', '#pdfPages'].forEach(s => $(s).addEventListener('change', syncExportDialog));
  /** "1-3, 5" → page objects (1-based, clamped, de-duplicated, in order) */
  function parseRange(s) {
    const n = doc.pages.length, set = new Set();
    for (const part of String(s).split(/[,; ]+/).filter(Boolean)) {
      const m = part.match(/^(\d+)(?:-(\d*))?$/); if (!m) throw new Error(`"${part}" is not a page number or range`);
      const a = clamp(+m[1], 1, n), b = m[2] === undefined ? a : clamp(m[2] === '' ? n : +m[2], 1, n);
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) set.add(i - 1);
    }
    if (!set.size) throw new Error('enter the pages to export, e.g. 1-3, 5');
    return [...set].sort((a, b) => a - b).map(i => doc.pages[i]);
  }
  function exportPages() {
    const w = $('#pdfPages').value;
    return w === 'all' ? doc.pages : w === 'current' ? [page()] : parseRange($('#pdfRange').value);
  }

  // ---- modals
  function openModal(sel) { $$('.modal').forEach(m => m.hidden = true); $(sel).hidden = false; const f = $(sel).querySelector('select, input, button.primary'); if (f) f.focus(); }
  const anyModal = () => $$('.modal').some(m => !m.hidden);
  function renderProjects() {
    const idx = projIndex();
    const when = t => { const d = new Date(t); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
    $('#projectList').innerHTML = idx.map(p => `<li class="${p.id === doc.id ? 'current' : ''}"><div><b>${esc(p.title)}</b><small>${p.pages} page${p.pages > 1 ? 's' : ''} · ${when(p.updated)}${p.id === doc.id ? ' · open now' : ''}</small></div>
      ${p.id === doc.id ? '' : `<button data-openproj="${p.id}" class="primary">Open</button>`}<button data-dupproj="${p.id}" title="Make a copy">Copy</button><button data-delproj="${p.id}" class="danger" title="Delete from this browser">Delete</button></li>`).join('') || '<li class="hint">No cartoons yet.</li>';
  }
  $('#projectList').addEventListener('click', e => {
    const o = e.target.closest('[data-openproj]'), d = e.target.closest('[data-delproj]'), c = e.target.closest('[data-dupproj]');
    if (o) {
      const data = readJSON(PROJ_PREFIX + o.dataset.openproj, null);
      if (!data) { toast('That project could not be found'); return; }
      try { save(); loadDoc(data); $('#projectsModal').hidden = true; toast('Opened ' + (doc.title || 'cartoon')); } catch (err) { alert('Could not open: ' + err.message); }
    } else if (c) {
      const data = readJSON(PROJ_PREFIX + c.dataset.dupproj, null); if (!data) return;
      save(); data.id = uid(); data.title = (data.title || 'Cartoon') + ' (copy)';
      loadDoc(data); save(); renderProjects(); toast('Copy created and opened');
    } else if (d) {
      const id = d.dataset.delproj, p = projIndex().find(x => x.id === id);
      if (!confirm(`Delete "${p ? p.title : 'this cartoon'}" from this browser? This cannot be undone.`)) return;
      localStorage.removeItem(PROJ_PREFIX + id);
      localStorage.setItem(INDEX_KEY, JSON.stringify(projIndex().filter(x => x.id !== id)));
      if (id === doc.id) { doc = newDoc(); state.page = 0; state.sel = null; resetHistory(); renderAll(); zoomFit(); }
      renderProjects();
    }
  });

  const actions = {
    new() {
      if (commitTimer) commit();
      save();
      doc = newDoc(); state.page = 0; state.sel = null; state.selPanel = '0-0'; fileSnap = null; resetHistory(); renderAll(); zoomFit();
      $$('.modal').forEach(m => m.hidden = true);
      toast('New cartoon started – the previous one is in Projects');
    },
    projects() { if (commitTimer) commit(); renderProjects(); openModal('#projectsModal'); },
    help() { openModal('#helpModal'); },
    open() { $('#fileOpen').click(); },
    save() {
      if (commitTimer) commit();
      download(new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' }), fileBase() + '.stickstudio.json');
      markFileSaved(); toast('Project saved to your downloads');
    },
    undo, redo,
    zoomIn() { setZoom(state.zoom * 1.2); }, zoomOut() { setZoom(state.zoom / 1.2); }, zoomFit,
    png() { openExport('png'); },
    pdf() { openExport('pdf'); },
    print() { printPages(doc.pages, doc.mono); },
    closeModal(b) { const m = b && b.closest ? b.closest('.modal') : null; if (m) m.hidden = true; else $$('.modal').forEach(x => x.hidden = true); },
    doPdf() { runExport(); },
    addPage() { doc.pages.splice(state.page + 1, 0, Object.assign(newPage(page().layout), page().format ? { format: page().format } : {})); state.page++; state.sel = null; commit(); renderAll(); },
    dupPage() { const c = JSON.parse(JSON.stringify(page())); c.id = uid(); c.items.forEach(i => i.id = uid()); doc.pages.splice(state.page + 1, 0, c); state.page++; state.sel = null; commit(); renderAll(); },
    delPage() {
      if (doc.pages.length === 1) { toast('A cartoon needs at least one page'); return; }
      if (!confirm(`Delete page ${state.page + 1}?`)) return;
      doc.pages.splice(state.page, 1); state.page = clamp(state.page, 0, doc.pages.length - 1); state.sel = null; commit(); renderAll();
      toast('Page deleted', 5000, { label: 'Undo', fn: undo });
    },
    pageLeft() { const i = state.page; if (i < 1) return; [doc.pages[i - 1], doc.pages[i]] = [doc.pages[i], doc.pages[i - 1]]; state.page--; commit(); renderAll(); },
    pageRight() { const i = state.page; if (i >= doc.pages.length - 1) return; [doc.pages[i + 1], doc.pages[i]] = [doc.pages[i], doc.pages[i + 1]]; state.page++; commit(); renderAll(); },
    preset(b) {
      const p = LAYOUTS[+b.dataset.i], L = page().layout;
      L.rows = p.cols.length; L.cols = p.cols.slice(); L.heights = (p.heights || p.cols.map(() => 1)).slice();
      L.widths = p.widths ? JSON.parse(JSON.stringify(p.widths)) : [];
      normLayout(L); warnOrphans(page()); state.selPanel = null; commit(); renderAll();
    },
    layoutAll() {
      const src = page();
      doc.pages.forEach(pg => { if (pg === src) return; const t = pg.layout.title; pg.layout = JSON.parse(JSON.stringify(src.layout)); pg.layout.title = t; if (src.format) pg.format = src.format; else delete pg.format; });
      commit(); renderAll(); toast(`Layout copied to all ${doc.pages.length} pages (page titles kept)`, 4000, { label: 'Undo', fn: undo });
    },
    splitPanel() {
      const pg = page(), [r, c] = keyRC(state.selPanel), L = pg.layout;
      if (L.cols[r] >= 10) { toast('A row can have at most 10 panels'); return; }
      const old = computePanels(pg), w = L.widths[r][c];
      L.cols[r]++; L.widths[r].splice(c, 1, w / 2, w / 2);
      remapPanels(pg, old, k => { const [rr, cc] = keyRC(k); return rr === r && cc > c ? `${rr}-${cc + 1}` : k; });
      commit(); renderAll();
    },
    mergePanel() {
      const pg = page(), [r, c] = keyRC(state.selPanel), L = pg.layout;
      if (c >= L.cols[r] - 1) return;
      const old = computePanels(pg);
      L.widths[r].splice(c, 2, L.widths[r][c] + L.widths[r][c + 1]); L.cols[r]--;
      remapPanels(pg, old, k => { const [rr, cc] = keyRC(k); return rr === r && cc > c ? `${rr}-${cc - 1}` : k; });
      commit(); renderAll();
    },
    evenWidths() { const [r] = keyRC(state.selPanel), L = page().layout; L.widths[r] = L.widths[r].map(() => 1); commit(); renderAll(); },
    copyNext() {
      const pg = page(), from = state.selPanel, to = readingNext(pg, from);
      if (!to) { toast('This is the last panel on the page – add a page or a panel first'); return; }
      const PM = computePanels(pg), P = PM.map[from], Q = PM.map[to];
      if (pg.panels[from]) pg.panels[to] = JSON.parse(JSON.stringify(pg.panels[from]));
      pg.items.filter(i => i.panel === from).forEach(i => { panelFor(i, PM); const c = cloneItem(i); c.panel = to; c.pw = P.w; c.ph = P.h; pg.items.push(c); });
      void Q; state.selPanel = to; state.sel = null; commit(); renderAll(); toast('Copied to the next panel');
    },
    saveChar() {
      const it = selItem(); if (!it || it.type !== 'figure') return;
      const name = prompt('Name for this character:', FIG.CHARACTERS[it.char].name); if (!name) return;
      const style = {}; ['cloth', 'hairColor', 'handL', 'handR', 'color', 'lw'].forEach(k => { if (it[k] !== undefined) style[k] = it[k]; });
      const mine = readJSON(PRESET_KEY, []); mine.push({ name: name.slice(0, 30), char: it.char, style });
      localStorage.setItem(PRESET_KEY, JSON.stringify(mine));
      state.tab = 'characters'; renderLibrary(); toast(`"${name}" added to My characters`);
    },
    flipX() { const it = selItem(); if (it) { it.flipX = !it.flipX; commit(); renderCanvas(); renderInspector(); } },
    flipY() { const it = selItem(); if (it) { it.flipY = !it.flipY; commit(); renderCanvas(); renderInspector(); } },
    mirrorTail() { const it = selItem(); if (it) { it.tx = -it.tx; commit(); renderCanvas(); } },
    bigger() { resizeSel(1.1); }, smaller() { resizeSel(1 / 1.1); },
    front() { layer('front'); }, back() { layer('back'); }, forward() { layer('forward'); }, backward() { layer('backward'); },
    duplicate: duplicateSel, delete: deleteSel,
    fit() { const it = selItem(); if (it) { refit(it); commit(); renderCanvas(); } },
    editInline() { const it = selItem(); if (it) openInline(it); },
    clearCloth() { const it = selItem(); if (it) { delete it.cloth; commit(); renderCanvas(); renderInspector(); } },
    clearHair() { const it = selItem(); if (it) { delete it.hairColor; commit(); renderCanvas(); renderInspector(); } },
    sceneAll() {
      const pg = page(), src = pg.panels[state.selPanel] || {};
      computePanels(pg).list.forEach(P => { pg.panels[P.key] = Object.assign(pg.panels[P.key] || {}, { scene: src.scene, sceneZoom: src.sceneZoom, sceneOpacity: src.sceneOpacity, sceneFlip: src.sceneFlip, sceneX: src.sceneX }); });
      commit(); renderCanvas(); toast('Scene applied to all panels');
    },
    clearPanel() {
      if (!confirm('Remove everything in this panel?')) return;
      const pg = page(); pg.items = pg.items.filter(i => i.panel !== state.selPanel); delete pg.panels[state.selPanel];
      state.sel = null; commit(); renderAll();
    },
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const fn = actions[b.dataset.act]; if (fn) fn(b);
  });

  $('#fileOpen').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      save(); // keep the current cartoon in Projects
      const existing = d && d.id && projIndex().find(p => p.id === d.id);
      if (existing && d.id !== doc.id && !confirm(`"${existing.title}" is already in Projects. Replace that copy with the file's contents?\n\n(Cancel opens the file as a separate copy.)`)) d.id = uid();
      loadDoc(d, true); save(); toast('Opened ' + file.name);
    } catch (err) { alert('Could not open this file: ' + (err instanceof SyntaxError ? 'it is not a valid project file' : err.message)); }
  });
  // drop a .json project file anywhere to open it
  document.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', e => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    e.preventDefault();
    if (!/\.json$/i.test(file.name)) { toast('Drop a StickStudio .json project file to open it'); return; }
    const dt = new DataTransfer(); dt.items.add(file); $('#fileOpen').files = dt.files; $('#fileOpen').dispatchEvent(new Event('change'));
  });

  // ------------------------------------------------------------------ keyboard
  document.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
    if (anyModal()) { if (e.key === 'Escape') $$('.modal').forEach(m => m.hidden = true); else if (e.key === 'Enter' && !$('#modal').hidden && e.target.tagName !== 'BUTTON') runExport(); return; }
    // app-wide shortcuts (work even while typing in a field)
    if (ctrl && key === 's') { e.preventDefault(); actions.save(); return; }
    if (ctrl && key === 'o') { e.preventDefault(); actions.open(); return; }
    if (ctrl && key === 'p') { e.preventDefault(); actions.print(); return; }
    if (ctrl && key === 'e') { e.preventDefault(); actions.pdf(); return; }
    if (e.key === 'F1') { e.preventDefault(); actions.help(); return; }
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const it = selItem();
    if (ctrl && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (ctrl && key === 'y') { e.preventDefault(); redo(); return; }
    if (ctrl && key === 'a') { e.preventDefault(); return; }
    if (ctrl && key === 'd') { e.preventDefault(); duplicateSel(); return; }
    if (e.key === 'PageDown') { e.preventDefault(); goPage(state.page + 1); return; }
    if (e.key === 'PageUp') { e.preventDefault(); goPage(state.page - 1); return; }
    if (e.key === '?') { actions.help(); return; }
    if (ctrl && e.key.toLowerCase() === 'c' && it) { state.clipboard = JSON.stringify(it); toast('Copied'); return; }
    if (ctrl && e.key.toLowerCase() === 'v' && state.clipboard) {
      const c = JSON.parse(state.clipboard); c.id = uid();
      const PM = computePanels(page());
      if (state.selPanel && PM.map[state.selPanel] && state.selPanel !== c.panel) c.panel = state.selPanel; else { c.x += 18; c.y += 18; }
      page().items.push(c); state.sel = c.id; commit(); renderCanvas(); renderInspector(); return;
    }
    if (!it) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); }
    else if (e.key === 'Escape') { state.sel = null; renderCanvas(); renderInspector(); }
    else if (e.key.startsWith('Arrow')) {
      e.preventDefault(); const d = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') it.x -= d; if (e.key === 'ArrowRight') it.x += d;
      if (e.key === 'ArrowUp') it.y -= d; if (e.key === 'ArrowDown') it.y += d;
      renderCanvas(); commitSoon();
    }
    else if (e.key.toLowerCase() === 'h') actions.flipX();
    else if (e.key.toLowerCase() === 'v') actions.flipY();
    else if (e.key === ']') layer('forward');
    else if (e.key === '[') layer('backward');
    else if (e.key === 'Enter' && it.type === 'balloon') { e.preventDefault(); openInline(it); }
  });

  // ------------------------------------------------------------------ export
  function pageSvgString(pg, scale, mono) {
    const F = fmt(pg);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(F.w * scale)}" height="${Math.round(F.h * scale)}" viewBox="0 0 ${F.w} ${F.h}">${pageContent(pg, { export: true, mono })}</svg>`;
  }
  function rasterize(pg, scale, mono) {
    return new Promise((resolve, reject) => {
      const F = fmt(pg);
      const blob = new Blob([pageSvgString(pg, scale, mono)], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = Math.round(F.w * scale); c.height = Math.round(F.h * scale);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); resolve(c);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Rendering failed')); };
      img.src = url;
    });
  }
  const canvasBytes = (c, type, q) => new Promise((res, rej) => c.toBlob(b => b ? b.arrayBuffer().then(a => res(new Uint8Array(a))) : rej(new Error('Image too large for this browser')), type, q));
  const tick = () => new Promise(r => setTimeout(r, 20));
  async function makePdf(pages, dpi, mono, progress = () => {}, marks = false) {
    const scale = dpi / 96;
    const out = [];
    for (let i = 0; i < pages.length; i++) {
      progress(`Rendering page ${i + 1} of ${pages.length}…`);
      await tick();
      const F = fmt(pages[i]);
      const c = await rasterize(pages[i], scale, mono);
      const jpeg = await canvasBytes(c, 'image/jpeg', 0.93);
      out.push({ jpeg, imgW: c.width, imgH: c.height, ptW: F.w * 0.75, ptH: F.h * 0.75, marks });
    }
    progress('Building PDF…');
    return PDF.build(out, doc.title);
  }
  async function makeZip(pages, dpi, mono, base, progress) {
    const files = [];
    for (let i = 0; i < pages.length; i++) {
      progress(`Rendering page ${i + 1} of ${pages.length}…`); await tick();
      const c = await rasterize(pages[i], dpi / 96, mono);
      files.push({ name: `${base}-page${String(doc.pages.indexOf(pages[i]) + 1).padStart(2, '0')}.png`, data: await canvasBytes(c, 'image/png') });
    }
    progress('Packing ZIP…');
    return PDF.zip(files);
  }
  async function makeStrip(pages, dpi, mono, progress) {
    // all pages stacked vertically; scale is reduced if the image would exceed browser canvas limits
    const gapPx = 24, MAXH = 30000, MAXW = 8000;
    let scale = dpi / 96;
    const totH = pages.reduce((a, p) => a + fmt(p).h, 0), maxW = Math.max(...pages.map(p => fmt(p).w));
    scale = Math.min(scale, (MAXH - gapPx * (pages.length - 1)) / totH, MAXW / maxW);
    const W = Math.round(maxW * scale), H = Math.round(totH * scale) + gapPx * (pages.length - 1);
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const g = out.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    let y = 0;
    for (let i = 0; i < pages.length; i++) {
      progress(`Rendering page ${i + 1} of ${pages.length}…`); await tick();
      const c = await rasterize(pages[i], scale, mono);
      g.drawImage(c, Math.round((W - c.width) / 2), y); y += c.height + gapPx;
    }
    progress('Encoding image…');
    return new Blob([await canvasBytes(out, 'image/png')], { type: 'image/png' });
  }
  /** vector "PDF": print the SVG pages through the browser's print dialog (Save as PDF keeps text as text) */
  function printPages(pages, mono) {
    const old = $('#printFrame'); if (old) old.remove();
    const fr = document.createElement('iframe'); fr.id = 'printFrame';
    Object.assign(fr.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(fr);
    const sizes = {};
    const body = pages.map(pg => {
      const F = fmt(pg), name = 'p' + F.w + 'x' + F.h; sizes[name] = F;
      return `<div class="pg" style="page:${name};width:${F.w * 0.75}pt;height:${F.h * 0.75}pt"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${F.w} ${F.h}" width="100%" height="100%">${pageContent(pg, { export: true, mono })}</svg></div>`;
    }).join('');
    const css = Object.entries(sizes).map(([n, F]) => `@page ${n} { size: ${F.w * 0.75}pt ${F.h * 0.75}pt; margin: 0; }`).join('\n');
    const d = fr.contentDocument;
    d.open();
    d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(fileBase())}</title><style>${css}\n@page { margin: 0; } html,body{margin:0;padding:0} .pg{break-after:page;overflow:hidden} .pg:last-child{break-after:auto} *{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${body}</body></html>`);
    d.close();
    setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { alert('Printing failed: ' + e.message); } }, 250);
  }
  async function runExport() {
    const status = $('#pdfStatus'), btn = $('#exGo');
    const type = $('#exType').value, dpi = +$('#pdfDpi').value, mono = $('#pdfMono').checked;
    const base = ($('#exName').value || fileBase()).replace(/[\\/:*?"<>|]+/g, '').replace(/\.(pdf|png|zip)$/i, '').trim() || 'cartoon';
    let pages;
    try { pages = exportPages(); } catch (err) { status.textContent = '⚠ ' + err.message; return; }
    const prog = t => status.textContent = t;
    btn.disabled = true;
    try {
      if (type === 'vector') { $('#modal').hidden = true; printPages(pages, mono); return; }
      if (type === 'pdf') download(await makePdf(pages, dpi, mono, prog, $('#pdfMarks').checked), base + '.pdf');
      else if (type === 'zip') download(await makeZip(pages, dpi, mono, base, prog), base + '.zip');
      else if (type === 'strip') download(await makeStrip(pages, dpi, mono, prog), base + '-strip.png');
      else {
        for (let i = 0; i < pages.length; i++) {
          prog(`Rendering page ${i + 1} of ${pages.length}…`); await tick();
          const c = await rasterize(pages[i], dpi / 96, mono);
          download(new Blob([await canvasBytes(c, 'image/png')], { type: 'image/png' }), pages.length > 1 || doc.pages.length > 1 ? `${base}-page${doc.pages.indexOf(pages[i]) + 1}.png` : base + '.png');
          if (pages.length > 1) await new Promise(r => setTimeout(r, 350)); // browsers throttle rapid downloads
        }
      }
      status.textContent = 'Done! Check your downloads.';
      setTimeout(() => { $('#modal').hidden = true; }, 900);
    } catch (err) { status.textContent = 'Export failed: ' + err.message; }
    finally { btn.disabled = false; }
  }

  // ------------------------------------------------------------------ demo cartoon
  function demoDoc() {
    doc = newDoc();
    doc.title = 'The Dragon Problem';
    const pg = page();
    pg.layout.title = 'The Dragon Problem';
    const PM = computePanels(pg);
    const put = (key, spec, fx, fy, extra = {}) => {
      const P = PM.map[key];
      const it = makeItem(spec, P, [P.x + fx * P.w, P.y + fy * P.h]);
      Object.assign(it, extra);
      delete it.k; delete it.gy;
      if (it.type === 'balloon' && extra.text) Object.assign(it, BAL.fit(it));
      if (extra.k) { it.w *= extra.k; it.h *= extra.k; }
      if (extra.gy) it.y = extra.gy * P.h - (it.type === 'figure' ? (FIG.GROUND - FIG.NH / 2) * it.h / FIG.NH : it.h / 2);
      pg.items.push(it); return it;
    };
    // the scenes' ground sits at 250/300 of their height (bottom-anchored, so the same in any panel)
    const GY = 0.84;
    pg.panels['0-0'] = { scene: 'throneroom', sceneOpacity: 0.55 };
    pg.panels['0-1'] = { scene: 'forest', sceneOpacity: 0.6 };
    pg.panels['1-0'] = { scene: 'mountains', sceneOpacity: 0.6 };
    pg.panels['1-1'] = { scene: 'room', sceneOpacity: 0.6 };
    // panel 1
    const aim = (b, fig, dx = 0) => { // point a balloon's tail at a figure's head
      const [hx, hy] = FIG.headAt(fig.char, fig.pose);
      const sx = fig.w / FIG.NW, sy = fig.h / FIG.NH;
      const tx = fig.x + (fig.flipX ? -1 : 1) * (hx - FIG.NW / 2) * sx + dx, ty = fig.y + (hy - FIG.NH / 2) * sy - 26 * sy;
      b.tx = tx - b.x; b.ty = ty - b.y;
    };
    // panel 1
    const king = put('0-0', { kind: 'figure', char: 'king', pose: 'point', expr: 'angry' }, 0.72, 0, { gy: GY, flipX: true });
    put('0-0', { kind: 'figure', char: 'knight', pose: 'kneel', expr: 'happy' }, 0.27, 0, { gy: GY });
    const b1 = put('0-0', { kind: 'balloon', style: 'speech' }, 0.52, 0.17, { text: 'Sir Kevin! Slay the *dragon* by Friday!' });
    aim(b1, king);
    // panel 2
    const k2 = put('0-1', { kind: 'figure', char: 'knight', pose: 'walk', expr: 'neutral' }, 0.42, 0, { gy: GY, handR: 'spear' });
    const b2 = put('0-1', { kind: 'balloon', style: 'thought' }, 0.55, 0.17, { text: 'I hope it is a small one...' });
    aim(b2, k2);
    // panel 3
    put('1-0', { kind: 'object', obj: 'dragon' }, 0.68, 0, { gy: GY, flipX: true, k: 1.1 });
    put('1-0', { kind: 'figure', char: 'knight', pose: 'panic', expr: 'scared' }, 0.2, 0, { gy: GY, flipX: true, fx: ['sweat'] });
    put('1-0', { kind: 'object', obj: 'speed' }, 0.42, 0.6, { k: 0.9 });
    put('1-0', { kind: 'balloon', style: 'sfx', text: 'ROAR!' }, 0.68, 0.14, { rot: 8 });
    // panel 4 – seat the knight on the chair
    const P4 = PM.map['1-1'];
    const chair = put('1-1', { kind: 'object', obj: 'chair' }, 0.4, 0, { gy: GY, k: 1.1 });
    const k4 = put('1-1', { kind: 'figure', char: 'knight', pose: 'sit', expr: 'smirk' }, 0.4, 0, { handR: 'cup', handL: 'none' });
    const cs = chair.w / OBJ.OBJECTS.chair.w, fs = k4.w / FIG.NW;
    const seat = [chair.x - chair.w / 2 + 18 * cs, chair.y - chair.h / 2 + 61 * cs];
    const [hx, hy] = FIG.hipAt('knight', 'sit');
    k4.x = seat[0] - (hx - FIG.NW / 2) * fs; k4.y = seat[1] - (hy - FIG.NH / 2) * fs - 3;
    put('1-1', { kind: 'balloon', style: 'caption', text: 'Meanwhile, back home...' }, 0.3, 0.08, { align: 'left' });
    const b4 = put('1-1', { kind: 'balloon', style: 'speech' }, 0.62, 0.3, { text: 'Dragons are *overrated*.' });
    aim(b4, k4);
    void P4;
    return doc;
  }

  // ------------------------------------------------------------------ boot
  function boot() {
    let loaded = null;
    try { loaded = migrateDoc(JSON.parse(localStorage.getItem(STORE_KEY) || 'null')); } catch (e) { loaded = null; }
    if (loaded) doc = loaded; else demoDoc();
    history = []; hIndex = -1; commit();
    renderLibrary(); renderAll(); afterChange();
    requestAnimationFrame(zoomFit);
    window.addEventListener('resize', () => { clearTimeout(boot.rt); boot.rt = setTimeout(zoomFit, 150); });
    window.addEventListener('beforeunload', () => { if (commitTimer) commit(); });
    if (!localStorage.getItem(HELP_KEY)) { try { localStorage.setItem(HELP_KEY, '1'); } catch (e) { /* ignore */ } openModal('#helpModal'); }
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot); else boot();

  window.StickStudio = { get doc() { return doc; }, state, renderAll, makePdf, rasterize, _migrate: migrateDoc };
})();
