'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Notification, Tray, Menu, nativeImage, nativeTheme, safeStorage, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const { Store } = require('./store');
const { Liturgy, iso, longDate } = require('./liturgy');
const { ClaudeAccount } = require('./claude-account');
const { Agent } = require('./agent');
const { ClaudeCodeProvider, ApiProvider, findClaude } = require('./ai/providers');
const { generatePosterContent, refinePosterContent } = require('./ai/tasks');
const { Assets, ROLES, buildPosters, relayout, presetById, qrSvg, fillQr, footerFrom } = require('./posters');
const printing = require('./printing');
const Poster = require('../shared/poster');
const Presets = require('../shared/presets');

const APP_NAME = 'Plakaty Parafialne';
app.setName(APP_NAME);
app.commandLine.appendSwitch('lang', 'pl');
if (process.platform === 'win32') app.setAppUserModelId('pl.z0z6.plakatyparafialne');

protocol.registerSchemesAsPrivileged([{ scheme: 'plakat', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

// Wersja portable (Windows): dane obok pliku .exe
const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
const dataDir = process.env.PLAKATY_DATA_DIR || (portableDir ? path.join(portableDir, 'Plakaty Parafialne - dane') : path.join(app.getPath('userData'), 'dane'));
const ASSET_URL = 'plakat://zasob/';

if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
let tray = null;
let quitting = false;
let store, liturgy, agent, account, assets;

const secretsFile = () => path.join(dataDir, 'klucz.bin');
function getApiKey() {
  try {
    const raw = fs.readFileSync(secretsFile());
    if (raw.slice(0, 4).toString() === 'b64:') return Buffer.from(raw.slice(4).toString(), 'base64').toString('utf8');
    return safeStorage.decryptString(raw);
  } catch (_) { return null; }
}
function setApiKey(key) {
  if (!key) { try { fs.unlinkSync(secretsFile()); } catch (_) { /* brak */ } return; }
  if (safeStorage.isEncryptionAvailable()) fs.writeFileSync(secretsFile(), safeStorage.encryptString(key));
  else fs.writeFileSync(secretsFile(), 'b64:' + Buffer.from(key, 'utf8').toString('base64'));
}
function getProvider() {
  const s = store.settings;
  return s.ai.provider === 'api' ? new ApiProvider(s, getApiKey) : new ClaudeCodeProvider(s);
}

function emit(channel, payload) { if (win && !win.isDestroyed()) win.webContents.send(channel, payload); }
function iconPath() { return path.join(__dirname, '..', 'assets', 'icon.png'); }
function notify(title, body) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: iconPath() });
  n.on('click', () => showWindow());
  n.show();
}

async function fetchPage(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await net.fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 PlakatyParafialne/1.0' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return (await r.text()).slice(0, 600000);
  } finally { clearTimeout(t); }
}

function createWindow() {
  const isMac = process.platform === 'darwin';
  win = new BrowserWindow({
    width: 1360, height: 880, minWidth: 1080, minHeight: 680, show: false,
    frame: isMac, titleBarStyle: isMac ? 'hiddenInset' : undefined,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#f5f5f7',
    icon: iconPath(),
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => { win.webContents.setZoomLevel(0); win.webContents.setVisualZoomLevelLimits(1, 1); });
  win.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) win.show(); });
  if (process.env.PLAKATY_SHOTS) {
    win.webContents.on('console-message', (...a) => { const e = a[0]; console.log('[renderer]', e && e.message ? e.message : a.slice(1).join(' ')); });
    win.webContents.once('did-finish-load', () => devScreenshots(process.env.PLAKATY_SHOTS));
  }
  win.on('close', (e) => {
    if (!quitting && store.settings.agent.runInBackground && tray) {
      e.preventDefault();
      win.hide();
      if (!store.data.notified.trayHint) {
        store.data.notified.trayHint = true; store.save();
        notify('Plakaty Parafialne działają w tle', 'Agent dalej pilnuje kalendarza świąt. Aplikację zamkniesz z menu ikony w zasobniku.');
      }
    }
  });
  win.on('maximize', () => emit('window:state', { maximized: true }));
  win.on('unmaximize', () => emit('window:state', { maximized: false }));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

