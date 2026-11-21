'use strict';
// Druk, eksport PDF i PNG: ukryte okno renderuje plakat (lub kilka na arkuszu) w dokładnym rozmiarze papieru.

const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Poster = require('../shared/poster');

const { planSheet, PAPERS } = require('./sheet-plan');
const jobs = new Map(); // webContents.id -> { job, resolve }

ipcMain.handle('printjob:get', (e) => { const j = jobs.get(e.sender.id); return j ? j.job : null; });
ipcMain.handle('printjob:ready', (e, info) => { const j = jobs.get(e.sender.id); if (j) j.resolve(info || {}); return true; });

async function withSheet(poster, opts, assetUrlBase, fn, { cssZoom = 1, offscreen = false } = {}) {
  const plan = planSheet(poster, opts);
  const MM = Poster.MM;
  const width = Math.round(plan.paper.w * MM * cssZoom);
  const height = Math.round(plan.paper.h * MM * cssZoom);
  const win = new BrowserWindow({
    show: false, width, height, useContentSize: true, enableLargerThanScreen: true, frame: false,
    webPreferences: { preload: path.join(__dirname, '..', 'print-preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false, offscreen: !!offscreen }
  });
  const job = { poster, plan, cropMarks: !!opts.cropMarks, grayscale: opts.color === false, assetUrlBase, cssZoom };
  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });
  jobs.set(win.webContents.id, { job, resolve: resolveReady });
  if (process.env.PLAKATY_SHOTS) win.webContents.on('console-message', (...a) => { const e = a[0]; console.log('[print]', e && e.message ? e.message : a.slice(1).join(' ')); });
  try {
    await win.loadFile(path.join(__dirname, '..', 'renderer', 'print.html'));
    win.webContents.setZoomLevel(0); // Chromium zapamiętuje powiększenie dla pliku – zawsze 100%
    await Promise.race([ready, new Promise((_, rej) => setTimeout(() => rej(new Error('Przekroczono czas przygotowania wydruku.')), 30000))]);
    await new Promise((r) => setTimeout(r, 150));
    return await fn(win, plan);
  } finally {
    jobs.delete(win.webContents.id);
    if (!win.isDestroyed()) win.destroy();
  }
}

function pageSizeFor(plan) {
  const { w, h, name } = plan.paper;
  if (name && PAPERS[name]) return { pageSize: name, landscape: w > h };
  return { pageSize: { width: Math.round(w * 1000), height: Math.round(h * 1000) }, landscape: false };
}

async function printPoster(poster, opts, assetUrlBase) {
  return withSheet(poster, opts, assetUrlBase, (win, plan) => new Promise((resolve, reject) => {
    const ps = pageSizeFor(plan);
    const o = {
      silent: !!opts.silent && !!opts.printer,
      printBackground: true,
      color: opts.color !== false,
      copies: Math.max(1, Math.min(200, Number(opts.copies) || 1)),
      margins: { marginType: 'none' },
      pageSize: ps.pageSize,
      landscape: ps.landscape
    };
    if (opts.printer) o.deviceName = opts.printer;
    win.webContents.print(o, (ok, reason) => {
      if (ok) resolve({ ok: true, paper: plan.paper, copies: o.copies });
      else if (/cancel/i.test(String(reason))) resolve({ ok: false, cancelled: true });
      else reject(new Error('Drukowanie nie powiodło się: ' + (reason || 'nieznany błąd')));
    });
  }));
}

async function pdfBuffer(poster, opts, assetUrlBase) {
  return withSheet(poster, Object.assign({ forExport: true }, opts), assetUrlBase, async (win, plan) => {
    return win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { top: 0, bottom: 0, left: 0, right: 0 }, pageSize: { width: plan.paper.w / 25.4, height: plan.paper.h / 25.4 } });
  });
}

async function pngBuffer(poster, opts, assetUrlBase) {
  const longEdgePx = Number(opts.longEdgePx) || 2400;
  const W = poster.format.w * Poster.MM, H = poster.format.h * Poster.MM;
  const z = Math.max(0.5, Math.min(longEdgePx / Math.max(W, H), 8));
  const pw = Math.round(W * z), ph = Math.round(H * z);
  return withSheet(poster, { forExport: true, nup: 1 }, assetUrlBase, async (win) => {
    // zrzut przez DevTools Protocol – niezależny od rozmiaru ekranu
    const dbg = win.webContents.debugger;
    dbg.attach('1.3');
    try {
      await dbg.sendCommand('Emulation.setDeviceMetricsOverride', { width: pw, height: ph, deviceScaleFactor: 1, mobile: false });
      await new Promise((r) => setTimeout(r, 300));
      const r = await dbg.sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true, clip: { x: 0, y: 0, width: pw, height: ph, scale: 1 } });
      return Buffer.from(r.data, 'base64');
    } finally { try { dbg.detach(); } catch (_) { /* ignore */ } }
  }, { cssZoom: z, offscreen: true });
}

module.exports = { planSheet, printPoster, pdfBuffer, pngBuffer, PAPERS };
