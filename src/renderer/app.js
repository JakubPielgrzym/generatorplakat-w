'use strict';
/* global UI, icon, Poster, PRESETS, Editor */
const { h, iconEl, toast, sheet, toggle, segmented, select, spinner, group, row, busy } = UI;
// window.api – most z procesem głównym (preload.js)

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const WD = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const WD_SHORT = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
const RANKS = { uroczystosc: 'Uroczystość', swieto: 'Święto', wspomnienie: 'Wspomnienie', niedziela: 'Niedziela', okres: 'Okres / nabożeństwa', okazja: 'Okazja', parafialne: 'Święto parafii', wydarzenie: 'Wydarzenie' };
const LCOLORS = { bialy: '#e9dfc4', czerwony: '#d0312d', fioletowy: '#7b4aa0', zielony: '#3f8f3f', rozowy: '#e58fb0', zloty: '#c9a227' };

const state = {
  info: null, settings: null, hasApiKey: false, claudePath: null, footerPreview: '',
  view: 'dashboard', agent: null,
  presets: { builtIn: [], custom: [], categories: {} },
  assets: [], roles: {}, posters: [], upcoming: [],
  create: null,
  library: { q: '' },
  cal: { month: null, items: [], online: [] },
  presetCat: 'all',
  settingsTab: 'parafia',
  claude: { status: null, login: null, installing: false, log: '', advanced: false }
};

// ───────────────────────── narzędzia ─────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const longDate = (s) => { const d = parseIso(s); return `${WD[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`; };
const shortDate = (s) => { const d = parseIso(s); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; };
const daysUntil = (s) => Math.round((parseIso(s) - parseIso(iso(new Date()))) / 86400000);
const inDays = (n) => (n === 0 ? 'dziś' : n === 1 ? 'jutro' : n < 0 ? `${-n} dni temu` : `za ${n} dni`);
const plural = (n, a, b, c) => { if (n === 1) return a; const d = n % 10, t = n % 100; return d >= 2 && d <= 4 && !(t >= 12 && t <= 14) ? b : c; };
const assetUrl = (id) => state.info.assetUrl + encodeURIComponent(id);
const allPresets = () => [...state.presets.custom, ...state.presets.builtIn];
const presetById = (id) => allPresets().find((p) => p.id === id) || state.presets.builtIn.find((p) => p.id === 'ogloszenie');
const assetById = (id) => state.assets.find((a) => a.id === id);
function errToast(e) { toast(e.message || String(e), 'error', 8000); }

function brand() {
  const s = state.settings;
  const aspects = {};
  for (const a of state.assets) aspects[a.id] = { aspect: a.aspect };
  return { assets: aspects, logoId: s.poster.logoId || 'brand:logo', emblemId: s.poster.emblemId || 'brand:herb', parishLine: `${s.parish.name} ${s.parish.place}`.trim(), footer: state.footerPreview };
}

// Miniatura plakatu (skalowana strona)
const fitQueue = new Set();
let fitTimer = null;
function queueFit(page) {
  fitQueue.add(page);
  if (fitTimer) return;
  fitTimer = requestAnimationFrame(async () => {
    try { await Poster.loadFonts(); } catch (_) { /* ignore */ }
    for (const p of fitQueue) if (p.isConnected) Poster.fitText(p);
    fitQueue.clear();
    fitTimer = null;
  });
}
function thumb(poster, width, cls) {
  const scale = width / (poster.format.w * Poster.MM);
  const box = h('div', { class: 'thumb-box ' + (cls || ''), style: { width: width + 'px', height: poster.format.h * Poster.MM * scale + 'px' } });
  const page = Poster.render(poster, { assetUrl });
  page.style.transform = `scale(${scale})`;
  page.style.transformOrigin = '0 0';
  box.appendChild(page);
  queueFit(page);
  return box;
}
function presetPreview(preset, width, content) {
  const d = preset.defaults || {};
  const c = Object.assign({ title: d.title || preset.name, subtitle: d.subtitle, dateText: 'niedziela, 25 lipca, godz. 11:30', closing: d.closing, quote: d.quote, imageId: preset.imageId, showLogo: preset.showLogo !== false, body: '' }, content || {});
  const p = Poster.layout({ content: c, style: preset.style, format: Poster.FORMATS.a4, brand: brand() });
  return thumb(p, width);
}

// ───────────────────────── start ─────────────────────────
async function init() {
  state.info = await api.info();
  document.body.classList.add('platform-' + state.info.platform);
  state.cal.month = state.info.today.slice(0, 7);
  await Promise.all([loadSettings(), loadPresets(), loadAssets(), loadPosters(), loadAgent(), loadUpcoming()]);
  Poster.ensureStyles();
  Poster.loadFonts().then(() => { document.querySelectorAll('.poster-page').forEach((p) => Poster.fitText(p)); });

  document.querySelectorAll('#traffic .tl').forEach((b) => b.addEventListener('click', async () => {
    const maximized = await api.windowControl(b.dataset.act);
    if (b.dataset.act === 'maximize') setMaxTitle(maximized);
  }));
  api.on('window:state', (s) => setMaxTitle(s.maximized));
  document.querySelector('.titlebar').addEventListener('dblclick', (e) => { if (!e.target.closest('.traffic')) api.windowControl('maximize'); });
  window.addEventListener('blur', () => document.body.classList.add('window-blur'));
  window.addEventListener('focus', () => document.body.classList.remove('window-blur'));
  document.getElementById('content').addEventListener('scroll', (e) => e.target.classList.toggle('scrolled', e.target.scrollTop > 4));

  api.on('agent:status', (s) => { state.agent = s; renderSidebar(); if (state.view === 'dashboard') render(); });
  api.on('posters:changed', async () => { await loadPosters(); if (['library', 'dashboard'].includes(state.view)) render(); });
  api.on('data:changed', async () => { await loadUpcoming(); if (state.view === 'calendar') { await loadCalendar(); render(); } });
  api.on('claude:log', (t) => { state.claude.log = (state.claude.log + t).slice(-4000); const el = document.querySelector('.acc-log'); if (el) el.textContent = state.claude.log.split('\n').slice(-6).join('\n'); });
  api.on('claude:login', (ev) => {
    const C = state.claude;
    if (ev.stage === 'url' || ev.stage === 'code') { C.login = { ...(C.login || {}), stage: ev.stage, url: ev.url || (C.login && C.login.url) }; if (state.view === 'settings') render(); }
    if (ev.stage === 'done') { C.login = null; C.status = ev.status; toast('Połączono z kontem Claude', 'success'); render(); }
    if (ev.stage === 'error') { C.login = null; errToast(new Error(ev.error)); render(); }
  });
  document.addEventListener('keydown', (e) => { if (state.view === 'editor') Editor.onKey(e); });
  render();
  if (state.settings.ai.provider === 'claude-code') refreshClaude();
}

function setMaxTitle(maximized) {
  const b = document.querySelector('#traffic .tl.max');
  if (b) b.title = maximized ? 'Przywróć' : 'Maksymalizuj';
}

async function loadSettings() {
  const r = await api.getSettings();
  state.settings = r.settings; state.hasApiKey = r.hasApiKey; state.claudePath = r.claudePath; state.footerPreview = r.footerPreview;
}
async function loadPresets() { state.presets = await api.presets(); }
async function loadAssets() { const r = await api.assets(); state.assets = r.assets; state.roles = r.roles; }
async function loadPosters() { state.posters = await api.posters(); }
async function loadAgent() { state.agent = await api.agentStatus(); }
async function loadUpcoming() { const t = new Date(); state.upcoming = await api.calendar(iso(t), iso(addDays(t, 150))); }

async function saveSettings(patch, quiet) {
  try {
    state.settings = await api.setSettings(patch);
    const r = await api.getSettings(); state.footerPreview = r.footerPreview;
    if (!quiet) toast('Zapisano ustawienia', 'success', 1500);
  } catch (e) { errToast(e); }
}

function go(view, opts = {}) {
  if (state.view === 'editor' && view !== 'editor') Editor.leave();
  state.view = view;
  if (view === 'create' && (!state.create || opts.reset)) state.create = newCreateState(opts);
  if (view === 'calendar') loadCalendar().then(render);
  render();
  document.getElementById('content').scrollTop = 0;
}

