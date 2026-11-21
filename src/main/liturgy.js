'use strict';
// Kalendarz liturgiczny Kościoła w Polsce (najważniejsze dni) + święta parafii + wydarzenia własne i z internetu.
// Liczony lokalnie – działa bez internetu. Agent uzupełnia go wydarzeniami znalezionymi w sieci.

const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const longDate = (s) => { const d = parseIso(s); return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`; };

function easter(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// pierwsza niedziela adwentu: czwarta niedziela przed 25 grudnia
function adventStart(year) {
  const xmas = new Date(year, 11, 25);
  const back = xmas.getDay() === 0 ? 7 : xmas.getDay();
  return addDays(xmas, -back - 21);
}
const sundayOnOrBefore = (d) => addDays(d, -d.getDay());
const sundayAfter = (d) => addDays(d, 7 - d.getDay());

// rank: uroczystosc | swieto | wspomnienie | niedziela | okres | okazja | parafialne | wydarzenie
// color: bialy | czerwony | fioletowy | zielony | rozowy | zloty
const LEAD = { uroczystosc: 21, swieto: 14, wspomnienie: 7, niedziela: 10, okres: 21, okazja: 14, parafialne: 30, wydarzenie: 21 };

// [MM-DD, nazwa, ranga, kolor, preset, propozycja plakatu, uwaga]
const FIXED = [
  ['01-01', 'Uroczystość Świętej Bożej Rodzicielki Maryi', 'uroczystosc', 'bialy', 'boze-narodzenie', false, 'Nowy Rok · Światowy Dzień Pokoju · święto nakazane'],
  ['01-06', 'Objawienie Pańskie (Trzech Króli)', 'uroczystosc', 'bialy', 'boze-narodzenie', true, 'Święto nakazane · poświęcenie kredy i kadzidła'],
  ['01-21', 'Dzień Babci', 'okazja', 'zielony', 'koncert', false, 'Okazja do jasełek i spotkania z seniorami'],
  ['01-22', 'Dzień Dziadka', 'okazja', 'zielony', 'koncert', false, ''],
  ['02-02', 'Ofiarowanie Pańskie (Matki Bożej Gromnicznej)', 'swieto', 'bialy', 'maryjne', true, 'Poświęcenie gromnic · Dzień Życia Konsekrowanego'],
  ['02-11', 'Najświętsza Maryja Panna z Lourdes · Światowy Dzień Chorego', 'wspomnienie', 'bialy', 'ogloszenie', true, 'Msza z sakramentem namaszczenia chorych'],
  ['02-14', 'Święci Cyryl i Metody, patroni Europy', 'swieto', 'bialy', 'ogloszenie', false, ''],
  ['03-19', 'Uroczystość św. Józefa, Oblubieńca NMP', 'uroczystosc', 'bialy', 'ogloszenie', false, ''],
  ['03-25', 'Zwiastowanie Pańskie', 'uroczystosc', 'bialy', 'maryjne', false, 'Dzień Świętości Życia · duchowa adopcja'],
  ['04-23', 'Uroczystość św. Wojciecha, patrona Polski', 'uroczystosc', 'czerwony', 'ogloszenie', false, ''],
  ['05-01', 'Rozpoczęcie nabożeństw majowych', 'okres', 'bialy', 'majowe', true, 'Litania Loretańska przez cały maj · św. Józefa Rzemieślnika'],
  ['05-03', 'Uroczystość NMP Królowej Polski', 'uroczystosc', 'bialy', 'patriotyczne', true, 'Rocznica Konstytucji 3 Maja · Msza za Ojczyznę'],
  ['05-08', 'Uroczystość św. Stanisława, biskupa i męczennika', 'uroczystosc', 'czerwony', 'ogloszenie', false, ''],
  ['05-16', 'Św. Andrzej Bobola, patron Polski', 'swieto', 'czerwony', 'ogloszenie', false, ''],
  ['05-26', 'Dzień Matki', 'okazja', 'zielony', 'ogloszenie', false, 'Msza w intencji matek'],
  ['06-01', 'Dzień Dziecka · nabożeństwa czerwcowe', 'okazja', 'zielony', 'festyn', true, 'Festyn rodzinny · Litania do Najświętszego Serca Pana Jezusa przez czerwiec'],
  ['06-29', 'Uroczystość Świętych Apostołów Piotra i Pawła', 'uroczystosc', 'czerwony', 'ogloszenie', false, 'Świętopietrze'],
  ['07-11', 'Św. Benedykt, patron Europy', 'swieto', 'bialy', 'ogloszenie', false, ''],
  ['07-23', 'Św. Brygida, patronka Europy', 'swieto', 'bialy', 'ogloszenie', false, ''],
  ['07-25', 'Św. Jakub Apostoł', 'swieto', 'czerwony', 'odpust', false, 'Święto patrona parafii (zob. święta parafialne)'],
  ['07-26', 'Św. Joachim i Anna, rodzice NMP', 'wspomnienie', 'bialy', 'ogloszenie', false, 'Dzień seniorów'],
  ['08-06', 'Przemienienie Pańskie', 'swieto', 'bialy', 'ogloszenie', false, ''],
  ['08-15', 'Wniebowzięcie Najświętszej Maryi Panny (Matki Bożej Zielnej)', 'uroczystosc', 'bialy', 'maryjne', true, 'Święto nakazane · poświęcenie ziół i kwiatów · Święto Wojska Polskiego'],
  ['08-22', 'Najświętsza Maryja Panna Królowa', 'wspomnienie', 'bialy', 'maryjne', false, ''],
  ['08-26', 'Uroczystość Najświętszej Maryi Panny Częstochowskiej', 'uroczystosc', 'bialy', 'maryjne', false, 'Zob. święta parafialne (obraz w sanktuarium)'],
  ['09-08', 'Narodzenie Najświętszej Maryi Panny (Matki Bożej Siewnej)', 'swieto', 'bialy', 'maryjne', true, 'Poświęcenie ziarna siewnego'],
  ['09-14', 'Podwyższenie Krzyża Świętego', 'swieto', 'czerwony', 'ogloszenie', false, ''],
  ['09-18', 'Św. Stanisław Kostka, patron dzieci i młodzieży', 'swieto', 'bialy', 'ogloszenie', false, 'Rostkowo – diecezja płocka'],
  ['09-29', 'Święci Archaniołowie Michał, Gabriel i Rafał', 'swieto', 'bialy', 'ogloszenie', false, ''],
  ['10-01', 'Rozpoczęcie nabożeństw różańcowych', 'okres', 'bialy', 'rozancowe', true, 'Różaniec codziennie przez październik'],
  ['10-07', 'Najświętsza Maryja Panna Różańcowa', 'wspomnienie', 'bialy', 'rozancowe', false, ''],
  ['10-22', 'Św. Jan Paweł II, papież', 'wspomnienie', 'bialy', 'ogloszenie', false, ''],
  ['11-01', 'Uroczystość Wszystkich Świętych', 'uroczystosc', 'bialy', 'wszystkich-swietych', true, 'Święto nakazane · Msza i procesja na cmentarzu'],
  ['11-02', 'Wspomnienie wszystkich wiernych zmarłych (Zaduszki)', 'wspomnienie', 'fioletowy', 'wszystkich-swietych', false, 'Wypominki · odpust za zmarłych 1–8 listopada'],
  ['11-11', 'Narodowe Święto Niepodległości', 'okazja', 'bialy', 'patriotyczne', true, 'Msza w intencji Ojczyzny · św. Marcin'],
  ['12-06', 'Św. Mikołaj, biskup', 'wspomnienie', 'bialy', 'festyn', false, 'Spotkanie mikołajkowe dla dzieci'],
  ['12-08', 'Uroczystość Niepokalanego Poczęcia NMP', 'uroczystosc', 'bialy', 'maryjne', false, ''],
  ['12-24', 'Wigilia Bożego Narodzenia · Pasterka', 'uroczystosc', 'bialy', 'boze-narodzenie', true, 'Pasterka o północy'],
  ['12-25', 'Uroczystość Narodzenia Pańskiego', 'uroczystosc', 'bialy', 'boze-narodzenie', false, 'Święto nakazane'],
  ['12-26', 'Św. Szczepan, pierwszy męczennik', 'swieto', 'czerwony', 'boze-narodzenie', false, 'Drugi dzień świąt · poświęcenie owsa'],
  ['12-27', 'Rozpoczęcie wizyty duszpasterskiej (kolędy)', 'okres', 'bialy', 'koleda', true, 'Zwyczajowy początek kolędy – sprawdź plan parafii'],
  ['12-31', 'Zakończenie roku · Te Deum', 'okazja', 'bialy', 'ogloszenie', false, 'Nabożeństwo dziękczynne na zakończenie roku']
];

function movable(year) {
  const E = easter(year);
  const A = adventStart(year);
  const xmas = new Date(year, 11, 25);
  const familySunday = xmas.getDay() === 0 ? new Date(year, 11, 30) : sundayAfter(xmas);
  const baptism = sundayAfter(new Date(year, 0, 6));
  const pope = sundayOnOrBefore(new Date(year, 9, 16));
  const septFirstSunday = (() => { const d = new Date(year, 8, 1); return d.getDay() === 0 ? d : sundayAfter(d); })();
  const D = (n) => addDays(E, n);
  return [
    [baptism, 'Niedziela Chrztu Pańskiego', 'niedziela', 'bialy', 'boze-narodzenie', false, 'Zakończenie okresu Bożego Narodzenia'],
    [D(-52), 'Tłusty czwartek', 'okazja', 'zielony', 'festyn', false, ''],
    [D(-46), 'Środa Popielcowa – początek Wielkiego Postu', 'okres', 'fioletowy', 'wielki-post', true, 'Posypanie głów popiołem · post ścisły'],
    [D(-44), 'Nabożeństwa Drogi Krzyżowej i Gorzkich Żali', 'okres', 'fioletowy', 'wielki-post', true, 'Piątki i niedziele Wielkiego Postu'],
    [D(-32), 'Rekolekcje wielkopostne (propozycja)', 'okres', 'fioletowy', 'rekolekcje', true, 'Termin ustala parafia – zwykle w połowie Wielkiego Postu'],
    [D(-21), 'IV Niedziela Wielkiego Postu (Laetare)', 'niedziela', 'rozowy', 'wielki-post', false, ''],
    [D(-7), 'Niedziela Palmowa Męki Pańskiej', 'niedziela', 'czerwony', 'triduum', true, 'Poświęcenie palm · konkurs palm'],
    [D(-3), 'Wielki Czwartek – Msza Wieczerzy Pańskiej', 'uroczystosc', 'bialy', 'triduum', false, 'Początek Triduum Paschalnego'],
    [D(-2), 'Wielki Piątek – Liturgia Męki Pańskiej', 'uroczystosc', 'czerwony', 'triduum', false, 'Post ścisły · adoracja przy Grobie Pańskim'],
    [D(-1), 'Wielka Sobota – święcenie pokarmów, Wigilia Paschalna', 'uroczystosc', 'bialy', 'wielkanoc', true, 'Święcenie pokarmów · Liturgia Wigilii Paschalnej'],
    [E, 'Niedziela Zmartwychwstania Pańskiego (Wielkanoc)', 'uroczystosc', 'bialy', 'wielkanoc', true, 'Rezurekcja'],
    [D(1), 'Poniedziałek Wielkanocny', 'uroczystosc', 'bialy', 'wielkanoc', false, ''],
    [D(7), 'Niedziela Miłosierdzia Bożego', 'niedziela', 'bialy', 'adoracja', false, 'Koronka do Miłosierdzia Bożego'],
    [D(42), 'Wniebowstąpienie Pańskie', 'uroczystosc', 'bialy', 'ogloszenie', false, 'W Polsce obchodzone w VII Niedzielę Wielkanocną'],
    [D(49), 'Zesłanie Ducha Świętego', 'uroczystosc', 'czerwony', 'zeslanie', true, 'Zielone Świątki'],
    [D(50), 'Najświętsza Maryja Panna, Matka Kościoła', 'swieto', 'bialy', 'maryjne', false, ''],
    [D(56), 'Najświętsza Trójca', 'uroczystosc', 'bialy', 'ogloszenie', false, ''],
    [D(60), 'Boże Ciało – Uroczystość Najświętszego Ciała i Krwi Chrystusa', 'uroczystosc', 'bialy', 'boze-cialo', true, 'Święto nakazane · procesja do czterech ołtarzy · oktawa'],
    [D(68), 'Najświętsze Serce Pana Jezusa', 'uroczystosc', 'bialy', 'adoracja', false, ''],
    [septFirstSunday, 'Dożynki parafialne (propozycja)', 'okazja', 'zielony', 'dozynki', true, 'Wiele parafii świętuje dożynki na przełomie sierpnia i września'],
    [pope, 'Dzień Papieski', 'niedziela', 'bialy', 'ogloszenie', false, 'Zbiórka na Fundację „Dzieło Nowego Tysiąclecia”'],
    [addDays(A, -7), 'Uroczystość Jezusa Chrystusa, Króla Wszechświata', 'uroczystosc', 'bialy', 'ogloszenie', false, 'Ostatnia niedziela roku liturgicznego'],
    [A, 'I Niedziela Adwentu – początek Rorat', 'okres', 'fioletowy', 'adwent', true, 'Nowy rok liturgiczny · Roraty'],
    [addDays(A, 14), 'III Niedziela Adwentu (Gaudete)', 'niedziela', 'rozowy', 'adwent', false, ''],
    [familySunday, 'Święto Świętej Rodziny: Jezusa, Maryi i Józefa', 'swieto', 'bialy', 'boze-narodzenie', false, 'Odnowienie przyrzeczeń małżeńskich']
  ];
}

class Liturgy {
  constructor(store) { this.store = store; }

  get settings() { return this.store.settings; }

  yearList(year) {
    const out = [];
    const push = (date, name, rank, color, presetId, propose, note, source, extra = {}) => {
      out.push({ key: `${source}:${iso(date)}:${name}`, date: iso(date), name, rank, color, presetId, propose: !!propose, note: note || '', source, leadDays: extra.leadDays || LEAD[rank] || 14, ...extra });
    };
    for (const [md, name, rank, color, preset, propose, note] of FIXED) {
      const [m, d] = md.split('-').map(Number);
      push(new Date(year, m - 1, d), name, rank, color, preset, propose, note, 'liturgia');
    }
    for (const [date, name, rank, color, preset, propose, note] of movable(year)) push(date, name, rank, color, preset, propose, note, 'liturgia');
    // święta parafii (konfigurowalne)
    for (const f of this.settings.parishFeasts || []) {
      if (!f || !f.md || f.enabled === false) continue;
      const [m, d] = f.md.split('-').map(Number);
      if (!m || !d) continue;
      push(new Date(year, m - 1, d), f.name, 'parafialne', f.color || 'zloty', f.presetId || 'odpust', f.propose !== false, f.note || '', 'parafia', { leadDays: Number(f.leadDays) || LEAD.parafialne, feastId: f.id });
    }
    return out;
  }

  // Wydarzenia jednorazowe: własne (dodane w kalendarzu) i znalezione w internecie
  datedEvents() {
    const s = this.store.data;
    return [
      ...(s.events || []).map((e) => ({ key: `wlasne:${e.id}`, date: e.date, name: e.name, rank: 'wydarzenie', color: 'zloty', presetId: e.presetId || 'ogloszenie', propose: e.propose !== false, note: e.note || '', source: 'wlasne', leadDays: Number(e.leadDays) || LEAD.wydarzenie, eventId: e.id })),
      ...(s.onlineEvents || []).filter((e) => !e.hidden).map((e) => ({ key: `internet:${e.id}`, date: e.date, name: e.name, rank: 'wydarzenie', color: 'zloty', presetId: e.presetId || 'ogloszenie', propose: true, note: e.description || '', source: 'internet', url: e.url || '', leadDays: LEAD.wydarzenie, eventId: e.id }))
    ];
  }

  inRange(from, to) {
    const f = typeof from === 'string' ? from : iso(from);
    const t = typeof to === 'string' ? to : iso(to);
    const y1 = Number(f.slice(0, 4)), y2 = Number(t.slice(0, 4));
    const cats = (this.settings.calendar && this.settings.calendar.ranks) || {};
    let all = [];
    for (let y = y1; y <= y2; y++) all.push(...this.yearList(y));
    all.push(...this.datedEvents());
    all = all.filter((o) => o.date >= f && o.date <= t && cats[o.rank] !== false);
    const rankOrder = ['parafialne', 'wydarzenie', 'uroczystosc', 'okres', 'swieto', 'niedziela', 'okazja', 'wspomnienie'];
    return all.sort((a, b) => a.date.localeCompare(b.date) || rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank));
  }

  // Okazje, dla których warto teraz przygotować plakat (w oknie „leadDays” przed datą)
  dueForPoster(now = new Date(), horizonDays = 45) {
    const today = iso(now);
    const list = this.inRange(today, iso(addDays(now, horizonDays)));
    return list.filter((o) => o.propose && Math.round((parseIso(o.date) - parseIso(today)) / 86400000) <= o.leadDays);
  }

  seasonOf(dateIso) {
    const d = parseIso(dateIso);
    const y = d.getFullYear();
    const E = easter(y), A = adventStart(y);
    if (d >= A && d < new Date(y, 11, 25)) return { name: 'Adwent', color: 'fioletowy' };
    const baptism = sundayAfter(new Date(y, 0, 6));
    if (d >= new Date(y, 11, 25) || d <= baptism) return { name: 'Okres Bożego Narodzenia', color: 'bialy' };
    if (d >= addDays(E, -46) && d < addDays(E, -3)) return { name: 'Wielki Post', color: 'fioletowy' };
    if (d >= addDays(E, -3) && d < E) return { name: 'Triduum Paschalne', color: 'czerwony' };
    if (d >= E && d <= addDays(E, 49)) return { name: 'Okres Wielkanocny', color: 'bialy' };
    return { name: 'Okres zwykły', color: 'zielony' };
  }
}

module.exports = { Liturgy, easter, adventStart, iso, parseIso, addDays, pad, longDate, MONTHS, MONTHS_GEN, WEEKDAYS, LEAD };
