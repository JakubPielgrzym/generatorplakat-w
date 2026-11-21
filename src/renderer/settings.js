'use strict';
/* global UI, icon, Poster, state, h, iconEl, toast, segmented, select, toggle, spinner, group, row, busy, saveSettings, loadSettings, render, renderSidebar, errToast, allPresets, loadUpcoming, loadAgent */
// Ustawienia: parafia, plakaty, Claude, druk, agent, wygląd.

function viewSettings() {
  const tabs = [
    { value: 'parafia', label: 'Parafia', icon: 'cross' },
    { value: 'plakaty', label: 'Plakaty', icon: 'photo' },
    { value: 'claude', label: 'Claude (AI)', icon: 'cpu' },
    { value: 'druk', label: 'Druk', icon: 'printer' },
    { value: 'agent', label: 'Agent i internet', icon: 'bolt' },
    { value: 'ogolne', label: 'Ogólne', icon: 'gear' }
  ];
  const body = { parafia: settingsParish, plakaty: settingsPosters, claude: settingsAi, druk: settingsPrint, agent: settingsAgent, ogolne: settingsGeneral }[state.settingsTab]();
  return h('div', null,
    h('div', { class: 'toolbar' }, h('h1', null, 'Ustawienia')),
    h('div', { class: 'page' },
      h('div', { class: 'settings-tabs' }, segmented(tabs, state.settingsTab, (v) => { state.settingsTab = v; render(); })),
      body));
}

function textInput(value, onSave, attrs = {}) {
  return h(attrs.textarea ? 'textarea' : 'input', { class: 'input' + (attrs.textarea ? ' area' : ''), rows: attrs.rows || null, style: { width: attrs.width || '320px' }, value: value || '', placeholder: attrs.placeholder || '', type: attrs.type || 'text', onchange: (e) => onSave(e.target.value) });
}

