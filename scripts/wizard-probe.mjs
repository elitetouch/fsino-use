/**
 * The step-by-step wizard, online and offline.
 *
 * Quick record has been tested to death; the wizard is the other half
 * of the record screen and had never been driven at all. Walks the
 * steps, fills the feed step, saves, and reports what the server got.
 *
 *   node wizard-probe.mjs <baseUrl> online|offline
 */
const BASE = process.argv[2] ?? 'http://localhost:3123';
const MODE = process.argv[3] ?? 'offline';
const STUB = 'http://localhost:4000';

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
const screen = () => ev(`(() => {
  const t = document.body ? document.body.innerText.replace(/\\s+/g,' ').trim() : '';
  const step = (t.match(/STEP \\d+ OF \\d+/) || [''])[0];
  return JSON.stringify({ step, head: t.slice(0, 110) });
})()`);

/** Click the first enabled button/link whose text matches. */
const tap = (re, last = false) => ev(`(() => {
  const els = [...document.querySelectorAll('button,a')]
    .filter(x => ${re}.test(x.innerText.replace(/\\s+/g,' ').trim()) && !x.disabled);
  const el = ${last ? 'els[els.length - 1]' : 'els[0]'};
  if (!el) return 'NOT FOUND';
  el.click(); return 'tapped: ' + el.innerText.trim().replace(/\\s+/g,' ').slice(0, 30);
})()`);

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
await sleep(8000);

if (MODE === 'offline') {
  await net(true);
  await fetch(`${STUB}/__reset`).catch(() => {});
}
console.log(`=== WIZARD, ${MODE.toUpperCase()} ===`);

await c.send('Page.navigate', { url: BASE + '/cycles/cycle-1/record' });
await sleep(6000);
console.log('date step:', await screen());

// Step 0 offers quick record plus a way into the wizard.
// The bottom CTA ("Add record" / "Edit record") is the wizard entry.
console.log('into wizard:', await tap('/^(add|edit) record$/i', true));
await sleep(3500);
console.log('step 1:', await screen());

// Feed step: pick a ration, type an amount, continue.
console.log('  ration:', await tap('/^(grower|starter|finisher)$/i'));
await sleep(600);
console.log('  amount:', await ev(`(() => {
  const inputs = [...document.querySelectorAll('input')].filter(x => x.type !== 'hidden' && !x.disabled);
  if (inputs.length === 0) return 'no inputs';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  for (const i of inputs) { setter.call(i, '3'); i.dispatchEvent(new Event('input', { bubbles: true })); }
  return 'typed 3 into ' + inputs.length + ' field(s)';
})()`));
await sleep(900);
console.log('  buttons here:', await ev(`JSON.stringify([...document.querySelectorAll('button')].map(b => ({t:b.innerText.replace(/\\s+/g,' ').trim().slice(0,24), d:b.disabled||undefined})).filter(x=>x.t && !/^\\d+$/.test(x.t)))`));
// The feed step needs type + BRAND + amount before Continue enables.
console.log('  brand:', await ev(`(() => {
  const sels = [...document.querySelectorAll('select')];
  const brand = sels.find(s => [...s.options].some(o => /feed|hope|vital|chikun|own/i.test(o.text)));
  if (!brand) return 'no brand select (selects: ' + sels.length + ')';
  const opt = [...brand.options].find(o => o.value && o.value !== 'other');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  setter.call(brand, opt.value);
  brand.dispatchEvent(new Event('change', { bubbles: true }));
  return 'picked ' + opt.text;
})()`));
await sleep(900);
console.log('  continue:', await tap('/^continue$|^save|^complete/i'));
await sleep(4000);
console.log('after feed step:', await screen());

// Walk whatever remains by skipping, to reach the end of the wizard.
for (let i = 0; i < 8; i += 1) {
  const skipped = await tap('/skip this step|continue|complete record/i');
  if (skipped === 'NOT FOUND') break;
  await sleep(2500);
}
console.log('end of wizard:', await screen());

if (MODE === 'offline') {
  console.log('\noutbox: ' + await ev(`(async () => {
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
  console.log('\n--- reconnecting ---');
  await net(false);
  await sleep(9000);
}

const writes = await (await fetch(`${STUB}/__writes`)).json();
console.log('\nSERVER RECEIVED:', JSON.stringify(writes.map((w) => ({
  url: w.url, farm: w.farm, auth: w.auth, event: w.body?.event_type, qty: w.body?.quantity, unit: w.body?.unit,
})), null, 1));

const errs = [...new Set(c.events
  .filter((e) => e.method === 'Runtime.exceptionThrown' || e.method === 'Runtime.consoleAPICalled')
  .map((e) => e.method === 'Runtime.exceptionThrown'
    ? e.params.exceptionDetails?.exception?.description
    : (e.params.type === 'error' ? e.params.args.map(a => a.description ?? a.value ?? '').join(' ') : null)))]
  .filter(Boolean);
console.log(errs.length ? 'EXCEPTIONS: ' + errs.map(e => String(e).slice(0,140)).join(' | ') : 'exceptions: none');

c.close();
