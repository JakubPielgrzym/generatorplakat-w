'use strict';
/* global Poster, printApi */
// Okno wydruku: arkusz papieru z jedną lub kilkoma kopiami plakatu.

(async () => {
  const job = await printApi.job();
  if (!job) return;
  const { poster, plan } = job;
  const MM = Poster.MM;
  const W = plan.paper.w, H = plan.paper.h;
  document.getElementById('page-style').textContent = `@page { size: ${W}mm ${H}mm; margin: 0; }`;
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.style.width = W * MM + 'px';
  sheet.style.height = H * MM + 'px';
  if (job.grayscale) sheet.style.filter = 'grayscale(1)';
  if (job.cssZoom && job.cssZoom !== 1) document.body.style.zoom = String(job.cssZoom);
  const assetUrl = (id) => job.assetUrlBase + encodeURIComponent(id);
  const pw = poster.format.w, ph = poster.format.h;
  for (const c of plan.cells) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.style.left = c.x * MM + 'px';
    cell.style.top = c.y * MM + 'px';
    cell.style.transform = `scale(${c.scale})`;
    cell.appendChild(Poster.render(poster, { assetUrl }));
    sheet.appendChild(cell);
    if (job.cropMarks) {
      const L = 5, g = 1.5, t = 0.25;
      const x0 = c.x, y0 = c.y, x1 = c.x + pw * c.scale, y1 = c.y + ph * c.scale;
      const mark = (x, y, w, h) => { const m = document.createElement('div'); m.className = 'crop'; Object.assign(m.style, { left: x * MM + 'px', top: y * MM + 'px', width: w * MM + 'px', height: h * MM + 'px' }); sheet.appendChild(m); };
      for (const [x, sx] of [[x0, -1], [x1, 1]]) {
        for (const [y, sy] of [[y0, -1], [y1, 1]]) {
          mark(sx < 0 ? x - g - L : x + g, y - t / 2, L, t);
          mark(x - t / 2, sy < 0 ? y - g - L : y + g, t, L);
        }
      }
    }
  }
  document.getElementById('root').appendChild(sheet);
  // czekamy na czcionki i obrazy
  try { await Poster.loadFonts(); } catch (_) { /* ignore */ }
  const urls = [];
  sheet.querySelectorAll('.pe-img').forEach((el) => {
    const m = (el.style.backgroundImage || el.style.webkitMaskImage || '').match(/url\(["']?(.*?)["']?\)/);
    if (m) urls.push(m[1]);
  });
  await Promise.all([...new Set(urls)].map((u) => new Promise((res) => { const i = new Image(); i.onload = res; i.onerror = res; i.src = u; setTimeout(res, 8000); })));
  sheet.querySelectorAll('.poster-page').forEach((p) => Poster.fitText(p));
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  printApi.ready({ cells: plan.cells.length });
})();