function settingsParish() {
  const p = state.settings.parish;
  const f = (key, label, ic, color, attrs = {}) => row(label, textInput(p[key], (v) => saveSettings({ parish: { [key]: v } }, true).then(() => { if (attrs.rerender) render(); }), attrs), { icon: ic, color, hint: attrs.hint });
  const feasts = state.settings.parishFeasts || [];
  const presetOpts = allPresets().map((x) => ({ value: x.id, label: x.name }));
  const saveFeasts = async (list) => { try { state.settings = await api.replaceSetting('parishFeasts', list); await loadUpcoming(); await loadAgent(); render(); } catch (e) { errToast(e); } };
  return h('div', null,
    group('Dane parafii (trafiają na plakaty i do AI)', [
      f('name', 'Nazwa parafii', 'cross', 'var(--accent)', { placeholder: 'Parafia pw. …', rerender: true }),
      f('place', 'Miejscowość (z przyimkiem)', 'home', 'var(--indigo)', { placeholder: 'w Koziebrodach', rerender: true }),
      f('sanctuary', 'Sanktuarium', 'sparkles', 'var(--purple)'),
      f('diocese', 'Diecezja', 'globe', 'var(--teal)'),
      f('address', 'Adres', 'home', 'var(--orange)', { placeholder: 'Koziebrody …, kod pocztowy' }),
      f('phone', 'Telefon', 'bell', 'var(--green)'),
      f('email', 'E-mail', 'doc', 'var(--accent)'),
      f('website', 'Strona internetowa', 'globe', 'var(--teal)', { placeholder: 'https://…' }),
      f('facebook', 'Facebook', 'people', 'var(--indigo)'),
      f('pastor', 'Proboszcz', 'person', 'var(--pink)', { placeholder: 'ks. …' }),
      f('massSunday', 'Msze w niedziele', 'clock', 'var(--orange)', { placeholder: 'np. 8:00, 10:00, 12:00' }),
      f('massWeekday', 'Msze w dni powszednie', 'clock', 'var(--orange)', { placeholder: 'np. 18:00' }),
      f('office', 'Kancelaria – godziny', 'clock', 'var(--text-3)', { placeholder: 'np. wt. i pt. 16:00–17:00' }),
      f('bankAccount', 'Konto parafii', 'key', 'var(--green)')
    ], 'Uzupełnij brakujące pola – AI korzysta z nich przy pisaniu treści, a stopka plakatu tworzy się automatycznie.'),
    h('section', { class: 'group' },
      h('h3', { class: 'group-title' }, 'Święta parafii i sanktuarium (co roku)'),
      h('div', { class: 'group-body' },
        feasts.map((x, i) => h('div', { class: 'row feast-row' },
          h('input', { class: 'input', style: { width: '74px' }, value: x.md, placeholder: 'MM-DD', title: 'Miesiąc-dzień, np. 07-25', onchange: (e) => { const v = e.target.value.trim(); if (!/^\d{2}-\d{2}$/.test(v)) { toast('Wpisz datę jako MM-DD, np. 07-25', 'error'); return; } feasts[i].md = v; saveFeasts(feasts); } }),
          h('input', { class: 'input', style: { flex: 1 }, value: x.name, onchange: (e) => { feasts[i].name = e.target.value; saveFeasts(feasts); } }),
          select(presetOpts, x.presetId, (v) => { feasts[i].presetId = v; saveFeasts(feasts); }, { style: { width: '200px' } }),
          h('input', { class: 'input', type: 'number', style: { width: '64px' }, min: 3, max: 120, value: x.leadDays || 30, title: 'Ile dni wcześniej przypomnieć', onchange: (e) => { feasts[i].leadDays = Number(e.target.value) || 30; saveFeasts(feasts); } }),
          h('button', { class: 'icon-btn danger', title: 'Usuń', onclick: () => { feasts.splice(i, 1); saveFeasts(feasts); }, html: icon('trash', 14) }))),
        h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { feasts.push({ id: Date.now().toString(36), md: '01-01', name: 'Nowe święto parafialne', presetId: 'odpust', leadDays: 21, propose: true }); saveFeasts(feasts); } }, iconEl('plus', 12), 'Dodaj święto'))),
      h('p', { class: 'group-footer' }, 'Data w formacie MM-DD, preset plakatu i liczba dni wyprzedzenia, z jaką agent zaproponuje plakat. Sprawdź i uzupełnij listę o uroczystości obchodzone w sanktuarium (np. rocznice koronacji, odpusty maryjne).')));
}

function settingsPosters() {
  const s = state.settings.poster;
  const presetOpts = allPresets().map((x) => ({ value: x.id, label: x.name }));
  return h('div', null,
    group('Nowe plakaty', [
      row('Domyślny format', select(Object.entries(Poster.FORMATS).map(([v, f]) => ({ value: v, label: f.label })), s.defaultFormat, (v) => saveSettings({ poster: { defaultFormat: v } })), { icon: 'doc', color: 'var(--accent)' }),
      row('Domyślny preset', select(presetOpts, s.defaultPreset || 'ogloszenie', (v) => saveSettings({ poster: { defaultPreset: v } })), { icon: 'sparkles', color: 'var(--purple)' }),
      row('Warianty z AI', select([1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) })), String(s.variants), (v) => saveSettings({ poster: { variants: Number(v) } })), { icon: 'photo', color: 'var(--indigo)', hint: 'Ile różnych układów przygotować za jednym razem (bez dodatkowego zużycia AI).' }),
      row('Logo parafii na plakatach', toggle(s.showLogo, (v) => saveSettings({ poster: { showLogo: v } }, true)), { icon: 'cross', color: 'var(--orange)' })
    ]),
    group('Stopka', [
      row('Automatyczna stopka z danymi parafii', toggle(s.autoFooter, (v) => saveSettings({ poster: { autoFooter: v } }, true).then(render)), { icon: 'doc', color: 'var(--teal)' }),
      row('Szablon stopki', textInput(s.footerTemplate, (v) => saveSettings({ poster: { footerTemplate: v } }, true).then(render), { width: '420px' }), { icon: 'pencil', color: 'var(--text-3)', hint: 'Pola: {nazwa} {miejscowosc} {adres} {telefon} {www} {email} {facebook} {proboszcz} {sanktuarium} {konto}. Puste pola są pomijane.' }),
      row('Podgląd', h('span', { class: 'muted', style: { maxWidth: '420px', textAlign: 'right' } }, state.footerPreview || '(pusta – uzupełnij dane parafii)'), { icon: 'eye', color: 'var(--green)' })
    ]),
    group('Kod QR', [
      row('Domyślny adres w kodzie QR', textInput(s.qrUrl, (v) => saveSettings({ poster: { qrUrl: v } }, true), { placeholder: 'https://… (strona parafii)' }), { icon: 'qr', color: 'var(--indigo)' }),
      row('Dodawaj kod QR do nowych plakatów', toggle(s.qrDefault, (v) => saveSettings({ poster: { qrDefault: v } }, true)), { icon: 'check', color: 'var(--green)' })
    ]));
}

