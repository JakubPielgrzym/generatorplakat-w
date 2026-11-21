'use strict';
// Prosty, trwały magazyn danych w pliku JSON (zapis atomowy).
const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
  parish: {
    name: 'Parafia pw. św. Jakuba Apostoła',
    place: 'w Koziebrodach',
    sanctuary: 'Sanktuarium Matki Bożej Królowej Nieba',
    diocese: 'Diecezja Płocka',
    address: 'Koziebrody',
    phone: '',
    email: '',
    website: '',
    facebook: '',
    pastor: '',
    massSunday: '',
    massWeekday: '',
    office: '',
    bankAccount: ''
  },
  parishFeasts: [
    { id: 'jakub', md: '07-25', name: 'Odpust parafialny ku czci św. Jakuba Apostoła', presetId: 'odpust', leadDays: 30, propose: true, note: 'Patron parafii' },
    { id: 'mbc', md: '08-26', name: 'Uroczystość NMP Częstochowskiej w sanktuarium', presetId: 'maryjne', leadDays: 21, propose: true, note: 'Obraz Matki Bożej w sanktuarium' }
  ],
  poster: {
    defaultFormat: 'a4',
    variants: 2,
    showLogo: true,
    autoFooter: true,
    footerTemplate: '{nazwa} {miejscowosc}  ·  {adres}  ·  {telefon}  ·  {www}',
    qrUrl: '',
    qrDefault: false,
    honorifics: true
  },
  ai: {
    provider: 'claude-code',
    model: 'sonnet',
    apiModel: 'claude-sonnet-5-5',
    claudePath: '',
    useWebSearch: true,
    tone: 'ciepły, uroczysty, prosty i zrozumiały dla wszystkich parafian',
    extraInstructions: ''
  },
  print: {
    printer: '',
    copies: 1,
    nup: 1,
    paper: 'auto',
    scale: 'fit',
    color: true,
    marginMm: 0,
    cropMarks: false
  },
  agent: {
    enabled: true,
    runInBackground: true,
    notifications: true,
    onlineCheck: true,
    onlineIntervalDays: 7,
    horizonDays: 60,
    monitorUrls: ['https://diecezjaplocka.pl', 'https://plock.gosc.pl'],
    autoDraft: false
  },
  calendar: {
    ranks: { uroczystosc: true, swieto: true, wspomnienie: true, niedziela: true, okres: true, okazja: true, parafialne: true, wydarzenie: true }
  },
  ui: { theme: 'system' }
};

const DEFAULT_DATA = {
  version: 1,
  settings: DEFAULT_SETTINGS,
  customPresets: [],
  assets: [], // { id, name, file, role, aspect, addedAt }
  events: [], // wydarzenia dodane ręcznie { id, date, name, presetId, note }
  onlineEvents: [], // z internetu { id, date, name, description, url, presetId, foundAt, hidden }
  proposals: {}, // key -> { status: 'new'|'done'|'dismissed', at, posterId }
  onlineCheckedAt: null,
  agentLog: [],
  notified: {}
};

function deepMerge(base, extra) {
  if (Array.isArray(base)) return Array.isArray(extra) ? extra : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
      for (const k of Object.keys(extra)) {
        out[k] = k in base ? deepMerge(base[k], extra[k]) : extra[k];
      }
    }
    return out;
  }
  return extra === undefined ? base : extra;
}

class Store {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'plakaty-dane.json');
    this.postersDir = path.join(dir, 'plakaty');
    this.assetsDir = path.join(dir, 'zasoby');
    fs.mkdirSync(this.postersDir, { recursive: true });
    fs.mkdirSync(this.assetsDir, { recursive: true });
    this.data = this._load();
    this.listeners = new Set();
  }

  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return deepMerge(DEFAULT_DATA, raw);
    } catch (e) {
      if (fs.existsSync(this.file)) {
        try { fs.copyFileSync(this.file, this.file + '.uszkodzony-' + Date.now()); } catch (_) { /* ignore */ }
      }
      return JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
  }

  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
    for (const fn of this.listeners) { try { fn(); } catch (_) { /* ignore */ } }
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  get settings() { return this.data.settings; }

  updateSettings(patch) {
    this.data.settings = deepMerge(this.data.settings, patch);
    this.save();
    return this.data.settings;
  }

  log(type, message, extra) {
    this.data.agentLog.unshift({ at: new Date().toISOString(), type, message, ...(extra || {}) });
    this.data.agentLog = this.data.agentLog.slice(0, 200);
    this.save();
  }

  // ── plakaty (każdy w osobnym pliku JSON) ──
  _posterFile(id) {
    if (!/^[a-z0-9_-]+$/i.test(id)) throw new Error('Nieprawidłowy identyfikator plakatu.');
    return path.join(this.postersDir, id + '.json');
  }

  listPosters() {
    const out = [];
    for (const f of fs.readdirSync(this.postersDir)) {
      if (!f.endsWith('.json')) continue;
      try { out.push(JSON.parse(fs.readFileSync(path.join(this.postersDir, f), 'utf8'))); } catch (_) { /* pomiń uszkodzony */ }
    }
    return out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  getPoster(id) { return JSON.parse(fs.readFileSync(this._posterFile(id), 'utf8')); }

  savePoster(p) {
    p.updatedAt = new Date().toISOString();
    if (!p.createdAt) p.createdAt = p.updatedAt;
    const f = this._posterFile(p.id);
    fs.writeFileSync(f + '.tmp', JSON.stringify(p), 'utf8');
    fs.renameSync(f + '.tmp', f);
    return p;
  }

  deletePoster(id) {
    const f = this._posterFile(id);
    const bin = path.join(this.dir, 'kosz');
    fs.mkdirSync(bin, { recursive: true });
    if (fs.existsSync(f)) fs.renameSync(f, path.join(bin, id + '.json'));
  }
}

module.exports = { Store, DEFAULT_SETTINGS, deepMerge };
