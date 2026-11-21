'use strict';
// Zadania AI: treść plakatu, poprawki poleceniem, wyszukiwanie wydarzeń parafii i diecezji w internecie.

const { extractJson } = require('./providers');
const Poster = require('../../shared/poster');
const { longDate, iso } = require('../liturgy');

const clip = (s, n) => String(s == null ? '' : s).replace(/\s+\n/g, '\n').trim().slice(0, n);

function parishText(p) {
  return [
    `${p.name} ${p.place}`.trim(),
    p.sanctuary ? `Przy parafii: ${p.sanctuary}` : '',
    p.diocese ? `Diecezja: ${p.diocese}` : '',
    p.address ? `Adres: ${p.address}` : '',
    p.pastor ? `Proboszcz: ${p.pastor}` : '',
    p.massSunday ? `Msze Święte w niedziele: ${p.massSunday}` : '',
    p.massWeekday ? `Msze Święte w dni powszednie: ${p.massWeekday}` : '',
    p.office ? `Kancelaria: ${p.office}` : '',
    p.phone ? `Telefon: ${p.phone}` : '',
    p.website ? `Strona: ${p.website}` : '',
    p.bankAccount ? `Konto parafii: ${p.bankAccount}` : ''
  ].filter(Boolean).join('\n');
}

const SYSTEM = `Jesteś doświadczonym redaktorem i grafikiem przygotowującym plakaty i ogłoszenia dla katolickiej parafii w Polsce.
Piszesz poprawną polszczyzną, zgodnie z terminologią liturgiczną Kościoła katolickiego i polskimi zwyczajami.
Zasady:
- Pisownia z szacunkiem: Msza Święta, Najświętszy Sakrament, Pan Jezus, Matka Boża, Najświętsza Maryja Panna, Duch Święty, Ewangelia, Eucharystia.
- Teksty krótkie i czytelne z daleka: tytuł do ok. 6 słów, podtytuł 1 zdanie, treść 1–3 krótkie zdania.
- NIE wymyślaj faktów: godzin, dat, nazwisk, kwot, kaznodziejów. Używaj wyłącznie danych od użytkownika i danych parafii. Brakujące informacje wypisz w polu "missing" – nie wstawiaj zgadywanych wartości.
- Cytat z Pisma Świętego tylko dobrze znany, dosłownie według Biblii Tysiąclecia, z poprawną sygnaturą (np. "J 1,14"). Jeśli nie masz pewności – pole "quote" ustaw na null.
- Daty pisz po polsku, np. "niedziela, 25 lipca 2027 r.", godziny w formacie 24-godzinnym ("18:00").
- Harmonogram ("schedule") tylko wtedy, gdy jest kilka punktów programu lub terminów.`;

function catalog(assets) {
  return {
    palettes: Object.entries(Poster.PALETTES).map(([id, p]) => `${id} – ${p.label}`).join('\n'),
    motifs: Object.entries(Poster.MOTIFS).filter(([id]) => !id.startsWith('linia')).map(([id, m]) => `${id} – ${m.label}`).join('\n'),
    layouts: Object.entries(Poster.LAYOUTS).map(([id, l]) => `${id} – ${l}`).join('\n'),
    images: assets.filter((a) => a.role !== 'logo' && a.role !== 'emblemat').map((a) => `${a.id} – ${a.name}`).join('\n')
  };
}

const JSON_SHAPE = `{
  "title": "tytuł",
  "subtitle": "podtytuł lub pusty tekst",
  "dateText": "data słownie lub pusty tekst",
  "timeText": "godzina/godziny lub pusty tekst",
  "placeText": "miejsce lub pusty tekst",
  "body": "krótka treść (możesz użyć **pogrubienia**)",
  "schedule": [{ "when": "18:00", "what": "Msza Święta" }],
  "quote": { "text": "cytat", "source": "J 1,14" },
  "closing": "krótkie zaproszenie lub życzenie",
  "layout": "id układu",
  "palette": "id palety",
  "motif": "id motywu",
  "image": "id obrazu lub null",
  "missing": ["czego brakuje do pełnej informacji"],
  "notes": "krótka uwaga dla pracownika kancelarii (opcjonalnie)"
}`;