function settingsPrint() {
  const p = state.settings.print;
  return h('div', null,
    group('Domyślne ustawienia wydruku', [
      row('Liczba kopii', h('input', { class: 'input', type: 'number', min: 1, max: 200, style: { width: '90px' }, value: p.copies, onchange: (e) => saveSettings({ print: { copies: Number(e.target.value) || 1 } }) }), { icon: 'copy', color: 'var(--accent)' }),
      row('Papier', select([{ value: 'auto', label: 'Automatycznie (jak format plakatu)' }, { value: 'A4', label: 'A4' }, { value: 'A3', label: 'A3' }, { value: 'A5', label: 'A5' }], p.paper, (v) => saveSettings({ print: { paper: v } })), { icon: 'doc', color: 'var(--indigo)' }),
      row('Plakatów na kartce', segmented([1, 2, 4, 8].map((n) => ({ value: n, label: String(n) })), p.nup, (v) => saveSettings({ print: { nup: v } }, true)), { icon: 'table', color: 'var(--orange)', hint: '2, 4 lub 8 – ulotki i karteczki do rozdania po Mszy.' }),
      row('Kolor', segmented([{ value: true, label: 'Kolorowy' }, { value: false, label: 'Czarno-biały' }], p.color, (v) => saveSettings({ print: { color: v } }, true)), { icon: 'paint', color: 'var(--pink)' }),
      row('Margines (mm)', h('input', { class: 'input', type: 'number', min: 0, max: 30, style: { width: '90px' }, value: p.marginMm, onchange: (e) => saveSettings({ print: { marginMm: Number(e.target.value) || 0 } }) }), { icon: 'table', color: 'var(--teal)' }),
      row('Znaczniki cięcia', toggle(p.cropMarks, (v) => saveSettings({ print: { cropMarks: v } }, true)), { icon: 'pencil', color: 'var(--text-3)' })
    ], 'Drukarkę wybierasz przy drukowaniu – aplikacja zapamięta ostatnio użytą.'));
}

function settingsGeneral() {
  const s = state.settings;
  return h('div', null,
    group('Wygląd aplikacji', [
      row('Motyw', segmented([{ value: 'system', label: 'Systemowy' }, { value: 'light', label: 'Jasny' }, { value: 'dark', label: 'Ciemny' }], s.ui.theme, (v) => saveSettings({ ui: { theme: v } }, true)), { icon: 'paint', color: 'var(--pink)' })
    ]),
    group('Dane', [
      row('Folder danych aplikacji', h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, h('span', { class: 'path', style: { maxWidth: '340px' } }, state.info.dataDir), h('button', { class: 'btn sm', onclick: () => api.openData() }, 'Otwórz')), { icon: 'folder', color: 'var(--orange)', hint: state.info.portable ? 'Wersja przenośna – dane leżą obok pliku .exe.' : 'Kopia tego folderu = kopia wszystkich plakatów i ustawień.' }),
      row('Wersja', h('span', { class: 'muted' }, state.info.version), { icon: 'info', color: 'var(--text-3)' })
    ]));
}