function aiReady() {
  const s = state.settings;
  if (s.ai.provider === 'api') return state.hasApiKey;
  return !!(state.claude.status && state.claude.status.loggedIn);
}

// ───────────────────────── pasek boczny ─────────────────────────
function renderSidebar() {
  const sb = document.getElementById('sidebar');
  const props = state.agent ? state.agent.proposals.filter((p) => p.status === 'new').length : 0;
  const items = [
    ['dashboard', 'home', 'Pulpit', props || null],
    ['create', 'wand', 'Nowy plakat'],
    ['library', 'photo', 'Moje plakaty'],
    ['calendar', 'calendar', 'Kalendarz świąt']
  ];
  const items2 = [
    ['presets', 'sparkles', 'Presety tematyczne'],
    ['assets', 'folder', 'Logo i grafiki'],
    ['settings', 'gear', 'Ustawienia']
  ];
  const ag = state.agent || {};
  const dotCls = !ag.enabled ? 'off' : ag.running ? 'busy' : ag.lastError ? 'err' : '';
  const agText = !ag.enabled ? 'Agent wyłączony' : ag.running ? 'Agent sprawdza…' : ag.lastError ? 'Agent: problem' : 'Agent czuwa';
  const agSub = ag.lastError ? ag.lastError.slice(0, 60) : ag.onlineCheckedAt ? 'Internet: ' + new Date(ag.onlineCheckedAt).toLocaleDateString('pl-PL') : ag.lastRun ? 'Ostatnio ' + new Date(ag.lastRun).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : 'Pilnuje kalendarza świąt';
  const nav = (list) => list.map(([v, ic, label, badge]) => h('div', { class: 'nav-item' + (state.view === v || (v === 'library' && state.view === 'editor') ? ' active' : ''), onclick: () => go(v, v === 'create' ? { reset: !state.create || !!(state.create && state.create.results) } : {}) },
    h('span', { html: icon(ic, 17) }), label, badge ? h('span', { class: 'nav-badge' }, badge) : null));
  sb.replaceChildren(
    h('div', { class: 'brand' },
      h('div', { class: 'brand-logo', html: icon('cross', 20) }),
      h('div', null, h('div', { class: 'brand-name' }, 'Plakaty Parafialne'), h('div', { class: 'brand-sub' }, state.settings ? (state.settings.parish.place || '').replace(/^w\s+/, '') || 'Parafia' : ''))),
    h('div', { class: 'nav-section' }, 'Praca'), ...nav(items),
    h('div', { class: 'nav-section' }, 'Wygląd i dane'), ...nav(items2),
    h('div', { class: 'sidebar-spacer' }),
    h('div', { class: 'agent-pill', title: 'Kliknij, aby agent sprawdził teraz kalendarz i internet', onclick: runAgent },
      h('span', { class: 'agent-dot ' + dotCls }),
      h('div', { style: { minWidth: 0 } }, h('div', { class: 't1' }, agText), h('div', { class: 't2' }, agSub)))
  );
}

async function runAgent() {
  try {
    toast('Agent sprawdza kalendarz świąt i wydarzenia w internecie…', 'info', 3000);
    state.agent = await api.agentRun();
    await loadUpcoming();
    renderSidebar();
    if (['dashboard', 'calendar'].includes(state.view)) { if (state.view === 'calendar') await loadCalendar(); render(); }
    if (state.agent.lastError) toast(state.agent.lastError, 'error', 8000); else toast('Agent zakończył sprawdzanie', 'success', 2000);
  } catch (e) { errToast(e); }
}

// ───────────────────────── render ─────────────────────────
const TITLES = { dashboard: 'Pulpit', create: 'Nowy plakat', library: 'Moje plakaty', editor: 'Edytor plakatu', calendar: 'Kalendarz świąt', presets: 'Presety tematyczne', assets: 'Logo i grafiki', settings: 'Ustawienia' };
function render() {
  renderSidebar();
  const c = document.getElementById('content');
  const views = { dashboard: viewDashboard, create: viewCreate, library: viewLibrary, editor: () => Editor.view(), calendar: viewCalendar, presets: viewPresets, assets: viewAssets, settings: viewSettings };
  const el = views[state.view]();
  if (state.view !== 'editor') el.classList.add('fade-in');
  c.classList.toggle('editor-mode', state.view === 'editor');
  c.replaceChildren(el);
  document.getElementById('window-title').textContent = TITLES[state.view] + ' — Plakaty Parafialne';
  if (state.view === 'editor') Editor.afterRender();
}

// ───────────────────────── PULPIT ─────────────────────────
function viewDashboard() {
  const s = state.settings;
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Szczęść Boże! Dzień dobry' : hour < 18 ? 'Szczęść Boże!' : 'Szczęść Boże! Dobry wieczór';
  const proposals = (state.agent ? state.agent.proposals : []).filter((p) => p.status !== 'dismissed');
  const upcoming = state.upcoming.filter((o) => daysUntil(o.date) <= 31 && ['uroczystosc', 'parafialne', 'okres', 'wydarzenie', 'swieto', 'niedziela'].includes(o.rank)).slice(0, 9);
  const needsClaude = !aiReady();
  return h('div', null,
    h('div', { class: 'toolbar' }, h('h1', null, 'Pulpit'), h('div', { style: { flex: 1 } }),
      h('button', { class: 'btn', onclick: () => go('calendar') }, iconEl('calendar', 14), 'Kalendarz'),
      h('button', { class: 'btn primary', onclick: () => go('create', { reset: true }) }, iconEl('plus', 14), 'Nowy plakat')),
    h('div', { class: 'page' },
      h('div', { class: 'hello' }, h('h2', null, hello), h('p', { class: 'muted' }, `${longDate(state.info.today)} · ${s.parish.name} ${s.parish.place}`)),
      needsClaude ? h('div', { class: 'card connect-banner' },
        h('div', { class: 'acc-logo', html: icon('sparkles', 22) }),
        h('div', { style: { flex: 1 } }, h('div', { class: 'acc-title' }, 'Połącz aplikację ze swoim kontem Claude'),
          h('div', { class: 'muted small' }, 'Wtedy agent AI będzie sam pisał treść plakatów, poprawiał je na polecenie i wyszukiwał wydarzenia parafii w internecie. Bez połączenia nadal możesz tworzyć plakaty z presetów.')),
        h('button', { class: 'btn primary', onclick: () => { state.settingsTab = 'claude'; go('settings'); } }, 'Połącz')) : null,
      h('div', { class: 'grid dash-grid' },
        h('div', { class: 'card card-pad' },
          h('div', { class: 'card-title' }, iconEl('bell', 16), 'Propozycje agenta', h('span', { class: 'muted small', style: { marginLeft: 'auto', fontWeight: 500 } }, 'na podstawie kalendarza i internetu')),
          proposals.length ? h('div', { class: 'proposal-list' }, proposals.map(proposalCard))
            : h('div', { class: 'empty' }, iconEl('checkCircle', 26), h('div', { style: { marginTop: '8px' } }, 'Na razie brak propozycji – agent poinformuje Cię, gdy zbliży się ważne święto.'))),
        h('div', { class: 'card card-pad' },
          h('div', { class: 'card-title' }, iconEl('calendar', 16), 'Najbliższe święta i wydarzenia'),
          upcoming.length ? upcoming.map((o) => occasionRow(o)) : h('div', { class: 'empty' }, 'Brak ważnych dni w najbliższym miesiącu.'))),
      h('div', { class: 'section-head' }, h('h3', null, 'Ostatnie plakaty'), h('button', { class: 'btn plain', onclick: () => go('library') }, 'Wszystkie', iconEl('chevronR', 12))),
      state.posters.length ? h('div', { class: 'poster-grid' }, state.posters.slice(0, 6).map((p) => posterCard(p, 168)))
        : h('div', { class: 'card empty' }, 'Nie masz jeszcze plakatów. ', h('button', { class: 'btn plain', onclick: () => go('create', { reset: true }) }, 'Utwórz pierwszy plakat'))));
}

function colorDot(c) { return h('span', { class: 'lit-dot', title: 'Kolor liturgiczny: ' + c, style: { background: LCOLORS[c] || '#ccc' } }); }