function normalizeContent(j, assets, fallback = {}) {
  const ids = new Set(assets.map((a) => a.id));
  const sched = Array.isArray(j.schedule) ? j.schedule : [];
  const quote = j.quote && typeof j.quote === 'object' && j.quote.text ? { text: clip(j.quote.text, 300), source: clip(j.quote.source, 40) } : null;
  return {
    content: {
      title: clip(j.title, 140) || fallback.title || 'Ogłoszenie',
      subtitle: clip(j.subtitle, 200),
      dateText: clip(j.dateText, 120),
      timeText: clip(j.timeText, 160),
      placeText: clip(j.placeText, 160),
      body: clip(j.body, 900),
      schedule: sched.slice(0, 16).map((s) => ({ when: clip(s && s.when, 40), what: clip(s && s.what, 160) })).filter((s) => s.when || s.what),
      quote,
      closing: clip(j.closing, 160),
      imageId: j.image && ids.has(j.image) ? j.image : (j.image === null ? null : fallback.imageId || null)
    },
    style: {
      layout: Poster.LAYOUTS[j.layout] ? j.layout : null,
      paletteId: Poster.PALETTES[j.palette] ? j.palette : null,
      motif: Poster.MOTIFS[j.motif] ? j.motif : null
    },
    missing: (Array.isArray(j.missing) ? j.missing : []).map((m) => clip(m, 160)).filter(Boolean).slice(0, 8),
    notes: clip(j.notes, 400)
  };
}

async function generatePosterContent(provider, { brief, preset, parish, ai, assets, webSearch, today = new Date() }) {
  const cat = catalog(assets);
  const occ = brief.occasion;
  const prompt = `Dzisiaj jest ${longDate(iso(today))}.

DANE PARAFII:
${parishText(parish)}

PRESET (temat plakatu): ${preset.name}
Wskazówki presetu: ${preset.aiHints || '—'}
Domyślny tytuł presetu: ${preset.defaults.title || '—'}; domyślne zakończenie: ${preset.defaults.closing || '—'}
${preset.defaults.quote ? `Proponowany cytat: „${preset.defaults.quote.text}” (${preset.defaults.quote.source})` : ''}

${occ && occ.name ? `OKAZJA: ${occ.name} – ${occ.date ? longDate(occ.date) : ''}${occ.note ? ` (${occ.note})` : ''}` : occ && occ.date ? `DZIEŃ WYDARZENIA: ${longDate(occ.date)}` : ''}

INFORMACJE OD PRACOWNIKA KANCELARII (najważniejsze – użyj ich dokładnie):
${brief.title ? `Tytuł: ${brief.title}\n` : ''}${brief.dateText ? `Data: ${brief.dateText}\n` : ''}${brief.timeText ? `Godzina: ${brief.timeText}\n` : ''}${brief.placeText ? `Miejsce: ${brief.placeText}\n` : ''}${brief.details ? `Szczegóły:\n${brief.details}\n` : ''}
Styl i ton: ${ai.tone || 'uroczysty, ciepły'}
${ai.extraInstructions ? `Dodatkowe zalecenia parafii: ${ai.extraInstructions}` : ''}

Dobierz też wygląd (wybierz identyfikatory z list):
UKŁADY:
${cat.layouts}
PALETY:
${cat.palettes}
MOTYWY:
${cat.motifs}
OBRAZY PARAFII (pole "image"; null = bez zdjęcia):
${cat.images || '(brak)'}
Preferowane ustawienia presetu: układ ${preset.style.layout}, paleta ${preset.style.paletteId}, motyw ${preset.style.motif}${preset.imageId ? `, obraz ${preset.imageId}` : ''}. Zmieniaj je tylko, jeśli treść tego wymaga.

Zwróć WYŁĄCZNIE obiekt JSON w bloku \`\`\`json:
${JSON_SHAPE}`;
  const res = await provider.run({ system: SYSTEM, prompt, webSearch: !!webSearch, maxTokens: 4000 });
  return normalizeContent(extractJson(res.text), assets, { title: brief.title || preset.defaults.title, imageId: preset.imageId });
}