function accountCard() {
  const C = state.claude;
  const st = C.status;
  const wrap = h('div', { class: 'account' });
  if (!st) { wrap.append(h('div', { class: 'acc-row' }, spinner(18), h('span', { class: 'muted' }, 'Sprawdzam połączenie z kontem Claude…'))); return wrap; }
  const logo = (cls) => h('div', { class: 'acc-logo ' + (cls || ''), html: icon(st.loggedIn ? 'checkCircle' : 'person', 24) });
  if (st.loggedIn) {
    wrap.append(h('div', { class: 'acc-row' }, logo('ok'),
      h('div', { style: { flex: 1 } }, h('div', { class: 'acc-title' }, 'Połączono z kontem Claude'),
        h('div', { class: 'muted small' }, [st.email, st.plan ? `plan ${st.plan}` : null].filter(Boolean).join(' · ') || 'Aplikacja korzysta z Twojego planu Claude.')),
      h('button', { class: 'btn', onclick: (e) => busy(e.currentTarget, async () => { try { const r = await api.testAi(); toast(r, 'success', 5000); } catch (er) { errToast(er); } }, 'Testuję…') }, iconEl('bolt', 14), 'Testuj'),
      h('button', { class: 'btn danger', onclick: async () => { try { C.status = await api.claudeLogout(); render(); } catch (er) { errToast(er); } } }, 'Wyloguj')));
    return wrap;
  }
  if (!st.installed) {
    wrap.append(h('div', { class: 'acc-row' }, logo(),
      h('div', { style: { flex: 1 } }, h('div', { class: 'acc-title' }, 'Połącz aplikację ze swoim kontem Claude'),
        h('div', { class: 'muted small' }, 'Jednorazowo zainstaluję oficjalny program Claude Code od Anthropic (ok. 1 minuty), a potem otworzę stronę logowania Claude.')),
      h('button', { class: 'btn primary lg', disabled: C.installing || null, onclick: installAndLogin }, C.installing ? spinner(14) : iconEl('upload', 15), C.installing ? 'Instaluję…' : 'Zainstaluj i połącz')));
    if (C.installing || C.log) wrap.append(h('pre', { class: 'acc-log' }, (C.log || '').split('\n').slice(-6).join('\n')));
    return wrap;
  }
  const L = C.login;
  if (!L) {
    wrap.append(h('div', { class: 'acc-row' }, logo(),
      h('div', { style: { flex: 1 } }, h('div', { class: 'acc-title' }, 'Zaloguj się swoim kontem Claude'),
        h('div', { class: 'muted small' }, 'Otworzy się strona logowania Claude w przeglądarce – zaloguj się tak samo jak na claude.ai.')),
      h('button', { class: 'btn primary lg', onclick: startLogin }, iconEl('key', 15), 'Zaloguj się')));
    return wrap;
  }
  const code = h('input', { class: 'input', style: { flex: 1 }, placeholder: 'Wklej kod ze strony logowania (jeśli się pojawił)' });
  wrap.append(
    h('div', { class: 'acc-row' }, h('div', { class: 'acc-logo' }, spinner(20)),
      h('div', { style: { flex: 1 } }, h('div', { class: 'acc-title' }, 'Czekam na zalogowanie w przeglądarce…'),
        h('div', { class: 'muted small' }, 'Zaloguj się na stronie Claude, która otworzyła się w przeglądarce. Po zalogowaniu aplikacja połączy się sama.')),
      h('button', { class: 'btn', onclick: async () => { await api.claudeCancel(); C.login = null; render(); } }, 'Anuluj')),
    h('div', { class: 'acc-sub' },
      L.url ? h('button', { class: 'btn plain sm', onclick: () => api.openExternal(L.url) }, iconEl('globe', 12), 'Przeglądarka się nie otworzyła? Otwórz stronę logowania') : null,
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '8px' } }, code,
        h('button', { class: 'btn primary', onclick: async () => { if (!code.value.trim()) return; try { await api.claudeCode(code.value); toast('Przekazano kod – trwa łączenie…', 'info', 3000); } catch (er) { errToast(er); } } }, 'Zatwierdź kod'))));
  return wrap;
}

