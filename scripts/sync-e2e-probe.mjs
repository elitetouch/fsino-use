/**
 * The whole point of the offline app, tested end to end:
 *
 *   online  -> warm
 *   offline -> save a daily record
 *   online  -> does it actually REACH THE SERVER?
 *
 * The stub records every write it receives, so "it synced" is a fact
 * from the server side, not a green tick in the UI.
 */
const BASE = process.argv[2] ?? 'http://localhost:3123';
const STUB = 'http://localhost:4000';

const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page = list.find((t) => t.type === 'page');
const c = await new Promise((resolve, reject) => {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map(); let id = 0;
  ws.onopen = () => resolve({
    send(method, params = {}) {
      id += 1; ws.send(JSON.stringify({ id, method, params }));
      return new Promise((res, rej) => pending.set(id, { res, rej }));
    },
    close: () => ws.close(),
  });
  ws.onerror = reject;
  ws.onmessage = (raw) => {
    const m = JSON.parse(raw.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    }
  };
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (e) => c.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })
  .then((r) => r.result?.value);
const net = (offline) => c.send('Network.emulateNetworkConditions', {
  offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
});

await c.send('Page.enable');
await c.send('Runtime.enable');
await c.send('Network.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

await fetch(`${STUB}/__reset`).catch(() => {});

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
await sleep(7000);

console.log('=== OFFLINE: save a daily record ===');
await net(true);
await c.send('Page.navigate', { url: BASE + '/cycles/cycle-1/record' });
await sleep(6000);

// Drive the app's own offline write path.
const queued = await ev(`(async () => {
  const mod = Object.values(window).length; void mod;
  // Use the app's module graph via its own save path is not reachable
  // from here, so write through the same public helper the UI uses.
  const { mutateOffline } = await import('/_next/static/chunks/offline-api-probe.js').catch(() => ({}));
  return typeof mutateOffline;
})()`).catch(() => 'n/a');
void queued;

// Fill the quick-record box and press Save — the real user path.
const typed = await ev(`(() => {
  const ta = document.querySelector('textarea');
  if (!ta) return 'no textarea';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, '15 birds died');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed';
})()`);
console.log('compose:', typed);
await sleep(1500);

const saved = await ev(`(() => {
  const btn = [...document.querySelectorAll('button')].find(b => /save/i.test(b.innerText));
  if (!btn) return 'no save button';
  if (btn.disabled) return 'save disabled: ' + btn.innerText.trim();
  btn.click();
  return 'clicked: ' + btn.innerText.trim();
})()`);
console.log('save:', saved);
await sleep(4000);

console.log('outbox after offline save: ' + await ev(`(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('fsm-offline');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const rows = await new Promise((res) => {
    const q = db.transaction('outbox','readonly').objectStore('outbox').getAll();
    q.onsuccess = () => res(q.result); q.onerror = () => res([]);
  });
  return JSON.stringify(rows.map(r => ({ url: r.url, status: r.status, err: r.lastError?.message })));
})()`));

console.log('\\n=== BACK ONLINE: does it reach the server? ===');
await net(false);
await sleep(9000);

console.log('outbox after reconnect: ' + await ev(`(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('fsm-offline');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const rows = await new Promise((res) => {
    const q = db.transaction('outbox','readonly').objectStore('outbox').getAll();
    q.onsuccess = () => res(q.result); q.onerror = () => res([]);
  });
  return JSON.stringify(rows.map(r => ({ url: r.url, status: r.status, err: r.lastError?.message })));
})()`));

const writes = await (await fetch(`${STUB}/__writes`)).json();
console.log('\\nSERVER RECEIVED:', JSON.stringify(writes, null, 2));

c.close();