function proposalCard(p) {
  const n = daysUntil(p.date);
  const preset = presetById(p.presetId);
  return h('div', { class: 'proposal-card' + (p.status === 'done' ? ' done' : '') },
    h('div', { class: 'pc-date' }, h('div', { class: 'd' }, parseIso(p.date).getDate()), h('div', { class: 'm' }, MONTHS_GEN[parseIso(p.date).getMonth()].slice(0, 3))),
    h('div', { style: { flex: 1, minWidth: 0 } },
      h('div', { class: 'pc-name' }, p.name),
      h('div', { class: 'kind' }, colorDot(p.color), `${RANKS[p.rank] || ''} · ${inDays(n)} · preset: ${preset ? preset.name : '—'}`,
        p.source === 'internet' ? h('span', { class: 'chip teal' }, 'z internetu') : null),
      p.note ? h('div', { class: 'muted small', style: { marginTop: '3px' } }, p.note) : null),
    p.status === 'done' || p.status === 'draft'
      ? h('div', { class: 'pc-actions' }, h('span', { class: 'chip green' }, p.status === 'draft' ? 'szkic gotowy' : 'plakat gotowy'),
        p.posterId ? h('button', { class: 'btn sm', onclick: () => openPoster(p.posterId) }, 'Otwórz') : null)
      : h('div', { class: 'pc-actions' },
        h('button', { class: 'btn primary sm', onclick: () => go('create', { reset: true, occasion: p }) }, iconEl('wand', 13), 'Przygotuj plakat'),
        h('button', { class: 'icon-btn', title: 'Pomiń tę propozycję', onclick: async () => { state.agent = await api.setProposal(p.key, { status: 'dismissed' }); render(); }, html: icon('x', 14) })));
}

function occasionRow(o) {
  const n = daysUntil(o.date);
  return h('div', { class: 'up-item' },
    h('div', { class: 'date-badge' }, h('div', { class: 'db-d' }, parseIso(o.date).getDate()), h('div', { class: 'db-m' }, MONTHS_GEN[parseIso(o.date).getMonth()].slice(0, 3))),
    h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { class: 'up-name' }, o.name), h('div', { class: 'kind' }, colorDot(o.color), `${RANKS[o.rank] || ''} · ${inDays(n)}`)),
    h('button', { class: 'icon-btn', title: 'Utwórz plakat na tę okazję', onclick: () => go('create', { reset: true, occasion: o }), html: icon('wand', 15) }));
}

function posterCard(p, w = 180) {
  const f = Object.values(Poster.FORMATS).find((x) => Math.abs(x.w - p.format.w) < 0.6 && Math.abs(x.h - p.format.h) < 0.6);
  return h('div', { class: 'poster-card' },
    h('div', { class: 'pc-thumb', onclick: () => openPoster(p.id) }, thumb(p, w)),
    h('div', { class: 'pc-meta' },
      h('div', { class: 'pc-title', title: p.name }, p.name),
      h('div', { class: 'muted small' }, `${f ? f.label : `${Math.round(p.format.w)}×${Math.round(p.format.h)} mm`} · ${new Date(p.updatedAt).toLocaleDateString('pl-PL')}`),
      h('div', { class: 'pc-btns' },
        h('button', { class: 'icon-btn', title: 'Edytuj', onclick: () => openPoster(p.id), html: icon('pencil', 15) }),
        h('button', { class: 'icon-btn', title: 'Drukuj', onclick: () => printDialog(p), html: icon('printer', 15) }),
        h('button', { class: 'icon-btn', title: 'Duplikuj', onclick: async () => { try { await api.duplicatePoster(p.id); toast('Utworzono kopię', 'success', 1500); } catch (e) { errToast(e); } }, html: icon('copy', 15) }),
        h('button', { class: 'icon-btn danger', title: 'Usuń', onclick: () => confirmDeletePoster(p), html: icon('trash', 15) }))));
}

function confirmDeletePoster(p) {
  sheet({
    title: 'Usunąć plakat?', subtitle: p.name,
    body: h('p', { class: 'muted' }, 'Plakat trafi do folderu „kosz” w danych aplikacji – w razie potrzeby można go odzyskać.'),
    actions: [{ label: 'Anuluj' }, { label: 'Usuń', kind: 'danger', onClick: async () => { await api.deletePoster(p.id); toast('Usunięto plakat', 'success', 1500); } }]
  });
}

async function openPoster(id) {
  try { const p = await api.getPoster(id); Editor.open(p); go('editor'); } catch (e) { errToast(e); }
}

// ───────────────────────── NOWY PLAKAT ─────────────────────────
function newCreateState(opts = {}) {
  const o = opts.occasion || null;
  const presetId = opts.presetId || (o && o.presetId) || state.settings.poster.defaultPreset || 'ogloszenie';
  return {
    presetId, cat: 'all', occasion: o,
    title: o ? o.name.replace(/\s*\(propozycja\)/, '') : '', dateText: o ? longDate(o.date) : '', timeText: '', placeText: '', details: '',
    schedule: [], imageId: 'auto', formatId: state.settings.poster.defaultFormat || 'a4', variants: state.settings.poster.variants || 2,
    showLogo: true, qrOn: !!state.settings.poster.qrDefault, qr: state.settings.poster.qrUrl || '', webSearch: false,
    generating: false, results: null, missing: [], notes: ''
  };
}