async function refreshClaude() {
  try { state.claude.status = await api.claudeStatus(); } catch (e) { state.claude.status = { installed: false, loggedIn: false }; }
  renderSidebar();
  if (['settings', 'dashboard', 'create'].includes(state.view)) render();
}

async function installAndLogin() {
  const C = state.claude;
  C.installing = true; C.log = ''; render();
  try {
    C.status = await api.claudeInstall();
    C.installing = false; render();
    if (C.status.installed && !C.status.loggedIn) await startLogin();
  } catch (e) { C.installing = false; errToast(e); render(); }
}

async function startLogin() {
  const C = state.claude;
  try { C.login = { stage: 'start' }; render(); await api.claudeLogin(); await loadSettings(); } catch (e) { C.login = null; errToast(e); render(); }
}

function settingsAi() {
  const s = state.settings;
  const status = h('div', { class: 'status-line' });
  const adv = state.claude.advanced || s.ai.provider === 'api';
  const ccStatus = state.claudePath ? h('div', { class: 'status-line ok' }, iconEl('checkCircle', 14), h('span', { class: 'path' }, state.claudePath))
    : h('div', { class: 'status-line bad' }, iconEl('warn', 14), 'Nie znaleziono Claude Code');
  const testBtn = h('button', { class: 'btn' }, iconEl('bolt', 14), 'Testuj połączenie');
  testBtn.addEventListener('click', () => busy(testBtn, async () => {
    status.className = 'status-line';
    status.replaceChildren(spinner(12), ' Łączę…');
    try { const r = await api.testAi(); status.className = 'status-line ok'; status.replaceChildren(iconEl('checkCircle', 14), r); } catch (e) { status.className = 'status-line bad'; status.replaceChildren(iconEl('warn', 14), e.message); }
  }, 'Testuję…'));
  const keyInput = h('input', { class: 'input', type: 'password', style: { width: '300px' }, placeholder: state.hasApiKey ? '•••••••• (zapisany)' : 'sk-ant-…' });
  return h('div', null,
    s.ai.provider === 'claude-code' ? h('div', { class: 'group' }, h('h3', { class: 'group-title' }, 'Konto Claude'), h('div', { class: 'group-body' }, accountCard()),
      h('p', { class: 'group-footer' }, 'Logujesz się na oficjalnej stronie Claude – aplikacja nie widzi Twojego hasła i nie przechowuje danych logowania. Zapytania wykonuje program Claude Code w ramach Twojego planu (Pro/Max).')) : null,
    group('Agent AI', [
      s.ai.provider === 'claude-code'
        ? row('Model Claude', select([{ value: 'sonnet', label: 'Sonnet (zalecany)' }, { value: 'opus', label: 'Opus (najmocniejszy)' }, { value: 'haiku', label: 'Haiku (najszybszy)' }], s.ai.model, (v) => saveSettings({ ai: { model: v } })), { icon: 'sparkles', color: 'var(--purple)' })
        : row('Model Claude', select([{ value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (zalecany)' }, { value: 'claude-opus-5-5', label: 'Claude Opus 5.5' }, { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' }], s.ai.apiModel, (v) => saveSettings({ ai: { apiModel: v } })), { icon: 'sparkles', color: 'var(--purple)' }),
      row('Ton wypowiedzi', textInput(s.ai.tone, (v) => saveSettings({ ai: { tone: v } }), { width: '360px' }), { icon: 'pencil', color: 'var(--orange)' }),
      row('Stałe zalecenia dla AI', textInput(s.ai.extraInstructions, (v) => saveSettings({ ai: { extraInstructions: v } }), { textarea: true, rows: 3, width: '360px', placeholder: 'np. Zawsze dopisz „Szczęść Boże!”; nie używaj wykrzykników w nekrologach; spowiedź pół godziny przed Mszą.' }), { icon: 'doc', color: 'var(--teal)' }),
      row('Wyszukiwanie w internecie', toggle(s.ai.useWebSearch, (v) => saveSettings({ ai: { useWebSearch: v } }, true)), { icon: 'globe', color: 'var(--teal)', hint: 'Agent może sprawdzać wydarzenia parafii i diecezji oraz informacje o okazjach.' })
    ]),
    h('div', { class: 'group' }, h('button', { class: 'btn plain', onclick: () => { state.claude.advanced = !adv; render(); } }, iconEl(adv ? 'chevronL' : 'chevronR', 12), adv ? 'Ukryj ustawienia zaawansowane' : 'Ustawienia zaawansowane')),
    adv ? h('div', null,
      group('Sposób połączenia', [
        row('Dostawca', segmented([{ value: 'claude-code', label: 'Konto Claude' }, { value: 'api', label: 'Klucz API' }], s.ai.provider, async (v) => { await saveSettings({ ai: { provider: v } }, true); render(); }), { icon: 'cpu', color: 'var(--accent)' })
      ], 'Klucz API (platform.claude.com) jest rozliczany osobno, za faktyczne zużycie – niezależnie od planu Claude.'),
      s.ai.provider === 'api' ? group('Klucz API', [
        row('Klucz', h('div', { style: { display: 'flex', gap: '6px' } }, keyInput,
          h('button', { class: 'btn', onclick: async () => { try { state.hasApiKey = await api.setApiKey(keyInput.value); keyInput.value = ''; toast(state.hasApiKey ? 'Zapisano klucz' : 'Usunięto klucz', 'success'); render(); } catch (e) { errToast(e); } } }, 'Zapisz')), { icon: 'key', color: 'var(--green)' }),
        row('Pobierz klucz', h('button', { class: 'btn sm', onclick: () => api.openExternal('https://platform.claude.com/settings/keys') }, 'platform.claude.com'), { icon: 'globe', color: 'var(--teal)' })
      ]) : group('Claude Code', [
        row('Program', h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' } }, ccStatus,
          h('button', { class: 'btn sm', onclick: async () => { try { const p = await api.browseClaude(); if (p) { await loadSettings(); await refreshClaude(); } } catch (e) { errToast(e); } } }, 'Wskaż ręcznie…')), { icon: 'cpu', color: 'var(--orange)' })
      ]),
      h('div', { class: 'group', style: { display: 'flex', alignItems: 'center', gap: '12px' } }, testBtn, status)) : null);
}

