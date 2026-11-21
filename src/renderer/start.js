'use strict';
/* global init */
init().catch((e) => { document.body.innerHTML = '<pre style="padding:20px">Błąd uruchomienia: ' + e.message + '\n' + (e.stack || '') + '</pre>'; });
