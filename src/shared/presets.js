'use strict';
// Wbudowane presety tematyczne plakatów. Użytkownik może je skopiować i zmienić (Presety → Duplikuj).

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PRESETS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const CATEGORIES = {
    swieta: 'Święta i okresy liturgiczne',
    okolicznosci: 'Sakramenty i okoliczności',
    imprezy: 'Wydarzenia i imprezy',
    ogloszenia: 'Ogłoszenia'
  };

  const F = (heading, body, script) => ({ heading, body, script: script || 'vibes' });

  // style: paletteId, fonts, layout, motif, divider, frame, pattern, titleUpper, imageShape
  const P = (id, name, category, o) => ({
    id, name, category, builtIn: true,
    icon: o.icon || o.motif || 'krzyz',
    description: o.description || '',
    style: {
      paletteId: o.palette, fonts: o.fonts || F('cinzel', 'garamond'), layout: o.layout || 'klasyczny',
      motif: o.motif || 'krzyz', divider: o.divider || 'linia-romb', frame: o.frame || 'none', pattern: o.pattern || 'none',
      titleUpper: o.titleUpper !== false, imageShape: o.imageShape || 'luk'
    },
    imageId: o.imageId || null,
    showLogo: o.showLogo !== false,
    defaults: Object.assign({ title: '', subtitle: '', closing: '', quote: null, body: '' }, o.defaults || {}),
    aiHints: o.aiHints || ''
  });

  const LIST = [
    // ── święta i okresy ──
    P('boze-narodzenie', 'Boże Narodzenie i Pasterka', 'swieta', {
      palette: 'biel-zloto', motif: 'gwiazda', divider: 'linia-kropki', frame: 'ozdobna', pattern: 'promienie', layout: 'ramka',
      description: 'Pasterka, porządek Mszy Świętych w okresie świątecznym, życzenia.',
      defaults: { title: 'Boże Narodzenie', subtitle: 'Pasterka i Msze Święte w okresie świątecznym', closing: 'Radosnych i błogosławionych Świąt!', quote: { text: 'Słowo stało się ciałem i zamieszkało wśród nas', source: 'J 1,14' } },
      aiHints: 'Ciepły, radosny ton. Pasterka zwykle o północy (24 grudnia). Podaj porządek Mszy w Boże Narodzenie i drugi dzień świąt, jeśli użytkownik je podał.'
    }),
    P('adwent', 'Adwent i Roraty', 'swieta', {
      palette: 'fiolet', motif: 'wieniec', divider: 'linia-krzyz', frame: 'podwojna', layout: 'klasyczny', imageId: 'brand:mb1',
      description: 'Msze roratnie, rekolekcje adwentowe, lampiony dla dzieci.',
      defaults: { title: 'Roraty', subtitle: 'Msze Święte roratnie w Adwencie', closing: 'Czuwajmy z Maryją!', quote: { text: 'Przygotujcie drogę Panu, prostujcie ścieżki dla Niego', source: 'Mk 1,3' } },
      aiHints: 'Okres oczekiwania i czuwania. Roraty – Msza wotywna o Najświętszej Maryi Pannie, dzieci przychodzą z lampionami.'
    }),
    P('wielki-post', 'Wielki Post: Droga Krzyżowa, Gorzkie Żale', 'swieta', {
      palette: 'fiolet', motif: 'krzyz', divider: 'linia-krzyz', frame: 'linia', layout: 'harmonogram',
      description: 'Nabożeństwa pasyjne, Środa Popielcowa, post i jałmużna.',
      defaults: { title: 'Nabożeństwa wielkopostne', subtitle: 'Droga Krzyżowa i Gorzkie Żale', closing: 'Zapraszamy do wspólnej modlitwy', quote: { text: 'Nawracajcie się i wierzcie w Ewangelię', source: 'Mk 1,15' } },
      aiHints: 'Poważny, skupiony ton. Droga Krzyżowa zwykle w piątki, Gorzkie Żale w niedziele. Harmonogram: dzień tygodnia + godzina + dla kogo.'
    }),
    P('triduum', 'Wielki Tydzień i Triduum Paschalne', 'swieta', {
      palette: 'noc-zloto', motif: 'krzyz-ozdobny', divider: 'linia-romb', frame: 'ozdobna', layout: 'harmonogram',
      description: 'Porządek liturgii Wielkiego Czwartku, Piątku, Soboty i Niedzieli Zmartwychwstania.',
      defaults: { title: 'Triduum Paschalne', subtitle: 'Porządek nabożeństw Wielkiego Tygodnia', closing: 'Przeżyjmy razem najważniejsze dni roku liturgicznego', quote: { text: 'Nikt nie ma większej miłości od tej, gdy ktoś życie swoje oddaje za przyjaciół swoich', source: 'J 15,13' } },
      aiHints: 'Harmonogram dzień po dniu: Wielki Czwartek (Msza Wieczerzy Pańskiej), Wielki Piątek (Liturgia Męki Pańskiej, adoracja przy Grobie), Wielka Sobota (święcenie pokarmów, Wigilia Paschalna), Niedziela Zmartwychwstania (Rezurekcja).'
    }),
    P('wielkanoc', 'Wielkanoc i święcenie pokarmów', 'swieta', {
      palette: 'biel-zloto', motif: 'zmartwychwstanie', divider: 'linia-zawijas', frame: 'narozniki', pattern: 'promienie', layout: 'ramka',
      description: 'Rezurekcja, święcenie pokarmów, życzenia wielkanocne.',
      defaults: { title: 'Wesołego Alleluja!', subtitle: 'Chrystus zmartwychwstał', closing: 'Radosnych Świąt Zmartwychwstania Pańskiego', quote: { text: 'Nie ma Go tu, bo zmartwychwstał, jak powiedział', source: 'Mt 28,6' } },
      aiHints: 'Radosny ton paschalny. Święcenie pokarmów w Wielką Sobotę – podaj godziny, jeśli są.'
    }),
    P('zeslanie', 'Zesłanie Ducha Świętego', 'swieta', {
      palette: 'czerwien', motif: 'golebica', divider: 'linia-kropki', frame: 'none', pattern: 'promienie', layout: 'ramka',
      defaults: { title: 'Zesłanie Ducha Świętego', subtitle: 'Uroczystość Pięćdziesiątnicy', closing: 'Przyjdź, Duchu Święty!', quote: { text: 'Weźmijcie Ducha Świętego', source: 'J 20,22' } },
      aiHints: 'Kolor liturgiczny czerwony. Można wspomnieć Wigilię Zesłania Ducha Świętego.'
    }),
    P('boze-cialo', 'Boże Ciało i procesja', 'swieta', {
      palette: 'biel-zloto', motif: 'monstrancja', divider: 'linia-romb', frame: 'ozdobna', layout: 'klasyczny',
      description: 'Procesja eucharystyczna do czterech ołtarzy, oktawa.',
      defaults: { title: 'Boże Ciało', subtitle: 'Uroczystość Najświętszego Ciała i Krwi Chrystusa', closing: 'Zapraszamy do udziału w procesji', quote: { text: 'Ja jestem chlebem życia', source: 'J 6,35' } },
      aiHints: 'Podaj godzinę Mszy i procesji, trasę lub ołtarze, prośbę o udekorowanie domów i udział dzieci pierwszokomunijnych, jeśli użytkownik o tym wspomni.'
    }),
    P('adoracja', 'Adoracja Najświętszego Sakramentu', 'swieta', {
      palette: 'noc-zloto', motif: 'monstrancja', divider: 'linia-kropki', frame: 'luk', pattern: 'promienie', layout: 'ramka',
      defaults: { title: 'Adoracja Najświętszego Sakramentu', subtitle: 'Bądź z Jezusem', closing: 'Zapraszamy do wspólnego czuwania' },
      aiHints: 'Spokojny, modlitewny ton.'
    }),
    P('maryjne', 'Uroczystości maryjne (MB Częstochowska, Królowa Nieba)', 'swieta', {
      palette: 'blekit', motif: 'korona', divider: 'linia-zawijas', frame: 'ozdobna', layout: 'obraz', imageId: 'brand:mb1',
      description: 'Uroczystości ku czci Matki Bożej w sanktuarium – z obrazem Matki Bożej.',
      defaults: { title: 'Uroczystość Matki Bożej', subtitle: 'Sanktuarium Matki Bożej Królowej Nieba w Koziebrodach', closing: 'Pod Twoją obronę uciekamy się', quote: { text: 'Zróbcie wszystko, cokolwiek wam powie', source: 'J 2,5' } },
      aiHints: 'Sanktuarium w Koziebrodach słynie z obrazu Matki Bożej (kopia wizerunku Matki Bożej Częstochowskiej). Ton uroczysty, maryjny.'
    }),
    P('odpust', 'Odpust parafialny ku czci św. Jakuba', 'swieta', {
      palette: 'bordo-zloto', motif: 'muszla', divider: 'linia-romb', frame: 'narozniki', layout: 'klasyczny', imageId: 'brand:sanktuarium',
      description: 'Odpust 25 lipca – suma odpustowa, procesja, kaznodzieja.',
      defaults: { title: 'Odpust parafialny', subtitle: 'ku czci św. Jakuba Apostoła, patrona parafii', closing: 'Serdecznie zapraszamy parafian i gości!', quote: { text: 'Czy możecie pić kielich, który Ja mam pić?', source: 'Mt 20,22' } },
      aiHints: 'Św. Jakub Starszy Apostoł – patron parafii, symbol: muszla pielgrzyma. Wspomnij sumę odpustową, kaznodzieję, procesję i możliwość uzyskania odpustu zupełnego (pod zwykłymi warunkami), jeśli to pasuje.'
    }),
    P('wszystkich-swietych', 'Wszystkich Świętych, Zaduszki, wypominki', 'swieta', {
      palette: 'swieca', motif: 'swieca', divider: 'linia-krzyz', frame: 'linia', layout: 'ramka',
      defaults: { title: 'Wszystkich Świętych', subtitle: 'Wspomnienie wszystkich wiernych zmarłych', closing: 'Wieczny odpoczynek racz im dać, Panie', quote: { text: 'Ja jestem zmartwychwstaniem i życiem', source: 'J 11,25' } },
      aiHints: 'Msze na cmentarzu, procesja, wypominki, odpust za zmarłych (1–8 listopada, pod zwykłymi warunkami).'
    }),
    P('majowe', 'Nabożeństwa majowe', 'swieta', {
      palette: 'blekit', motif: 'lilia', divider: 'linia-zawijas', frame: 'narozniki', layout: 'klasyczny', imageId: 'brand:mb2',
      defaults: { title: 'Nabożeństwa majowe', subtitle: 'Litania Loretańska ku czci Najświętszej Maryi Panny', closing: 'Chwalcie łąki umajone!', quote: { text: 'Oto Ja służebnica Pańska, niech Mi się stanie według twego słowa', source: 'Łk 1,38' } },
      aiHints: 'Podaj godziny w dni powszednie i w niedziele, także przy kapliczkach i krzyżach przydrożnych, jeśli użytkownik je poda.'
    }),
    P('rozancowe', 'Nabożeństwa różańcowe (październik)', 'swieta', {
      palette: 'granat-zloto', motif: 'rozaniec', divider: 'linia-kropki', frame: 'ozdobna', layout: 'obraz', imageId: 'brand:mb1',
      defaults: { title: 'Nabożeństwa różańcowe', subtitle: 'Październik – miesiąc różańca świętego', closing: 'Weź różaniec do ręki!', quote: { text: 'Bądź pozdrowiona, pełna łaski, Pan z Tobą', source: 'Łk 1,28' } },
      aiHints: 'Godziny dla dorosłych i dla dzieci (dzieci często otrzymują obrazki).'
    }),
    P('patriotyczne', 'Msza za Ojczyznę (3 Maja, 11 Listopada)', 'swieta', {
      palette: 'bialo-czerwona', fonts: F('playfair', 'lora', 'vibes'), motif: 'krzyz', divider: 'linia-romb', frame: 'podwojna', layout: 'klasyczny',
      defaults: { title: 'Msza Święta w intencji Ojczyzny', subtitle: '', closing: 'Boże, coś Polskę…' },
      aiHints: 'Ton patriotyczno-religijny. 3 Maja – uroczystość NMP Królowej Polski; 11 Listopada – Narodowe Święto Niepodległości. Udział pocztów sztandarowych, szkół, służb.'
    }),

    // ── sakramenty i okoliczności ──
    P('komunia', 'Pierwsza Komunia Święta', 'okolicznosci', {
      palette: 'biel-zloto', motif: 'kielich', divider: 'linia-zawijas', frame: 'narozniki', layout: 'ramka', fonts: F('cormorant', 'garamond'),
      defaults: { title: 'Pierwsza Komunia Święta', subtitle: '', closing: 'Módlmy się za dzieci i ich rodziny', quote: { text: 'Ja jestem chlebem żywym, który zstąpił z nieba', source: 'J 6,51' } },
      aiHints: 'Ton radosny i ciepły. Godzina Mszy, próby, spowiedź dzieci i rodziców, rocznica I Komunii, biały tydzień.'
    }),
    P('bierzmowanie', 'Sakrament bierzmowania', 'okolicznosci', {
      palette: 'czerwien', motif: 'golebica', divider: 'linia-kropki', frame: 'none', pattern: 'promienie', layout: 'klasyczny',
      defaults: { title: 'Sakrament bierzmowania', subtitle: '', closing: 'Duchu Święty, prowadź!', quote: { text: 'Otrzymacie moc Ducha Świętego, który zstąpi na was', source: 'Dz 1,8' } },
      aiHints: 'Biskup udzielający sakramentu, spowiedź, próby, świadkowie.'
    }),
    P('koleda', 'Wizyta duszpasterska (kolęda)', 'okolicznosci', {
      palette: 'granat-zloto', motif: 'gwiazda', divider: 'linia-kropki', frame: 'podwojna', layout: 'harmonogram',
      defaults: { title: 'Wizyta duszpasterska', subtitle: 'Kolęda', closing: 'Z serca dziękujemy za gościnność', quote: { text: 'Pokój temu domowi', source: 'Łk 10,5' } },
      aiHints: 'Harmonogram: data + godzina rozpoczęcia + miejscowości/ulice. Godzina rozpoczęcia wizyty, prośba o przygotowanie krzyża, świec, wody święconej.'
    }),
    P('rekolekcje', 'Rekolekcje parafialne', 'okolicznosci', {
      palette: 'fiolet', motif: 'krzyz-ozdobny', divider: 'linia-krzyz', frame: 'linia', layout: 'harmonogram',
      defaults: { title: 'Rekolekcje parafialne', subtitle: '', closing: 'Zapraszamy wszystkich parafian', quote: { text: 'Oto teraz czas upragniony, oto teraz dzień zbawienia', source: '2 Kor 6,2' } },
      aiHints: 'Rekolekcjonista, temat, harmonogram dni (nauki stanowe, spowiedź, nauki dla dzieci i młodzieży).'
    }),
    P('nekrolog', 'Nekrolog / zawiadomienie o pogrzebie', 'okolicznosci', {
      palette: 'zaloba', fonts: F('garamond', 'garamond', 'cormorant'), motif: 'krzyz', divider: 'linia-krzyz', frame: 'linia', layout: 'ramka', titleUpper: false, showLogo: false,
      description: 'Klepsydra: imię i nazwisko, wiek, data i godzina pogrzebu, różaniec.',
      defaults: { title: '', subtitle: '', closing: 'Wieczny odpoczynek racz mu dać, Panie', quote: { text: 'Ja jestem zmartwychwstaniem i życiem', source: 'J 11,25' } },
      aiHints: 'Format klepsydry: „Z głębokim żalem zawiadamiamy, że dnia … zmarł(a) … przeżywszy … lat”. Tytuł = imię i nazwisko zmarłego. Godzina Mszy pogrzebowej, miejsce (kościół, cmentarz), różaniec za zmarłego. Ton spokojny, z szacunkiem. Bez zbędnych ozdobników.'
    }),

    // ── wydarzenia i imprezy ──
    P('festyn', 'Festyn / piknik parafialny', 'imprezy', {
      palette: 'radosna', fonts: F('oswald', 'lora', 'vibes'), motif: 'serce', divider: 'linia-kropki', frame: 'none', layout: 'harmonogram', titleUpper: true,
      defaults: { title: 'Festyn parafialny', subtitle: '', closing: 'Zabierz rodzinę i przyjaciół!', quote: { text: 'Radujcie się zawsze w Panu', source: 'Flp 4,4' } },
      aiHints: 'Ton radosny, rodzinny. Atrakcje (dla dzieci, loteria, grill, muzyka), cel zbiórki, harmonogram. Krótkie hasła.'
    }),
    P('dozynki', 'Dożynki parafialne', 'imprezy', {
      palette: 'sepia', motif: 'klosy', divider: 'linia-zawijas', frame: 'narozniki', layout: 'klasyczny', fonts: F('playfair', 'lora'),
      defaults: { title: 'Dożynki parafialne', subtitle: 'Dziękczynienie za tegoroczne plony', closing: 'Zapraszamy rolników i całe rodziny', quote: { text: 'Dziękujcie Panu, bo jest dobry', source: 'Ps 136,1' } },
      aiHints: 'Msza dziękczynna, poświęcenie wieńców dożynkowych, korowód, gospodarze dożynek.'
    }),
    P('koncert', 'Koncert, jasełka, występy', 'imprezy', {
      palette: 'granat-zloto', motif: 'nuta', divider: 'linia-romb', frame: 'ozdobna', layout: 'ramka', fonts: F('playfair', 'garamond'),
      defaults: { title: 'Koncert', subtitle: '', closing: 'Wstęp wolny – serdecznie zapraszamy', quote: { text: 'Śpiewajcie Panu pieśń nową', source: 'Ps 96,1' } },
      aiHints: 'Wykonawcy, repertuar (kolędy, pieśni maryjne, muzyka organowa), wstęp, ewentualna zbiórka.'
    }),
    P('pielgrzymka', 'Pielgrzymka', 'imprezy', {
      palette: 'sepia', motif: 'muszla', divider: 'linia-kropki', frame: 'podwojna', layout: 'obraz', imageId: 'brand:sanktuarium',
      defaults: { title: 'Pielgrzymka parafialna', subtitle: '', closing: 'Zapisy w kancelarii parafialnej', quote: { text: 'Ja jestem drogą i prawdą, i życiem', source: 'J 14,6' } },
      aiHints: 'Cel pielgrzymki, termin, koszt, zapisy, zbiórka i godzina wyjazdu, co zabrać.'
    }),
    P('zbiorka', 'Zbiórka, Caritas, akcja charytatywna', 'imprezy', {
      palette: 'czerwien', motif: 'serce', divider: 'linia-kropki', frame: 'none', layout: 'klasyczny', fonts: F('oswald', 'lora'),
      defaults: { title: 'Zbiórka charytatywna', subtitle: '', closing: 'Dziękujemy za każdy dar serca!', quote: { text: 'Radosnego dawcę miłuje Bóg', source: '2 Kor 9,7' } },
      aiHints: 'Cel zbiórki, co zbieramy, gdzie i kiedy, numer konta (jeśli podano).'
    }),

    // ── ogłoszenia ──
    P('ogloszenie', 'Ogłoszenie ogólne', 'ogloszenia', {
      palette: 'bordo-zloto', motif: 'krzyz', divider: 'linia-romb', frame: 'linia', layout: 'klasyczny', fonts: F('cinzel', 'lora'),
      defaults: { title: 'Ogłoszenie', closing: '' },
      aiHints: 'Rzeczowy, uprzejmy ton. Najważniejsza informacja w tytule.'
    }),
    P('porzadek-mszy', 'Porządek Mszy Świętych / godziny kancelarii', 'ogloszenia', {
      palette: 'bordo-zloto', motif: 'kosciol', divider: 'linia-krzyz', frame: 'podwojna', layout: 'harmonogram', fonts: F('cinzel', 'lora'),
      defaults: { title: 'Porządek Mszy Świętych', closing: '' },
      aiHints: 'Czytelny harmonogram: niedziele i święta, dni powszednie, godziny kancelarii, spowiedź.'
    })
  ];

  const byId = (id, custom = []) => custom.find((p) => p.id === id) || LIST.find((p) => p.id === id) || null;

  return { CATEGORIES, LIST, byId };
});
