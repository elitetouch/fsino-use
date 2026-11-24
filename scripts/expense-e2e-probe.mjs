/**
 * Phase 1 end to end: say a purchase into the composer and confirm an
 * EXPENSE row reaches the server — online, and offline-then-reconnect.
 *
 *   node expense-e2e.mjs <baseUrl> online|offline
 */
import { writeFileSync } from 'node:fs';
const BASE = process.argv[2] ?? 'http://localhost:3123';
const MODE = process.argv[3] ?? 'online';
const STUB = 'http://localhost:4000';
const SENTENCE = process.argv[4] ?? 'I bought 10 bags of feed for 45,000 and 12 birds died';

const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page = list.find((t) => t.type === 'page');
const c = await new Promise((resolve) => {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map(); const events = []; let id = 0;
  ws.onopen = () => resolve({ send(m, p = {}) { id += 1; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); }, events, close: () => ws.close() });
  ws.onmessage = (raw) => { const m = JSON.parse(raw.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } else if (m.method) events.push(m); };
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (e) => c.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }).then((r) => r.result?.value);
const net = (offline) => c.send('Network.emulateNetworkConditions', { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Network.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

await fetch(`${STUB}/__reset`).catch(() => {});
await net(false);
await c.send('Page.navigate', { url: BASE + '/' });
await sleep(2500);
await ev(`(() => { localStorage.setItem('fsm.app.token','t'); localStorage.setItem('fsm.app.user',JSON.stringify({id:1,name:'v'})); localStorage.setItem('fsm.app.currentFarmId','farm-1'); return 1; })()`);
await c.send('Page.navigate', { url: BASE + '/home' });
await sleep(7000);

if (MODE === 'offline') { await net(true); }
await fetch(`${STUB}/__reset`).catch(() => {});

console.log(`=== ${MODE.toUpperCase()}: "${SENTENCE}" ===`);
await c.send('Page.navigate', { url: BASE + '/cycles/cycle-1/record' });
await sleep(6000);

console.log('typed:', await ev(`(() => {
  const ta = document.querySelector('textarea');
  if (!ta) return 'no textarea';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, ${JSON.stringify(SENTENCE)});
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`));
await sleep(2000);

console.log('chips:', await ev(`JSON.stringify(
  [...document.querySelectorAll('section span')]
    .map(s => s.innerText.replace(/\\s+/g,' ').trim())
    .filter(t => /Spent|Deaths|Feed|Water|Sold/i.test(t) && t.length < 80)
    .slice(0, 6)
)`));

const shot = await c.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(`expense-${MODE}.png`, Buffer.from(shot.data, 'base64'));

console.log('save:', await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /^save /i.test(x.innerText) && !x.disabled);
  if (!b) return 'no enabled save button';
  b.click(); return 'clicked: ' + b.innerText.trim();
})()`));
await sleep(5000);

if (MODE === 'offline') {
  console.log('outbox:', await ev(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('fsm-offline'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const rows = await new Promise((res) => { const q = db.transaction('outbox','readonly').objectStore('outbox').getAll(); q.onsuccess = () => res(q.result); q.onerror = () => res([]); });
    return JSON.stringify(rows.map(r => ({ url: r.url, status: r.status, err: r.lastError?.message })));
  })()`));
  console.log('--- reconnecting ---');
  await net(false);
  await sleep(9000);
}

const writes = await (await fetch(`${STUB}/__writes`)).json();
console.log('SERVER RECEIVED:');
for (const w of writes) {
  console.log('  ' + w.url + '  farm=' + w.farm + '  ' + JSON.stringify(
    w.url.includes('expenses')
      ? { category: w.body?.category, amount: w.body?.amount, currency: w.body?.currency, date: w.body?.expense_date, flock: w.body?.flock_id }
      : { event: w.body?.event_type, payload: w.body?.payload?.dead ?? w.body?.quantity }
  ));
}
const errs = [...new Set(c.events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => e.params.exceptionDetails?.exception?.description))].filter(Boolean);
console.log(errs.length ? 'EXCEPTIONS: ' + errs.map(e => String(e).slice(0,120)).join(' | ') : 'exceptions: none');
c.close();