function settingsAgent() {
  const a = state.settings.agent;
  const ranks = state.settings.calendar.ranks;
  const urls = (a.monitorUrls || []).slice();
  const urlBox = h('div', { class: 'url-list' },
    urls.map((u, i) => h('div', { class: 'url-row' },
      h('input', { class: 'input', style: { flex: 1 }, value: u, onchange: (e) => { urls[i] = e.target.value.trim(); saveUrls(); } }),
      h('button', { class: 'icon-btn danger', onclick: () => { urls.splice(i, 1); saveUrls(); }, html: icon('trash', 14) }))),
    h('button', { class: 'btn sm', onclick: () => { urls.push('https://'); saveUrls(); } }, iconEl('plus', 12), 'Dodaj stronę'));
  async function saveUrls() {
    state.settings.agent.monitorUrls = urls;
    try { await api.setSettings({ agent: { monitorUrls: urls } }); } catch (e) { errToast(e); }
    render();
  }
  const RANKS_L = { uroczystosc: 'Uroczystości', swieto: 'Święta', wspomnienie: 'Wspomnienia', niedziela: 'Niedziele szczególne', okres: 'Okresy i nabożeństwa', okazja: 'Okazje (Dzień Babci, Matki…)', parafialne: 'Święta parafii', wydarzenie: 'Wydarzenia (własne i z internetu)' };
  return h('div', null,
    group('Agent w tle', [
      row('Agent włączony', toggle(a.enabled, (v) => saveSettings({ agent: { enabled: v } }, true)), { icon: 'bolt', color: 'var(--green)', hint: 'Co godzinę sprawdza kalendarz świąt i proponuje plakaty z wyprzedzeniem.' }),
      row('Działaj w tle po zamknięciu okna', toggle(a.runInBackground, (v) => saveSettings({ agent: { runInBackground: v } }, true)), { icon: 'moon', color: 'var(--indigo)', hint: 'Aplikacja zostaje w zasobniku systemowym (obok zegara).' }),
      row('Powiadomienia systemowe', toggle(a.notifications, (v) => saveSettings({ agent: { notifications: v } }, true)), { icon: 'bell', color: 'var(--red)' }),
      row('Jak daleko patrzeć w przyszłość', select([30, 45, 60, 90].map((n) => ({ value: String(n), label: `${n} dni` })), String(a.horizonDays), (v) => saveSettings({ agent: { horizonDays: Number(v) } })), { icon: 'calendar', color: 'var(--orange)' }),
      row('Sam przygotowuj szkice plakatów', toggle(a.autoDraft, (v) => saveSettings({ agent: { autoDraft: v } }, true)), { icon: 'sparkles', color: 'var(--purple)', hint: 'Dla nowych propozycji agent od razu tworzy szkic z AI (zużywa limit planu Claude).' })
    ]),
    group('Internet', [
      row('Szukaj wydarzeń parafii i diecezji w internecie', toggle(a.onlineCheck, (v) => saveSettings({ agent: { onlineCheck: v } }, true)), { icon: 'globe', color: 'var(--teal)', hint: 'Wymaga połączenia z Claude. Agent czyta monitorowane strony i korzysta z wyszukiwarki.' }),
      row('Co ile dni sprawdzać', select([1, 3, 7, 14].map((n) => ({ value: String(n), label: n === 1 ? 'codziennie' : `co ${n} dni` })), String(a.onlineIntervalDays), (v) => saveSettings({ agent: { onlineIntervalDays: Number(v) } })), { icon: 'clock', color: 'var(--accent)' }),
      row('Monitorowane strony', urlBox, { icon: 'doc', color: 'var(--indigo)', stack: true, hint: 'Np. strona parafii, sanktuarium, diecezji, dekanatu, profil wydarzeń.' })
    ]),
    group('Co pokazywać w kalendarzu', Object.entries(RANKS_L).map(([k, l]) => row(l, toggle(ranks[k] !== false, (v) => saveSettings({ calendar: { ranks: { [k]: v } } }, true).then(loadUpcoming)))), 'Wyłączone kategorie nie są pokazywane i nie wywołują propozycji.'),
    group('Dziennik agenta', [h('div', { style: { padding: '6px 14px', maxHeight: '320px', overflowY: 'auto' } },
      (state.agent && state.agent.log.length) ? state.agent.log.map((l) => h('div', { class: 'issue ' + (l.type === 'error' ? 'warn' : 'info') },
        h('span', { html: icon(l.type === 'error' ? 'warn' : 'info', 14) }),
        h('span', null, h('span', { class: 'muted small' }, new Date(l.at).toLocaleString('pl-PL') + ' · '), l.message))) : h('div', { class: 'empty' }, 'Brak wpisów.'))]));
}
