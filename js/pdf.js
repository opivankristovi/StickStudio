/* StickStudio – tiny dependency-free PDF writer: one full-page JPEG image per page. */
(function () {
  function b64ToBytes(b64) {
    const bin = atob(b64), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** pages: [{ jpeg: Uint8Array, imgW, imgH, ptW, ptH }] → Blob (application/pdf) */
  function build(pages, title) {
    const enc = new TextEncoder();
    const parts = []; let offset = 0; const xref = [];
    const put = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); offset += b.length; };
    const obj = (n, body) => { xref[n] = offset; put(`${n} 0 obj\n`); body(); put(`\nendobj\n`); };

    const n = pages.length;
    // object numbers: 1 catalog, 2 pages, 3 info, then per page: page, content, image
    const pageObj = i => 4 + i * 3, contObj = i => 5 + i * 3, imgObj = i => 6 + i * 3;
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => put(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => pageObj(i) + ' 0 R').join(' ')}] >>`));
    const safe = String(title || 'Cartoon').replace(/[()\\]/g, '').replace(/[^\x20-\x7e]/g, '');
    obj(3, () => put(`<< /Title (${safe}) /Creator (StickStudio) >>`));
    pages.forEach((p, i) => {
      // optional crop marks: the page is placed inside a larger sheet with marks at the trim corners
      const o = p.marks ? 28 : 0;
      const w = p.ptW.toFixed(2), h = p.ptH.toFixed(2);
      const W = (p.ptW + 2 * o).toFixed(2), H = (p.ptH + 2 * o).toFixed(2);
      obj(pageObj(i), () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}]${o ? ` /TrimBox [${o} ${o} ${(p.ptW + o).toFixed(2)} ${(p.ptH + o).toFixed(2)}]` : ''} /Resources << /XObject << /Im${i} ${imgObj(i)} 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ${contObj(i)} 0 R >>`));
      let content = `q ${w} 0 0 ${h} ${o} ${o} cm /Im${i} Do Q`;
      if (o) {
        const x1 = o, y1 = o, x2 = p.ptW + o, y2 = p.ptH + o, L = 18, gap = 6, mk = [];
        for (const [x, sx] of [[x1, -1], [x2, 1]]) for (const [y, sy] of [[y1, -1], [y2, 1]]) {
          mk.push(`${(x + sx * gap).toFixed(2)} ${y.toFixed(2)} m ${(x + sx * (gap + L)).toFixed(2)} ${y.toFixed(2)} l`);
          mk.push(`${x.toFixed(2)} ${(y + sy * gap).toFixed(2)} m ${x.toFixed(2)} ${(y + sy * (gap + L)).toFixed(2)} l`);
        }
        content += `\nq 0 G 0.5 w ${mk.join(' ')} S Q`;
      }
      obj(contObj(i), () => put(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
      obj(imgObj(i), () => {
        put(`<< /Type /XObject /Subtype /Image /Width ${p.imgW} /Height ${p.imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
        put(p.jpeg);
        put('\nendstream');
      });
    });
    const total = 4 + n * 3;
    const xrefPos = offset;
    let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let i = 1; i < total; i++) x += String(xref[i]).padStart(10, '0') + ' 00000 n \n';
    put(x);
    put(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
  }

  // ---- minimal ZIP writer (stored, no compression – PNGs are already compressed)
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  /** files: [{ name, data: Uint8Array }] → Blob (application/zip) */
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
    const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)), dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate());
    for (const f of files) {
      const name = enc.encode(f.name), crc = crc32(f.data), n = f.data.length;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, n, true); h.setUint32(22, n, true);
      h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, f.data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, n, true); c.setUint32(24, n, true);
      c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + n;
    }
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
  }

  window.PDF = { build, b64ToBytes, zip };
})();