function viewCreate() {
  const C = state.create;
  if (C.results) return viewCreateResults();
  const preset = presetById(C.presetId);
  const previewBox = h('div', { class: 'create-preview' });
  const refreshPreview = () => {
    const fmt = Poster.FORMATS[C.formatId] || Poster.FORMATS.a4;
    const d = preset.defaults || {};
    const content = {
      title: C.title || d.title || preset.name, subtitle: d.subtitle || '', dateText: C.dateText, timeText: C.timeText, placeText: C.placeText,
      body: C.details && C.details.length < 220 ? C.details : (C.details ? C.details.slice(0, 200) + '…' : ''),
      schedule: C.schedule.filter((r) => r.when || r.what), quote: d.quote, closing: d.closing,
      imageId: C.imageId === 'auto' ? preset.imageId : C.imageId || null, showLogo: C.showLogo && preset.showLogo !== false, qr: C.qrOn ? C.qr : ''
    };
    const p = Poster.layout({ content, style: preset.style, format: fmt, brand: brand() });
    const w = fmt.w > fmt.h ? 420 : 330;
    previewBox.replaceChildren(h('div', { class: 'preview-label' }, 'Podgląd szablonu (bez AI)'), thumb(p, w, 'shadow'));
  };
  const inp = (key, placeholder, attrs = {}) => h(attrs.textarea ? 'textarea' : 'input', { class: 'input' + (attrs.textarea ? ' area' : ''), value: C[key] || '', placeholder, rows: attrs.rows, oninput: (e) => { C[key] = e.target.value; clearTimeout(C._t); C._t = setTimeout(refreshPreview, 350); } });
  const cats = [{ value: 'all', label: 'Wszystkie' }, ...Object.entries(state.presets.categories).map(([v, l]) => ({ value: v, label: l.split(' ')[0] }))];
  const presetList = allPresets().filter((p) => C.cat === 'all' || p.category === C.cat);
  const imgs = state.assets.filter((a) => a.role === 'zdjecie' || a.role === 'tlo' || a.role === 'motyw');
  const occOptions = [{ value: '', label: '— bez konkretnej okazji —' }, ...state.upcoming.slice(0, 80).map((o) => ({ value: o.key, label: `${shortDate(o.date)} – ${o.name}` }))];
  const schedEl = h('div', { class: 'sched-edit' });
  const drawSched = () => {
    schedEl.replaceChildren(...C.schedule.map((r, i) => h('div', { class: 'sched-row' },
      h('input', { class: 'input', style: { width: '120px' }, placeholder: 'np. 18:00', value: r.when, oninput: (e) => { r.when = e.target.value; refreshPreview(); } }),
      h('input', { class: 'input', style: { flex: 1 }, placeholder: 'np. Msza Święta', value: r.what, oninput: (e) => { r.what = e.target.value; refreshPreview(); } }),
      h('button', { class: 'icon-btn', title: 'Usuń wiersz', onclick: () => { C.schedule.splice(i, 1); drawSched(); refreshPreview(); }, html: icon('x', 13) }))),
    h('button', { class: 'btn sm', onclick: () => { C.schedule.push({ when: '', what: '' }); drawSched(); } }, iconEl('plus', 12), 'Dodaj punkt programu'));
  };
  drawSched();
  setTimeout(refreshPreview, 0);

  return h('div', null,
    h('div', { class: 'toolbar' }, h('h1', null, 'Nowy plakat'), h('div', { style: { flex: 1 } }),
      h('button', { class: 'btn', onclick: () => api.importJson().then((p) => { if (p) { Editor.open(p); go('editor'); } }).catch(errToast) }, iconEl('upload', 14), 'Otwórz projekt…')),
    h('div', { class: 'page create-page' },
      h('div', { class: 'create-form' },
        h('div', { class: 'step' }, h('span', { class: 'step-n' }, '1'), 'Wybierz temat (preset)'),
        h('div', { style: { marginBottom: '10px' } }, segmented(cats, C.cat, (v) => { C.cat = v; render(); })),
        h('div', { class: 'preset-pick' }, presetList.map((p) => {
          const pal = Poster.resolvePalette(p.style);
          return h('div', { class: 'pp' + (p.id === C.presetId ? ' active' : ''), title: p.description || p.name, onclick: () => { C.presetId = p.id; if (!C.title || C._autoTitle) { C.title = ''; } render(); } },
            h('div', { class: 'pp-ic', style: { background: pal.bg, color: pal.accent, borderColor: pal.title }, html: Poster.motifSvg(p.icon || p.style.motif, pal.title, 4) }),
            h('div', { class: 'pp-name' }, p.name), p.builtIn ? null : h('span', { class: 'chip blue' }, 'własny'));
        })),
        h('div', { class: 'step' }, h('span', { class: 'step-n' }, '2'), 'Informacje dla parafian'),
        h('div', { class: 'form-grid' },
          h('div', { class: 'field span2' }, h('label', null, 'Okazja z kalendarza (opcjonalnie)'),
            select(occOptions, C.occasion ? C.occasion.key : '', (v) => {
              const o = state.upcoming.find((x) => x.key === v) || null;
              C.occasion = o;
              if (o) { C.presetId = o.presetId || C.presetId; C.title = o.name.replace(/\s*\(propozycja\)/, ''); C.dateText = longDate(o.date); }
              render();
            })),
          h('div', { class: 'field span2' }, h('label', null, 'Tytuł (puste = AI zaproponuje)'), inp('title', preset.defaults.title || 'np. Odpust parafialny')),
          h('div', { class: 'field' }, h('label', null, 'Data'), inp('dateText', 'np. niedziela, 25 lipca 2027 r.')),
          h('div', { class: 'field' }, h('label', null, 'Godzina'), inp('timeText', 'np. godz. 11:30')),
          h('div', { class: 'field span2' }, h('label', null, 'Miejsce'), inp('placeText', 'np. kościół parafialny / plac przy sanktuarium')),
          h('div', { class: 'field span2' }, h('label', null, 'Szczegóły – co ma się znaleźć na plakacie?'), inp('details', 'Wpisz swobodnie, np.: Sumie odpustowej przewodniczy ks. bp …; po Mszy procesja; od 10:00 spowiedź; zapraszamy dzieci w strojach komunijnych; po południu festyn z loterią fantową.', { textarea: true, rows: 5 })),
          h('div', { class: 'field span2' }, h('label', null, 'Harmonogram (opcjonalnie)'), schedEl)),
        h('div', { class: 'step' }, h('span', { class: 'step-n' }, '3'), 'Wygląd i format'),
        h('div', { class: 'form-grid' },
          h('div', { class: 'field' }, h('label', null, 'Format'), select(Object.entries(Poster.FORMATS).map(([v, f]) => ({ value: v, label: f.label })), C.formatId, (v) => { C.formatId = v; refreshPreview(); })),
          h('div', { class: 'field' }, h('label', null, 'Liczba wariantów do wyboru'), select([1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} ${plural(n, 'wariant', 'warianty', 'wariantów')}` })), String(C.variants), (v) => { C.variants = Number(v); })),
          h('div', { class: 'field span2' }, h('label', null, 'Zdjęcie / obraz'),
            h('div', { class: 'img-pick' },
              h('div', { class: 'ip' + (C.imageId === 'auto' ? ' active' : ''), onclick: () => { C.imageId = 'auto'; render(); } }, h('div', { class: 'ip-auto', html: icon('sparkles', 18) }), h('span', null, 'Automatycznie')),
              h('div', { class: 'ip' + (C.imageId === null ? ' active' : ''), onclick: () => { C.imageId = null; render(); } }, h('div', { class: 'ip-auto', html: icon('x', 18) }), h('span', null, 'Bez zdjęcia')),
              imgs.map((a) => h('div', { class: 'ip' + (C.imageId === a.id ? ' active' : ''), title: a.name, onclick: () => { C.imageId = a.id; render(); } }, h('div', { class: 'ip-img', style: { backgroundImage: `url('${assetUrl(a.id)}')` } }), h('span', null, a.name))))),
          h('div', { class: 'field span2 toggles' },
            h('label', { class: 'tg' }, toggle(C.showLogo, (v) => { C.showLogo = v; refreshPreview(); }), 'Logo parafii'),
            h('label', { class: 'tg' }, toggle(C.qrOn, (v) => { C.qrOn = v; render(); }), 'Kod QR'),
            state.settings.ai.useWebSearch ? h('label', { class: 'tg', title: 'Agent może sprawdzić w internecie informacje o okazji' }, toggle(C.webSearch, (v) => { C.webSearch = v; }), 'Sprawdź w internecie') : null),
          C.qrOn ? h('div', { class: 'field span2' }, h('label', null, 'Adres w kodzie QR'), inp('qr', 'https://… (strona parafii, wydarzenie na Facebooku, formularz zapisów)')) : null),
        h('div', { class: 'create-actions' },
          C.generating ? h('div', { class: 'gen-box' }, spinner(18), h('div', null, h('div', { style: { fontWeight: 600 } }, 'Agent AI przygotowuje plakat…'), h('div', { class: 'muted small' }, 'Pisze treść, dobiera układ, kolory i motywy. Zwykle trwa to 20–60 sekund.')))
            : [
              h('button', { class: 'btn primary lg', disabled: !aiReady() || null, title: aiReady() ? '' : 'Najpierw połącz konto Claude w Ustawieniach', onclick: () => generate(true) }, iconEl('sparkles', 15), 'Generuj z AI'),
              h('button', { class: 'btn lg', onclick: () => generate(false) }, iconEl('doc', 15), 'Utwórz z szablonu (bez AI)'),
              !aiReady() ? h('span', { class: 'muted small' }, 'AI niedostępne – ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); state.settingsTab = 'claude'; go('settings'); } }, 'połącz konto Claude')) : null
            ])),
      previewBox));
}

async function generate(useAi) {
  const C = state.create;
  C.generating = useAi; render();
  try {
    const brief = {
      title: C.title, dateText: C.dateText, timeText: C.timeText, placeText: C.placeText, details: C.details,
      schedule: C.schedule.filter((r) => r.when || r.what), imageId: C.imageId, showLogo: C.showLogo, qr: C.qrOn ? C.qr : '', webSearch: C.webSearch
    };
    const r = await api.createPosters({ brief, presetId: C.presetId, formatId: C.formatId, useAi, variants: useAi ? C.variants : 1, occasion: C.occasion });
    C.results = r.posters; C.missing = r.missing || []; C.notes = r.notes || '';
    C.generating = false;
    if (!useAi) { Editor.open(r.posters[0]); go('editor'); return; }
    render();
  } catch (e) { C.generating = false; render(); errToast(e); }
}

function viewCreateResults() {
  const C = state.create;
  return h('div', null,
    h('div', { class: 'toolbar' },
      h('button', { class: 'btn', onclick: () => { C.results = null; render(); } }, iconEl('chevronL', 13), 'Wróć do formularza'),
      h('h1', null, 'Wybierz wariant'), h('div', { style: { flex: 1 } }),
      h('button', { class: 'btn', onclick: () => { C.results = null; generate(true); } }, iconEl('refresh', 14), 'Wygeneruj ponownie')),
    h('div', { class: 'page' },
      C.missing.length ? h('div', { class: 'note-box warn' }, iconEl('warn', 16), h('div', null, h('b', null, 'Agent prosi o uzupełnienie: '), C.missing.join(' · '), h('div', { class: 'muted small' }, 'Brakujące dane dopisz w edytorze (podwójne kliknięcie w tekst) albo poleceniem „Popraw z AI”.'))) : null,
      C.notes ? h('div', { class: 'note-box' }, iconEl('info', 16), h('div', null, C.notes)) : null,
      h('div', { class: 'variants' }, C.results.map((p, i) => h('div', { class: 'variant', onclick: () => { Editor.open(p); go('editor'); } },
        thumb(p, C.results.length > 2 ? 250 : 320, 'shadow'),
        h('div', { class: 'variant-foot' }, h('b', null, `Wariant ${i + 1}`), h('span', { class: 'muted small' }, Poster.LAYOUTS[p.style.layout] || ''),
          h('button', { class: 'btn primary sm' }, iconEl('pencil', 12), 'Edytuj'))))),
      h('p', { class: 'muted small', style: { marginTop: '14px' } }, 'Wszystkie warianty zapisano w „Moich plakatach”. Niepotrzebne możesz usunąć.')));
}

// ───────────────────────── MOJE PLAKATY ─────────────────────────
function viewLibrary() {
  const q = state.library.q.toLowerCase();
  const list = state.posters.filter((p) => !q || String(p.name).toLowerCase().includes(q));
  const search = h('input', { class: 'input', style: { width: '260px' }, placeholder: 'Szukaj plakatu…', value: state.library.q, oninput: (e) => { state.library.q = e.target.value; clearTimeout(state.library.t); state.library.t = setTimeout(() => { render(); const el = document.querySelector('.toolbar input'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 250); } });
  return h('div', null,
    h('div', { class: 'toolbar' }, h('h1', null, 'Moje plakaty'), h('span', { class: 'muted' }, `${state.posters.length}`), h('div', { style: { flex: 1 } }), search,
      h('button', { class: 'btn', onclick: () => api.importJson().catch(errToast) }, iconEl('upload', 14), 'Importuj projekt'),
      h('button', { class: 'btn primary', onclick: () => go('create', { reset: true }) }, iconEl('plus', 14), 'Nowy plakat')),
    h('div', { class: 'page' }, list.length ? h('div', { class: 'poster-grid' }, list.map((p) => posterCard(p, 180))) : h('div', { class: 'card empty' }, q ? 'Brak plakatów pasujących do wyszukiwania.' : 'Nie masz jeszcze plakatów.')));
}

// ───────────────────────── KALENDARZ ─────────────────────────
async function loadCalendar() {
  const [y, m] = state.cal.month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const end = addDays(start, 41);
  state.cal.start = iso(start);
  state.cal.items = await api.calendar(iso(start), iso(end));
  state.cal.online = await api.onlineEvents();
}

function viewCalendar() {
  const [y, m] = state.cal.month.split('-').map(Number);
  const start = state.cal.start ? parseIso(state.cal.start) : new Date(y, m - 1, 1);
  const today = state.info.today;
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    const ds = iso(d);
    const items = state.cal.items.filter((o) => o.date === ds);
    cells.push(h('div', { class: 'cal-c' + (d.getMonth() !== m - 1 ? ' other' : '') + (ds === today ? ' today' : '') + (d.getDay() === 0 ? ' sunday' : ''), onclick: () => openCalDay(ds, items) },
      h('div', { class: 'cal-n' }, h('span', null, d.getDate()), items.some((o) => o.proposal && o.proposal.posterId) ? h('span', { class: 'mini-ok', html: icon('photo', 11), title: 'Plakat przygotowany' }) : null),
      items.slice(0, 3).map((o) => h('div', { class: 'cal-tag r-' + o.rank, title: o.name, style: { borderLeftColor: LCOLORS[o.color] || '#ccc' } }, o.name)),
      items.length > 3 ? h('div', { class: 'muted small' }, `+${items.length - 3} więcej`) : null));
  }
  const nav = (n) => { const d = new Date(y, m - 1 + n, 1); state.cal.month = n === 0 ? today.slice(0, 7) : `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; loadCalendar().then(render); };
  const online = state.cal.online.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  return h('div', null,
    h('div', { class: 'toolbar' }, h('h1', null, 'Kalendarz świąt'),
      h('div', { class: 'segmented', style: { alignItems: 'center' } },
        h('button', { title: 'Poprzedni miesiąc', onclick: () => nav(-1), html: icon('chevronL', 14) }),
        h('button', { class: 'active', style: { minWidth: '150px', justifyContent: 'center' }, onclick: () => nav(0) }, `${MONTHS[m - 1]} ${y}`),
        h('button', { title: 'Następny miesiąc', onclick: () => nav(1), html: icon('chevronR', 14) })),
      h('div', { style: { flex: 1 } }),
      h('button', { class: 'btn', onclick: () => editEvent({ date: today }) }, iconEl('plus', 14), 'Dodaj wydarzenie'),
      h('button', { class: 'btn', onclick: runAgent }, iconEl('globe', 14), 'Sprawdź internet teraz')),
    h('div', { class: 'page wide' },
      h('div', { class: 'cal-layout' },
        h('div', null,
          h('div', { class: 'cal' }, WD_SHORT.map((d) => h('div', { class: 'cal-h' }, d)), cells),
          h('div', { class: 'legend' }, Object.entries({ bialy: 'biały', czerwony: 'czerwony', fioletowy: 'fioletowy', zielony: 'zielony', rozowy: 'różowy', zloty: 'parafia / wydarzenie' }).map(([k, l]) => h('span', null, h('i', { class: 'lit-dot', style: { background: LCOLORS[k] } }), l)))),
        h('div', { class: 'card card-pad cal-side' },
          h('div', { class: 'card-title' }, iconEl('globe', 16), 'Znalezione w internecie'),
          h('p', { class: 'muted small', style: { marginTop: '-6px' } }, state.agent && state.agent.onlineCheckedAt ? `Ostatnie sprawdzenie: ${new Date(state.agent.onlineCheckedAt).toLocaleString('pl-PL')}` : 'Agent jeszcze nie przeglądał internetu.'),
          online.length ? online.map((e) => h('div', { class: 'online-ev' },
            h('div', { class: 'oe-date' }, shortDate(e.date)),
            h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { class: 'up-name' }, e.name), e.description ? h('div', { class: 'muted small' }, e.description) : null,
              e.url ? h('a', { href: '#', class: 'small', onclick: (ev) => { ev.preventDefault(); api.openExternal(e.url); } }, 'źródło') : null),
            h('div', { class: 'oe-btns' },
              h('button', { class: 'icon-btn', title: 'Utwórz plakat', onclick: () => go('create', { reset: true, occasion: { key: 'internet:' + e.id, date: e.date, name: e.name, presetId: e.presetId, note: e.description } }), html: icon('wand', 14) }),
              h('button', { class: 'icon-btn', title: 'Ukryj', onclick: async () => { await api.hideOnlineEvent(e.id); await loadCalendar(); render(); }, html: icon('x', 14) }))))
            : h('div', { class: 'empty small' }, 'Brak wydarzeń. Agent przegląda strony diecezji i wyszukiwarkę co kilka dni (Ustawienia → Agent).')))));
}

function openCalDay(ds, items) {
  const body = h('div', null,
    items.length ? items.map((o) => h('div', { class: 'up-item' },
      colorDot(o.color),
      h('div', { style: { flex: 1 } }, h('div', { class: 'up-name' }, o.name), h('div', { class: 'kind' }, RANKS[o.rank] || '', o.note ? ' · ' + o.note : '', o.source === 'internet' ? ' · z internetu' : '')),
      o.source === 'wlasne' ? h('button', { class: 'icon-btn', title: 'Edytuj wydarzenie', onclick: () => { s.close(); editEvent(Object.assign({}, o, { id: o.eventId })); }, html: icon('pencil', 14) }) : null,
      h('button', { class: 'btn sm primary', onclick: () => { s.close(); go('create', { reset: true, occasion: o }); } }, iconEl('wand', 12), 'Plakat'))) : h('div', { class: 'empty' }, 'Brak świąt i wydarzeń tego dnia.'));
  const s = sheet({ title: longDate(ds), body, actions: [{ label: 'Dodaj wydarzenie', onClick: () => { setTimeout(() => editEvent({ date: ds }), 250); } }, { label: 'Nowy plakat na ten dzień', kind: 'primary', onClick: () => go('create', { reset: true, occasion: { key: 'dzien:' + ds, date: ds, name: '', presetId: 'ogloszenie' } }) }] });
}

function editEvent(ev) {
  const e = Object.assign({ name: '', date: state.info.today, presetId: 'ogloszenie', note: '', leadDays: 21 }, ev);
  const presetOpts = allPresets().map((p) => ({ value: p.id, label: p.name }));
  const body = h('div', null,
    h('div', { class: 'field' }, h('label', null, 'Nazwa wydarzenia'), h('input', { class: 'input', value: e.name, placeholder: 'np. Wizytacja kanoniczna ks. biskupa', oninput: (x) => { e.name = x.target.value; } })),
    h('div', { class: 'form-grid' },
      h('div', { class: 'field' }, h('label', null, 'Data'), h('input', { class: 'input', type: 'date', value: e.date, onchange: (x) => { e.date = x.target.value; } })),
      h('div', { class: 'field' }, h('label', null, 'Przypomnij (dni wcześniej)'), h('input', { class: 'input', type: 'number', min: 1, max: 120, value: e.leadDays, onchange: (x) => { e.leadDays = Number(x.target.value); } }))),
    h('div', { class: 'field' }, h('label', null, 'Preset plakatu'), select(presetOpts, e.presetId, (v) => { e.presetId = v; })),
    h('div', { class: 'field' }, h('label', null, 'Notatka (trafi do AI przy tworzeniu plakatu)'), h('textarea', { class: 'input area', rows: 3, value: e.note, oninput: (x) => { e.note = x.target.value; } })));
  const actions = [{ label: 'Anuluj' }];
  if (e.id) actions.unshift({ label: 'Usuń', kind: 'danger', onClick: async () => { await api.deleteEvent(e.id); await loadUpcoming(); if (state.view === 'calendar') await loadCalendar(); render(); } });
  actions.push({ label: 'Zapisz', kind: 'primary', onClick: async () => { try { await api.saveEvent(e); await loadUpcoming(); await loadAgent(); if (state.view === 'calendar') await loadCalendar(); render(); toast('Zapisano wydarzenie', 'success', 1500); } catch (er) { errToast(er); return false; } } });
  sheet({ title: e.id ? 'Edytuj wydarzenie' : 'Nowe wydarzenie parafialne', subtitle: 'Agent przypomni o plakacie z wyprzedzeniem.', body, actions });
}

// ───────────────────────── PRESETY ─────────────────────────
function viewPresets() {
  const cats = [{ value: 'all', label: 'Wszystkie' }, ...Object.entries(state.presets.categories).map(([v, l]) => ({ value: v, label: l })), { value: 'custom', label: 'Własne' }];
  const list = allPresets().filter((p) => state.presetCat === 'all' || (state.presetCat === 'custom' ? !p.builtIn : p.category === state.presetCat));
  return h('div', null,
    h('div', { class: 'toolbar' }, h('h1', null, 'Presety tematyczne'), h('div', { style: { flex: 1 } }),
      h('button', { class: 'btn primary', onclick: () => editPreset(Object.assign(Poster.clone(presetById('ogloszenie')), { id: null, name: 'Mój preset', builtIn: false })) }, iconEl('plus', 14), 'Nowy preset')),
    h('div', { class: 'page wide' },
      h('div', { style: { marginBottom: '14px' } }, segmented(cats, state.presetCat, (v) => { state.presetCat = v; render(); })),
      h('p', { class: 'muted', style: { margin: '0 0 14px' } }, 'Preset to gotowy zestaw: kolory, czcionki, układ, motyw religijny, zdjęcie i wskazówki dla AI. Wbudowane presety możesz skopiować i dopasować do zwyczajów parafii.'),
      list.length ? h('div', { class: 'preset-grid' }, list.map((p) => h('div', { class: 'preset-card' },
        h('div', { class: 'pc-thumb', onclick: () => go('create', { reset: true, presetId: p.id }) }, presetPreview(p, 190)),
        h('div', { class: 'pc-meta' },
          h('div', { class: 'pc-title' }, p.name, p.builtIn ? null : h('span', { class: 'chip blue', style: { marginLeft: '6px' } }, 'własny')),
          h('div', { class: 'muted small' }, (state.presets.categories[p.category] || '')),
          h('div', { class: 'pc-btns' },
            h('button', { class: 'btn sm primary', onclick: () => go('create', { reset: true, presetId: p.id }) }, 'Użyj'),
            p.builtIn ? h('button', { class: 'btn sm', onclick: () => editPreset(Object.assign(Poster.clone(p), { id: null, name: p.name + ' (moja wersja)', builtIn: false })) }, iconEl('copy', 12), 'Dopasuj')
              : h('button', { class: 'btn sm', onclick: () => editPreset(Poster.clone(p)) }, iconEl('pencil', 12), 'Edytuj'),
            p.builtIn ? null : h('button', { class: 'icon-btn danger', title: 'Usuń', onclick: async () => { await api.deletePreset(p.id); await loadPresets(); render(); }, html: icon('trash', 14) })))))) : h('div', { class: 'card empty' }, 'Brak własnych presetów – użyj „Dopasuj” przy dowolnym presecie wbudowanym.')));
}

function editPreset(p) {
  p.style = Object.assign({}, p.style);
  p.style.fonts = Object.assign({}, p.style.fonts);
  p.defaults = Object.assign({ title: '', subtitle: '', closing: '', quote: null }, p.defaults);
  const preview = h('div', { class: 'preset-preview' });
  const upd = () => preview.replaceChildren(presetPreview(p, 260));
  const sel = (opts, val, fn) => select(opts, val, (v) => { fn(v); upd(); });
  const fontOpts = Object.entries(Poster.FONTS).map(([v, f]) => ({ value: v, label: f.label }));
  const pal = Object.assign({}, Poster.resolvePalette(p.style));
  const colorRow = h('div', { class: 'color-row' });
  const drawColors = () => {
    const P = Poster.resolvePalette(p.style);
    colorRow.replaceChildren(...[['bg', 'Tło'], ['title', 'Tytuł'], ['text', 'Tekst'], ['accent', 'Akcent'], ['muted', 'Drobny tekst']].map(([k, l]) => h('label', { class: 'color-pick' },
      h('input', { type: 'color', value: P[k], oninput: (e) => { p.style.palette = Object.assign({}, p.style.palette || {}, { [k]: e.target.value }); upd(); } }), h('span', null, l))));
  };
  drawColors();
  void pal;
  const imgOpts = [{ value: '', label: 'Bez zdjęcia' }, ...state.assets.filter((a) => a.role === 'zdjecie' || a.role === 'tlo' || a.role === 'motyw').map((a) => ({ value: a.id, label: a.name }))];
  const motifOpts = Object.entries(Poster.MOTIFS).filter(([k]) => !k.startsWith('linia')).map(([v, m]) => ({ value: v, label: m.label }));
  const body = h('div', { class: 'preset-edit' },
    h('div', { class: 'pe-form' },
      h('div', { class: 'field' }, h('label', null, 'Nazwa presetu'), h('input', { class: 'input', value: p.name, oninput: (e) => { p.name = e.target.value; } })),
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('label', null, 'Kategoria'), sel(Object.entries(state.presets.categories).map(([v, l]) => ({ value: v, label: l })), p.category, (v) => { p.category = v; })),
        h('div', { class: 'field' }, h('label', null, 'Układ'), sel(Object.entries(Poster.LAYOUTS).map(([v, l]) => ({ value: v, label: l })), p.style.layout, (v) => { p.style.layout = v; })),
        h('div', { class: 'field' }, h('label', null, 'Paleta kolorów'), sel(Object.entries(Poster.PALETTES).map(([v, x]) => ({ value: v, label: x.label })), p.style.paletteId, (v) => { p.style.paletteId = v; p.style.palette = null; drawColors(); })),
        h('div', { class: 'field' }, h('label', null, 'Motyw religijny'), sel(motifOpts, p.style.motif, (v) => { p.style.motif = v; p.icon = v; })),
        h('div', { class: 'field span2' }, h('label', null, 'Własne kolory (nadpisują paletę)'), colorRow),
        h('div', { class: 'field' }, h('label', null, 'Czcionka tytułu'), sel(fontOpts, p.style.fonts.heading, (v) => { p.style.fonts.heading = v; })),
        h('div', { class: 'field' }, h('label', null, 'Czcionka treści'), sel(fontOpts, p.style.fonts.body, (v) => { p.style.fonts.body = v; })),
        h('div', { class: 'field' }, h('label', null, 'Czcionka ozdobna'), sel(fontOpts, p.style.fonts.script, (v) => { p.style.fonts.script = v; })),
        h('div', { class: 'field' }, h('label', null, 'Ozdobnik'), sel(Poster.DIVIDERS.map((d) => ({ value: d, label: Poster.MOTIFS[d].label.replace('Ozdobnik: ', '') })), p.style.divider, (v) => { p.style.divider = v; })),
        h('div', { class: 'field' }, h('label', null, 'Ramka'), sel(Object.entries(Poster.FRAMES).map(([v, l]) => ({ value: v, label: l })), p.style.frame, (v) => { p.style.frame = v; })),
        h('div', { class: 'field' }, h('label', null, 'Tło'), sel(Object.entries(Poster.PATTERNS).map(([v, l]) => ({ value: v, label: l })), p.style.pattern, (v) => { p.style.pattern = v; })),
        h('div', { class: 'field' }, h('label', null, 'Domyślne zdjęcie'), sel(imgOpts, p.imageId || '', (v) => { p.imageId = v || null; })),
        h('div', { class: 'field' }, h('label', null, 'Kształt zdjęcia'), sel([{ value: 'luk', label: 'Łuk (okno)' }, { value: 'rect', label: 'Prostokąt' }, { value: 'kolo', label: 'Koło' }], p.style.imageShape || 'luk', (v) => { p.style.imageShape = v; })),
        h('div', { class: 'field span2 toggles' },
          h('label', { class: 'tg' }, toggle(p.style.titleUpper, (v) => { p.style.titleUpper = v; upd(); }), 'Tytuł wielkimi literami'),
          h('label', { class: 'tg' }, toggle(p.showLogo !== false, (v) => { p.showLogo = v; upd(); }), 'Logo parafii'))),
      h('div', { class: 'field' }, h('label', null, 'Domyślny tytuł'), h('input', { class: 'input', value: p.defaults.title, oninput: (e) => { p.defaults.title = e.target.value; clearTimeout(p._t); p._t = setTimeout(upd, 300); } })),
      h('div', { class: 'field' }, h('label', null, 'Domyślny podtytuł'), h('input', { class: 'input', value: p.defaults.subtitle || '', oninput: (e) => { p.defaults.subtitle = e.target.value; clearTimeout(p._t); p._t = setTimeout(upd, 300); } })),
      h('div', { class: 'field' }, h('label', null, 'Zakończenie / zaproszenie'), h('input', { class: 'input', value: p.defaults.closing || '', oninput: (e) => { p.defaults.closing = e.target.value; clearTimeout(p._t); p._t = setTimeout(upd, 300); } })),
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('label', null, 'Cytat (Pismo Święte)'), h('input', { class: 'input', value: p.defaults.quote ? p.defaults.quote.text : '', oninput: (e) => { p.defaults.quote = e.target.value ? Object.assign({ source: '' }, p.defaults.quote, { text: e.target.value }) : null; clearTimeout(p._t); p._t = setTimeout(upd, 300); } })),
        h('div', { class: 'field' }, h('label', null, 'Sygnatura'), h('input', { class: 'input', value: p.defaults.quote ? p.defaults.quote.source : '', placeholder: 'np. J 1,14', oninput: (e) => { if (p.defaults.quote) p.defaults.quote.source = e.target.value; clearTimeout(p._t); p._t = setTimeout(upd, 300); } }))),
      h('div', { class: 'field' }, h('label', null, 'Wskazówki dla AI (zwyczaje parafii, stałe informacje)'), h('textarea', { class: 'input area', rows: 3, value: p.aiHints || '', oninput: (e) => { p.aiHints = e.target.value; } }))),
    preview);
  upd();
  sheet({
    title: p.id ? 'Edytuj preset' : 'Nowy preset', subtitle: 'Zmiany widać od razu na podglądzie.', body, wide: true,
    actions: [{ label: 'Anuluj' }, { label: 'Zapisz preset', kind: 'primary', onClick: async () => { try { const { _t, ...clean } = p; void _t; await api.savePreset(clean); await loadPresets(); state.presetCat = 'custom'; render(); toast('Zapisano preset', 'success', 1500); } catch (e) { errToast(e); return false; } } }]
  });
}

