'use strict';
// Usługa plakatów: zasoby graficzne parafii, budowa plakatu z presetu i treści, kody QR, warianty.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Poster = require('../shared/poster');
const Presets = require('../shared/presets');

const BRAND_DIR = path.join(__dirname, '..', 'assets', 'brand');
const BUILT_IN_ASSETS = [
  { id: 'brand:logo', name: 'Logo parafii (z nazwą, przezroczyste tło)', file: 'logo.png', role: 'logo', aspect: 0.8214 },
  { id: 'brand:herb', name: 'Emblemat – kościół (bez napisu)', file: 'herb-kosciol.png', role: 'emblemat', aspect: 0.9417 },
  { id: 'brand:logo-karta', name: 'Logo na kremowej karcie', file: 'logo-karta.jpg', role: 'logo', aspect: 0.8143 },
  { id: 'brand:mb1', name: 'Obraz Matki Bożej w sanktuarium (1)', file: 'mb-czestochowska-1.jpg', role: 'zdjecie', aspect: 1.3238 },
  { id: 'brand:mb2', name: 'Obraz Matki Bożej w sanktuarium (2)', file: 'mb-czestochowska-2.jpg', role: 'zdjecie', aspect: 1.3654 },
  { id: 'brand:sanktuarium', name: 'Kościół – widok od bramy', file: 'sanktuarium.jpg', role: 'zdjecie', aspect: 0.8193 }
].map((a) => ({ ...a, builtIn: true }));

const ROLES = { logo: 'Logo', emblemat: 'Emblemat / herb', zdjecie: 'Zdjęcie', motyw: 'Motyw / grafika', tlo: 'Tło' };

class Assets {
  constructor(store) { this.store = store; }

  list() {
    const hidden = new Set(this.store.data.hiddenAssets || []);
    return [...BUILT_IN_ASSETS.filter((a) => !hidden.has(a.id)), ...this.store.data.assets.map((a) => ({ ...a, builtIn: false }))];
  }

  byId(id) { return this.list().find((a) => a.id === id) || BUILT_IN_ASSETS.find((a) => a.id === id) || null; }

  filePath(id) {
    const b = BUILT_IN_ASSETS.find((a) => a.id === id);
    if (b) return path.join(BRAND_DIR, b.file);
    const u = this.store.data.assets.find((a) => a.id === id);
    if (!u) return null;
    const f = path.join(this.store.assetsDir, path.basename(u.file));
    return fs.existsSync(f) ? f : null;
  }

  add({ name, data, mediaType, role, aspect }) {
    if (!data) throw new Error('Brak pliku.');
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' }[mediaType] || 'png';
    const id = 'user:' + crypto.randomBytes(6).toString('hex');
    const file = id.slice(5) + '.' + ext;
    fs.writeFileSync(path.join(this.store.assetsDir, file), Buffer.from(data, 'base64'));
    const a = { id, name: String(name || 'Grafika').slice(0, 120), file, role: ROLES[role] ? role : 'zdjecie', aspect: Number(aspect) || 1, addedAt: new Date().toISOString() };
    this.store.data.assets.push(a);
    this.store.save();
    return a;
  }

  update(id, patch) {
    const a = this.store.data.assets.find((x) => x.id === id);
    if (!a) throw new Error('Wbudowanych zasobów nie można edytować – możesz je ukryć.');
    if (patch.name != null) a.name = String(patch.name).slice(0, 120);
    if (patch.role && ROLES[patch.role]) a.role = patch.role;
    this.store.save();
    return a;
  }

  remove(id) {
    if (id.startsWith('brand:')) {
      this.store.data.hiddenAssets = [...new Set([...(this.store.data.hiddenAssets || []), id])];
      this.store.save();
      return true;
    }
    const i = this.store.data.assets.findIndex((x) => x.id === id);
    if (i < 0) return false;
    const [a] = this.store.data.assets.splice(i, 1);
    try { fs.unlinkSync(path.join(this.store.assetsDir, path.basename(a.file))); } catch (_) { /* brak */ }
    this.store.save();
    return true;
  }

  restoreBuiltIn() { this.store.data.hiddenAssets = []; this.store.save(); return true; }

  aspects() {
    const out = {};
    for (const a of this.list()) out[a.id] = { aspect: a.aspect };
    for (const a of BUILT_IN_ASSETS) out[a.id] = { aspect: a.aspect };
    return out;
  }
}