async function refinePosterContent(provider, { poster, instruction, parish, ai, assets }) {
  const cat = catalog(assets);
  const c = poster.content || {};
  const prompt = `DANE PARAFII:
${parishText(parish)}

OBECNA TREŚĆ PLAKATU (JSON):
${JSON.stringify({ title: c.title, subtitle: c.subtitle, dateText: c.dateText, timeText: c.timeText, placeText: c.placeText, body: c.body, schedule: c.schedule, quote: c.quote, closing: c.closing, image: c.imageId || null }, null, 1)}
Obecny wygląd: układ ${poster.style.layout}, paleta ${poster.style.paletteId}, motyw ${poster.style.motif}.

POLECENIE PRACOWNIKA KANCELARII:
${instruction}

Wprowadź tylko zmiany wynikające z polecenia; resztę zostaw bez zmian. Styl: ${ai.tone || ''}.
Możliwe układy: ${Object.keys(Poster.LAYOUTS).join(', ')}
Możliwe palety:
${cat.palettes}
Możliwe motywy: ${Object.keys(Poster.MOTIFS).filter((m) => !m.startsWith('linia')).join(', ')}
Obrazy: ${assets.filter((a) => a.role !== 'logo' && a.role !== 'emblemat').map((a) => a.id).join(', ')}

Zwróć WYŁĄCZNIE pełny obiekt JSON (wszystkie pola, także niezmienione) w bloku \`\`\`json:
${JSON_SHAPE.replace('"notes": "krótka uwaga dla pracownika kancelarii (opcjonalnie)"', '"notes": "co zmieniono – jedno zdanie"')}`;
  const res = await provider.run({ system: SYSTEM, prompt, maxTokens: 4000 });
  const j = extractJson(res.text);
  const out = normalizeContent(j, assets, { title: c.title, imageId: c.imageId });
  // jeśli model nie zmienił stylu – nie traktuj tego jako zmiany
  if (out.style.layout === poster.style.layout) out.style.layout = null;
  if (out.style.paletteId === poster.style.paletteId) out.style.paletteId = null;
  if (out.style.motif === poster.style.motif) out.style.motif = null;
  return out;
}

const EVENTS_SYSTEM = `Jesteś asystentem kancelarii parafialnej. Wyszukujesz w internecie zapowiedzi wydarzeń, które dotyczą konkretnej parafii, jej sanktuarium, dekanatu lub diecezji (uroczystości, odpusty, pielgrzymki, wizytacje biskupa, rekolekcje, koncerty, zbiórki, peregrynacje, jubileusze, nabożeństwa diecezjalne).
Podawaj tylko wydarzenia z konkretną datą w zadanym okresie i tylko takie, które znalazłeś w źródłach. Nie wymyślaj.`;

async function lookupEvents(provider, { parish, from, to, pages = [], webSearch = true }) {
  const pagesText = pages.filter((p) => p.text).map((p) => `--- ŹRÓDŁO: ${p.url}\n${p.text.slice(0, 9000)}`).join('\n\n');
  const prompt = `Parafia:
${parishText(parish)}

Okres: od ${longDate(from)} do ${longDate(to)}.
${webSearch ? 'Wyszukaj w internecie zapowiedzi wydarzeń dla tej parafii, sanktuarium i diecezji.' : 'Nie korzystaj z wyszukiwarki – przeanalizuj wyłącznie poniższe teksty stron.'}
${pagesText ? `\nTreść monitorowanych stron (fragmenty):\n${pagesText}\n` : ''}
Pomiń zwykłe święta z kalendarza liturgicznego (np. Boże Narodzenie, Wszystkich Świętych) – one są już w aplikacji. Interesują nas wydarzenia lokalne i diecezjalne.
Do każdego wydarzenia dobierz preset plakatu: odpust, maryjne, pielgrzymka, koncert, festyn, rekolekcje, komunia, bierzmowanie, adoracja, zbiorka, dozynki, ogloszenie.

Zwróć WYŁĄCZNIE JSON w bloku \`\`\`json:
{ "events": [ { "date": "RRRR-MM-DD", "name": "nazwa wydarzenia", "description": "1–2 zdania: co, gdzie, dla kogo", "url": "adres źródła", "preset": "id presetu", "relevance": "parafia|dekanat|diecezja" } ] }`;
  const res = await provider.run({ system: EVENTS_SYSTEM, prompt, webSearch, maxTokens: 4000 });
  const j = extractJson(res.text);
  const list = Array.isArray(j.events) ? j.events : Array.isArray(j) ? j : [];
  return list
    .map((e) => ({
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(e.date)) ? e.date : null,
      name: clip(e.name, 160),
      description: clip(e.description, 400),
      url: /^https?:\/\//.test(String(e.url || '')) ? String(e.url).slice(0, 400) : '',
      presetId: clip(e.preset, 40) || 'ogloszenie',
      relevance: clip(e.relevance, 20)
    }))
    .filter((e) => e.date && e.name && e.date >= from && e.date <= to)
    .slice(0, 30);
}

// Zamiana HTML strony na zwykły tekst (do monitorowania stron parafii/diecezji)
function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

module.exports = { generatePosterContent, refinePosterContent, lookupEvents, normalizeContent, htmlToText, parishText };