// Tryb deweloperski: zrzuty ekranu (PLAKATY_SHOTS=katalog, PLAKATY_STEPS="nazwa=<js>,...")
async function devScreenshots(dir) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  fs.mkdirSync(dir, { recursive: true });
  const steps = (process.env.PLAKATY_STEPS || 'dashboard').split(',');
  await wait(1800);
  for (const step of steps) {
    const [name, js] = step.split('=');
    if (js) await win.webContents.executeJavaScript(decodeURIComponent(js)).catch((e) => console.error(e));
    await wait(Number(process.env.PLAKATY_WAIT) || 1200);
    if (name.startsWith('_')) continue;
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(dir, name + '.png'), img.toPNG());
  }
  quitting = true;
  app.quit();
}

function showWindow() {
  if (!win || win.isDestroyed()) createWindow();
  win.show();
  win.focus();
}

function createTray() {
  try {
    const img = nativeImage.createFromPath(iconPath()).resize({ width: 22, height: 22 });
    tray = new Tray(img);
    tray.setToolTip(APP_NAME);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Otwórz Plakaty Parafialne', click: showWindow },
      { label: 'Sprawdź święta i wydarzenia teraz', click: () => agent.tick(true) },
      { type: 'separator' },
      { label: 'Zakończ', click: () => { quitting = true; app.quit(); } }
    ]));
    tray.on('click', showWindow);
  } catch (_) { tray = null; }
}

