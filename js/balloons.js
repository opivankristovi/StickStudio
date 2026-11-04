/* StickStudio – speech / thought balloons, captions, SFX lettering. */
(function () {
  const STYLES = {
    speech:  { name: 'Speech',        tail: true,  fill: '#ffffff' },
    rounded: { name: 'Speech (box)',  tail: true,  fill: '#ffffff' },
    thought: { name: 'Thought',       tail: true,  fill: '#ffffff' },
    shout:   { name: 'Shout',         tail: true,  fill: '#ffffff' },
    whisper: { name: 'Whisper',       tail: true,  fill: '#ffffff' },
    caption: { name: 'Caption box',   tail: false, fill: '#fff6c2' },
    text:    { name: 'Plain text',    tail: false, fill: 'none' },
    sfx:     { name: 'Sound effect',  tail: false, fill: '#ffd23c' },
  };

  const FONTS = {
    'Comic Sans MS, Comic Neue, cursive': 'Comic',
    'Segoe Print, Comic Sans MS, cursive': 'Handwritten',
    'Ink Free, Segoe Print, cursive': 'Marker',
    'Arial, Helvetica, sans-serif': 'Arial',
    'Georgia, serif': 'Georgia',
    'Courier New, monospace': 'Typewriter',
    'Impact, Arial Black, sans-serif': 'Impact',
    'Segoe Script, cursive': 'Script',
  };

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const f = n => Math.round(n * 10) / 10;

  function fontCss(it, bold, italic) {
    return `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${it.size}px ${it.font}`;
  }

  // Parse "*bold*" and "_italic_" markers into styled words, paragraph by paragraph.
  function parse(it) {
    let text = it.text || '';
    if (it.upper) text = text.toUpperCase();
    return text.split('\n').map(par => {
      const words = []; let cur = null; let b = false, i = false;
      const push = () => { if (cur && cur.t) words.push(cur); cur = null; };
      for (const chr of par) {
        if (chr === '*') { if (cur) { cur.runs.push({ t: '', b: !b, i }); } b = !b; continue; }
        if (chr === '_') { if (cur) { cur.runs.push({ t: '', b, i: !i }); } i = !i; continue; }
        if (chr === ' ') { push(); continue; }
        if (!cur) cur = { t: '', runs: [{ t: '', b, i }] };
        cur.t += chr; cur.runs[cur.runs.length - 1].t += chr;
      }
      push();
      words.forEach(w => w.runs = w.runs.filter(r => r.t));
      return words;
    });
  }

  function measureRuns(it, runs) {
    let w = 0;
    for (const r of runs) { ctx.font = fontCss(it, it.bold || r.b, it.italic || r.i); w += ctx.measureText(r.t).width; }
    return w;
  }

  function layout(it, maxW) {
    ctx.font = fontCss(it, it.bold, it.italic);
    const space = ctx.measureText(' ').width;
    const lines = [];
    for (const words of parse(it)) {
      if (!words.length) { lines.push({ words: [], w: 0 }); continue; }
      let line = { words: [], w: 0 };
      for (const wd of words) {
        wd.w = measureRuns(it, wd.runs);
        const nw = line.words.length ? line.w + space + wd.w : wd.w;
        if (nw > maxW && line.words.length) { lines.push(line); line = { words: [wd], w: wd.w }; }
        else { line.words.push(wd); line.w = nw; }
      }
      lines.push(line);
    }
    const maxLine = lines.reduce((m, l) => Math.max(m, l.w), 0);
    return { lines, space, width: maxLine, height: lines.length * it.size * (it.lh || 1.2) };
  }

  function innerRatio(style) {
    return { speech: [0.74, 0.7], whisper: [0.74, 0.7], thought: [0.66, 0.6], shout: [0.6, 0.55], rounded: [1, 1], caption: [1, 1], text: [1, 1], sfx: [1, 1] }[style] || [0.8, 0.8];
  }
  function padding(style) { return ['rounded', 'caption'].includes(style) ? 12 : (style === 'text' || style === 'sfx' ? 4 : 0); }

  function innerSize(it) {
    const [rx, ry] = innerRatio(it.style), p = padding(it.style);
    return { w: Math.max(10, it.w * rx - 2 * p), h: Math.max(10, it.h * ry - 2 * p) };
  }

  // Compute a balloon size that nicely fits the text.
  function fit(it) {
    const [rx, ry] = innerRatio(it.style), p = padding(it.style);
    let best = null;
    for (let iw = 40; iw <= 700; iw += 10) {
      const L = layout(it, iw);
      const bw = (L.width + 2 * p) / rx, bh = (L.height + 2 * p) / ry;
      best = { w: bw, h: bh };
      const paragraphs = (it.text || '').split('\n').length;
      if (bh <= bw * 0.62 || L.lines.length <= paragraphs) break;
    }
    const ext = it.style === 'sfx' ? it.size * 0.3 : 6;
    return { w: Math.max(40, Math.ceil(best.w + ext)), h: Math.max(28, Math.ceil(best.h + ext)) };
  }

  function textSvg(it) {
    const inner = innerSize(it);
    const L = layout(it, inner.w + 0.5);
    const lh = it.size * (it.lh || 1.2);
    const y0 = -L.height / 2 + lh / 2 + it.size * 0.34;
    const align = it.align || 'center';
    const x = align === 'left' ? -inner.w / 2 : align === 'right' ? inner.w / 2 : 0;
    const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
    const sfx = it.style === 'sfx';
    const paint = sfx ? ` stroke="${it.stroke || '#1d1d1d'}" stroke-width="${f(it.size * 0.14)}" stroke-linejoin="round" paint-order="stroke"` : ' stroke="none"';
    const fill = sfx ? (it.fill || '#ffd23c') : (it.color || '#1d1d1d');
    let out = '';
    L.lines.forEach((line, li) => {
      const y = y0 + li * lh;
      let spans = '';
      line.words.forEach((wd, wi) => {
        wd.runs.forEach((r, ri) => {
          const pre = wi > 0 && ri === 0 ? ' ' : '';
          const b = it.bold || r.b, ital = it.italic || r.i;
          spans += `<tspan font-weight="${b ? 'bold' : 'normal'}" font-style="${ital ? 'italic' : 'normal'}">${esc(pre + r.t)}</tspan>`;
        });
      });
      if (spans) out += `<text x="${f(x)}" y="${f(y)}" text-anchor="${anchor}" xml:space="preserve" font-family="${esc(it.font)}" font-size="${it.size}" fill="${fill}"${paint}>${spans}</text>`;
    });
    return out;
  }

  function ellipsePath(rx, ry) { return `M${-rx},0 A${rx},${ry} 0 1 0 ${rx},0 A${rx},${ry} 0 1 0 ${-rx},0 Z`; }

  function cloudPath(rx, ry) {
    const per = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
    const n = Math.max(8, Math.round(per / 34));
    const pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + 0.3; pts.push([Math.cos(a) * rx, Math.sin(a) * ry]); }
    let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      const ch = Math.hypot(q[0] - p[0], q[1] - p[1]);
      d += ` A${f(ch * 0.62)},${f(ch * 0.62)} 0 0 1 ${f(q[0])},${f(q[1])}`;
    }
    return d + 'Z';
  }

  function shoutPath(rx, ry) {
    const n = 26; let d = '';
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const k = i % 2 ? 0.8 + ((i * 7) % 5) * 0.015 : 1.02 + ((i * 3) % 4) * 0.03;
      d += (i ? 'L' : 'M') + f(Math.cos(a) * rx * k) + ',' + f(Math.sin(a) * ry * k);
    }
    return d + 'Z';
  }

  function tailPath(it) {
    const tx = it.tx || 0, ty = it.ty || 0;
    const len = Math.hypot(tx, ty) || 1;
    const d = [tx / len, ty / len], n = [-d[1], d[0]];
    const m = Math.min(it.w, it.h);
    const B = [d[0] * m * 0.22, d[1] * m * 0.22];
    const wd = Math.max(7, Math.min(20, m * 0.15));
    const b1 = [B[0] + n[0] * wd, B[1] + n[1] * wd], b2 = [B[0] - n[0] * wd, B[1] - n[1] * wd];
    const bend = (it.bend !== undefined ? it.bend : 0.4) * wd * 2;
    if (it.style === 'shout') {
      const m1 = [(b1[0] + tx) / 2 + n[0] * 6, (b1[1] + ty) / 2 + n[1] * 6];
      const m2 = [(b2[0] + tx) / 2 + n[0] * 12, (b2[1] + ty) / 2 + n[1] * 12];
      return `M${f(b1[0])},${f(b1[1])} L${f(m1[0])},${f(m1[1])} L${f(tx)},${f(ty)} L${f(m2[0])},${f(m2[1])} L${f(b2[0])},${f(b2[1])} Z`;
    }
    const c1 = [(b1[0] + tx) / 2 + n[0] * bend, (b1[1] + ty) / 2 + n[1] * bend];
    const c2 = [(b2[0] + tx) / 2 + n[0] * bend, (b2[1] + ty) / 2 + n[1] * bend];
    return `M${f(b1[0])},${f(b1[1])} Q${f(c1[0])},${f(c1[1])} ${f(tx)},${f(ty)} Q${f(c2[0])},${f(c2[1])} ${f(b2[0])},${f(b2[1])} Z`;
  }

  function thoughtBubbles(it) {
    const tx = it.tx || 0, ty = it.ty || 0;
    const rx = it.w / 2, ry = it.h / 2;
    const a = Math.atan2(ty / ry, tx / rx);
    const E = [Math.cos(a) * rx, Math.sin(a) * ry];
    const k = Math.max(0.6, Math.min(1.4, Math.min(it.w, it.h) / 90));
    return [[0.3, 9], [0.62, 6], [0.92, 3.5]].map(([t, r]) =>
      `<circle cx="${f(E[0] + (tx - E[0]) * t)}" cy="${f(E[1] + (ty - E[1]) * t)}" r="${f(r * k)}"/>`).join('');
  }

  function draw(it) {
    const st = it.style;
    const lw = it.lw || 3;
    const stroke = it.stroke || '#1d1d1d';
    const fill = it.fill || STYLES[st].fill;
    const rx = it.w / 2, ry = it.h / 2;
    const text = textSvg(it);
    if (st === 'text' || st === 'sfx') return text;
    let body;
    switch (st) {
      case 'rounded': body = `<rect x="${f(-rx)}" y="${f(-ry)}" width="${f(it.w)}" height="${f(it.h)}" rx="${f(Math.min(18, ry))}"/>`; break;
      case 'caption': body = `<rect x="${f(-rx)}" y="${f(-ry)}" width="${f(it.w)}" height="${f(it.h)}" rx="2"/>`; break;
      case 'thought': body = `<path d="${cloudPath(rx * 0.9, ry * 0.86)}"/>`; break;
      case 'shout': body = `<path d="${shoutPath(rx * 0.97, ry * 0.95)}"/>`; break;
      default: body = `<path d="${ellipsePath(rx, ry)}"/>`;
    }
    let tail = '';
    if (it.tail !== false && STYLES[st].tail) tail = st === 'thought' ? thoughtBubbles(it) : `<path d="${tailPath(it)}"/>`;
    const dash = st === 'whisper' ? ` stroke-dasharray="${lw * 3} ${lw * 2.2}"` : '';
    const shapes = body + tail;
    return `<g fill="${fill}" stroke="${stroke}" stroke-width="${lw * 2}" stroke-linejoin="round"${dash}>${shapes}</g>`
      + `<g fill="${fill === 'none' ? '#fff' : fill}" stroke="none">${shapes}</g>` + text;
  }

  window.BAL = { STYLES, FONTS, draw, fit, layout, innerSize };
})();
