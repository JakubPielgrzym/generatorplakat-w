'use strict';
// Agent w tle: pilnuje kalendarza liturgicznego i świąt parafii, proponuje plakaty z wyprzedzeniem,
// co kilka dni przegląda internet (strony parafii/diecezji + wyszukiwarka) w poszukiwaniu wydarzeń.

const crypto = require('crypto');
const { iso, addDays, longDate } = require('./liturgy');
const { lookupEvents, htmlToText } = require('./ai/tasks');

const TICK_MS = 60 * 60 * 1000; // co godzinę
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

class Agent {
  constructor({ store, liturgy, getProvider, notify, emit, fetchPage, autoDraft, aiAvailable }) {
    Object.assign(this, { store, liturgy, getProvider, notify, emit, fetchPage, autoDraft, aiAvailable });
    this.timer = null;
    this.running = false;
    this.lastRun = null;
    this.lastError = null;
  }

  get cfg() { return this.store.settings.agent; }

  start() {
    this.stop();
    if (!this.cfg.enabled) { this.emit('agent:status', this.status()); return; }
    setTimeout(() => this.tick(), 5000);
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }

  proposals() {
    const P = this.store.data.proposals;
    const due = this.liturgy.dueForPoster(new Date(), this.cfg.horizonDays || 60);
    return due.map((o) => ({ ...o, status: (P[o.key] && P[o.key].status) || 'new', posterId: P[o.key] && P[o.key].posterId, longDate: longDate(o.date) }))
      .filter((o) => o.status !== 'dismissed');
  }

  status() {
    return {
      enabled: this.cfg.enabled,
      running: this.running,
      lastRun: this.lastRun,
      lastError: this.lastError,
      onlineCheckedAt: this.store.data.onlineCheckedAt,
      log: this.store.data.agentLog.slice(0, 60),
      proposals: this.proposals()
    };
  }

  setProposal(key, patch) {
    const P = this.store.data.proposals;
    P[key] = Object.assign({}, P[key] || {}, patch, { at: new Date().toISOString() });
    // porządek: usuwamy wpisy starsze niż rok
    const limit = iso(addDays(new Date(), -400));
    for (const k of Object.keys(P)) { const d = (k.match(/\d{4}-\d{2}-\d{2}/) || [])[0]; if (d && d < limit) delete P[k]; }
    this.store.save();
    this.emit('agent:status', this.status());
  }

  async tick(force = false) {
    if (this.running) return;
    if (!this.cfg.enabled && !force) return;
    this.running = true;
    this.lastError = null;
    this.emit('agent:status', this.status());
    try {
      // 1) propozycje z kalendarza
      const P = this.store.data.proposals;
      const fresh = [];
      for (const o of this.liturgy.dueForPoster(new Date(), this.cfg.horizonDays || 60)) {
        if (P[o.key]) continue;
        P[o.key] = { status: 'new', at: new Date().toISOString() };
        fresh.push(o);
      }
      if (fresh.length) {
        this.store.save();
        this.store.log('proposal', `Nowe propozycje plakatów: ${fresh.map((o) => `${o.name} (${o.date})`).join('; ')}`);
        if (this.cfg.notifications) {
          const first = fresh[0];
          this.notify(fresh.length === 1 ? 'Propozycja plakatu' : `Propozycje plakatów (${fresh.length})`,
            fresh.length === 1 ? `${first.name} – ${longDate(first.date)}. Przygotować plakat?` : fresh.slice(0, 3).map((o) => o.name).join(', ') + (fresh.length > 3 ? '…' : ''));
        }
        if (this.cfg.autoDraft && this.autoDraft) {
          for (const o of fresh.slice(0, 3)) {
            try {
              const posterId = await this.autoDraft(o);
              if (posterId) P[o.key] = { status: 'draft', posterId, at: new Date().toISOString() };
            } catch (e) { this.store.log('error', `Szkic plakatu „${o.name}” nie powstał: ${e.message}`); }
          }
          this.store.save();
        }
      }

      // 2) internet: strony parafii/diecezji + wyszukiwarka
      const days = Math.max(1, Number(this.cfg.onlineIntervalDays) || 7);
      const last = this.store.data.onlineCheckedAt ? new Date(this.store.data.onlineCheckedAt) : null;
      const tried = this.store.data.onlineTriedAt ? new Date(this.store.data.onlineTriedAt) : null;
      const dueOnline = force || !last || (Date.now() - last.getTime()) > days * 86400000;
      const backoff = tried && !force && (Date.now() - tried.getTime()) < 6 * 3600000;
      if (this.cfg.onlineCheck && dueOnline && !backoff && (!this.aiAvailable || this.aiAvailable())) {
        this.store.data.onlineTriedAt = new Date().toISOString();
        this.store.save();
        try {
          await this.checkOnline();
        } catch (e) {
          if (/zalogowan|nie znaleziono|klucza api|log ?in|authenticat/i.test(e.message)) {
            this.store.log('info', 'Pominięto przeglądanie internetu – aplikacja nie jest połączona z kontem Claude.');
          } else throw e;
        }
      }
      this.lastRun = new Date().toISOString();
    } catch (e) {
      this.lastError = e.message;
      this.store.log('error', e.message);
    } finally {
      this.running = false;
      this.emit('agent:status', this.status());
    }
  }

  async checkOnline() {
    const s = this.store.settings;
    const from = iso(new Date());
    const to = iso(addDays(new Date(), Math.max(30, Number(this.cfg.horizonDays) || 60) + 30));
    const pages = [];
    for (const url of (this.cfg.monitorUrls || []).filter((u) => /^https?:\/\//.test(u)).slice(0, 6)) {
      try { pages.push({ url, text: htmlToText(await this.fetchPage(url)) }); } catch (e) { this.store.log('info', `Nie udało się pobrać ${url}: ${e.message}`); }
    }
    const events = await lookupEvents(this.getProvider(), { parish: s.parish, from, to, pages, webSearch: s.ai.useWebSearch !== false });
    const list = this.store.data.onlineEvents;
    let added = 0;
    for (const e of events) {
      const dup = list.find((x) => x.date === e.date && (norm(x.name) === norm(e.name) || norm(x.name).includes(norm(e.name)) || norm(e.name).includes(norm(x.name))));
      if (dup) continue;
      list.push({ id: crypto.randomBytes(5).toString('hex'), ...e, foundAt: new Date().toISOString(), hidden: false });
      added++;
    }
    // usuń stare wydarzenia (sprzed 60 dni)
    const old = iso(addDays(new Date(), -60));
    this.store.data.onlineEvents = list.filter((e) => e.date >= old);
    this.store.data.onlineCheckedAt = new Date().toISOString();
    this.store.save();
    this.store.log('online', `Przejrzano internet (${pages.length} stron + wyszukiwarka): znaleziono ${events.length} wydarzeń, nowych ${added}.`);
    if (added && this.cfg.notifications) this.notify('Nowe wydarzenia z internetu', `Agent znalazł ${added} ${added === 1 ? 'wydarzenie' : 'wydarzeń'} dla parafii i diecezji – sprawdź kalendarz.`);
    return { found: events.length, added };
  }
}

module.exports = { Agent };