function registerProtocol() {
  protocol.handle('plakat', async (req) => {
    const u = new URL(req.url);
    const id = decodeURIComponent(u.pathname.replace(/^\//, ''));
    const file = u.hostname === 'zasob' ? assets.filePath(id) : null;
    if (!file) return new Response('Nie znaleziono', { status: 404 });
    const r = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(r.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'max-age=3600');
    return new Response(r.body, { status: r.status, headers });
  });
}

// ─────────────────────────── plakaty ───────────────────────────

function assetCatalog() {
  return assets.list().map((a) => ({ id: a.id, name: a.name, role: a.role }));
}

async function createPosters({ brief = {}, presetId, formatId, useAi = true, variants, occasion }) {
  const preset = presetById(store, presetId || (occasion && occasion.presetId) || 'ogloszenie');
  const s = store.settings;
  const nVariants = Math.max(1, Math.min(4, Number(variants) || s.poster.variants || 1));
  let content, style = {}, missing = [], notes = '';
  if (useAi) {
    const r = await generatePosterContent(getProvider(), {
      brief: Object.assign({}, brief, { occasion }), preset, parish: s.parish, ai: s.ai, assets: assetCatalog(),
      webSearch: !!(s.ai.useWebSearch && brief.webSearch)
    });
    content = r.content; style = r.style; missing = r.missing; notes = r.notes;
    if (brief.imageId !== undefined && brief.imageId !== 'auto') content.imageId = brief.imageId || null;
  } else {
    const d = preset.defaults || {};
    content = {
      title: brief.title || (occasion && occasion.name) || d.title || preset.name,
      subtitle: brief.subtitle != null ? brief.subtitle : d.subtitle || '',
      dateText: brief.dateText || (occasion && occasion.date ? longDate(occasion.date) : ''),
      timeText: brief.timeText || '',
      placeText: brief.placeText || '',
      body: brief.details || d.body || '',
      schedule: brief.schedule || [],
      quote: d.quote || null,
      closing: d.closing || '',
      imageId: brief.imageId !== undefined && brief.imageId !== 'auto' ? brief.imageId || null : preset.imageId || null
    };
  }
  if (brief.qr) content.qr = brief.qr;
  if (brief.showLogo === false) content.showLogo = false;
  const posters = await buildPosters({
    store, assets, preset, content, styleOverride: style, formatId: formatId || s.poster.defaultFormat, variants: nVariants,
    meta: { occasion: occasion ? { key: occasion.key, name: occasion.name, date: occasion.date } : null, missing, notes, ai: !!useAi }
  });
  posters.forEach((p, i) => { if (posters.length > 1) p.name = `${p.name} (wariant ${i + 1})`; });
  return { posters, missing, notes };
}

// ─────────────────────────── IPC ───────────────────────────

function handle(channel, fn) {
  ipcMain.handle(channel, async (_e, ...args) => {
    try { return { ok: true, data: await fn(...args) }; } catch (err) { return { ok: false, error: err.message || String(err) }; }
  });
}

function registerIpc() {
  handle('app:info', () => ({ version: app.getVersion(), platform: process.platform, dataDir, portable: !!portableDir, today: iso(new Date()), assetUrl: ASSET_URL }));
  handle('window:control', (action) => {
    if (!win) return false;
    if (action === 'close') { win.close(); return false; }
    if (action === 'minimize') { win.minimize(); return win.isMaximized(); }
    if (action === 'maximize') { const target = !win.isMaximized(); if (target) win.maximize(); else win.unmaximize(); return target; }
    return win.isMaximized();
  });

  // ustawienia i konto Claude
  handle('settings:get', () => ({ settings: store.settings, hasApiKey: !!getApiKey(), claudePath: findClaude(store.settings.ai.claudePath), footerPreview: footerFrom(store.settings) }));
  handle('settings:set', (patch) => {
    const s = store.updateSettings(patch);
    if (patch && patch.agent) agent.start();
    if (patch && patch.ui && patch.ui.theme) nativeTheme.themeSource = patch.ui.theme;
    return s;
  });
  handle('settings:replace', (key, value) => { // pola tablicowe (np. święta parafii, adresy stron)
    if (!['parishFeasts'].includes(key)) throw new Error('Nieobsługiwane ustawienie.');
    store.data.settings[key] = value;
    store.save();
    emit('data:changed', {});
    return store.settings;
  });
  handle('apikey:set', (key) => { setApiKey((key || '').trim()); return !!getApiKey(); });
  handle('ai:test', async () => getProvider().test());
  handle('claude:status', () => account.status());
  handle('claude:install', () => account.install());
  handle('claude:login', () => { store.updateSettings({ ai: { provider: 'claude-code' } }); return account.startLogin(); });
  handle('claude:code', (code) => account.submitCode(code));
  handle('claude:cancel', () => { account.cancelLogin(); return true; });
  handle('claude:logout', () => account.logout());
  handle('ai:browseClaude', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Wskaż program Claude Code', properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return null;
    store.updateSettings({ ai: { claudePath: r.filePaths[0] } });
    return r.filePaths[0];
  });

  // presety
  handle('presets:list', () => ({ builtIn: Presets.LIST, custom: store.data.customPresets, categories: Presets.CATEGORIES }));
  handle('presets:save', (p) => {
    if (!p || !p.name) throw new Error('Preset musi mieć nazwę.');
    const list = store.data.customPresets;
    const preset = Object.assign({}, p, { builtIn: false, id: p.id && !Presets.byId(p.id) ? p.id : 'wlasny-' + Date.now().toString(36) });
    const i = list.findIndex((x) => x.id === preset.id);
    if (i >= 0) list[i] = preset; else list.push(preset);
    store.save();
    return preset;
  });
  handle('presets:delete', (id) => { store.data.customPresets = store.data.customPresets.filter((x) => x.id !== id); store.save(); return true; });

  // zasoby graficzne
  handle('assets:list', () => ({ assets: assets.list(), roles: ROLES }));
  handle('assets:add', (a) => assets.add(a));
  handle('assets:update', (id, patch) => assets.update(id, patch));
  handle('assets:remove', (id) => assets.remove(id));
  handle('assets:restore', () => assets.restoreBuiltIn());

  // kalendarz
  handle('calendar:range', (from, to) => liturgy.inRange(from, to).map((o) => ({ ...o, proposal: store.data.proposals[o.key] || null })));
  handle('calendar:season', (date) => liturgy.seasonOf(date));
  handle('events:save', (e) => {
    if (!e || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || !e.name) throw new Error('Podaj datę i nazwę wydarzenia.');
    const list = store.data.events;
    const ev = { id: e.id || Date.now().toString(36), date: e.date, name: String(e.name).slice(0, 160), presetId: e.presetId || 'ogloszenie', note: String(e.note || '').slice(0, 400), leadDays: Number(e.leadDays) || 21 };
    const i = list.findIndex((x) => x.id === ev.id);
    if (i >= 0) list[i] = ev; else list.push(ev);
    store.save();
    emit('agent:status', agent.status());
    return ev;
  });
  handle('events:delete', (id) => { store.data.events = store.data.events.filter((x) => x.id !== id); store.save(); return true; });
  handle('onlineEvents:hide', (id) => { const e = store.data.onlineEvents.find((x) => x.id === id); if (e) e.hidden = true; store.save(); return true; });
  handle('onlineEvents:list', () => store.data.onlineEvents.filter((e) => !e.hidden));

  // propozycje i agent
  handle('agent:status', () => agent.status());
  handle('agent:run', async () => { await agent.tick(true); return agent.status(); });
  handle('proposal:set', (key, patch) => { agent.setProposal(key, patch); return agent.status(); });

  // plakaty
  handle('posters:list', () => store.listPosters());
  handle('poster:get', (id) => store.getPoster(id));
  handle('poster:save', (p) => { const r = store.savePoster(p); emit('posters:changed', {}); return r; });
  handle('poster:delete', (id) => { store.deletePoster(id); emit('posters:changed', {}); return true; });
  handle('poster:duplicate', (id) => {
    const p = Poster.clone(store.getPoster(id));
    p.id = Poster.uid('p'); p.name = p.name + ' (kopia)'; p.createdAt = null;
    const r = store.savePoster(p);
    emit('posters:changed', {});
    return r;
  });
  handle('poster:create', async (opts) => {
    const r = await createPosters(opts || {});
    const saved = r.posters.map((p) => store.savePoster(p));
    if (opts && opts.occasion && opts.occasion.key) agent.setProposal(opts.occasion.key, { status: 'done', posterId: saved[0].id });
    store.log('poster', `Utworzono ${saved.length === 1 ? 'plakat' : saved.length + ' warianty plakatu'}: ${saved[0].name}`);
    emit('posters:changed', {});
    return { posters: saved, missing: r.missing, notes: r.notes };
  });
  handle('poster:refine', async (poster, instruction) => {
    if (!instruction || !instruction.trim()) throw new Error('Wpisz, co zmienić.');
    const r = await refinePosterContent(getProvider(), { poster, instruction, parish: store.settings.parish, ai: store.settings.ai, assets: assetCatalog() });
    let p = Poster.clone(poster);
    let relaid = false;
    if (r.style.layout || r.style.motif) {
      p.style = Object.assign({}, p.style, r.style.layout ? { layout: r.style.layout } : {}, r.style.motif ? { motif: r.style.motif } : {});
      p.content = Object.assign({}, p.content, r.content);
      p = await relayout({ store, assets, poster: p });
      relaid = true;
    } else {
      const applied = Poster.applyContent(p, r.content);
      if (applied) p = applied;
      else { p.content = Object.assign({}, p.content, r.content); p = await relayout({ store, assets, poster: p }); relaid = true; }
    }
    if (r.style.paletteId) p = Poster.recolor(p, r.style.paletteId);
    return { poster: p, notes: r.notes, missing: r.missing, relaid };
  });
  handle('poster:relayout', async (poster, layoutId, formatId) => relayout({ store, assets, poster, layoutId, formatId }));
  handle('qr:svg', (data) => qrSvg(data));
  handle('poster:fillQr', (p) => fillQr(p));

  // druk i eksport
  handle('print:printers', async () => {
    const list = await win.webContents.getPrintersAsync();
    return list.map((p) => ({ name: p.name, displayName: p.displayName || p.name, isDefault: !!p.isDefault, description: p.description || '' }));
  });
  handle('print:plan', (poster, opts) => printing.planSheet(poster, opts));
  handle('print:run', async (poster, opts) => {
    const r = await printing.printPoster(poster, opts || {}, ASSET_URL);
    if (r.ok) store.log('print', `Wydrukowano: ${poster.name} (${r.copies} ${r.copies === 1 ? 'kopia' : 'kopie'})`);
    return r;
  });
  handle('export:pdf', async (poster, opts) => {
    const def = path.join(app.getPath('documents'), safeName(poster.name) + '.pdf');
    const save = await dialog.showSaveDialog(win, { title: 'Zapisz plakat jako PDF', defaultPath: def, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (save.canceled || !save.filePath) return null;
    fs.writeFileSync(save.filePath, await printing.pdfBuffer(poster, opts || {}, ASSET_URL));
    return save.filePath;
  });
  handle('export:png', async (poster, opts) => {
    const def = path.join(app.getPath('pictures'), safeName(poster.name) + '.png');
    const save = await dialog.showSaveDialog(win, { title: 'Zapisz plakat jako obraz PNG', defaultPath: def, filters: [{ name: 'Obraz PNG', extensions: ['png'] }] });
    if (save.canceled || !save.filePath) return null;
    fs.writeFileSync(save.filePath, await printing.pngBuffer(poster, opts || {}, ASSET_URL));
    return save.filePath;
  });
  handle('export:json', async (poster) => {
    const save = await dialog.showSaveDialog(win, { title: 'Zapisz projekt plakatu', defaultPath: path.join(app.getPath('documents'), safeName(poster.name) + '.plakat.json'), filters: [{ name: 'Projekt plakatu', extensions: ['json'] }] });
    if (save.canceled || !save.filePath) return null;
    fs.writeFileSync(save.filePath, JSON.stringify(poster, null, 1));
    return save.filePath;
  });
  handle('import:json', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Otwórz projekt plakatu', filters: [{ name: 'Projekt plakatu', extensions: ['json'] }], properties: ['openFile'] });
    if (r.canceled || !r.filePaths[0]) return null;
    const p = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
    if (!p || !Array.isArray(p.elements) || !p.format) throw new Error('To nie jest projekt plakatu.');
    p.id = Poster.uid('p');
    const saved = store.savePoster(p);
    emit('posters:changed', {});
    return saved;
  });

  if (process.env.PLAKATY_SHOTS) { // tryb deweloperski: eksport bez okien dialogowych
    handle('dev:export', async (poster, name, kind, opts) => {
      const f = path.join(process.env.PLAKATY_SHOTS, name);
      const buf = kind === 'png' ? await printing.pngBuffer(poster, opts || {}, ASSET_URL) : await printing.pdfBuffer(poster, opts || {}, ASSET_URL);
      fs.writeFileSync(f, buf);
      return f;
    });
  }
  handle('shell:showFile', (p) => shell.showItemInFolder(p));
  handle('shell:openFile', (p) => shell.openPath(p));
  handle('shell:openData', () => shell.openPath(dataDir));
  handle('shell:openExternal', (url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
}

function safeName(s) { return String(s || 'plakat').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'plakat'; }

async function autoDraft(occasion) {
  const r = await createPosters({ presetId: occasion.presetId, occasion, useAi: true, variants: 1, brief: { details: occasion.note || '' } });
  const p = store.savePoster(r.posters[0]);
  emit('posters:changed', {});
  return p.id;
}

app.on('second-instance', () => showWindow());

app.whenReady().then(() => {
  store = new Store(dataDir);
  nativeTheme.themeSource = store.settings.ui.theme || 'system';
  assets = new Assets(store);
  liturgy = new Liturgy(store);
  account = new ClaudeAccount({ getSettings: () => store.settings, emit });
  agent = new Agent({ store, liturgy, getProvider, notify, emit, fetchPage, autoDraft, aiAvailable: () => (store.settings.ai.provider === 'api' ? !!getApiKey() : !!findClaude(store.settings.ai.claudePath)) });
  registerProtocol();
  registerIpc();
  createWindow();
  if (!process.env.PLAKATY_SHOTS) createTray();
  agent.start();
  app.on('activate', showWindow);
});

app.on('before-quit', () => { quitting = true; if (account) account.cancelLogin(); });
app.on('window-all-closed', () => { if (!store || !store.settings.agent.runInBackground || !tray) app.quit(); });


