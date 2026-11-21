'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const call = async (channel, ...args) => {
  const r = await ipcRenderer.invoke(channel, ...args);
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

const channels = {
  info: 'app:info', windowControl: 'window:control',
  getSettings: 'settings:get', setSettings: 'settings:set', replaceSetting: 'settings:replace', setApiKey: 'apikey:set', testAi: 'ai:test',
  claudeStatus: 'claude:status', claudeInstall: 'claude:install', claudeLogin: 'claude:login', claudeCode: 'claude:code', claudeCancel: 'claude:cancel', claudeLogout: 'claude:logout', browseClaude: 'ai:browseClaude',
  presets: 'presets:list', savePreset: 'presets:save', deletePreset: 'presets:delete',
  assets: 'assets:list', addAsset: 'assets:add', updateAsset: 'assets:update', removeAsset: 'assets:remove', restoreAssets: 'assets:restore',
  calendar: 'calendar:range', season: 'calendar:season', saveEvent: 'events:save', deleteEvent: 'events:delete', hideOnlineEvent: 'onlineEvents:hide', onlineEvents: 'onlineEvents:list',
  agentStatus: 'agent:status', agentRun: 'agent:run', setProposal: 'proposal:set',
  posters: 'posters:list', getPoster: 'poster:get', savePoster: 'poster:save', deletePoster: 'poster:delete', duplicatePoster: 'poster:duplicate',
  createPosters: 'poster:create', refinePoster: 'poster:refine', relayout: 'poster:relayout', qrSvg: 'qr:svg', fillQr: 'poster:fillQr',
  printers: 'print:printers', printPlan: 'print:plan', print: 'print:run', exportPdf: 'export:pdf', exportPng: 'export:png', exportJson: 'export:json', importJson: 'import:json',
  showFile: 'shell:showFile', openFile: 'shell:openFile', openData: 'shell:openData', openExternal: 'shell:openExternal'
};

const api = {};
for (const [name, ch] of Object.entries(channels)) api[name] = (...args) => call(ch, ...args);
api.devExport = (...a) => call('dev:export', ...a);
api.on = (channel, fn) => {
  const allowed = ['agent:status', 'posters:changed', 'data:changed', 'window:state', 'claude:log', 'claude:login'];
  if (!allowed.includes(channel)) return () => {};
  const h = (_e, payload) => fn(payload);
  ipcRenderer.on(channel, h);
  return () => ipcRenderer.removeListener(channel, h);
};

contextBridge.exposeInMainWorld('api', api);
