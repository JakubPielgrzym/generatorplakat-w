'use strict';
// Model plakatu: formaty, palety, czcionki, motywy religijne (SVG), silnik układu i renderowanie do DOM.
// Plik wspólny – działa w procesie głównym (require) i w oknie (window.Poster).

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Poster = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const MM = 96 / 25.4; // px na mm przy 96 dpi
  const PT = 96 / 72; // px na punkt typograficzny

  // ───────────────────────── formaty ─────────────────────────
  const FORMATS = {
    a4: { label: 'A4 pionowo', w: 210, h: 297, paper: 'A4' },
    a4l: { label: 'A4 poziomo', w: 297, h: 210, paper: 'A4', landscape: true },
    a3: { label: 'A3 pionowo', w: 297, h: 420, paper: 'A3' },
    a3l: { label: 'A3 poziomo', w: 420, h: 297, paper: 'A3', landscape: true },
    a5: { label: 'A5 (ulotka)', w: 148, h: 210, paper: 'A5' },
    a6: { label: 'A6 (karteczka)', w: 105, h: 148, paper: 'A6' },
    b2: { label: 'Plakat 50×70 cm', w: 500, h: 700, paper: null },
    square: { label: 'Kwadrat (Facebook, Instagram)', w: 200, h: 200, paper: null },
    screen: { label: 'Ekran 16:9 (telewizor, Facebook)', w: 320, h: 180, paper: null, landscape: true }
  };

  // ───────────────────────── czcionki ─────────────────────────
  const FONTS = {
    cinzel: { label: 'Cinzel – klasyczne kapitaliki', css: "'P Cinzel', 'P Garamond', serif", w: 0.74 },
    cormorant: { label: 'Cormorant Garamond – elegancka', css: "'P Cormorant', 'P Garamond', serif", w: 0.47 },
    garamond: { label: 'EB Garamond – książkowa', css: "'P Garamond', serif", w: 0.5 },
    playfair: { label: 'Playfair Display – wyrazista', css: "'P Playfair', serif", w: 0.56 },
    lora: { label: 'Lora – czytelna szeryfowa', css: "'P Lora', serif", w: 0.55 },
    oswald: { label: 'Oswald – wąska, plakatowa', css: "'P Oswald', 'P Inter', sans-serif", w: 0.46 },
    inter: { label: 'Inter – nowoczesna bezszeryfowa', css: "'P Inter', sans-serif", w: 0.55 },
    vibes: { label: 'Great Vibes – odręczna', css: "'P Vibes', 'P Cormorant', cursive", w: 0.42 }
  };

  // ───────────────────────── palety ─────────────────────────
  // title – tytuł, text – treść, accent – ozdobniki i akcenty, muted – drobny tekst, bg/bg2 – tło
  const PALETTES = {
    'bordo-zloto': { label: 'Bordo i złoto', bg: '#fbf6ec', bg2: '#f1e3c6', title: '#7a1f2b', text: '#3a2a1e', accent: '#b08a3e', muted: '#7d6b55' },
    'noc-zloto': { label: 'Ciemne bordo i złoto', bg: '#2b0f17', bg2: '#4d1826', title: '#ecc978', text: '#f6ead2', accent: '#d4a64a', muted: '#cdb89a' },
    'biel-zloto': { label: 'Biel i złoto (uroczystości)', bg: '#ffffff', bg2: '#f8efd8', title: '#86651c', text: '#2f2a22', accent: '#c6a048', muted: '#8a7f6d' },
    fiolet: { label: 'Fiolet (Adwent, Wielki Post)', bg: '#f7f3f9', bg2: '#e6d9ef', title: '#4b2366', text: '#2e2433', accent: '#8a63a8', muted: '#75687d' },
    'fiolet-noc': { label: 'Ciemny fiolet', bg: '#26122f', bg2: '#3d2150', title: '#f1e3ff', text: '#efe6f5', accent: '#c9a6e8', muted: '#bba9c9' },
    zielen: { label: 'Zieleń (okres zwykły)', bg: '#f5f8f1', bg2: '#dfead6', title: '#2f5a2a', text: '#263022', accent: '#6f9a4a', muted: '#6b7a64' },
    czerwien: { label: 'Czerwień (Duch Święty, męczennicy)', bg: '#fff7f3', bg2: '#fbe0d6', title: '#a3161f', text: '#34201c', accent: '#df5b2a', muted: '#8a6b62' },
    blekit: { label: 'Błękit maryjny', bg: '#f4f8fd', bg2: '#dce8f7', title: '#1f4a8a', text: '#1f2a3a', accent: '#c19a44', muted: '#66768c' },
    'granat-zloto': { label: 'Granat i złoto', bg: '#13213f', bg2: '#1f3260', title: '#f0d38a', text: '#eef1f7', accent: '#d6b062', muted: '#aeb8cc' },
    roz: { label: 'Różowy (Gaudete, Laetare)', bg: '#fff6f8', bg2: '#f8dce4', title: '#9c2f52', text: '#36242a', accent: '#c9748f', muted: '#86656f' },
    sepia: { label: 'Sepia (pielgrzymki, historia)', bg: '#f6f0e4', bg2: '#e8dac0', title: '#5a3b1e', text: '#3a2b1c', accent: '#9b6b35', muted: '#85735c' },
    swieca: { label: 'Noc i światło (Wszystkich Świętych)', bg: '#1c1e23', bg2: '#30333b', title: '#f2e3c0', text: '#e9e9ea', accent: '#e2b75b', muted: '#a3a6ad' },
    'bialo-czerwona': { label: 'Biało-czerwona (Ojczyzna)', bg: '#ffffff', bg2: '#fbe9ea', title: '#c8102e', text: '#232323', accent: '#c8102e', muted: '#6b6b6b' },
    radosna: { label: 'Radosna (festyny)', bg: '#fffaf0', bg2: '#ffe6b0', title: '#c2410c', text: '#2b2b2b', accent: '#2f855a', muted: '#6b6b6b' },
    zaloba: { label: 'Żałobna (nekrologi)', bg: '#ffffff', bg2: '#efefef', title: '#111111', text: '#1e1e1e', accent: '#3d3d3d', muted: '#5f5f5f' },
    oszczedna: { label: 'Oszczędna w druku (czarno-biała)', bg: '#ffffff', bg2: '#ffffff', title: '#000000', text: '#000000', accent: '#4a4a4a', muted: '#4a4a4a' }
  };

  // ───────────────────────── motywy SVG ─────────────────────────
  // viewBox 0 0 100 100 (chyba że podano vb). Klasa f = wypełnienie kolorem, reszta = obrys.
  function palmPath() {
    let d = 'M28 94C38 66 50 38 74 8';
    for (let i = 1; i <= 11; i++) {
      const t = i / 12;
      const x = 28 * (1 - t) ** 3 + 3 * 38 * t * (1 - t) ** 2 + 3 * 50 * t * t * (1 - t) + 74 * t ** 3;
      const y = 94 * (1 - t) ** 3 + 3 * 66 * t * (1 - t) ** 2 + 3 * 38 * t * t * (1 - t) + 8 * t ** 3;
      const L = 20 * (1 - t * 0.7);
      d += `M${x.toFixed(1)} ${y.toFixed(1)}l${(-L * 0.9).toFixed(1)} ${(-L * 0.35).toFixed(1)}M${x.toFixed(1)} ${y.toFixed(1)}l${(L * 0.45).toFixed(1)} ${(L * 0.55).toFixed(1)}`;
    }
    return `<path d="${d}"/>`;
  }
  function wheatPath() {
    let s = '';
    for (const [dx, rot] of [[-16, -14], [0, 0], [16, 14]]) {
      let g = '<path d="M50 96V30"/>';
      for (let i = 0; i < 6; i++) {
        const y = 32 + i * 8;
        g += `<ellipse class="f" cx="45" cy="${y}" rx="3.2" ry="6" transform="rotate(-28 45 ${y})"/><ellipse class="f" cx="55" cy="${y}" rx="3.2" ry="6" transform="rotate(28 55 ${y})"/>`;
      }
      g += '<ellipse class="f" cx="50" cy="24" rx="3" ry="6"/>';
      s += `<g transform="translate(${dx} 0) rotate(${rot} 50 96)">${g}</g>`;
    }
    return s;
  }
  function rosaryPath() {
    let s = '';
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const x = 50 + 30 * Math.sin(a), y = 36 - 26 * Math.cos(a);
      if (y > 58) continue;
      s += `<circle class="f" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6"/>`;
    }
    for (let i = 0; i < 4; i++) s += `<circle class="f" cx="50" cy="${66 + i * 5}" r="2.4"/>`;
    return s + '<path d="M50 84v14M44 89h12"/>';
  }
  function raysPath(n, r1, r2, cx = 50, cy = 50) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      d += `M${(cx + r1 * Math.cos(a)).toFixed(1)} ${(cy + r1 * Math.sin(a)).toFixed(1)}L${(cx + r2 * Math.cos(a)).toFixed(1)} ${(cy + r2 * Math.sin(a)).toFixed(1)}`;
    }
    return d;
  }

  const MOTIFS = {
    krzyz: { label: 'Krzyż', svg: '<path d="M50 8v84M27 32h46"/>' },
    'krzyz-ozdobny': { label: 'Krzyż ozdobny', svg: '<path d="M50 15v70M31 36h38"/><circle class="f" cx="50" cy="10" r="5"/><circle class="f" cx="26" cy="36" r="5"/><circle class="f" cx="74" cy="36" r="5"/><circle class="f" cx="50" cy="90" r="5"/><circle cx="50" cy="36" r="7"/>' },
    zmartwychwstanie: { label: 'Krzyż ze stułą (Wielkanoc)', svg: '<path d="M50 6v88M28 28h44"/><path d="M33 29c4 9 10 13 17 13s13-4 17-13M43 41l-9 26 6-2M57 41l9 26-6-2"/><path d="' + raysPath(16, 30, 40, 50, 28).replace(/M/g, 'M') + '" opacity=".55"/>' },
    'chi-rho': { label: 'Chi-Rho (monogram Chrystusa)', svg: '<path d="M50 10v80M28 28l44 44M72 28 28 72"/><path d="M50 10h11a12 12 0 0 1 0 24H50"/>' },
    ihs: { label: 'IHS', svg: '<path d="M50 6v20M42 13h16"/><text class="f" x="50" y="66" text-anchor="middle" font-size="33" font-family="P Cinzel, serif" font-weight="700">IHS</text><path d="' + raysPath(24, 40, 47, 50, 52) + '" opacity=".6"/>' },
    'alfa-omega': { label: 'Alfa i Omega', svg: '<path d="M50 10v80M32 30h36"/><text class="f" x="22" y="74" text-anchor="middle" font-size="30" font-family="P Garamond, serif">Α</text><text class="f" x="78" y="74" text-anchor="middle" font-size="30" font-family="P Garamond, serif">Ω</text>' },
    golebica: { label: 'Gołębica (Duch Święty)', svg: '<path d="M50 42C38 27 22 22 6 25c14 4 24 12 32 24M50 42c12-15 28-20 44-17-14 4-24 12-32 24"/><path d="M39 49c2 13 6 21 11 30 5-9 9-17 11-30-4-4-7-6-11-6s-7 2-11 6z"/><circle class="f" cx="50" cy="86" r="4.5"/><path d="M44 40l6-20 6 20"/><path d="' + raysPath(12, 44, 50, 50, 50) + '" opacity=".5"/>' },
    gwiazda: { label: 'Gwiazda betlejemska', svg: '<path class="f" d="M50 4l4.5 40L80 50l-25.5 6L50 97l-4.5-41L20 50l25.5-6z"/><path d="M50 50 68 32M50 50 32 32M50 50 66 66M50 50 34 66" stroke-width="2"/>' },
    lilia: { label: 'Lilia (Maryja, czystość)', svg: '<path d="M50 96V40"/><path d="M50 40c-10-12-8-26 0-34 8 8 10 22 0 34zM48 44c-12 0-24-8-26-20 12 2 22 8 26 20zM52 44c12 0 24-8 26-20-12 2-22 8-26 20z"/><path d="M50 70c-10-4-16-12-18-20M50 80c10-4 16-12 18-22"/>' },
    muszla: { label: 'Muszla św. Jakuba', svg: '<path d="M50 86 14 46C12 26 30 10 50 10s38 16 36 36z"/><path d="M50 86 21 33M50 86 29 21M50 86 39 13M50 86V10M50 86 61 13M50 86 71 21M50 86 79 33"/><path d="M40 86h20l3 8H37z"/>' },
    kielich: { label: 'Kielich i Hostia', svg: '<circle cx="50" cy="20" r="12"/><path d="M50 12v16M42 20h16" stroke-width="2"/><path d="M28 38c0 20 10 28 22 28s22-8 22-28z"/><path d="M50 66v16"/><circle class="f" cx="50" cy="74" r="3.5"/><path d="M35 90c3-6 27-6 30 0z"/>' },
    monstrancja: { label: 'Monstrancja (Boże Ciało)', svg: '<circle cx="50" cy="36" r="11"/><circle cx="50" cy="36" r="17"/><path d="' + raysPath(20, 21, 33, 50, 36) + '"/><path d="M50 53v26M43 62h14"/><path d="M36 92c2-8 26-8 28 0z"/><path d="M50 2v8"/>' },
    palma: { label: 'Palma (Niedziela Palmowa)', svg: palmPath() },
    swieca: { label: 'Świeca', svg: '<path d="M41 42h18v52H41z"/><path class="f" d="M50 10c8 10 8 19 0 24-8-5-8-14 0-24z"/><path d="M50 34v8"/><path d="' + raysPath(14, 18, 24, 50, 26) + '" opacity=".5"/>' },
    wieniec: { label: 'Wieniec adwentowy', svg: '<ellipse cx="50" cy="80" rx="40" ry="10"/><path d="M14 78c8 6 64 6 72 0" opacity=".6"/><path d="M22 76V50h8v26M38 80V42h8v38M54 80V42h8v38M70 76V50h8v26"/><path class="f" d="M42 26c4 5 4 9 0 12-4-3-4-7 0-12zM58 26c4 5 4 9 0 12-4-3-4-7 0-12zM26 34c4 5 4 9 0 12-4-3-4-7 0-12zM74 34c4 5 4 9 0 12-4-3-4-7 0-12z"/>' },
    klosy: { label: 'Kłosy (dożynki, Eucharystia)', svg: wheatPath() },
    winogrono: { label: 'Winogrono', svg: '<path d="M50 6c0 8 6 12 12 12M50 6v10"/>' + [[40, 24], [52, 24], [64, 24], [34, 36], [46, 36], [58, 36], [70, 36], [40, 48], [52, 48], [64, 48], [46, 60], [58, 60], [52, 72]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6.2"/>`).join('') + '<path d="M30 18c-8 0-14 6-14 14 8 0 14-6 14-14z"/>' },
    serce: { label: 'Serce', svg: '<path d="M50 88C20 64 8 48 8 33 8 19 19 11 30 11c10 0 16 6 20 14 4-8 10-14 20-14 11 0 22 8 22 22 0 15-12 31-42 55z"/>' },
    'serce-jezusa': { label: 'Najświętsze Serce', svg: '<path d="M50 92C24 72 14 58 14 46c0-11 9-18 18-18 8 0 14 5 18 11 4-6 10-11 18-11 9 0 18 7 18 18 0 12-10 26-36 46z"/><path d="M50 4v24M43 12h14"/><path d="M38 26c4-4 8-4 12 0M50 26c4-4 8-4 12 0" opacity=".6"/>' },
    korona: { label: 'Korona (Królowa Nieba)', svg: '<path d="M14 76l6-40 16 20 14-30 14 30 16-20 6 40z"/><path d="M14 84h72"/><circle class="f" cx="20" cy="34" r="3.5"/><circle class="f" cx="80" cy="34" r="3.5"/><circle class="f" cx="50" cy="24" r="3.5"/><path d="M50 4v14M44 9h12"/>' },
    ryba: { label: 'Ryba (Ichthys)', svg: '<path d="M8 50c22-28 56-28 80 10M8 50c22 28 56 28 80-10"/><circle class="f" cx="26" cy="46" r="2.6"/>' },
    rozaniec: { label: 'Różaniec', svg: rosaryPath() },
    dzwon: { label: 'Dzwon', svg: '<path d="M30 72c0-32 6-50 20-50s20 18 20 50l7 8H23z"/><path d="M50 22v-9"/><circle cx="50" cy="10" r="3.5"/><path d="M45 85a5 5 0 0 0 10 0"/>' },
    nuta: { label: 'Nuty (koncert)', svg: '<ellipse class="f" cx="34" cy="76" rx="10" ry="7" transform="rotate(-20 34 76)"/><ellipse class="f" cx="70" cy="68" rx="10" ry="7" transform="rotate(-20 70 68)"/><path d="M43 74V22l36-8v52"/><path d="M43 34l36-8" stroke-width="7"/>' },
    pisanka: { label: 'Pisanka', svg: '<path d="M50 6C30 6 18 36 18 58c0 20 14 34 32 34s32-14 32-34C82 36 70 6 50 6z"/><path d="M22 46h56M19 62h62"/><path d="M22 54l6-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6 6-6 4 4"/><circle class="f" cx="50" cy="28" r="4"/><circle class="f" cx="38" cy="76" r="3"/><circle class="f" cx="62" cy="76" r="3"/>' },
    promienie: { label: 'Promienie chwały', svg: '<circle cx="50" cy="50" r="14"/><path d="' + raysPath(32, 20, 46) + '"/>' },
    kosciol: { label: 'Kościół', svg: '<path d="M50 4v12M45 9h10"/><path d="M42 30l8-14 8 14v14H42z"/><path d="M18 94V58l32-18 32 18v36z"/><path d="M42 94V76a8 8 0 0 1 16 0v18"/><path d="M28 70h8M64 70h8"/>' },
    'linia-romb': { label: 'Ozdobnik: linia z rombem', vb: '0 0 200 24', svg: '<path d="M6 12h76M118 12h76"/><path d="M100 2l10 10-10 10-10-10z"/><circle class="f" cx="86" cy="12" r="2.2"/><circle class="f" cx="114" cy="12" r="2.2"/>' },
    'linia-krzyz': { label: 'Ozdobnik: linia z krzyżykiem', vb: '0 0 200 24', svg: '<path d="M6 12h80M114 12h80"/><path d="M100 1v22M92 8h16"/>' },
    'linia-zawijas': { label: 'Ozdobnik: zawijasy', vb: '0 0 200 24', svg: '<path d="M8 12h60c10 0 14-8 22-8s10 8 10 8 2-8 10-8 12 8 22 8h60"/><path d="M100 12c-4 4-10 6-14 4M100 12c4 4 10 6 14 4"/><circle class="f" cx="100" cy="12" r="2.6"/>' },
    'linia-kropki': { label: 'Ozdobnik: kropki', vb: '0 0 200 24', svg: '<path d="M10 12h70M120 12h70"/><circle class="f" cx="90" cy="12" r="2.4"/><circle class="f" cx="100" cy="12" r="3.4"/><circle class="f" cx="110" cy="12" r="2.4"/>' }
  };
  const DIVIDERS = ['linia-romb', 'linia-krzyz', 'linia-zawijas', 'linia-kropki'];

  const LAYOUTS = {
    klasyczny: 'Klasyczny – logo, tytuł, obraz, szczegóły',
    obraz: 'Duży obraz u góry',
    ramka: 'Ozdobna ramka, bez zdjęcia',
    harmonogram: 'Harmonogram (godziny i punkty programu)',
    pozioma: 'Dwie kolumny (dla formatów poziomych)'
  };
  const FRAMES = { none: 'Bez ramki', linia: 'Cienka linia', podwojna: 'Podwójna linia', narozniki: 'Ozdobne narożniki', ozdobna: 'Ozdobna (romby)', luk: 'Łuk (okno kościelne)' };
  const PATTERNS = { none: 'Gładkie', promienie: 'Promienie', krzyzyki: 'Drobne krzyżyki', gradient: 'Delikatny gradient', winieta: 'Winieta (ciemniejsze brzegi)' };

  // ───────────────────────── narzędzia ─────────────────────────
  let seq = 0;
  const uid = (p = 'e') => p + Date.now().toString(36).slice(-4) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function richText(s) {
    return esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  }
  const fontCss = (id) => (FONTS[id] || FONTS.garamond).css;

  function resolvePalette(style) {
    const base = PALETTES[style && style.paletteId] || PALETTES['bordo-zloto'];
    return Object.assign({}, base, (style && style.palette) || {});
  }

  // Szacowanie wysokości tekstu (mm) – potem DOM i tak dopasowuje rozmiar (autoFit).
  function estText(text, pt, widthMm, fontId, lh = 1.25, upper = false) {
    if (!text) return 0;
    const f = FONTS[fontId] || FONTS.garamond;
    const cw = pt * 0.3528 * f.w * (upper && fontId !== 'cinzel' ? 1.15 : 1);
    const perLine = Math.max(4, Math.floor(widthMm / cw));
    let lines = 0;
    for (const p of String(text).split('\n')) lines += Math.max(1, Math.ceil(p.length / perLine));
    return lines * pt * 0.3528 * lh + 1;
  }

  // ───────────────────────── elementy ─────────────────────────
  function textEl(role, content, o) {
    return {
      id: uid(), type: 'text', role, x: o.x, y: o.y, w: o.w, h: o.h, rot: 0, opacity: 1,
      text: {
        content: content || '', font: o.font, fontKey: o.fontKey || null, size: Math.round(o.size * 10) / 10,
        weight: o.weight || 400, italic: !!o.italic, color: o.color, colorKey: o.colorKey || null,
        align: o.align || 'center', valign: o.valign || 'middle', lineHeight: o.lh || 1.2,
        letterSpacing: o.ls || 0, upper: !!o.upper, shadow: !!o.shadow, fit: true
      }
    };
  }

  // ───────────────────────── układ ─────────────────────────
  // input: { content, style, format: {w,h}, brand: { assets: {id:{aspect}}, logoId, emblemId, parishLine, footer } }
  function layout(input) {
    const { content: c0, format, brand = {} } = input;
    const style = Object.assign({ paletteId: 'bordo-zloto', fonts: { heading: 'cinzel', body: 'garamond', script: 'vibes' }, layout: 'klasyczny', motif: 'krzyz', divider: 'linia-romb', frame: 'none', pattern: 'none', titleUpper: true, imageShape: 'luk' }, input.style || {});
    style.fonts = Object.assign({ heading: 'cinzel', body: 'garamond', script: 'vibes' }, style.fonts || {});
    const c = Object.assign({ title: '', subtitle: '', dateText: '', timeText: '', placeText: '', body: '', schedule: [], quote: null, closing: '', footer: '', imageId: null, showLogo: true, qr: '' }, c0 || {});
    const W = format.w, H = format.h;
    const P = resolvePalette(style);
    const F = style.fonts;
    const landscape = W / H > 1.15;
    let mode = style.layout;
    if (landscape && mode !== 'ramka') mode = 'pozioma';
    const k = Math.min(W, H) / 210 * (landscape ? 1.08 : 1);
    const aspectOf = (id, def = 1) => (brand.assets && brand.assets[id] && brand.assets[id].aspect) || def;
    const elements = [];
    const hasFrame = style.frame && style.frame !== 'none';
    const m = Math.max(W, H) * (hasFrame ? 0.075 : 0.06);

    // ── stopka i kod QR (dół strony) ──
    let bottom = H - m;
    const footerText = c.footer || brand.footer || '';
    if (footerText || c.qr) {
      const fpt = 9.5 * k;
      const qrSize = c.qr ? Math.min(W, H) * 0.12 : 0;
      const fw = W - 2 * m - (qrSize ? qrSize + 4 : 0);
      const fh = Math.max(estText(footerText, fpt, fw, F.body, 1.3) + 2, qrSize);
      const fpad = style.frame === 'narozniki' || style.frame === 'ozdobna' ? Math.min(W, H) * 0.09 : 0;
      const fx = landscape && mode === 'pozioma' ? W * 0.42 : m + fpad;
      const fwFinal = landscape && mode === 'pozioma' ? W - fx - m - (qrSize ? qrSize + 4 : 0) : fw - 2 * fpad;
      if (footerText) elements.push(textEl('footer', footerText, { x: fx, y: H - m - fh, w: fwFinal, h: fh, font: F.body, fontKey: 'body', size: fpt, color: P.muted, colorKey: 'muted', align: qrSize ? 'left' : 'center', valign: 'bottom', lh: 1.3 }));
      if (qrSize) elements.push({ id: uid(), type: 'qr', role: 'qr', x: W - m - qrSize, y: H - m - qrSize, w: qrSize, h: qrSize, rot: 0, opacity: 1, qr: { data: c.qr, color: P.text, colorKey: 'text', svg: '' } });
      bottom = H - m - fh - 4 * k;
      if (footerText) elements.push({ id: uid(), type: 'shape', role: 'rule', x: fx, y: bottom + 1.5 * k, w: fwFinal + (qrSize ? qrSize + 4 : 0), h: 0.5, rot: 0, opacity: 0.5, shape: { kind: 'rect', fill: P.accent, fillKey: 'accent', stroke: null, strokeWidth: 0, radius: 0 } });
      bottom -= 2 * k;
    }

    // ── bloki pionowe ──
    const blocks = [];
    const add = (b) => blocks.push(Object.assign({ gap: 5 * k }, b));
    const T = (role, text, pt, font, fontKey, colorKey, extra = {}) => {
      if (!text) return;
      add({ kind: 'text', role, text, pt, font, fontKey, colorKey, lh: extra.lh || 1.2, upper: !!extra.upper, weight: extra.weight, italic: extra.italic, gap: (extra.gap != null ? extra.gap : 5) * k, align: extra.align });
    };
    const logoId = brand.logoId || 'brand:logo';
    const emblemId = brand.emblemId || 'brand:herb';
    const titleLen = (c.title || '').length;
    const titlePt = (titleLen > 60 ? 30 : titleLen > 38 ? 38 : titleLen > 22 ? 46 : 54) * k * (F.heading === 'cinzel' ? 0.9 : 1);
    const scheduleBlock = (pt, gap) => { if (c.schedule && c.schedule.length) add({ kind: 'schedule', role: 'schedule', items: c.schedule, pt, gap: gap * k }); };
    const detailBlocks = (scale = 1) => {
      T('date', c.dateText, 30 * k * scale, F.heading, 'heading', 'title', { weight: 600, gap: 6 });
      T('time', c.timeText, 23 * k * scale, F.body, 'body', 'text', { weight: 600, gap: 2 });
      T('place', c.placeText, 18 * k * scale, F.body, 'body', 'text', { italic: true, gap: 2 });
    };
    const textBlocks = () => {
      T('body', c.body, 17 * k, F.body, 'body', 'text', { lh: 1.35, gap: 6 });
      scheduleBlock(17, 5);
      if (c.quote && c.quote.text) add({ kind: 'text', role: 'quote', text: `„${c.quote.text.replace(/^[„"]|[”"]$/g, '')}”${c.quote.source ? '\n' + c.quote.source : ''}`, pt: 15.5 * k, font: F.body, fontKey: 'body', colorKey: 'muted', italic: true, lh: 1.3, gap: 6 * k });
      T('closing', c.closing, (F.script === 'vibes' ? 32 : 22) * k, F.script, 'script', 'accent', { gap: 6 });
    };
    const imgBlock = (maxH, shape) => {
      if (!c.imageId) return;
      const a = aspectOf(c.imageId, 0.8);
      add({ kind: 'image', role: 'image', assetId: c.imageId, aspect: a, maxH, shape: shape || style.imageShape, gap: 6 * k });
    };

    let col = { x: m, w: W - 2 * m, top: m, bottom };

    if (mode === 'klasyczny') {
      if (c.showLogo) add({ kind: 'image', role: 'logo', assetId: logoId, aspect: aspectOf(logoId, 0.82), maxH: H * 0.14, fixed: true, gap: 0 });
      else T('kicker', brand.parishLine, 12 * k, F.heading, 'heading', 'muted', { upper: true, gap: 0 });
      add({ kind: 'motif', role: 'divider', name: style.divider, w: W * 0.42, gap: 4 * k });
      T('title', c.title, titlePt, F.heading, 'heading', 'title', { upper: style.titleUpper, weight: 700, lh: 1.08 });
      T('subtitle', c.subtitle, 21 * k, F.body, 'body', 'accent', { italic: true, gap: 3 });
      imgBlock(H * 0.25);
      detailBlocks();
      textBlocks();
    } else if (mode === 'obraz') {
      if (c.imageId) {
        const ih = H * (H / W < 1.2 ? 0.32 : 0.42);
        elements.push({ id: uid(), type: 'image', role: 'image', x: 0, y: 0, w: W, h: ih, rot: 0, opacity: 1, image: { assetId: c.imageId, fit: 'cover', shape: 'rect', radius: 0, borderWidth: 0, borderColor: P.accent, tint: null, posY: 30 } });
        elements.push({ id: uid(), type: 'shape', role: 'fade', x: 0, y: ih * 0.55, w: W, h: ih * 0.45 + 0.5, rot: 0, opacity: 1, shape: { kind: 'rect', fill: `linear-gradient(180deg, transparent, ${P.bg})`, fillKey: 'fade', stroke: null, strokeWidth: 0, radius: 0 } });
        col.top = ih - 4 * k;
      }
      if (c.showLogo) {
        const lh = H * 0.085, lw = lh * aspectOf(emblemId, 1.1);
        elements.push({ id: uid(), type: 'image', role: 'logo', x: m * 0.8, y: m * 0.7, w: lw, h: lh, rot: 0, opacity: 1, image: { assetId: emblemId, fit: 'contain', shape: 'rect', radius: 0, borderWidth: 0, borderColor: P.accent, tint: c.imageId ? '#ffffff' : null } });
        if (!c.imageId) col.top = m + lh + 4 * k;
      }
      T('title', c.title, titlePt, F.heading, 'heading', 'title', { upper: style.titleUpper, weight: 700, lh: 1.08, gap: 0 });
      T('subtitle', c.subtitle, 19 * k, F.body, 'body', 'accent', { italic: true, gap: 3 });
      add({ kind: 'motif', role: 'divider', name: style.divider, w: W * 0.4, gap: 4 * k });
      detailBlocks();
      textBlocks();
      if (!footerText) T('kicker', brand.parishLine, 10.5 * k, F.heading, 'heading', 'muted', { upper: true, gap: 6 });
    } else if (mode === 'ramka') {
      add({ kind: 'motif', role: 'motif', name: style.motif || 'krzyz', h: H * 0.08, gap: 0 });
      T('kicker', brand.parishLine, 11 * k, F.heading, 'heading', 'muted', { upper: true, gap: 4 });
      T('title', c.title, titlePt, F.heading, 'heading', 'title', { upper: style.titleUpper, weight: 700, lh: 1.08 });
      T('subtitle', c.subtitle, (F.script === 'vibes' ? 30 : 20) * k, F.script, 'script', 'accent', { gap: 2 });
      add({ kind: 'motif', role: 'divider', name: style.divider, w: W * 0.38, gap: 4 * k });
      imgBlock(H * 0.18, 'kolo');
      detailBlocks();
      textBlocks();
      if (c.showLogo) add({ kind: 'image', role: 'logo', assetId: emblemId, aspect: aspectOf(emblemId, 1.1), maxH: H * 0.07, fixed: true, gap: 5 * k });
    } else if (mode === 'harmonogram') {
      if (c.showLogo) add({ kind: 'row', role: 'header', assetId: emblemId, aspect: aspectOf(emblemId, 1.1), text: brand.parishLine, h: H * 0.075, gap: 0 });
      else T('kicker', brand.parishLine, 12 * k, F.heading, 'heading', 'muted', { upper: true, gap: 0 });
      add({ kind: 'motif', role: 'divider', name: style.divider, w: W * 0.5, gap: 4 * k });
      T('title', c.title, titlePt * 0.9, F.heading, 'heading', 'title', { upper: style.titleUpper, weight: 700, lh: 1.08 });
      T('subtitle', c.subtitle, 18 * k, F.body, 'body', 'accent', { italic: true, gap: 3 });
      detailBlocks(0.85);
      scheduleBlock(18, 7);
      T('body', c.body, 14 * k, F.body, 'body', 'text', { lh: 1.35, gap: 6 });
      if (c.quote && c.quote.text) add({ kind: 'text', role: 'quote', text: `„${c.quote.text.replace(/^[„"]|[”"]$/g, '')}”${c.quote.source ? '\n' + c.quote.source : ''}`, pt: 13 * k, font: F.body, fontKey: 'body', colorKey: 'muted', italic: true, lh: 1.3, gap: 6 * k });
      T('closing', c.closing, (F.script === 'vibes' ? 30 : 20) * k, F.script, 'script', 'accent', { gap: 6 });
    } else { // pozioma
      const leftW = W * 0.38;
      if (c.imageId) {
        elements.push({ id: uid(), type: 'image', role: 'image', x: 0, y: 0, w: leftW, h: H, rot: 0, opacity: 1, image: { assetId: c.imageId, fit: 'cover', shape: 'rect', radius: 0, borderWidth: 0, borderColor: P.accent, tint: null, posY: 35 } });
        if (c.showLogo) {
          const lh = H * 0.16, lw = lh * aspectOf(emblemId, 1.1);
          elements.push({ id: uid(), type: 'image', role: 'logo', x: (leftW - lw) / 2, y: H - lh - m * 0.6, w: lw, h: lh, rot: 0, opacity: 1, image: { assetId: emblemId, fit: 'contain', shape: 'rect', radius: 0, borderWidth: 0, borderColor: P.accent, tint: '#ffffff' } });
          elements.push({ id: uid(), type: 'shape', role: 'fade', x: 0, y: H * 0.55, w: leftW, h: H * 0.45, rot: 0, opacity: 0.85, shape: { kind: 'rect', fill: 'linear-gradient(180deg, transparent, rgba(0,0,0,.65))', fillKey: null, stroke: null, strokeWidth: 0, radius: 0 } });
        }
      } else if (c.showLogo) {
        const lh = H * 0.62, lw = Math.min(leftW * 0.8, lh * aspectOf(logoId, 0.82));
        elements.push({ id: uid(), type: 'image', role: 'logo', x: (leftW - lw) / 2 + m * 0.3, y: (H - lw / aspectOf(logoId, 0.82)) / 2, w: lw, h: lw / aspectOf(logoId, 0.82), rot: 0, opacity: 1, image: { assetId: logoId, fit: 'contain', shape: 'rect', radius: 0, borderWidth: 0, borderColor: P.accent, tint: null } });
      }
      col = { x: leftW + m * 0.8, w: W - leftW - m * 1.8, top: m, bottom };
      T('kicker', brand.parishLine, 10 * k, F.heading, 'heading', 'muted', { upper: true, gap: 0 });
      T('title', c.title, titlePt * 0.82, F.heading, 'heading', 'title', { upper: style.titleUpper, weight: 700, lh: 1.08, gap: 4 });
      T('subtitle', c.subtitle, 16 * k, F.body, 'body', 'accent', { italic: true, gap: 3 });
      add({ kind: 'motif', role: 'divider', name: style.divider, w: col.w * 0.5, gap: 3 * k });
      detailBlocks(0.8);
      T('body', c.body, 13 * k, F.body, 'body', 'text', { lh: 1.3, gap: 4 });
      scheduleBlock(13.5, 4);
      T('closing', c.closing, (F.script === 'vibes' ? 26 : 18) * k, F.script, 'script', 'accent', { gap: 4 });
    }

    placeBlocks(blocks, col, elements, { P, F, k, W, H });

    return {
      id: uid('p'),
      name: c.title || 'Nowy plakat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      format: { id: input.formatId || null, w: W, h: H },
      style: Object.assign({}, style, { palette: style.palette || null }),
      background: { color: P.bg, color2: P.bg2, colorKey: 'bg', pattern: style.pattern || 'none', imageAssetId: null, imageOpacity: 0.15 },
      frame: { style: style.frame || 'none', color: P.accent, colorKey: 'accent', inset: Math.max(W, H) * 0.03, width: 0.8 },
      content: c,
      elements
    };
  }

  function blockHeight(b, w, k) {
    if (b.kind === 'text') return estText(b.text, b.pt, w, b.font, b.lh, b.upper);
    if (b.kind === 'image') { const ww = Math.min(w, b.maxH * b.aspect); return ww / b.aspect; }
    if (b.kind === 'motif') { const def = MOTIFS[b.name] || MOTIFS['linia-romb']; if (b.h) return b.h; const vb = (def.vb || '0 0 100 100').split(' ').map(Number); return b.w * vb[3] / vb[2]; }
    if (b.kind === 'schedule') return b.items.reduce((s, it) => s + Math.max(estText(it.what, b.pt * k, w * 0.7, 'garamond', 1.25), b.pt * k * 0.3528 * 1.3) + 1.6 * k, 0);
    if (b.kind === 'row') return b.h;
    return 0;
  }

  function placeBlocks(blocks, col, elements, ctx) {
    const { P, F, k } = ctx;
    const avail = col.bottom - col.top;
    let scale = 1;
    const g = () => Math.min(1, scale);
    const measure = () => blocks.reduce((s, b, i) => s + (i ? b.gap * g() : 0) + b._h, 0);
    for (let iter = 0; iter < 14; iter++) {
      for (const b of blocks) {
        const sb = Object.assign({}, b, { pt: b.pt * scale, maxH: b.maxH && !b.fixed ? b.maxH * Math.max(scale, 0.55) : b.maxH, h: b.h ? b.h * (b.kind === 'motif' ? scale : 1) : b.h });
        b._s = sb;
        b._h = blockHeight(sb, col.w, k);
      }
      if (measure() <= avail || scale < 0.32) break;
      scale *= 0.93;
    }
    // dużo wolnego miejsca – powiększ (do 30%)
    if (scale === 1 && measure() < avail * 0.7) {
      for (let iter = 0; iter < 8; iter++) {
        const next = scale * 1.05;
        const trial = blocks.map((b) => { const sb = Object.assign({}, b, { pt: b.pt * next, maxH: b.maxH ? b.maxH * Math.min(next, 1.2) : b.maxH, h: b.h && b.kind === 'motif' ? b.h * next : b.h }); return { sb, hh: blockHeight(sb, col.w, k) }; });
        const tot = trial.reduce((sum, t, i) => sum + (i ? blocks[i].gap : 0) + t.hh, 0);
        if (tot > avail * 0.86 || next > 1.3) break;
        scale = next;
        trial.forEach((t, i) => { blocks[i]._s = t.sb; blocks[i]._h = t.hh; });
      }
    }
    const total = measure();
    let extra = Math.max(0, avail - total);
    const gaps = blocks.length - 1;
    const perGap = gaps > 0 ? Math.min(extra * 0.7 / gaps, 9 * k) : 0;
    extra -= perGap * gaps;
    let y = col.top + extra / 2;
    blocks.forEach((b, i) => {
      if (i) y += b.gap * g() + perGap;
      const s = b._s, h = b._h;
      if (b.kind === 'text') {
        elements.push(textEl(b.role, b.text, { x: col.x, y, w: col.w, h: h + 1, font: s.font, fontKey: s.fontKey, size: s.pt, color: P[s.colorKey], colorKey: s.colorKey, weight: s.weight || (s.role === 'title' ? 700 : 400), italic: s.italic, lh: s.lh, upper: s.upper, align: s.align || 'center' }));
      } else if (b.kind === 'image') {
        const w = h * b.aspect;
        elements.push({ id: uid(), type: 'image', role: b.role, x: col.x + (col.w - w) / 2, y, w, h, rot: 0, opacity: 1, image: { assetId: b.assetId, fit: b.role === 'logo' ? 'contain' : 'cover', shape: b.role === 'logo' ? 'rect' : (b.shape || 'rect'), radius: 0, borderWidth: b.role === 'logo' ? 0 : 0.8, borderColor: P.accent, borderKey: 'accent', tint: null } });
      } else if (b.kind === 'motif') {
        const def = MOTIFS[b.name] || MOTIFS['linia-romb'];
        const vb = (def.vb || '0 0 100 100').split(' ').map(Number);
        const w = h * vb[2] / vb[3];
        elements.push({ id: uid(), type: 'motif', role: b.role, x: col.x + (col.w - w) / 2, y, w, h, rot: 0, opacity: 1, motif: { name: b.name, color: P.accent, colorKey: 'accent', stroke: def.vb ? 1.6 : 3 } });
      } else if (b.kind === 'schedule') {
        elements.push({ id: uid(), type: 'schedule', role: 'schedule', x: col.x + col.w * 0.06, y, w: col.w * 0.88, h: h + 2, rot: 0, opacity: 1, schedule: { items: b.items.map((it) => ({ when: it.when || '', what: it.what || '' })), font: F.body, fontKey: 'body', whenFont: F.heading, whenFontKey: 'heading', size: Math.round(s.pt * k * 10) / 10, color: P.text, colorKey: 'text', whenColor: P.title, whenColorKey: 'title', lines: true, lineColor: P.accent, lineKey: 'accent', fit: true } });
      } else if (b.kind === 'row') {
        const lw = h * b.aspect;
        const tw = Math.min(col.w - lw - 4, col.w * 0.7);
        const x0 = col.x + (col.w - lw - 4 - tw) / 2;
        elements.push({ id: uid(), type: 'image', role: 'logo', x: x0, y, w: lw, h, rot: 0, opacity: 1, image: { assetId: b.assetId, fit: 'contain', shape: 'rect', radius: 0, borderWidth: 0, borderColor: P.accent, tint: null } });
        if (b.text) elements.push(textEl('kicker', b.text, { x: x0 + lw + 4, y, w: tw, h, font: F.heading, fontKey: 'heading', size: 12 * k, color: P.muted, colorKey: 'muted', align: 'left', upper: true, lh: 1.25 }));
      }
      y += h;
    });
  }

  // ───────────────────────── zmiany stylu ─────────────────────────
  function recolor(poster, paletteId, custom) {
    const p = clone(poster);
    p.style.paletteId = paletteId;
    p.style.palette = custom || null;
    const P = resolvePalette(p.style);
    if (p.background.colorKey !== null) { p.background.color = P.bg; p.background.color2 = P.bg2; p.background.colorKey = 'bg'; }
    if (p.frame.colorKey) p.frame.color = P[p.frame.colorKey];
    for (const e of p.elements) {
      if (e.text && e.text.colorKey) e.text.color = P[e.text.colorKey];
      if (e.motif && e.motif.colorKey) e.motif.color = P[e.motif.colorKey];
      if (e.qr && e.qr.colorKey) e.qr.color = P[e.qr.colorKey];
      if (e.image && e.image.borderKey) e.image.borderColor = P[e.image.borderKey];
      if (e.shape) {
        if (e.shape.fillKey === 'fade') e.shape.fill = `linear-gradient(180deg, transparent, ${P.bg})`;
        else if (e.shape.fillKey) e.shape.fill = P[e.shape.fillKey];
      }
      if (e.schedule) {
        const s = e.schedule;
        if (s.colorKey) s.color = P[s.colorKey];
        if (s.whenColorKey) s.whenColor = P[s.whenColorKey];
        if (s.lineKey) s.lineColor = P[s.lineKey];
      }
    }
    return p;
  }

  function refont(poster, fonts) {
    const p = clone(poster);
    p.style.fonts = Object.assign({}, p.style.fonts, fonts);
    for (const e of p.elements) {
      if (e.text && e.text.fontKey) e.text.font = p.style.fonts[e.text.fontKey];
      if (e.schedule) {
        if (e.schedule.fontKey) e.schedule.font = p.style.fonts[e.schedule.fontKey];
        if (e.schedule.whenFontKey) e.schedule.whenFont = p.style.fonts[e.schedule.whenFontKey];
      }
    }
    return p;
  }

  // Aktualizacja treści bez ruszania układu. Zwraca null, gdy potrzebny jest nowy układ.
  const ROLE_FIELD = { title: 'title', subtitle: 'subtitle', date: 'dateText', time: 'timeText', place: 'placeText', body: 'body', closing: 'closing', footer: 'footer' };
  function quoteText(q) { return q && q.text ? `„${q.text.replace(/^[„"]|[”"]$/g, '')}”${q.source ? '\n' + q.source : ''}` : ''; }
  function applyContent(poster, content) {
    const p = clone(poster);
    const c = Object.assign({}, p.content, content);
    const roles = new Set(p.elements.map((e) => e.role));
    const want = (role) => {
      if (role === 'schedule') return !!(c.schedule && c.schedule.length);
      if (role === 'quote') return !!(c.quote && c.quote.text);
      if (role === 'image') return !!c.imageId;
      return !!c[ROLE_FIELD[role]];
    };
    for (const role of [...Object.keys(ROLE_FIELD), 'schedule', 'quote', 'image']) {
      if (role === 'footer') continue;
      if (want(role) && !roles.has(role)) return null;
    }
    p.elements = p.elements.filter((e) => !(e.role in ROLE_FIELD || e.role === 'schedule' || e.role === 'quote' || (e.role === 'image' && e.type === 'image')) || want(e.role) || (e.role === 'footer' && c.footer));
    for (const e of p.elements) {
      if (e.type === 'text' && ROLE_FIELD[e.role]) e.text.content = c[ROLE_FIELD[e.role]] || '';
      if (e.role === 'quote' && e.type === 'text') e.text.content = quoteText(c.quote);
      if (e.type === 'schedule') e.schedule.items = (c.schedule || []).map((it) => ({ when: it.when || '', what: it.what || '' }));
      if (e.role === 'image' && e.type === 'image' && c.imageId) e.image.assetId = c.imageId;
    }
    p.content = c;
    p.name = c.title || p.name;
    return p;
  }

  // ───────────────────────── renderowanie (DOM) ─────────────────────────
  const CSS = `
.poster-page{position:relative;overflow:hidden;box-sizing:border-box;-webkit-font-smoothing:antialiased;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.poster-page *{box-sizing:border-box;}
.pe{position:absolute;}
.pe-text{width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;white-space:normal;word-wrap:break-word;}
.pe-text>div{width:100%;}
.pe-text b{font-weight:700;}
.pe-img{width:100%;height:100%;background-repeat:no-repeat;}
.pe-svg{width:100%;height:100%;display:block;overflow:visible;}
.pe-svg .f{fill:currentColor;stroke:none;}
.pe-sched{width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;overflow:hidden;}
.pe-sched .r{display:grid;grid-template-columns:auto 1fr;column-gap:.9em;align-items:baseline;padding:.32em 0;}
.pe-sched .w{font-weight:700;white-space:nowrap;text-align:right;min-width:4.2em;}
.pe-bgl{position:absolute;inset:0;pointer-events:none;}
`;
  function ensureStyles(doc) {
    doc = doc || document;
    if (doc.getElementById('poster-css')) return;
    const s = doc.createElement('style');
    s.id = 'poster-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  function motifSvg(name, color, stroke) {
    const def = MOTIFS[name] || MOTIFS.krzyz;
    return `<svg class="pe-svg" viewBox="${def.vb || '0 0 100 100'}" preserveAspectRatio="xMidYMid meet" style="color:${esc(color)}" fill="none" stroke="currentColor" stroke-width="${stroke || 3}" stroke-linecap="round" stroke-linejoin="round">${def.svg}</svg>`;
  }

  function frameSvg(frame, W, H) {
    if (!frame || !frame.style || frame.style === 'none') return '';
    const i = frame.inset, c = esc(frame.color), sw = frame.width || 0.8;
    let s = '';
    const rect = (d) => `<rect x="${i + d}" y="${i + d}" width="${W - 2 * (i + d)}" height="${H - 2 * (i + d)}"/>`;
    if (frame.style === 'linia') s = rect(0);
    else if (frame.style === 'podwojna') s = rect(0) + `<g stroke-width="${sw * 0.5}">${rect(2.2)}</g>`;
    else if (frame.style === 'narozniki' || frame.style === 'ozdobna') {
      const L = Math.min(W, H) * 0.12;
      const corner = (x, y, sx, sy) => `<path d="M${x} ${y + sy * L}V${y}H${x + sx * L}M${x + sx * 3} ${y + sy * (L * 0.7)}V${y + sy * 3}H${x + sx * (L * 0.7)}"/><path d="M${x + sx * 7} ${y + sy * 7}m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" fill="${c}"/>`;
      s = corner(i, i, 1, 1) + corner(W - i, i, -1, 1) + corner(i, H - i, 1, -1) + corner(W - i, H - i, -1, -1);
      if (frame.style === 'ozdobna') {
        s += `<g stroke-width="${sw * 0.6}"><path d="M${i + L + 3} ${i}H${W - i - L - 3}M${i + L + 3} ${H - i}H${W - i - L - 3}M${i} ${i + L + 3}V${H - i - L - 3}M${W - i} ${i + L + 3}V${H - i - L - 3}"/></g>`;
        const dia = (x, y) => `<path d="M${x} ${y - 3}l3 3-3 3-3-3z" fill="${c}"/>`;
        s += dia(W / 2, i) + dia(W / 2, H - i) + dia(i, H / 2) + dia(W - i, H / 2);
      }
    } else if (frame.style === 'luk') {
      const r = (W - 2 * i) / 2;
      s = `<path d="M${i} ${H - i}V${i + r}A${r} ${r} 0 0 1 ${W - i} ${i + r}V${H - i}Z"/><path stroke-width="${sw * 0.5}" d="M${i + 2.5} ${H - i - 2.5}V${i + r}A${r - 2.5} ${r - 2.5} 0 0 1 ${W - i - 2.5} ${i + r}V${H - i - 2.5}Z"/>`;
    }
    return `<svg class="pe-bgl" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" fill="none" stroke="${c}" stroke-width="${sw}" style="z-index:900">${s}</svg>`;
  }

  function patternLayer(bg, W, H, P) {
    const col = esc(P.accent);
    if (bg.pattern === 'promienie') {
      let d = '';
      for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2; d += `M${W / 2} ${H * 0.28}L${W / 2 + Math.cos(a) * W * 2} ${H * 0.28 + Math.sin(a) * W * 2}`; }
      return `<svg class="pe-bgl" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="opacity:.09"><path d="${d}" stroke="${col}" stroke-width="${W / 60}"/></svg>`;
    }
    if (bg.pattern === 'krzyzyki') {
      return `<svg class="pe-bgl" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="opacity:.08"><defs><pattern id="kp" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M7 3.5v7M4.5 6h5" stroke="${col}" stroke-width=".7" fill="none"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#kp)"/></svg>`;
    }
    if (bg.pattern === 'winieta') return '<div class="pe-bgl" style="background:radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.18) 100%)"></div>';
    return '';
  }

  // Zwraca element DOM strony w skali 1:1 (96 dpi). opts: { assetUrl(id), editable }
  function render(poster, opts = {}) {
    const doc = opts.document || document;
    ensureStyles(doc);
    const W = poster.format.w, H = poster.format.h;
    const P = resolvePalette(poster.style);
    const bg = poster.background || {};
    const page = doc.createElement('div');
    page.className = 'poster-page';
    page.style.width = W * MM + 'px';
    page.style.height = H * MM + 'px';
    page.style.background = bg.pattern === 'gradient' ? `linear-gradient(170deg, ${bg.color} 0%, ${bg.color} 45%, ${bg.color2 || bg.color} 100%)` : bg.color || '#fff';
    let html = '';
    if (bg.imageAssetId && opts.assetUrl) html += `<div class="pe-bgl" style="background:url('${opts.assetUrl(bg.imageAssetId)}') center/cover;opacity:${bg.imageOpacity != null ? bg.imageOpacity : 0.15}"></div>`;
    html += patternLayer(bg, W, H, P);
    page.innerHTML = html;
    // elementy rysujemy w jednostkach mm (×MM) – bez transformacji, żeby tekst był ostry
    poster.elements.forEach((e, idx) => page.appendChild(renderElement(e, idx, opts, doc)));
    const fr = frameSvg(poster.frame, W, H);
    if (fr) page.insertAdjacentHTML('beforeend', fr);
    return page;
  }

  function renderElement(e, idx, opts, doc) {
    const d = doc.createElement('div');
    d.className = 'pe pe-' + e.type;
    d.dataset.id = e.id;
    d.style.left = e.x * MM + 'px';
    d.style.top = e.y * MM + 'px';
    d.style.width = Math.max(e.w, 0.3) * MM + 'px';
    d.style.height = Math.max(e.h, 0.3) * MM + 'px';
    d.style.zIndex = String(e.z != null ? e.z : idx + 1);
    if (e.rot) d.style.transform = `rotate(${e.rot}deg)`;
    if (e.opacity != null && e.opacity !== 1) d.style.opacity = e.opacity;
    if (e.hidden) d.style.display = 'none';
    if (e.type === 'text') {
      const t = e.text;
      const inner = doc.createElement('div');
      inner.className = 'pe-text';
      inner.style.fontFamily = fontCss(t.font);
      inner.style.fontSize = t.size * PT + 'px';
      inner.style.fontWeight = t.weight || 400;
      inner.style.fontStyle = t.italic ? 'italic' : 'normal';
      inner.style.color = t.color;
      inner.style.textAlign = t.align || 'center';
      inner.style.justifyContent = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[t.valign || 'middle'];
      inner.style.lineHeight = t.lineHeight || 1.2;
      inner.style.letterSpacing = (t.letterSpacing || 0) + 'em';
      if (t.upper) inner.style.textTransform = 'uppercase';
      if (t.shadow) inner.style.textShadow = '0 0.04em 0.18em rgba(0,0,0,.45)';
      if (t.bg) { inner.style.background = t.bg; inner.style.padding = '0.25em 0.5em'; inner.style.borderRadius = '0.2em'; }
      inner.innerHTML = `<div>${richText(t.content)}</div>`;
      d.appendChild(inner);
    } else if (e.type === 'image') {
      const im = e.image;
      const url = opts.assetUrl ? opts.assetUrl(im.assetId) : '';
      const inner = doc.createElement('div');
      inner.className = 'pe-img';
      const pos = `50% ${im.posY != null ? im.posY : 50}%`;
      if (im.tint) {
        inner.style.backgroundColor = im.tint;
        inner.style.webkitMaskImage = `url('${url}')`;
        inner.style.webkitMaskSize = im.fit === 'cover' ? 'cover' : 'contain';
        inner.style.webkitMaskRepeat = 'no-repeat';
        inner.style.webkitMaskPosition = pos;
      } else {
        inner.style.backgroundImage = `url('${url}')`;
        inner.style.backgroundSize = im.fit === 'cover' ? 'cover' : im.fit === 'stretch' ? '100% 100%' : 'contain';
        inner.style.backgroundPosition = pos;
      }
      const shape = im.shape || 'rect';
      if (shape === 'luk') inner.style.borderRadius = `${e.w * MM / 2}px ${e.w * MM / 2}px ${(im.radius || 0) * MM}px ${(im.radius || 0) * MM}px`;
      else if (shape === 'kolo') inner.style.borderRadius = '50%';
      else inner.style.borderRadius = (im.radius || 0) * MM + 'px';
      if (im.borderWidth) inner.style.boxShadow = `0 0 0 ${im.borderWidth * MM}px ${im.borderColor || '#b08a3e'}`;
      if (im.shadow) inner.style.filter = 'drop-shadow(0 2mm 4mm rgba(0,0,0,.25))';
      if (im.grayscale) inner.style.filter = (inner.style.filter || '') + ' grayscale(1)';
      d.appendChild(inner);
    } else if (e.type === 'motif') {
      d.innerHTML = motifSvg(e.motif.name, e.motif.color, e.motif.stroke);
    } else if (e.type === 'shape') {
      const s = e.shape;
      const inner = doc.createElement('div');
      inner.style.cssText = 'width:100%;height:100%;';
      inner.style.background = s.fill || 'transparent';
      if (s.stroke && s.strokeWidth) inner.style.border = `${s.strokeWidth * MM}px solid ${s.stroke}`;
      inner.style.borderRadius = s.kind === 'ellipse' ? '50%' : (s.radius || 0) * MM + 'px';
      d.appendChild(inner);
    } else if (e.type === 'schedule') {
      const s = e.schedule;
      const inner = doc.createElement('div');
      inner.className = 'pe-sched';
      inner.style.fontFamily = fontCss(s.font);
      inner.style.fontSize = s.size * PT + 'px';
      inner.style.color = s.color;
      inner.innerHTML = s.items.map((it, i) => `<div class="r" style="${s.lines && i ? `border-top:${0.25 * MM}px solid ${esc(s.lineColor)}55` : ''}"><span class="w" style="font-family:${esc(fontCss(s.whenFont))};color:${esc(s.whenColor)}">${richText(it.when)}</span><span>${richText(it.what)}</span></div>`).join('');
      d.appendChild(inner);
    } else if (e.type === 'qr') {
      const inner = doc.createElement('div');
      inner.style.cssText = `width:100%;height:100%;color:${e.qr.color || '#000'}`;
      inner.innerHTML = e.qr.svg || '';
      const svg = inner.querySelector('svg');
      if (svg) { svg.style.width = '100%'; svg.style.height = '100%'; svg.style.display = 'block'; }
      d.appendChild(inner);
    }
    return d;
  }

  // Dopasowanie tekstu do ramek (po wstawieniu strony do dokumentu i wczytaniu czcionek).
  function fitText(page) {
    const nodes = page.querySelectorAll('.pe-text, .pe-sched');
    for (const n of nodes) {
      const box = n.parentElement;
      const base = parseFloat(n.style.fontSize);
      if (!base) continue;
      n.style.fontSize = base + 'px';
      let size = base;
      let guard = 0;
      while ((n.scrollHeight > box.clientHeight + 1 || n.scrollWidth > box.clientWidth + 1) && size > base * 0.35 && guard++ < 40) {
        size *= 0.95;
        n.style.fontSize = size + 'px';
      }
    }
  }

  // Wczytanie wszystkich czcionek plakatu (przed dopasowaniem tekstu i drukiem)
  let fontsPromise = null;
  function loadFonts(doc) {
    doc = doc || document;
    if (fontsPromise) return fontsPromise;
    const fams = ['P Inter', 'P Cinzel', 'P Cormorant', 'P Garamond', 'P Lora', 'P Oswald', 'P Playfair', 'P Vibes'];
    const jobs = [];
    for (const f of fams) for (const v of ['400', '700', 'italic 400']) jobs.push(doc.fonts.load(`${v} 20px "${f}"`, 'AaĄąŚś').catch(() => null));
    fontsPromise = Promise.all(jobs).then(() => doc.fonts.ready);
    return fontsPromise;
  }

  function defaultFooter(parish) {
    if (!parish) return '';
    const parts = [parish.address, parish.phone ? 'tel. ' + parish.phone : '', parish.website, parish.facebook].filter(Boolean);
    return parts.join('  ·  ');
  }

  return { MM, PT, FORMATS, FONTS, PALETTES, MOTIFS, DIVIDERS, LAYOUTS, FRAMES, PATTERNS, layout, recolor, refont, applyContent, render, fitText, resolvePalette, motifSvg, ensureStyles, uid, clone, defaultFooter, estText, loadFonts };
});
