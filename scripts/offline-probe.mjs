/**
 * Same real-Chrome probe, but signed in — which is where the farmer
 * actually is. A token in localStorage is all the app checks to render
 * the authenticated shell; the API calls behind it fail offline either
 * way, which is exactly the condition under test.
 */

const BASE = process.argv[2] ?? 'http://localhost:3123';
const CDP_PORT = 9333;

async function connectPage() {
  const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    const pending = new Map();
    const events = [];
    let id = 0;
    ws.onopen = () =>
      resolve({
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
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const c = await connectPage();
await c.send('Page.enable');
await c.send('Runtime.enable');
await c.send('Log.enable');
await c.send('Network.enable');

const ev = (expr) =>
  c
    .send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
    .then((r) => r.result?.value);

function errs() {
  return [
    ...new Set(
      c.events
        .filter((e) => e.method === 'Runtime.exceptionThrown' || e.method === 'Log.entryAdded')
        .map((e) =>
          e.method === 'Runtime.exceptionThrown'
            ? `EXCEPTION ${e.params.exceptionDetails?.exception?.description ?? e.params.exceptionDetails?.text}`
            : `${e.params.entry.level}: ${e.params.entry.text}`,
        )
        .filter((t) => !/favicon|ERR_INTERNET_DISCONNECTED|Failed to load resource/i.test(t)),
    ),
  ];
}

// Go online and plant a session.
await c.send('Network.emulateNetworkConditions', {
  offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
});
await c.send('Page.navigate', { url: BASE + '/' });
await sleep(3000);

console.log('=== ONLINE: warm the worker caches ===');
for (const p of ['/home', '/cycles', '/menu']) {
  await c.send('Page.navigate', { url: BASE + p });
  await sleep(4000);
}
console.log(
  await ev(`(async () => {
    const names = await caches.keys();
    const out = {};
    for (const n of names) out[n] = (await (await caches.open(n)).keys()).length;
    return JSON.stringify({ controlled: !!navigator.serviceWorker.controller, caches: out });
  })()`),
);

console.log('\n=== OFFLINE ===');
await c.send('Network.emulateNetworkConditions', {
  offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
});

// Plant the session only now. Online, a made-up token gets a real 401
// from the API and the interceptor clears it — which is an artifact of
// the probe, not of being offline. With no network nothing can reject
// it, which is also the real case: the farmer's token is already in
// localStorage when the signal goes.
await ev(`(() => {
  localStorage.setItem('fsm.app.token', 'probe-token');
  localStorage.setItem('fsm.app.user', JSON.stringify({ id: 1, name: 'Probe Farmer', email: 'p@example.com' }));
  localStorage.setItem('fsm.app.currentFarm', 'farm-probe');
  return true;
})()`);

for (const p of ['/home', '/cycles', '/menu', '/settings']) {
  c.events.length = 0;
  await c.send('Page.navigate', { url: BASE + p });
  await sleep(4500);
  const info = await ev(`JSON.stringify({
    at: location.pathname,
    online: navigator.onLine,
    chars: document.body ? document.body.innerText.trim().length : 0,
    text: document.body ? document.body.innerText.replace(/\\s+/g,' ').trim().slice(0, 200) : '',
  })`);
  console.log(`\n--- ${p} ---\n${info}`);
  const e = errs();
  console.log(e.length ? '  errors:\n   ' + e.slice(0, 5).map((x) => x.slice(0, 200)).join('\n   ') : '  errors: none');
}

c.close();