function footerFrom(settings) {
  const p = settings.parish;
  if (!settings.poster.autoFooter) return '';
  const map = { nazwa: p.name, miejscowosc: p.place, adres: p.address, telefon: p.phone ? 'tel. ' + p.phone : '', www: p.website, email: p.email, facebook: p.facebook, proboszcz: p.pastor, sanktuarium: p.sanctuary, konto: p.bankAccount ? 'konto: ' + p.bankAccount : '' };
  const t = String(settings.poster.footerTemplate || '').replace(/\{(\w+)\}/g, (_, k) => map[k] || '');
  return t.split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean).join('  ·  ');
}

function brandFor(settings, assets) {
  return {
    assets: assets.aspects(),
    logoId: settings.poster.logoId || 'brand:logo',
    emblemId: settings.poster.emblemId || 'brand:herb',
    parishLine: `${settings.parish.name} ${settings.parish.place}`.trim(),
    footer: footerFrom(settings)
  };
}

async function qrSvg(data) {
  if (!data) return '';
  const QR = require('qrcode');
  const svg = await QR.toString(String(data), { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff00' } });
  return svg.replace(/#000000/g, 'currentColor').replace(/<path fill="#ffffff00"[^>]*\/>/g, '').replace(/<path fill="#ffffff"[^>]*\/>/g, '');
}

async function fillQr(poster) {
  for (const e of poster.elements) if (e.type === 'qr' && e.qr.data && !e.qr.svg) e.qr.svg = await qrSvg(e.qr.data);
  return poster;
}

function presetById(store, id) {
  return Presets.byId(id, store.data.customPresets) || Presets.byId('ogloszenie');
}

// Kolejność alternatywnych układów dla wariantów
function variantLayouts(first, content) {
  const order = [first, 'klasyczny', 'ramka', 'obraz', 'harmonogram'];
  const out = [];
  for (const l of order) {
    if (!l || out.includes(l)) continue;
    if (l === 'obraz' && !content.imageId) continue;
    if (l === 'harmonogram' && !(content.schedule && content.schedule.length) && first !== 'harmonogram') continue;
    out.push(l);
  }
  return out;
}

async function buildPosters({ store, assets, preset, content, styleOverride = {}, formatId, variants = 1, meta = {} }) {
  const settings = store.settings;
  const format = Poster.FORMATS[formatId] || Poster.FORMATS[settings.poster.defaultFormat] || Poster.FORMATS.a4;
  const baseStyle = Object.assign({}, preset.style, Object.fromEntries(Object.entries(styleOverride).filter(([, v]) => v != null)));
  const brand = brandFor(settings, assets);
  const c = Object.assign({ showLogo: preset.showLogo !== false && settings.poster.showLogo !== false }, content);
  if (c.qr === undefined && settings.poster.qrDefault && settings.poster.qrUrl) c.qr = settings.poster.qrUrl;
  const layouts = variantLayouts(baseStyle.layout, c).slice(0, Math.max(1, Math.min(4, variants)));
  const out = [];
  for (const l of layouts) {
    const p = Poster.layout({ content: c, style: Object.assign({}, baseStyle, { layout: l }), format, formatId: formatId || settings.poster.defaultFormat, brand });
    p.presetId = preset.id;
    p.meta = Object.assign({}, meta);
    p.name = c.title || preset.name;
    await fillQr(p);
    out.push(p);
  }
  return out;
}

// Nowy układ z zachowaniem treści i stylu (np. po zmianie formatu lub układu)
async function relayout({ store, assets, poster, layoutId, formatId }) {
  const settings = store.settings;
  const format = formatId ? Poster.FORMATS[formatId] : { w: poster.format.w, h: poster.format.h };
  const style = Object.assign({}, poster.style, layoutId ? { layout: layoutId } : {});
  const p = Poster.layout({ content: poster.content, style, format, formatId: formatId || poster.format.id, brand: brandFor(settings, assets) });
  p.id = poster.id;
  p.createdAt = poster.createdAt;
  p.presetId = poster.presetId;
  p.meta = poster.meta;
  p.name = poster.name;
  if (poster.background && poster.background.imageAssetId) p.background.imageAssetId = poster.background.imageAssetId;
  if (poster.frame && poster.frame.style) p.frame.style = poster.frame.style;
  await fillQr(p);
  return p;
}

module.exports = { Assets, BUILT_IN_ASSETS, ROLES, brandFor, footerFrom, qrSvg, fillQr, buildPosters, relayout, presetById, variantLayouts };
