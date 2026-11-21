'use strict';
// Testy logiki bez Electrona: node test/run-tests.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { Liturgy, easter, adventStart, iso } = require('../src/main/liturgy');
const { Store } = require('../src/main/store');
const { extractJson } = require('../src/main/ai/providers');
const { normalizeContent, htmlToText, generatePosterContent, refinePosterContent, lookupEvents } = require('../src/main/ai/tasks');
const { Assets, buildPosters, footerFrom, variantLayouts } = require('../src/main/posters');
const { planSheet } = require('../src/main/sheet-plan');
const Poster = require('../src/shared/poster');
const Presets = require('../src/shared/presets');

let passed = 0;
const t = (name, fn) => Promise.resolve().then(fn).then(() => { passed++; console.log('✓', name); }, (e) => { console.error('✗', name, '\n ', e.stack); process.exitCode = 1; });
const tmpStore = () => new Store(fs.mkdtempSync(path.join(os.tmpdir(), 'plakaty-test-')));

(async () => {
  await t('Wielkanoc i Adwent', () => {
    assert.strictEqual(iso(easter(2026)), '2026-04-05');
    assert.strictEqual(iso(easter(2027)), '2027-03-28');
    assert.strictEqual(iso(adventStart(2026)), '2026-11-29');
    assert.strictEqual(iso(adventStart(2027)), '2027-11-28');
  });

  await t('Kalendarz liturgiczny 2027', () => {
    const L = new Liturgy(tmpStore());
    const list = L.inRange('2027-01-01', '2027-12-31');
    const on = (d) => list.filter((o) => o.date === d).map((o) => o.name).join(' | ');
    assert(/Popielcowa/.test(on('2027-02-10')), 'Popielec');
    assert(/Boże Ciało/.test(on('2027-05-27')), 'Boże Ciało');
    assert(/Zesłanie/.test(on('2027-05-16')), 'Zesłanie');
    assert(/Odpust parafialny/.test(on('2027-07-25')), 'odpust parafialny');
    assert(/Chrystusa, Króla/.test(on('2027-11-21')), 'Chrystus Król');
    assert(/Świętej Rodziny/.test(on('2027-12-26')), 'Święta Rodzina (niedziela 26.12)');
    assert(/Dzień Papieski/.test(on('2027-10-10')), 'Dzień Papieski');
    assert.strictEqual(L.seasonOf('2027-03-10').name, 'Wielki Post');
    assert.strictEqual(L.seasonOf('2026-12-01').name, 'Adwent');
  });

  await t('Propozycje plakatów z wyprzedzeniem', () => {
    const L = new Liturgy(tmpStore());
    const due = L.dueForPoster(new Date(2027, 6, 1), 60).map((o) => o.name);
    assert(due.some((n) => /Odpust parafialny/.test(n)), 'odpust 30 dni wcześniej');
    assert(!due.some((n) => /Wniebowzięcie/.test(n)), 'Wniebowzięcie jeszcze za wcześnie (21 dni)');
  });

  await t('Wydarzenia własne i z internetu w kalendarzu', () => {
    const s = tmpStore();
    s.data.events.push({ id: 'a', date: '2027-03-03', name: 'Wizytacja biskupa', presetId: 'ogloszenie' });
    s.data.onlineEvents.push({ id: 'b', date: '2027-03-05', name: 'Pielgrzymka mężczyzn', presetId: 'pielgrzymka' });
    const L = new Liturgy(s);
    const names = L.inRange('2027-03-01', '2027-03-06').map((o) => o.name);
    assert(names.includes('Wizytacja biskupa') && names.includes('Pielgrzymka mężczyzn'));
  });

  await t('Presety są kompletne', () => {
    const ids = new Set();
    for (const p of Presets.LIST) {
      assert(!ids.has(p.id), 'duplikat ' + p.id); ids.add(p.id);
      assert(/^[a-z0-9-]+$/.test(p.id), 'id ascii: ' + p.id);
      assert(Poster.PALETTES[p.style.paletteId], 'paleta ' + p.id);
      assert(Poster.MOTIFS[p.style.motif], 'motyw ' + p.id);
      assert(Poster.LAYOUTS[p.style.layout], 'układ ' + p.id);
      assert(Presets.CATEGORIES[p.category], 'kategoria ' + p.id);
      for (const f of Object.values(p.style.fonts)) assert(Poster.FONTS[f], 'czcionka ' + f);
    }
    const L = new Liturgy(tmpStore());
    for (const o of L.yearList(2027)) assert(Presets.byId(o.presetId), 'preset okazji ' + o.presetId + ' (' + o.name + ')');
  });

  await t('Układ plakatu mieści się na stronie (wszystkie presety i formaty)', () => {
    const brand = { assets: { 'brand:logo': { aspect: 0.82 }, 'brand:herb': { aspect: 0.94 }, 'brand:sanktuarium': { aspect: 0.82 }, 'brand:mb1': { aspect: 1.32 }, 'brand:mb2': { aspect: 1.36 } }, parishLine: 'Parafia pw. św. Jakuba Apostoła w Koziebrodach', footer: 'Koziebrody · tel. 000' };
    const content = { title: 'Uroczystość odpustowa ku czci św. Jakuba', subtitle: 'Zapraszamy', dateText: 'niedziela, 25 lipca 2027 r.', timeText: '11:30', placeText: 'kościół', body: 'Tekst '.repeat(40), schedule: [{ when: '10:00', what: 'Różaniec' }, { when: '11:30', what: 'Suma' }], quote: { text: 'Cytat', source: 'J 1,1' }, closing: 'Zapraszamy!', qr: 'https://example.pl' };
    for (const p of Presets.LIST) {
      for (const [fid, f] of Object.entries(Poster.FORMATS)) {
        const poster = Poster.layout({ content: Object.assign({}, content, { imageId: p.imageId, showLogo: p.showLogo }), style: p.style, format: f, brand });
        for (const e of poster.elements) {
          assert(e.x >= -0.5 && e.y >= -0.5 && e.x + e.w <= f.w + 0.5 && e.y + e.h <= f.h + 0.5, `${p.id}/${fid}: ${e.role} poza stroną (${e.x.toFixed(1)},${e.y.toFixed(1)},${e.w.toFixed(1)},${e.h.toFixed(1)})`);
        }
        assert(poster.elements.some((e) => e.role === 'title'), 'brak tytułu ' + p.id);
      }
    }
  });

  await t('Zmiana palety, czcionek i treści w miejscu', () => {
    const p = Poster.layout({ content: { title: 'A', body: 'B', closing: 'C' }, style: Presets.byId('odpust').style, format: Poster.FORMATS.a4, brand: { parishLine: 'P', footer: '' } });
    const r = Poster.recolor(p, 'fiolet');
    assert.strictEqual(r.elements.find((e) => e.role === 'title').text.color, Poster.PALETTES.fiolet.title);
    assert.strictEqual(r.background.color, Poster.PALETTES.fiolet.bg);
    const f = Poster.refont(p, { heading: 'playfair' });
    assert.strictEqual(f.elements.find((e) => e.role === 'title').text.font, 'playfair');
    const c = Poster.applyContent(p, { title: 'Nowy tytuł', body: '' });
    assert.strictEqual(c.elements.find((e) => e.role === 'title').text.content, 'Nowy tytuł');
    assert(!c.elements.find((e) => e.role === 'body'), 'pusty tekst usuwa element');
    assert.strictEqual(Poster.applyContent(p, { timeText: '18:00' }), null, 'nowe pole wymaga nowego układu');
  });

  await t('Odczyt i normalizacja odpowiedzi AI', () => {
    const j = extractJson('Oto:\n```json\n{"title":"Roraty","schedule":[{"when":"6:30","what":"Msza"}],"palette":"fiolet","layout":"zly","image":"brand:mb1","quote":{"text":"x","source":"Mk 1,3"}}\n```');
    const assets = [{ id: 'brand:mb1', name: 'MB', role: 'zdjecie' }];
    const n = normalizeContent(j, assets);
    assert.strictEqual(n.content.title, 'Roraty');
    assert.strictEqual(n.style.paletteId, 'fiolet');
    assert.strictEqual(n.style.layout, null);
    assert.strictEqual(n.content.imageId, 'brand:mb1');
    assert.strictEqual(normalizeContent({ title: 'x', image: 'brand:nieznany' }, assets).content.imageId, null);
  });

  await t('Zadania AI z atrapą dostawcy', async () => {
    const calls = [];
    const fake = (reply) => ({ run: async (o) => { calls.push(o); return { text: '```json\n' + JSON.stringify(reply) + '\n```' }; } });
    const s = tmpStore();
    const preset = Presets.byId('odpust');
    const assets = new Assets(s).list().map((a) => ({ id: a.id, name: a.name, role: a.role }));
    const g = await generatePosterContent(fake({ title: 'Odpust parafialny', dateText: 'niedziela, 25 lipca 2027 r.', layout: 'klasyczny', palette: 'bordo-zloto', motif: 'muszla', image: 'brand:sanktuarium', missing: ['godzina sumy'] }), { brief: { details: 'suma o 11:30' }, preset, parish: s.settings.parish, ai: s.settings.ai, assets });
    assert.strictEqual(g.content.imageId, 'brand:sanktuarium');
    assert.deepStrictEqual(g.missing, ['godzina sumy']);
    assert(/Koziebrod/.test(calls[0].prompt) && /suma o 11:30/.test(calls[0].prompt));
    const poster = Poster.layout({ content: g.content, style: preset.style, format: Poster.FORMATS.a4, brand: { parishLine: 'P' } });
    const r = await refinePosterContent(fake(Object.assign({}, g.content, { title: 'Odpust 2027', layout: 'klasyczny', palette: 'blekit' })), { poster, instruction: 'zmień tytuł', parish: s.settings.parish, ai: s.settings.ai, assets });
    assert.strictEqual(r.content.title, 'Odpust 2027');
    assert.strictEqual(r.style.layout, null, 'ten sam układ nie jest zmianą');
    assert.strictEqual(r.style.paletteId, 'blekit');
    const ev = await lookupEvents(fake({ events: [{ date: '2027-03-05', name: 'Pielgrzymka', preset: 'pielgrzymka', url: 'https://x.pl' }, { date: 'zła', name: 'X' }, { date: '2030-01-01', name: 'Poza zakresem' }] }), { parish: s.settings.parish, from: '2027-03-01', to: '2027-04-30', pages: [{ url: 'https://a', text: 'abc' }] });
    assert.strictEqual(ev.length, 1);
    assert.strictEqual(ev[0].presetId, 'pielgrzymka');
  });

  await t('Budowa plakatów z presetu (warianty, stopka, kod QR)', async () => {
    const s = tmpStore();
    s.updateSettings({ parish: { phone: '23 000 00 00', website: 'https://parafia.example.pl' } });
    assert(/tel\. 23 000 00 00/.test(footerFrom(s.settings)));
    assert.deepStrictEqual(variantLayouts('klasyczny', { imageId: 'x', schedule: [] }), ['klasyczny', 'ramka', 'obraz']);
    const posters = await buildPosters({ store: s, assets: new Assets(s), preset: Presets.byId('festyn'), content: { title: 'Festyn', schedule: [{ when: '15:00', what: 'Loteria' }], qr: 'https://parafia.example.pl' }, formatId: 'a4', variants: 3 });
    assert.strictEqual(posters.length, 3);
    const qr = posters[0].elements.find((e) => e.type === 'qr');
    assert(qr && /<svg/.test(qr.qr.svg) && /currentColor/.test(qr.qr.svg), 'kod QR jako SVG');
    s.savePoster(posters[0]);
    assert.strictEqual(s.listPosters().length, 1);
    s.deletePoster(posters[0].id);
    assert.strictEqual(s.listPosters().length, 0);
  });

  await t('Plan arkusza (druk kilku plakatów na kartce)', () => {
    const a5 = { format: { w: 148, h: 210 } };
    const one = planSheet({ format: { w: 210, h: 297 } }, {});
    assert.strictEqual(one.paper.name, 'A4');
    assert(Math.abs(one.cells[0].scale - 1) < 1e-9);
    const two = planSheet(a5, { nup: 2 });
    assert.strictEqual(two.cells.length, 2);
    assert(two.paper.w > two.paper.h, 'dwa A5 na poziomej A4');
    const exp = planSheet({ format: { w: 200, h: 200 } }, { forExport: true });
    assert.strictEqual(exp.paper.w, 200);
    assert.strictEqual(planSheet(a5, { nup: 8 }).cells.length, 8);
  });

  await t('Tekst ze strony HTML', () => {
    const txt = htmlToText('<html><script>x()</script><h1>Odpust</h1><p>25&nbsp;lipca &amp; procesja</p></html>');
    assert(/Odpust/.test(txt) && /25 lipca & procesja/.test(txt) && !/x\(\)/.test(txt));
  });

  console.log(`\n${passed} testów zaliczonych`);
})();
