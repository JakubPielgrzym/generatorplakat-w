'use strict';
// Plan arkusza do druku (bez zależności od Electrona – testowalny w Node).
const Poster = require('../shared/poster');

const PAPERS = { A3: [297, 420], A4: [210, 297], A5: [148, 210], A6: [105, 148], Letter: [215.9, 279.4] };

// Plan arkusza: rozmiar papieru i położenie kopii plakatu
function planSheet(poster, opts = {}) {
  const pw = poster.format.w, ph = poster.format.h;
  const nup = [1, 2, 4, 8].includes(Number(opts.nup)) ? Number(opts.nup) : 1;
  let paperName = opts.paper || 'auto';
  let base;
  if (paperName === 'auto') {
    if (opts.forExport && nup === 1) base = [pw, ph];
    else {
      const f = Object.values(Poster.FORMATS).find((x) => Math.abs(x.w - pw) < 0.6 && Math.abs(x.h - ph) < 0.6);
      paperName = nup === 1 && f && f.paper ? f.paper : 'A4';
      base = PAPERS[paperName];
    }
  } else base = PAPERS[paperName] || PAPERS.A4;
  const margin = Math.max(0, Number(opts.marginMm) || 0) + (nup > 1 ? 4 : 0);
  const gap = nup > 1 ? 6 : 0;
  const grids = { 1: [[1, 1]], 2: [[2, 1], [1, 2]], 4: [[2, 2], [4, 1], [1, 4]], 8: [[4, 2], [2, 4]] }[nup];
  let best = null;
  const orientations = opts.forExport && paperName === 'auto' ? [[base[0], base[1]]] : [[Math.min(...base), Math.max(...base)], [Math.max(...base), Math.min(...base)]];
  for (const [W, H] of orientations) {
    for (const [cols, rows] of grids) {
      const cw = (W - 2 * margin - (cols - 1) * gap) / cols;
      const ch = (H - 2 * margin - (rows - 1) * gap) / rows;
      let scale = Math.min(cw / pw, ch / ph);
      if (opts.scale === 'actual' && nup === 1) scale = 1;
      if (!best || scale > best.scale + 1e-6) best = { W, H, cols, rows, cw, ch, scale };
    }
  }
  const { W, H, cols, rows, cw, ch, scale } = best;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = margin + c * (cw + gap) + (cw - pw * scale) / 2;
      const y = margin + r * (ch + gap) + (ch - ph * scale) / 2;
      cells.push({ x, y, scale });
    }
  }
  return { paper: { w: W, h: H, name: paperName === 'auto' ? null : paperName }, cells, nup };
}

module.exports = { planSheet, PAPERS };
