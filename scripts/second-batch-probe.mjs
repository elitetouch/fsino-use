/**
 * Reported: offline, save one batch of records, then try to add
 * another — the record screen will not open and the offline page
 * appears instead.
 *
 * Walks exactly that, reporting the URL and what rendered at each step.
 */
const BASE = process.argv[2] ?? 'http://localhost:3123';

const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page = list.find((t) => t.type === 'page');
const c = await new Promise((resolve, reject) => {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map(); const events = []; let id = 0;
  ws.onopen = () => resolve({
    send(method, params = {}) {
      id += 1; ws.send(JSON.stringify({ id, method, params }));
      return new Promise((res, rej) => pending.set(id, { res, rej }));
    },
    events, close: () => ws.close(),
  });
  ws.onerror = reject;
  ws.onmessage = (raw) => {
    const m = JSON.parse(raw.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    } else if (m.method) events.push(m);
  };
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (e) => c.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })
  .then((r) => r.result?.value);
const net = (offline) => c.send('Network.emulateNetworkConditions', {
  offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
});
const where = () => ev(`JSON.stringify({
  url: location.pathname + location.search,
  text: document.body ? document.body.innerText.replace(/\\s+/g,' ').trim().slice(0, 150) : '',
})`);

await c.send('Page.enable');
await c.send('Runtime.enable');
await c.send('Network.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

await net(false);
await c.send('Page.navigate', { url: BASE + '/' });
await sleep(2500);
await ev(`(() => {
  localStorage.setItem('fsm.app.token', 'stub-token');
  localStorage.setItem('fsm.app.user', JSON.stringify({ id: 1, name: 'vinicius', email: 'v@example.com' }));
  localStorage.setItem('fsm.app.currentFarmId', 'farm-1');
  return true;
})()`);
await c.send('Page.navigate', { url: BASE + '/home' });
await sleep(8000);
console.log('warmed. cached pages:', await ev(`(async () => {
  const names = await caches.keys();
  const p = names.find(n => n.endsWith('-pages'));
  const keys = p ? (await (await caches.open(p)).keys()).map(r => new URL(r.url).pathname + new URL(r.url).search) : [];
  return JSON.stringify(keys.filter(k => k.includes('cycle')));
})()`));

await net(true);
console.log('\n--- OFFLINE ---');
await c.send('Page.navigate', { url: BASE + '/cycles/cycle-1/record' });
await sleep(6000);
console.log('1. record screen (first):', await where());

await ev(`(() => {
  const ta = document.querySelector('textarea');
  if (!ta) return 'no textarea';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, '12 birds died');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
})()`);
await sleep(1500);
console.log('2. save:', await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /save/i.test(x.innerText) && !x.disabled);
  if (!b) return 'no enabled save button';
  b.click(); return 'clicked';
})()`));
await sleep(5000);
console.log('3. after save, landed on:', await where());

const dump = `(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('fsm-offline');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const v = await new Promise((res) => {
    const q = db.transaction('meta','readonly').objectStore('meta').get('reactQueryCache');
    q.onsuccess = () => res(q.result); q.onerror = () => res(null);
  });
  const qs = v?.value?.state?.queries ?? [];
  return JSON.stringify(qs.map(q => JSON.stringify(q.queryKey)).filter(k => k.includes('guidance') || k.includes('flocks')));
})()`;
console.log('   persisted guidance/flocks keys:', await ev(dump));

// Now the reported step: open the record screen again.
console.log('\n--- SECOND BATCH ---');
const link = await ev(`(() => {
  const a = [...document.querySelectorAll('a,button')].find(x => /add .*record|add record/i.test(x.innerText));
  if (!a) return 'no add-record control found';
  a.click(); return 'clicked: ' + a.innerText.trim().slice(0, 40);
})()`);
console.log('4. tap add record:', link);
await sleep(6000);
console.log('5. landed on:', await where());

console.log('\n6. direct navigation to the record screen again:');
await c.send('Page.navigate', { url: BASE + '/cycles/cycle-1/record' });
await sleep(6000);
console.log('   ', await where());

c.close();
