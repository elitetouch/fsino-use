/**
 * The exact failure reported: open the record screen with no signal.
 * Before the regex fix this threw ChunkLoadError and Next rendered
 * "Application error: a client-side exception has occurred".
 */
const BASE = process.argv[2] ?? 'http://localhost:3123';

const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page = list.find((t) => t.type === 'page');
const c = await new Promise((resolve, reject) => {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  const events = [];
  let id = 0;
  ws.onopen = () => resolve({
    send(method, params = {}) {
      id += 1;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((res, rej) => pending.set(id, { res, rej }));
    },
    events,
    close: () => ws.close(),
  });
  ws.onerror = reject;
  ws.onmessage = (raw) => {
    const m = JSON.parse(raw.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
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

await c.send('Page.enable');
await c.send('Runtime.enable');
await c.send('Log.enable');
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

console.log('=== ONLINE: dashboard only. The record screen is NEVER opened. ===');
await c.send('Page.navigate', { url: BASE + '/home' });
await sleep(8000);

const cached = await ev(`(async () => {
  const names = await caches.keys();
  const s = names.find(n => n.endsWith('-static'));
  const keys = s ? (await (await caches.open(s)).keys()).map(r => decodeURI(new URL(r.url).pathname)) : [];
  return JSON.stringify({
    staticCount: keys.length,
    recordChunkCached: keys.some(k => k.includes('/record/page-')),
    routeGroupChunks: keys.filter(k => k.includes('/app/(app)/')).length,
  });
})()`);
console.log(cached);

console.log('\\n=== OFFLINE: open the record screen ===');
await net(true);
c.events.length = 0;
await c.send('Page.navigate', { url: BASE + '/cycles/cycle-1/record' });
await sleep(7000);

console.log(await ev(`JSON.stringify({
  at: location.pathname,
  text: document.body ? document.body.innerText.replace(/\\\\s+/g,' ').trim().slice(0, 220) : '',
})`));

const errs = [...new Set(c.events
  .filter((e) => e.method === 'Runtime.exceptionThrown' || e.method === 'Runtime.consoleAPICalled')
  .map((e) => e.method === 'Runtime.exceptionThrown'
    ? (e.params.exceptionDetails?.exception?.description ?? e.params.exceptionDetails?.text)
    : (e.params.type === 'error' || e.params.type === 'warning'
        ? e.params.args.map((a) => a.description ?? a.value ?? a.className ?? '').join(' ')
        : null))
  .filter(Boolean))];
console.log(errs.length ? 'EXCEPTIONS:\\n  ' + errs.map(e => String(e).slice(0, 180)).join('\\n  ') : 'exceptions: none');

c.close();