// ───────────────────────── LOGO I GRAFIKI ─────────────────────────
const assetInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml', multiple: true, style: { display: 'none' } });
document.body.appendChild(assetInput);
assetInput.addEventListener('change', () => { addAssetFiles([...assetInput.files]); assetInput.value = ''; });

async function prepareImage(file, keepPng) {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name}: to nie jest obraz.`);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`${file.name}: nie mogę otworzyć tego formatu (HEIC zapisz jako JPG).`)); i.src = url; });
    const max = 3000;
    const scale = Math.min(1, max / Math.max(img.naturalWidth || 1000, img.naturalHeight || 1000));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((img.naturalWidth || 1000) * scale);
    canvas.height = Math.round((img.naturalHeight || 1000) * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = keepPng || file.type === 'image/png' || file.type === 'image/svg+xml';
    const dataUrl = png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9);
    return { name: file.name.replace(/\.[^.]+$/, ''), data: dataUrl.split(',')[1], mediaType: png ? 'image/png' : 'image/jpeg', aspect: canvas.width / canvas.height };
  } finally { URL.revokeObjectURL(url); }
}

async function addAssetFiles(files, role) {
  let n = 0;
  for (const f of files) {
    try {
      const im = await prepareImage(f);
      const guess = role || (/logo/i.test(f.name) ? 'logo' : /herb|emblemat/i.test(f.name) ? 'emblemat' : /tlo|tło|background/i.test(f.name) ? 'tlo' : 'zdjecie');
      await api.addAsset({ ...im, role: guess });
      n++;
    } catch (e) { errToast(e); }
  }
  await loadAssets();
  if (n) toast(`Dodano ${n} ${plural(n, 'grafikę', 'grafiki', 'grafik')}`, 'success');
  render();
}

function viewAssets() {
  const roleOpts = Object.entries(state.roles).map(([v, l]) => ({ value: v, label: l }));
  const s = state.settings;
  const drop = h('div', { class: 'dropzone small-dz', onclick: () => assetInput.click(),
    ondragover: (e) => { e.preventDefault(); drop.classList.add('over'); }, ondragleave: () => drop.classList.remove('over'),
    ondrop: (e) => { e.preventDefault(); drop.classList.remove('over'); addAssetFiles([...e.dataTransfer.files]); } },
  h('div', { class: 'dz-ic', html: icon('upload', 26) }), h('h2', null, 'Dodaj logo, herb lub zdjęcia'), h('p', null, 'Przeciągnij pliki tutaj albo kliknij. PNG z przezroczystym tłem najlepiej nadaje się na logo.'));
  return h('div', null,
    h('div', { class: 'toolbar' }, h('h1', null, 'Logo i grafiki'), h('div', { style: { flex: 1 } }),
      h('button', { class: 'btn', onclick: async () => { await api.restoreAssets(); await loadAssets(); render(); } }, iconEl('refresh', 14), 'Przywróć wbudowane'),
      h('button', { class: 'btn primary', onclick: () => assetInput.click() }, iconEl('plus', 14), 'Dodaj pliki')),
    h('div', { class: 'page wide' },
      drop,
      group('Oficjalne oznaczenia na plakatach', [
        row('Logo (u góry plakatu)', select(state.assets.filter((a) => a.role === 'logo' || a.role === 'emblemat').map((a) => ({ value: a.id, label: a.name })), s.poster.logoId || 'brand:logo', (v) => saveSettings({ poster: { logoId: v } })), { icon: 'cross', color: 'var(--accent)', hint: 'Duże logo z nazwą parafii – układ klasyczny i dwukolumnowy.' }),
        row('Emblemat (mały znak)', select(state.assets.filter((a) => a.role === 'logo' || a.role === 'emblemat').map((a) => ({ value: a.id, label: a.name })), s.poster.emblemId || 'brand:herb', (v) => saveSettings({ poster: { emblemId: v } })), { icon: 'photo', color: 'var(--indigo)', hint: 'Mniejszy znak bez napisu – nagłówki, ramki, układ z dużym zdjęciem.' })
      ]),
      h('div', { class: 'asset-grid' }, state.assets.map((a) => h('div', { class: 'asset-card' },
        h('div', { class: 'ac-img' + (a.role === 'logo' || a.role === 'emblemat' ? ' checker' : '') }, h('div', { class: 'ac-in', style: { backgroundImage: `url('${assetUrl(a.id)}')` } })),
        h('div', { class: 'ac-meta' },
          a.builtIn ? h('div', { class: 'ac-name' }, a.name) : h('input', { class: 'input ac-name-in', value: a.name, onchange: async (e) => { await api.updateAsset(a.id, { name: e.target.value }); await loadAssets(); } }),
          h('div', { class: 'ac-row' },
            a.builtIn ? h('span', { class: 'chip' }, state.roles[a.role] || a.role) : select(roleOpts, a.role, async (v) => { await api.updateAsset(a.id, { role: v }); await loadAssets(); render(); }),
            a.builtIn ? h('span', { class: 'chip blue' }, 'parafia') : null,
            h('div', { style: { flex: 1 } }),
            h('button', { class: 'icon-btn danger', title: a.builtIn ? 'Ukryj' : 'Usuń', onclick: async () => { await api.removeAsset(a.id); await loadAssets(); render(); }, html: icon(a.builtIn ? 'eyeOff' : 'trash', 14) })))))),
      h('div', { class: 'section-head' }, h('h3', null, 'Motywy religijne (wbudowane, wektorowe)')),
      h('div', { class: 'motif-grid' }, Object.entries(Poster.MOTIFS).map(([k, m]) => h('div', { class: 'motif-cell', title: m.label }, h('div', { class: 'mc-svg', html: Poster.motifSvg(k, 'var(--text)', m.vb ? 1.6 : 3) }), h('span', null, m.label))))));
}

// ───────────────────────── DRUK ─────────────────────────
async function printDialog(poster) {
  const s = state.settings.print;
  const o = { printer: s.printer || '', copies: s.copies || 1, nup: s.nup || 1, paper: s.paper || 'auto', scale: s.scale || 'fit', color: s.color !== false, cropMarks: !!s.cropMarks, marginMm: s.marginMm || 0 };
  let printers = [];
  try { printers = await api.printers(); } catch (_) { /* brak */ }
  if (!o.printer) { const d = printers.find((p) => p.isDefault); if (d) o.printer = d.name; }
  const prev = h('div', { class: 'print-preview' });
  const info = h('div', { class: 'muted small', style: { textAlign: 'center', marginTop: '8px' } });
  const drawPrev = async () => {
    try {
      const plan = await api.printPlan(poster, o);
      const W = 230 * (plan.paper.w > plan.paper.h ? 1.25 : 1);
      const k = W / plan.paper.w;
      const sheetEl = h('div', { class: 'pp-sheet', style: { width: W + 'px', height: plan.paper.h * k + 'px', filter: o.color ? '' : 'grayscale(1)' } });
      for (const c of plan.cells) {
        const t = thumb(poster, poster.format.w * c.scale * k);
        t.style.position = 'absolute'; t.style.left = c.x * k + 'px'; t.style.top = c.y * k + 'px';
        sheetEl.appendChild(t);
      }
      prev.replaceChildren(sheetEl);
      info.textContent = `Papier: ${plan.paper.name || `${Math.round(plan.paper.w)}×${Math.round(plan.paper.h)} mm`} · ${plan.cells.length} ${plan.cells.length === 1 ? 'plakat' : 'plakaty'} na arkuszu · skala ${Math.round(plan.cells[0].scale * 100)}%`;
    } catch (e) { info.textContent = e.message; }
  };
  const set = (k, v) => { o[k] = v; drawPrev(); };
  const body = h('div', { class: 'print-dlg' },
    h('div', null, prev, info),
    h('div', { class: 'print-opts' },
      h('div', { class: 'field' }, h('label', null, 'Drukarka'), printers.length ? select(printers.map((p) => ({ value: p.name, label: p.displayName + (p.isDefault ? ' (domyślna)' : '') })), o.printer, (v) => set('printer', v)) : h('div', { class: 'muted small' }, 'Nie znaleziono drukarek – użyj okna systemowego lub zapisz PDF.')),
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('label', null, 'Liczba kopii'), h('input', { class: 'input', type: 'number', min: 1, max: 200, value: o.copies, onchange: (e) => set('copies', Number(e.target.value) || 1) })),
        h('div', { class: 'field' }, h('label', null, 'Papier'), select([{ value: 'auto', label: 'Automatycznie' }, { value: 'A4', label: 'A4' }, { value: 'A3', label: 'A3' }, { value: 'A5', label: 'A5' }, { value: 'Letter', label: 'Letter' }], o.paper, (v) => set('paper', v)))),
      h('div', { class: 'field' }, h('label', null, 'Plakatów na jednej kartce (ulotki do rozdania)'), segmented([1, 2, 4, 8].map((n) => ({ value: n, label: String(n) })), o.nup, (v) => set('nup', v))),
      h('div', { class: 'field' }, h('label', null, 'Skalowanie'), segmented([{ value: 'fit', label: 'Dopasuj do kartki' }, { value: 'actual', label: 'Rzeczywisty rozmiar' }], o.scale, (v) => set('scale', v))),
      h('div', { class: 'field' }, h('label', null, 'Kolor'), segmented([{ value: true, label: 'Kolorowy' }, { value: false, label: 'Czarno-biały' }], o.color, (v) => set('color', v))),
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('label', null, 'Margines (mm)'), h('input', { class: 'input', type: 'number', min: 0, max: 30, value: o.marginMm, onchange: (e) => set('marginMm', Number(e.target.value) || 0) })),
        h('div', { class: 'field' }, h('label', null, 'Znaczniki cięcia'), toggle(o.cropMarks, (v) => set('cropMarks', v)))),
      h('p', { class: 'muted small' }, 'Drukarki zwykle nie drukują do samej krawędzi – przy białym marginesie ustaw 4–5 mm.')));
  drawPrev();
  const remember = () => api.setSettings({ print: { printer: o.printer, copies: o.copies, nup: o.nup, paper: o.paper, scale: o.scale, color: o.color, cropMarks: o.cropMarks, marginMm: o.marginMm } }).then((st) => { state.settings = st; }).catch(() => {});
  sheet({
    title: 'Drukuj plakat', subtitle: poster.name, body, wide: true,
    actions: [
      { label: 'Zapisz PDF', onClick: async () => { remember(); try { const f = await api.exportPdf(poster, o); if (f) toast('Zapisano PDF', 'success'); } catch (e) { errToast(e); } } },
      { label: 'Okno systemowe…', onClick: async () => { remember(); try { const r = await api.print(poster, Object.assign({}, o, { silent: false })); if (r.ok) toast('Wysłano do drukarki', 'success'); } catch (e) { errToast(e); } } },
      { label: 'Drukuj', kind: 'primary', onClick: async () => { remember(); try { toast('Przygotowuję wydruk…', 'info', 2000); const r = await api.print(poster, Object.assign({}, o, { silent: !!o.printer })); if (r.ok) toast(`Wysłano do drukarki (${r.copies} ${plural(r.copies, 'kopia', 'kopie', 'kopii')})`, 'success'); } catch (e) { errToast(e); } } }
    ]
  });
}
