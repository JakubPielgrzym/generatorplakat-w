'use strict';
/* global UI, icon, Poster, state, h, iconEl, toast, sheet, segmented, select, toggle, spinner, busy, render, go, errToast, assetUrl, printDialog, aiReady, presetById */
// Edytor plakatów: przeciąganie i skalowanie elementów, edycja tekstu w miejscu, warstwy,
// cofanie/ponawianie, szybka zmiana kolorów, czcionek i układu, poprawki poleceniem dla AI.

const Editor = (() => {
  const MM = Poster.MM;
  const E = { poster: null, sel: null, zoom: 'fit', z: 1, history: [], future: [], dirty: false, saving: false, savedAt: null, saveTimer: null, aiBusy: false, aiText: '', leftTab: 'add', clipboard: null, editingText: false };
  const ROLE_LABEL = { title: 'Tytuł', subtitle: 'Podtytuł', date: 'Data', time: 'Godzina', place: 'Miejsce', body: 'Treść', schedule: 'Harmonogram', quote: 'Cytat', closing: 'Zakończenie', footer: 'Stopka', kicker: 'Nazwa parafii', logo: 'Logo', image: 'Zdjęcie', motif: 'Motyw', divider: 'Ozdobnik', qr: 'Kod QR', rule: 'Linia', fade: 'Przejście tonalne', header: 'Nagłówek' };
  const TYPE_ICON = { text: 'textT', image: 'photo', motif: 'cross', shape: 'square', schedule: 'list', qr: 'qr' };
  const ROLE_FIELD = { title: 'title', subtitle: 'subtitle', date: 'dateText', time: 'timeText', place: 'placeText', body: 'body', closing: 'closing', footer: 'footer' };

  const P = () => E.poster;
  const selEl = () => (E.poster && E.sel ? E.poster.elements.find((e) => e.id === E.sel) : null);
  const pal = () => Poster.resolvePalette(E.poster.style);

  function open(p) {
    E.poster = Poster.clone(p);
    E.sel = null; E.history = []; E.future = []; E.zoom = 'fit'; E.dirty = false; E.savedAt = p.updatedAt || null; E.aiText = '';
  }

  function leave() { if (E.dirty) saveNow(); }

  // ── historia i zapis ──
  function snapshot() { E.history.push(JSON.stringify(E.poster)); if (E.history.length > 80) E.history.shift(); E.future = []; }
  function commit(fn, opts = {}) {
    if (!opts.noHistory) snapshot();
    fn(E.poster);
    markDirty();
    if (opts.full) render(); else { drawCanvas(); if (!opts.keepProps) drawProps(); drawLayers(); }
    drawToolbarState();
  }
  function replacePoster(p, opts = {}) { snapshot(); E.poster = p; if (E.sel && !p.elements.find((e) => e.id === E.sel)) E.sel = null; markDirty(); if (opts.full !== false) render(); }
  function undo() { if (!E.history.length) return; E.future.push(JSON.stringify(E.poster)); E.poster = JSON.parse(E.history.pop()); afterHistory(); }
  function redo() { if (!E.future.length) return; E.history.push(JSON.stringify(E.poster)); E.poster = JSON.parse(E.future.pop()); afterHistory(); }
  function afterHistory() { if (E.sel && !selEl()) E.sel = null; markDirty(); drawCanvas(); drawProps(); drawLayers(); drawToolbarState(); }
  function markDirty() { E.dirty = true; clearTimeout(E.saveTimer); E.saveTimer = setTimeout(saveNow, 1200); drawToolbarState(); }
  async function saveNow(explicit) {
    clearTimeout(E.saveTimer);
    if (!E.poster) return;
    E.saving = true; drawToolbarState();
    try {
      const saved = await api.savePoster(Poster.clone(E.poster));
      E.poster.updatedAt = saved.updatedAt; E.savedAt = saved.updatedAt; E.dirty = false;
      if (explicit) toast('Zapisano plakat', 'success', 1400);
    } catch (e) { errToast(e); }
    E.saving = false; drawToolbarState();
  }

  // ── widok ──
  function view() {
    const p = E.poster;
    const name = h('input', { class: 'input ed-name', value: p.name, title: 'Nazwa plakatu', onchange: (e) => commit((x) => { x.name = e.target.value || 'Plakat'; }, { keepProps: true }) });
    return h('div', { class: 'editor' },
      h('div', { class: 'ed-toolbar' },
        h('button', { class: 'btn', onclick: () => go('library') }, iconEl('chevronL', 13), 'Plakaty'),
        name,
        h('div', { class: 'ed-sep' }),
        h('button', { class: 'icon-btn', id: 'ed-undo', title: 'Cofnij (Ctrl+Z)', onclick: undo, html: icon('undo', 16) }),
        h('button', { class: 'icon-btn', id: 'ed-redo', title: 'Ponów (Ctrl+Shift+Z)', onclick: redo, html: icon('redo', 16) }),
        h('div', { class: 'ed-sep' }),
        h('button', { class: 'icon-btn', title: 'Pomniejsz', onclick: () => setZoom(E.z / 1.2), html: icon('minus', 16) }),
        h('button', { class: 'btn plain sm', id: 'ed-zoom', title: 'Dopasuj do okna', onclick: () => setZoom('fit') }, '100%'),
        h('button', { class: 'icon-btn', title: 'Powiększ', onclick: () => setZoom(E.z * 1.2), html: icon('plus', 16) }),
        h('div', { style: { flex: 1 } }),
        h('span', { class: 'muted small', id: 'ed-status' }),
        h('button', { class: 'btn', onclick: exportMenu }, iconEl('download', 14), 'Eksport'),
        h('button', { class: 'btn', onclick: () => printDialog(Poster.clone(E.poster)) }, iconEl('printer', 14), 'Drukuj'),
        h('button', { class: 'btn primary', onclick: () => saveNow(true) }, iconEl('check', 14), 'Zapisz')),
      h('div', { class: 'ed-body' },
        h('aside', { class: 'ed-left', id: 'ed-left' }),
        h('div', { class: 'ed-stage', id: 'ed-stage', onmousedown: (e) => { if (e.target.id === 'ed-stage' || e.target.classList.contains('ed-center')) select_(null); } }, h('div', { class: 'ed-center', id: 'ed-center' })),
        h('aside', { class: 'ed-right', id: 'ed-right' })));
  }

  function afterRender() {
    drawCanvas(); drawProps(); drawLeft(); drawToolbarState();
    if (!E._resizeHooked) { E._resizeHooked = true; window.addEventListener('resize', () => { if (state.view === 'editor' && E.zoom === 'fit') drawCanvas(); }); }
  }

  function drawToolbarState() {
    const st = document.getElementById('ed-status');
    if (st) st.textContent = E.saving ? 'Zapisywanie…' : E.dirty ? 'Niezapisane zmiany' : E.savedAt ? 'Zapisano ' + new Date(E.savedAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '';
    const u = document.getElementById('ed-undo'); if (u) u.disabled = !E.history.length;
    const r = document.getElementById('ed-redo'); if (r) r.disabled = !E.future.length;
    const z = document.getElementById('ed-zoom'); if (z) z.textContent = Math.round(E.z * 100) + '%';
  }

  function setZoom(z) { E.zoom = z === 'fit' ? 'fit' : Math.max(0.15, Math.min(4, z)); drawCanvas(); drawToolbarState(); }

  // ── płótno ──
  function drawCanvas() {
    const stage = document.getElementById('ed-stage');
    const center = document.getElementById('ed-center');
    if (!stage || !center) return;
    const p = E.poster;
    const pw = p.format.w * MM, ph = p.format.h * MM;
    if (E.zoom === 'fit') E.z = Math.max(0.15, Math.min((stage.clientWidth - 70) / pw, (stage.clientHeight - 70) / ph));
    else E.z = E.zoom;
    const holder = h('div', { class: 'ed-holder', style: { width: pw * E.z + 'px', height: ph * E.z + 'px' } });
    const page = Poster.render(p, { assetUrl });
    page.classList.add('ed-page');
    page.style.transform = `scale(${E.z})`;
    page.style.transformOrigin = '0 0';
    holder.appendChild(page);
    const overlay = h('div', { class: 'ed-overlay', id: 'ed-overlay' });
    holder.appendChild(overlay);
    holder.addEventListener('mousedown', onPageDown);
    holder.addEventListener('dblclick', onPageDbl);
    center.replaceChildren(holder);
    E.page = page; E.holder = holder;
    Poster.loadFonts().then(() => { if (page.isConnected) Poster.fitText(page); });
    drawSelection();
    drawToolbarState();
  }

  function drawSelection(guides) {
    const ov = document.getElementById('ed-overlay');
    if (!ov) return;
    ov.replaceChildren();
    const e = selEl();
    if (guides) for (const g of guides) ov.appendChild(h('div', { class: 'ed-guide ' + g.dir, style: g.dir === 'v' ? { left: g.pos * MM * E.z + 'px' } : { top: g.pos * MM * E.z + 'px' } }));
    if (!e) return;
    const z = MM * E.z;
    const box = h('div', { class: 'ed-sel' + (e.locked ? ' locked' : ''), style: { left: e.x * z + 'px', top: e.y * z + 'px', width: e.w * z + 'px', height: e.h * z + 'px', transform: e.rot ? `rotate(${e.rot}deg)` : '' } });
    if (!e.locked) for (const hd of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) box.appendChild(h('div', { class: 'ed-h h-' + hd, 'data-h': hd }));
    box.appendChild(h('div', { class: 'ed-dim' }, `${(ROLE_LABEL[e.role] || e.type)} · ${Math.round(e.w)}×${Math.round(e.h)} mm`));
    ov.appendChild(box);
  }

  function toMm(ev) {
    const r = E.holder.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / (MM * E.z), y: (ev.clientY - r.top) / (MM * E.z) };
  }

  function select_(id) {
    if (E.editingText) return;
    if (E.sel === id) return;
    E.sel = id;
    drawSelection(); drawProps(); drawLayers();
  }

  function onPageDown(ev) {
    if (ev.button !== 0 || E.editingText) return;
    const handle = ev.target.closest('.ed-h');
    const pe = ev.target.closest('.pe');
    let el = selEl();
    if (handle && el) return startResize(ev, el, handle.dataset.h);
    if (ev.target.closest('.ed-sel') && el) return startDrag(ev, el);
    if (!pe) { select_(null); return; }
    // wybór elementu (Alt = element pod spodem)
    const id = pe.dataset.id;
    select_(id);
    el = selEl();
    if (el && !el.locked) startDrag(ev, el);
  }

  function startDrag(ev, el) {
    ev.preventDefault();
    if (el.locked) return;
    const start = toMm(ev);
    const x0 = el.x, y0 = el.y;
    const before = JSON.stringify(E.poster);
    const node = E.page.querySelector(`[data-id="${el.id}"]`);
    let moved = false;
    const W = E.poster.format.w, H = E.poster.format.h;
    const move = (e) => {
      const m = toMm(e);
      let nx = x0 + m.x - start.x, ny = y0 + m.y - start.y;
      if (!moved && Math.abs(m.x - start.x) + Math.abs(m.y - start.y) < 0.6) return;
      moved = true;
      const guides = [];
      const tol = 2.2 / E.z;
      if (!e.altKey) {
        const cx = nx + el.w / 2, cy = ny + el.h / 2;
        if (Math.abs(cx - W / 2) < tol) { nx = W / 2 - el.w / 2; guides.push({ dir: 'v', pos: W / 2 }); }
        if (Math.abs(cy - H / 2) < tol) { ny = H / 2 - el.h / 2; guides.push({ dir: 'h', pos: H / 2 }); }
        for (const o of E.poster.elements) {
          if (o.id === el.id || o.hidden) continue;
          for (const [a, b] of [[nx, o.x], [nx, o.x + o.w], [nx + el.w, o.x + o.w], [nx + el.w, o.x]]) if (Math.abs(a - b) < tol / 1.5) { nx += b - a; guides.push({ dir: 'v', pos: b }); break; }
          for (const [a, b] of [[ny, o.y + o.h], [ny + el.h, o.y], [ny, o.y], [ny + el.h, o.y + o.h]]) if (Math.abs(a - b) < tol / 1.5) { ny += b - a; guides.push({ dir: 'h', pos: b }); break; }
        }
      }
      el.x = nx; el.y = ny;
      if (node) { node.style.left = nx * MM + 'px'; node.style.top = ny * MM + 'px'; }
      drawSelection(guides);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (moved) {
        el.x = Math.round(el.x * 10) / 10; el.y = Math.round(el.y * 10) / 10;
        E.history.push(before); E.future = [];
        markDirty(); drawSelection(); drawProps();
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  function startResize(ev, el, hd) {
    ev.preventDefault(); ev.stopPropagation();
    const start = toMm(ev);
    const r0 = { x: el.x, y: el.y, w: el.w, h: el.h };
    const before = JSON.stringify(E.poster);
    const node = E.page.querySelector(`[data-id="${el.id}"]`);
    const keepAspect = ['image', 'motif', 'qr'].includes(el.type);
    const aspect = r0.w / r0.h;
    const move = (e) => {
      const m = toMm(e);
      const dx = m.x - start.x, dy = m.y - start.y;
      let { x, y, w, h: hh } = r0;
      if (hd.includes('e')) w = r0.w + dx;
      if (hd.includes('s')) hh = r0.h + dy;
      if (hd.includes('w')) { w = r0.w - dx; x = r0.x + dx; }
      if (hd.includes('n')) { hh = r0.h - dy; y = r0.y + dy; }
      w = Math.max(3, w); hh = Math.max(el.type === 'shape' ? 0.3 : 3, hh);
      if ((keepAspect && !e.shiftKey) || (!keepAspect && e.shiftKey)) {
        if (hd === 'n' || hd === 's') w = hh * aspect; else hh = w / aspect;
        if (hd.includes('w')) x = r0.x + r0.w - w;
        if (hd.includes('n')) y = r0.y + r0.h - hh;
        if (hd === 'n' || hd === 's') x = r0.x + (r0.w - w) / 2;
        if (hd === 'e' || hd === 'w') y = r0.y + (r0.h - hh) / 2;
      }
      Object.assign(el, { x, y, w, h: hh });
      if (node) Object.assign(node.style, { left: x * MM + 'px', top: y * MM + 'px', width: w * MM + 'px', height: hh * MM + 'px' });
      drawSelection();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      for (const k of ['x', 'y', 'w', 'h']) el[k] = Math.round(el[k] * 10) / 10;
      E.history.push(before); E.future = [];
      markDirty(); drawCanvas(); drawProps();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  // edycja tekstu w miejscu (podwójne kliknięcie)
  function onPageDbl(ev) {
    const pe = ev.target.closest('.pe') || (ev.target.closest('.ed-sel') && E.sel ? E.page.querySelector(`[data-id="${E.sel}"]`) : null);
    if (!pe) return;
    const el = E.poster.elements.find((x) => x.id === pe.dataset.id);
    if (!el || el.type !== 'text' || el.locked) return;
    const inner = pe.querySelector('.pe-text > div');
    if (!inner) return;
    E.editingText = true;
    inner.textContent = el.text.content;
    inner.style.whiteSpace = 'pre-wrap';
    inner.contentEditable = 'plaintext-only';
    inner.classList.add('ed-editing');
    inner.focus();
    const range = document.createRange(); range.selectNodeContents(inner);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    const finish = (save) => {
      inner.removeEventListener('blur', onBlur);
      inner.removeEventListener('keydown', onKeyEdit);
      E.editingText = false;
      const txt = inner.innerText.replace(/\n$/, '');
      if (save && txt !== el.text.content) commit(() => setText(el, txt));
      else drawCanvas();
    };
    const onBlur = () => finish(true);
    const onKeyEdit = (k) => {
      k.stopPropagation();
      if (k.key === 'Escape') { k.preventDefault(); finish(false); }
      if (k.key === 'Enter' && (k.ctrlKey || k.metaKey)) { k.preventDefault(); inner.blur(); }
    };
    inner.addEventListener('blur', onBlur);
    inner.addEventListener('keydown', onKeyEdit);
  }

  function setText(el, txt) {
    el.text.content = txt;
    const c = E.poster.content || (E.poster.content = {});
    if (ROLE_FIELD[el.role]) c[ROLE_FIELD[el.role]] = txt;
    if (el.role === 'quote') { const [t, ...src] = txt.split('\n'); c.quote = t ? { text: t.replace(/^[„"]|[”"]$/g, ''), source: src.join(' ') } : null; }
    if (el.role === 'title') E.poster.name = txt.split('\n')[0].slice(0, 80) || E.poster.name;
  }

  // ── lewy panel: dodawanie i warstwy ──
  function drawLeft() {
    const left = document.getElementById('ed-left');
    if (!left) return;
    left.replaceChildren(
      h('div', { class: 'ed-tabs' }, segmented([{ value: 'add', label: 'Dodaj' }, { value: 'layers', label: 'Warstwy' }], E.leftTab, (v) => { E.leftTab = v; drawLeft(); })),
      h('div', { id: 'ed-left-body', class: 'ed-left-body' }));
    if (E.leftTab === 'add') drawAdd(); else drawLayers();
  }

  function addElement(el) {
    const p = E.poster;
    el.id = Poster.uid();
    el.rot = el.rot || 0; el.opacity = el.opacity == null ? 1 : el.opacity;
    if (el.x == null) { el.x = (p.format.w - el.w) / 2; el.y = (p.format.h - el.h) / 2; }
    commit((x) => x.elements.push(el));
    select_(el.id);
  }

  function drawAdd() {
    const body = document.getElementById('ed-left-body');
    if (!body) return;
    const P_ = new Proxy({}, { get: (_, k) => pal()[k] }); // zawsze aktualna paleta plakatu
    const F = new Proxy({}, { get: (_, k) => (E.poster.style.fonts || { heading: 'cinzel', body: 'garamond', script: 'vibes' })[k] });
    const W = E.poster.format.w;
    const tile = (ic, label, fn, hint) => h('button', { class: 'ed-tile', title: hint || label, onclick: fn }, h('span', { html: icon(ic, 20) }), h('span', null, label));
    const textEl = (content, size, font, fontKey, colorKey, extra = {}) => ({ type: 'text', role: extra.role || 'custom', w: W * 0.7, h: size * 0.3528 * 1.6 + 4, text: Object.assign({ content, font, fontKey, size, weight: 400, italic: false, color: P_[colorKey], colorKey, align: 'center', valign: 'middle', lineHeight: 1.2, letterSpacing: 0, upper: false, shadow: false, fit: true }, extra.text || {}) });
    body.replaceChildren(
      h('div', { class: 'ed-sub' }, 'Tekst'),
      h('div', { class: 'ed-tiles' },
        tile('textT', 'Nagłówek', () => addElement(textEl('Nagłówek', 34, F.heading, 'heading', 'title', { text: { weight: 700, upper: true } }))),
        tile('doc', 'Akapit', () => addElement(Object.assign(textEl('Wpisz treść ogłoszenia…', 15, F.body, 'body', 'text'), { h: 30 }))),
        tile('pencil', 'Ozdobny', () => addElement(textEl('Zapraszamy!', 30, F.script, 'script', 'accent'))),
        tile('list', 'Harmonogram', () => addElement({ type: 'schedule', role: 'custom', w: W * 0.7, h: 40, schedule: { items: [{ when: '10:00', what: 'Msza Święta' }, { when: '12:00', what: 'Nabożeństwo' }], font: F.body, fontKey: 'body', whenFont: F.heading, whenFontKey: 'heading', size: 15, color: P_.text, colorKey: 'text', whenColor: P_.title, whenColorKey: 'title', lines: true, lineColor: P_.accent, lineKey: 'accent', fit: true } }))),
      h('div', { class: 'ed-sub' }, 'Grafika'),
      h('div', { class: 'ed-tiles' },
        tile('photo', 'Zdjęcie / logo', () => pickAsset((id) => { const a = state.assets.find((x) => x.id === id); const asp = (a && a.aspect) || 1; const w = W * 0.4; addElement({ type: 'image', role: 'custom', w, h: w / asp, image: { assetId: id, fit: 'contain', shape: 'rect', radius: 0, borderWidth: 0, borderColor: P_.accent, tint: null } }); })),
        tile('cross', 'Motyw religijny', () => pickMotif((name) => { const def = Poster.MOTIFS[name]; const vb = (def.vb || '0 0 100 100').split(' ').map(Number); const w = def.vb ? W * 0.45 : W * 0.18; addElement({ type: 'motif', role: 'custom', w, h: w * vb[3] / vb[2], motif: { name, color: P_.accent, colorKey: 'accent', stroke: def.vb ? 1.6 : 3 } }); })),
        tile('qr', 'Kod QR', async () => { const data = state.settings.poster.qrUrl || state.settings.parish.website || 'https://'; const svg = await api.qrSvg(data).catch(() => ''); addElement({ type: 'qr', role: 'qr', w: 28, h: 28, qr: { data, color: P_.text, colorKey: 'text', svg } }); })),
      h('div', { class: 'ed-sub' }, 'Kształty'),
      h('div', { class: 'ed-tiles' },
        tile('square', 'Prostokąt', () => addElement({ type: 'shape', role: 'custom', w: W * 0.5, h: 30, opacity: 1, shape: { kind: 'rect', fill: P_.bg2, fillKey: 'bg2', stroke: null, strokeWidth: 0, radius: 2 } })),
        tile('circle', 'Elipsa', () => addElement({ type: 'shape', role: 'custom', w: 40, h: 40, shape: { kind: 'ellipse', fill: P_.bg2, fillKey: 'bg2', stroke: P_.accent, strokeWidth: 0.6, radius: 0 } })),
        tile('minus', 'Linia', () => addElement({ type: 'shape', role: 'rule', w: W * 0.5, h: 0.6, shape: { kind: 'rect', fill: P_.accent, fillKey: 'accent', stroke: null, strokeWidth: 0, radius: 0 } })),
        tile('sparkles', 'Ozdobnik', () => pickMotif((name) => { const w = W * 0.45; addElement({ type: 'motif', role: 'divider', w, h: w * 24 / 200, motif: { name, color: P_.accent, colorKey: 'accent', stroke: 1.6 } }); }, true))),
      h('p', { class: 'muted small ed-tip' }, 'Wskazówki: przeciągaj elementy myszką, uchwytami zmieniaj rozmiar (Shift – bez zachowania proporcji). Dwuklik w tekst = edycja. Strzałki przesuwają o 1 mm (z Shift o 5 mm). Ctrl+D duplikuje, Delete usuwa.'));
  }

  function drawLayers() {
    if (E.leftTab !== 'layers') return;
    const body = document.getElementById('ed-left-body');
    if (!body) return;
    const els = E.poster.elements.map((e, i) => ({ e, i })).reverse();
    body.replaceChildren(h('div', { class: 'ed-layers' }, els.map(({ e }) => {
      const label = e.type === 'text' ? (e.text.content || '').split('\n')[0].slice(0, 28) || '(pusty)' : e.type === 'image' ? ((state.assets.find((a) => a.id === e.image.assetId) || {}).name || 'Obraz') : e.type === 'motif' ? (Poster.MOTIFS[e.motif.name] || {}).label || 'Motyw' : (ROLE_LABEL[e.role] || e.type);
      return h('div', { class: 'ed-layer' + (e.id === E.sel ? ' active' : '') + (e.hidden ? ' hidden' : ''), onclick: () => select_(e.id) },
        h('span', { class: 'ly-ic', html: icon(TYPE_ICON[e.type] || 'square', 14) }),
        h('div', { class: 'ly-text' }, h('div', { class: 'ly-role' }, ROLE_LABEL[e.role] || 'Element'), h('div', { class: 'ly-label' }, label)),
        h('button', { class: 'icon-btn', title: e.hidden ? 'Pokaż' : 'Ukryj', onclick: (ev) => { ev.stopPropagation(); commit(() => { e.hidden = !e.hidden; }); }, html: icon(e.hidden ? 'eyeOff' : 'eye', 13) }),
        h('button', { class: 'icon-btn', title: e.locked ? 'Odblokuj' : 'Zablokuj', onclick: (ev) => { ev.stopPropagation(); commit(() => { e.locked = !e.locked; }); }, html: icon(e.locked ? 'lock' : 'unlock', 13) }));
    })));
  }

  // ── prawy panel: właściwości ──
  function num(value, onChange, o = {}) {
    return h('div', { class: 'num' + (o.label ? ' labeled' : '') }, o.label ? h('span', { class: 'num-l' }, o.label) : null,
      h('input', { class: 'input', type: 'number', step: o.step || 1, min: o.min, max: o.max, value: Math.round(Number(value) * 10) / 10, style: { width: (o.width || 64) + 'px' }, onchange: (e) => { const v = parseFloat(e.target.value.replace(',', '.')); if (!isNaN(v)) onChange(v); } }),
      o.suffix ? h('span', { class: 'num-s' }, o.suffix) : null);
  }
  function colorInput(value, onChange) {
    const P_ = pal();
    const sw = [P_.title, P_.text, P_.accent, P_.muted, P_.bg, P_.bg2, '#ffffff', '#000000'];
    const isHex = /^#[0-9a-f]{6}$/i.test(value || '');
    return h('div', { class: 'color-field' },
      isHex ? h('input', { type: 'color', value, oninput: (e) => onChange(e.target.value, true), onchange: (e) => onChange(e.target.value) }) : h('input', { class: 'input', style: { width: '120px' }, value: value || '', onchange: (e) => onChange(e.target.value) }),
      h('div', { class: 'swatches' }, [...new Set(sw)].map((c) => h('button', { class: 'sw' + (String(value).toLowerCase() === c.toLowerCase() ? ' on' : ''), title: c, style: { background: c }, onclick: () => onChange(c) }))));
  }
  const prop = (label, control) => h('div', { class: 'prop' }, h('label', null, label), control);
  const section = (title, ...kids) => h('div', { class: 'ed-section' }, title ? h('div', { class: 'ed-sec-title' }, title) : null, ...kids);

  function drawProps() {
    const right = document.getElementById('ed-right');
    if (!right) return;
    const el = selEl();
    right.replaceChildren(aiBox(), el ? elementProps(el) : pageProps());
  }

  function aiBox() {
    const ta = h('textarea', { class: 'input area', rows: 3, placeholder: 'Napisz, co zmienić, np. „Zmień godzinę na 18:00 i dodaj, że spowiedź od 17:30”', value: E.aiText, oninput: (e) => { E.aiText = e.target.value; } });
    const chips = ['Skróć teksty', 'Bardziej uroczyście', 'Dodaj cytat z Pisma Świętego', 'Zmień kolory na bardziej radosne', 'Popraw błędy językowe'];
    const run = async (btn) => {
      if (!E.aiText.trim()) { toast('Wpisz polecenie dla AI', 'info'); return; }
      E.aiBusy = true;
      await busy(btn, async () => {
        try {
          const r = await api.refinePoster(Poster.clone(E.poster), E.aiText);
          replacePoster(r.poster);
          toast(r.notes || 'Wprowadzono zmiany', 'success', 5000);
          if (r.missing && r.missing.length) toast('Brakuje: ' + r.missing.join(', '), 'info', 7000);
          E.aiText = '';
          drawProps();
        } catch (e) { errToast(e); }
      }, 'AI pracuje…');
      E.aiBusy = false;
    };
    const btn = h('button', { class: 'btn primary', disabled: !aiReady() || null, onclick: (e) => run(e.currentTarget) }, iconEl('sparkles', 14), 'Popraw z AI');
    return h('div', { class: 'ed-section ai-box' },
      h('div', { class: 'ed-sec-title' }, iconEl('sparkles', 13), 'Popraw poleceniem'),
      ta,
      h('div', { class: 'ai-chips' }, chips.map((c) => h('button', { class: 'chip-btn', onclick: () => { E.aiText = E.aiText ? E.aiText + '. ' + c : c; ta.value = E.aiText; ta.focus(); } }, c))),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, btn, !aiReady() ? h('span', { class: 'muted small' }, 'Połącz konto Claude') : null));
  }

  function pageProps() {
    const p = E.poster;
    const c = p.content || {};
    const P_ = pal();
    const field = (label, key, area) => prop(label, h(area ? 'textarea' : 'input', { class: 'input' + (area ? ' area' : ''), rows: area ? 3 : null, value: c[key] || '', onchange: (e) => updateContent({ [key]: e.target.value }) }));
    return h('div', null,
      section('Treść plakatu',
        field('Tytuł', 'title'), field('Podtytuł', 'subtitle'), field('Data', 'dateText'), field('Godzina', 'timeText'), field('Miejsce', 'placeText'), field('Treść', 'body', true), field('Zakończenie', 'closing'),
        h('p', { class: 'muted small' }, 'Pole puste = element znika. Nowe pole = nowy układ plakatu.')),
      section('Kolorystyka',
        h('div', { class: 'pal-grid' }, Object.entries(Poster.PALETTES).map(([id, x]) => h('button', { class: 'pal' + (p.style.paletteId === id && !p.style.palette ? ' on' : ''), title: x.label, onclick: () => replacePoster(Poster.recolor(p, id), { full: false }) || drawCanvas() || drawProps() },
          h('span', { style: { background: x.bg } }), h('span', { style: { background: x.title } }), h('span', { style: { background: x.accent } }))))),
      section('Czcionki',
        ...[['heading', 'Tytuły'], ['body', 'Treść'], ['script', 'Ozdobna']].map(([k, l]) => prop(l, select(Object.entries(Poster.FONTS).map(([v, f]) => ({ value: v, label: f.label })), (p.style.fonts || {})[k], (v) => { replacePoster(Poster.refont(p, { [k]: v }), { full: false }); drawCanvas(); drawProps(); })))),
      section('Układ i format',
        prop('Układ', select(Object.entries(Poster.LAYOUTS).map(([v, l]) => ({ value: v, label: l })), p.style.layout, (v) => relayoutTo(v, null))),
        prop('Format', select([{ value: '', label: `${Math.round(p.format.w)}×${Math.round(p.format.h)} mm (obecny)` }, ...Object.entries(Poster.FORMATS).map(([v, f]) => ({ value: v, label: f.label }))], '', (v) => { if (v) relayoutTo(null, v); })),
        h('p', { class: 'muted small' }, 'Zmiana układu lub formatu ustawia elementy od nowa (ręczne przesunięcia można cofnąć Ctrl+Z).')),
      section('Tło',
        prop('Kolor tła', colorInput(p.background.color, (v, live) => commit((x) => { x.background.color = v; x.background.colorKey = null; }, { noHistory: live, keepProps: live }))),
        prop('Wzór', select(Object.entries(Poster.PATTERNS).map(([v, l]) => ({ value: v, label: l })), p.background.pattern || 'none', (v) => commit((x) => { x.background.pattern = v; }))),
        p.background.pattern === 'gradient' ? prop('Drugi kolor', colorInput(p.background.color2 || P_.bg2, (v, live) => commit((x) => { x.background.color2 = v; }, { noHistory: live, keepProps: live }))) : null,
        prop('Zdjęcie w tle', h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
          h('button', { class: 'btn sm', onclick: () => pickAsset((id) => commit((x) => { x.background.imageAssetId = id; })) }, p.background.imageAssetId ? 'Zmień' : 'Wybierz'),
          p.background.imageAssetId ? h('button', { class: 'btn sm', onclick: () => commit((x) => { x.background.imageAssetId = null; }) }, 'Usuń') : null)),
        p.background.imageAssetId ? prop('Krycie zdjęcia', h('input', { type: 'range', min: 0.03, max: 1, step: 0.01, value: p.background.imageOpacity, oninput: (e) => commit((x) => { x.background.imageOpacity = Number(e.target.value); }, { noHistory: true, keepProps: true }) })) : null),
      section('Ramka',
        prop('Styl', select(Object.entries(Poster.FRAMES).map(([v, l]) => ({ value: v, label: l })), p.frame.style || 'none', (v) => commit((x) => { x.frame.style = v; x.style.frame = v; }))),
        p.frame.style && p.frame.style !== 'none' ? [
          prop('Kolor', colorInput(p.frame.color, (v, live) => commit((x) => { x.frame.color = v; x.frame.colorKey = null; }, { noHistory: live, keepProps: live }))),
          prop('Odstęp od brzegu', num(p.frame.inset, (v) => commit((x) => { x.frame.inset = v; }), { suffix: 'mm', step: 0.5 })),
          prop('Grubość', num(p.frame.width, (v) => commit((x) => { x.frame.width = v; }), { suffix: 'mm', step: 0.1 }))
        ] : null));
  }

  async function updateContent(patch) {
    const p = E.poster;
    const r = Poster.applyContent(p, patch);
    if (r) { replacePoster(r, { full: false }); drawCanvas(); drawProps(); drawLayers(); return; }
    try {
      const next = Poster.clone(p);
      next.content = Object.assign({}, p.content, patch);
      const out = await api.relayout(next, null, null);
      replacePoster(out);
    } catch (e) { errToast(e); }
  }

  async function relayoutTo(layoutId, formatId) {
    try {
      const out = await api.relayout(Poster.clone(E.poster), layoutId, formatId);
      if (formatId) { out.background = Object.assign({}, E.poster.background, { color: out.background.color }); }
      E.zoom = 'fit';
      replacePoster(out);
    } catch (e) { errToast(e); }
  }

  function elementProps(el) {
    const upd = (fn, live) => commit(() => fn(el), { noHistory: !!live, keepProps: !!live });
    let specific = null;
    if (el.type === 'text') {
      const t = el.text;
      specific = section('Tekst',
        h('textarea', { class: 'input area', rows: Math.min(8, Math.max(2, (t.content || '').split('\n').length + 1)), value: t.content, onchange: (e) => upd(() => setText(el, e.target.value)) }),
        h('p', { class: 'muted small', style: { margin: '2px 0 8px' } }, '**pogrubienie** · nowa linia = Enter'),
        prop('Czcionka', select(Object.entries(Poster.FONTS).map(([v, f]) => ({ value: v, label: f.label })), t.font, (v) => upd(() => { t.font = v; t.fontKey = null; }))),
        h('div', { class: 'prop-row' },
          prop('Rozmiar', num(t.size, (v) => upd(() => { t.size = v; }), { suffix: 'pt', step: 1, min: 4 })),
          prop('Interlinia', num(t.lineHeight, (v) => upd(() => { t.lineHeight = v; }), { step: 0.05, min: 0.7 }))),
        prop('Styl', h('div', { class: 'btn-row' },
          h('button', { class: 'tbtn' + (t.weight >= 600 ? ' on' : ''), title: 'Pogrubienie', onclick: () => upd(() => { t.weight = t.weight >= 600 ? 400 : 700; }), html: icon('bold', 14) }),
          h('button', { class: 'tbtn' + (t.italic ? ' on' : ''), title: 'Kursywa', onclick: () => upd(() => { t.italic = !t.italic; }), html: icon('italic', 14) }),
          h('button', { class: 'tbtn' + (t.upper ? ' on' : ''), title: 'WIELKIE LITERY', onclick: () => upd(() => { t.upper = !t.upper; }) }, 'AA'),
          h('button', { class: 'tbtn' + (t.shadow ? ' on' : ''), title: 'Cień', onclick: () => upd(() => { t.shadow = !t.shadow; }) }, 'S'),
          h('span', { class: 'ed-sep' }),
          ...['left', 'center', 'right'].map((a) => h('button', { class: 'tbtn' + (t.align === a ? ' on' : ''), title: { left: 'Do lewej', center: 'Wyśrodkuj', right: 'Do prawej' }[a], onclick: () => upd(() => { t.align = a; }), html: icon('align' + a[0].toUpperCase() + a.slice(1), 14) })))),
        prop('Położenie w ramce', segmented([{ value: 'top', label: 'Góra' }, { value: 'middle', label: 'Środek' }, { value: 'bottom', label: 'Dół' }], t.valign || 'middle', (v) => upd(() => { t.valign = v; }))),
        prop('Kolor', colorInput(t.color, (v, live) => upd(() => { t.color = v; t.colorKey = null; }, live))),
        prop('Odstęp liter', h('input', { type: 'range', min: -0.05, max: 0.4, step: 0.01, value: t.letterSpacing || 0, oninput: (e) => upd(() => { t.letterSpacing = Number(e.target.value); }, true) })),
        prop('Podświetlenie tła', h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, toggle(!!t.bg, (v) => upd(() => { t.bg = v ? 'rgba(255,255,255,.85)' : null; })), t.bg ? colorInput(/^#/.test(t.bg) ? t.bg : '#ffffff', (v, live) => upd(() => { t.bg = v; }, live)) : null)),
        prop('Dopasuj rozmiar do ramki', toggle(t.fit !== false, (v) => upd(() => { t.fit = v; }))));
    } else if (el.type === 'image') {
      const im = el.image;
      specific = section('Obraz',
        h('div', { class: 'img-prev', style: { backgroundImage: `url('${assetUrl(im.assetId)}')` } }),
        h('button', { class: 'btn sm', onclick: () => pickAsset((id) => upd(() => { im.assetId = id; })) }, iconEl('photo', 12), 'Zmień obraz'),
        prop('Dopasowanie', segmented([{ value: 'cover', label: 'Wypełnij' }, { value: 'contain', label: 'Zmieść' }], im.fit || 'cover', (v) => upd(() => { im.fit = v; }))),
        im.fit === 'cover' ? prop('Kadr (góra–dół)', h('input', { type: 'range', min: 0, max: 100, step: 1, value: im.posY != null ? im.posY : 50, oninput: (e) => upd(() => { im.posY = Number(e.target.value); }, true) })) : null,
        prop('Kształt', segmented([{ value: 'rect', label: 'Prostokąt' }, { value: 'luk', label: 'Łuk' }, { value: 'kolo', label: 'Koło' }], im.shape || 'rect', (v) => upd(() => { im.shape = v; }))),
        im.shape === 'rect' ? prop('Zaokrąglenie', num(im.radius || 0, (v) => upd(() => { im.radius = v; }), { suffix: 'mm', step: 0.5, min: 0 })) : null,
        h('div', { class: 'prop-row' }, prop('Obramowanie', num(im.borderWidth || 0, (v) => upd(() => { im.borderWidth = v; }), { suffix: 'mm', step: 0.2, min: 0 }))),
        im.borderWidth ? prop('Kolor obramowania', colorInput(im.borderColor || '#b08a3e', (v, live) => upd(() => { im.borderColor = v; im.borderKey = null; }, live))) : null,
        prop('Kolor znaku (logo)', h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' } },
          h('button', { class: 'chip-btn' + (!im.tint ? ' on' : ''), onclick: () => upd(() => { im.tint = null; }) }, 'Oryginalny'),
          h('button', { class: 'chip-btn' + (im.tint === '#ffffff' ? ' on' : ''), onclick: () => upd(() => { im.tint = '#ffffff'; }) }, 'Biały'),
          h('button', { class: 'chip-btn' + (im.tint && im.tint !== '#ffffff' ? ' on' : ''), onclick: () => upd(() => { im.tint = pal().accent; }) }, 'Kolor'),
          im.tint && im.tint !== '#ffffff' ? colorInput(im.tint, (v, live) => upd(() => { im.tint = v; }, live)) : null)),
        h('p', { class: 'muted small' }, 'Zmiana koloru działa najlepiej dla grafik z przezroczystym tłem (PNG).'),
        h('div', { class: 'prop-row' },
          prop('Cień', toggle(!!im.shadow, (v) => upd(() => { im.shadow = v; }))),
          prop('Czarno-białe', toggle(!!im.grayscale, (v) => upd(() => { im.grayscale = v; })))));
    } else if (el.type === 'motif') {
      const m = el.motif;
      specific = section('Motyw',
        h('button', { class: 'btn sm', onclick: () => pickMotif((name) => upd(() => { m.name = name; }), !!Poster.MOTIFS[m.name].vb) }, iconEl('cross', 12), 'Zmień motyw'),
        prop('Kolor', colorInput(m.color, (v, live) => upd(() => { m.color = v; m.colorKey = null; }, live))),
        prop('Grubość linii', h('input', { type: 'range', min: 0.5, max: 8, step: 0.1, value: m.stroke || 3, oninput: (e) => upd(() => { m.stroke = Number(e.target.value); }, true) })));
    } else if (el.type === 'shape') {
      const s = el.shape;
      specific = section('Kształt',
        prop('Rodzaj', segmented([{ value: 'rect', label: 'Prostokąt' }, { value: 'ellipse', label: 'Elipsa' }], s.kind, (v) => upd(() => { s.kind = v; }))),
        prop('Wypełnienie', colorInput(/^#/.test(s.fill || '') ? s.fill : (s.fill || 'transparent'), (v, live) => upd(() => { s.fill = v; s.fillKey = null; }, live))),
        h('button', { class: 'btn sm', onclick: () => upd(() => { s.fill = 'transparent'; s.fillKey = null; }) }, 'Bez wypełnienia'),
        prop('Obrys', num(s.strokeWidth || 0, (v) => upd(() => { s.strokeWidth = v; if (!s.stroke) s.stroke = pal().accent; }), { suffix: 'mm', step: 0.1, min: 0 })),
        s.strokeWidth ? prop('Kolor obrysu', colorInput(s.stroke || '#000000', (v, live) => upd(() => { s.stroke = v; }, live))) : null,
        s.kind === 'rect' ? prop('Zaokrąglenie', num(s.radius || 0, (v) => upd(() => { s.radius = v; }), { suffix: 'mm', step: 0.5, min: 0 })) : null);
    } else if (el.type === 'schedule') {
      const s = el.schedule;
      const rows = h('div', { class: 'sched-edit' }, s.items.map((it, i) => h('div', { class: 'sched-row' },
        h('input', { class: 'input', style: { width: '78px' }, value: it.when, onchange: (e) => upd(() => { it.when = e.target.value; syncSchedule(el); }) }),
        h('input', { class: 'input', style: { flex: 1, minWidth: 0 }, value: it.what, onchange: (e) => upd(() => { it.what = e.target.value; syncSchedule(el); }) }),
        h('button', { class: 'icon-btn', onclick: () => upd(() => { s.items.splice(i, 1); syncSchedule(el); }), html: icon('x', 12) }))),
      h('button', { class: 'btn sm', onclick: () => upd(() => { s.items.push({ when: '', what: '' }); }) }, iconEl('plus', 12), 'Dodaj wiersz'));
      specific = section('Harmonogram', rows,
        prop('Rozmiar', num(s.size, (v) => upd(() => { s.size = v; }), { suffix: 'pt', step: 0.5, min: 5 })),
        prop('Czcionka', select(Object.entries(Poster.FONTS).map(([v, f]) => ({ value: v, label: f.label })), s.font, (v) => upd(() => { s.font = v; s.fontKey = null; }))),
        prop('Czcionka godzin', select(Object.entries(Poster.FONTS).map(([v, f]) => ({ value: v, label: f.label })), s.whenFont, (v) => upd(() => { s.whenFont = v; s.whenFontKey = null; }))),
        prop('Kolor tekstu', colorInput(s.color, (v, live) => upd(() => { s.color = v; s.colorKey = null; }, live))),
        prop('Kolor godzin', colorInput(s.whenColor, (v, live) => upd(() => { s.whenColor = v; s.whenColorKey = null; }, live))),
        prop('Linie między wierszami', toggle(s.lines, (v) => upd(() => { s.lines = v; }))));
    } else if (el.type === 'qr') {
      const q = el.qr;
      specific = section('Kod QR',
        prop('Adres (link)', h('input', { class: 'input', value: q.data, onchange: async (e) => { const data = e.target.value.trim(); try { const svg = await api.qrSvg(data); upd(() => { q.data = data; q.svg = svg; }); } catch (er) { errToast(er); } } })),
        prop('Kolor', colorInput(q.color || '#000000', (v, live) => upd(() => { q.color = v; q.colorKey = null; }, live))),
        h('p', { class: 'muted small' }, 'Kod QR otworzy w telefonie podany adres – np. stronę parafii lub zapisy.'));
    }
    const geom = section('Położenie i rozmiar',
      h('div', { class: 'prop-grid' },
        num(el.x, (v) => upd(() => { el.x = v; }), { label: 'X', suffix: 'mm', step: 0.5 }),
        num(el.y, (v) => upd(() => { el.y = v; }), { label: 'Y', suffix: 'mm', step: 0.5 }),
        num(el.w, (v) => upd(() => { el.w = Math.max(1, v); }), { label: 'Szer.', suffix: 'mm', step: 0.5 }),
        num(el.h, (v) => upd(() => { el.h = Math.max(0.3, v); }), { label: 'Wys.', suffix: 'mm', step: 0.5 }),
        num(el.rot || 0, (v) => upd(() => { el.rot = v; }), { label: 'Obrót', suffix: '°', step: 1 }),
        num(Math.round((el.opacity == null ? 1 : el.opacity) * 100), (v) => upd(() => { el.opacity = Math.max(0, Math.min(100, v)) / 100; }), { label: 'Krycie', suffix: '%', step: 5 })),
      h('div', { class: 'btn-row wrap' },
        h('button', { class: 'btn sm', title: 'Wyśrodkuj w poziomie', onclick: () => upd(() => { el.x = (E.poster.format.w - el.w) / 2; }) }, iconEl('alignCenter', 12), 'Środek'),
        h('button', { class: 'btn sm', title: 'Na wierzch', onclick: () => reorder(el, 'top') }, iconEl('arrowUp', 12), 'Na wierzch'),
        h('button', { class: 'btn sm', title: 'Pod spód', onclick: () => reorder(el, 'bottom') }, iconEl('arrowDown', 12), 'Pod spód'),
        h('button', { class: 'btn sm', title: 'Duplikuj (Ctrl+D)', onclick: duplicate }, iconEl('copy', 12), 'Duplikuj'),
        h('button', { class: 'btn sm', onclick: () => upd(() => { el.locked = !el.locked; }) }, iconEl(el.locked ? 'unlock' : 'lock', 12), el.locked ? 'Odblokuj' : 'Zablokuj'),
        h('button', { class: 'btn sm danger', title: 'Usuń (Delete)', onclick: removeSel }, iconEl('trash', 12), 'Usuń')));
    return h('div', null,
      h('div', { class: 'ed-sel-head' }, h('span', { html: icon(TYPE_ICON[el.type] || 'square', 15) }), h('b', null, ROLE_LABEL[el.role] || 'Element'), h('div', { style: { flex: 1 } }), h('button', { class: 'btn plain sm', onclick: () => select_(null) }, 'Ustawienia strony')),
      specific, geom);
  }

  function syncSchedule(el) { if (el.role === 'schedule') E.poster.content.schedule = el.schedule.items.map((x) => ({ ...x })); }

  function reorder(el, where) {
    commit((p) => {
      const i = p.elements.indexOf(el);
      p.elements.splice(i, 1);
      if (where === 'top') p.elements.push(el); else p.elements.unshift(el);
      for (const e of p.elements) delete e.z;
    });
  }
  function duplicate() {
    const el = selEl(); if (!el) return;
    const c = Poster.clone(el); c.id = Poster.uid(); c.x += 4; c.y += 4; c.role = c.role === 'title' ? 'custom' : c.role; c.locked = false;
    if (ROLE_FIELD[c.role] || c.role === 'schedule' || c.role === 'quote') c.role = 'custom';
    commit((p) => p.elements.push(c));
    select_(c.id);
  }
  function removeSel() {
    const el = selEl(); if (!el) return;
    commit((p) => {
      p.elements = p.elements.filter((x) => x.id !== el.id);
      if (ROLE_FIELD[el.role] && p.content) p.content[ROLE_FIELD[el.role]] = '';
      if (el.role === 'schedule' && p.content) p.content.schedule = [];
      if (el.role === 'quote' && p.content) p.content.quote = null;
      if (el.role === 'image' && p.content) p.content.imageId = null;
    });
    E.sel = null; drawProps(); drawSelection(); drawLayers();
  }

  // ── wybór grafiki i motywu ──
  function pickAsset(cb) {
    const grid = h('div', { class: 'asset-pick' }, state.assets.map((a) => h('div', { class: 'ap', title: a.name, onclick: () => { s.close(); cb(a.id); } },
      h('div', { class: 'ap-img' + (a.role === 'logo' || a.role === 'emblemat' ? ' checker' : '') }, h('div', { class: 'ac-in', style: { backgroundImage: `url('${assetUrl(a.id)}')` } })), h('span', null, a.name))));
    const s = sheet({ title: 'Wybierz grafikę', subtitle: 'Własne logo i zdjęcia dodasz w zakładce „Logo i grafiki”.', body: grid, wide: true });
  }
  function pickMotif(cb, dividers) {
    const list = Object.entries(Poster.MOTIFS).filter(([k]) => (dividers ? k.startsWith('linia') : !k.startsWith('linia')));
    const grid = h('div', { class: 'motif-grid pick' }, list.map(([k, m]) => h('div', { class: 'motif-cell', title: m.label, onclick: () => { s.close(); cb(k); } }, h('div', { class: 'mc-svg', html: Poster.motifSvg(k, 'var(--text)', m.vb ? 1.6 : 3) }), h('span', null, m.label))));
    const s = sheet({ title: dividers ? 'Wybierz ozdobnik' : 'Wybierz motyw religijny', body: grid, wide: true });
  }

  function exportMenu() {
    const p = Poster.clone(E.poster);
    const body = h('div', { class: 'export-list' },
      h('button', { class: 'export-item', onclick: async () => { s.close(); try { const f = await api.exportPdf(p, { paper: 'auto' }); if (f) toast('Zapisano PDF – gotowy do druku w drukarni', 'success'); } catch (e) { errToast(e); } } }, h('span', { html: icon('doc', 22) }), h('div', null, h('b', null, 'PDF do druku'), h('div', { class: 'muted small' }, 'Dokładny rozmiar plakatu, czcionki osadzone – dla drukarni lub do archiwum.'))),
      h('button', { class: 'export-item', onclick: async () => { s.close(); try { const f = await api.exportPng(p, { longEdgePx: 2400 }); if (f) toast('Zapisano obraz PNG', 'success'); } catch (e) { errToast(e); } } }, h('span', { html: icon('photo', 22) }), h('div', null, h('b', null, 'Obraz PNG'), h('div', { class: 'muted small' }, 'Na stronę parafii, Facebook, telewizor w kościele (2400 px).'))),
      h('button', { class: 'export-item', onclick: async () => { s.close(); try { const f = await api.exportJson(p); if (f) toast('Zapisano projekt', 'success'); } catch (e) { errToast(e); } } }, h('span', { html: icon('folder', 22) }), h('div', null, h('b', null, 'Projekt plakatu (.json)'), h('div', { class: 'muted small' }, 'Do przeniesienia na inny komputer z tą aplikacją.'))));
    const s = sheet({ title: 'Eksport plakatu', body });
  }

  // ── klawiatura ──
  function onKey(e) {
    if (!E.poster) return;
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(true); return; }
    if (typing || document.querySelector('.sheet-overlay')) return;
    const el = selEl();
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); printDialog(Poster.clone(E.poster)); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
    if (mod && e.key.toLowerCase() === 'c' && el) { E.clipboard = Poster.clone(el); return; }
    if (mod && e.key.toLowerCase() === 'v' && E.clipboard) { const c = Poster.clone(E.clipboard); c.id = Poster.uid(); c.x += 5; c.y += 5; if (ROLE_FIELD[c.role] || ['schedule', 'quote', 'image'].includes(c.role)) c.role = 'custom'; commit((p) => p.elements.push(c)); select_(c.id); return; }
    if (e.key === 'Escape') { select_(null); return; }
    if (!el) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel(); return; }
    const step = e.shiftKey ? 5 : 1;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d && !el.locked) { e.preventDefault(); commit(() => { el.x += d[0]; el.y += d[1]; }, { keepProps: false }); }
    if (e.key === 'Enter' && el.type === 'text') { e.preventDefault(); const node = E.page.querySelector(`[data-id="${el.id}"]`); if (node) onPageDbl({ target: node }); }
  }

  return { open, leave, view, afterRender, onKey, get poster() { return E.poster; } };
})();
