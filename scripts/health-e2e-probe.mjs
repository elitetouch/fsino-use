/**
 * The bug this exists for: a farmer gives "Glucose + Multivitamin
 * (anti-stress)" and says "vitamin", and the record saved the word
 * instead of the dose, so the scheduled item stayed undone on a card
 * farmers read as a safety net.
 *
 * Checks the three places it can still go wrong after the unit tests
 * pass: what the chip SHOWS, whether Save is reachable, and what the
 * server actually receives.
 *
 *   node health-e2e-probe.mjs <baseUrl> "<sentence>"
 */
const BASE = process.argv[2] ?? 'http://localhost:3123';
const STUB = 'http://localhost:4000';
const SENTENCE = process.argv[3] ?? 'i gave them vitamin';

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

await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Network.enable');
await fetch(`${STUB}/__reset`).catch(() => {});
await c.send('Page.navigate', { url: BASE + '/' });
await sleep(2500);
await ev(`(() => { localStorage.setItem('fsm.app.token','t'); localStorage.setItem('fsm.app.user',JSON.stringify({id:1,name:'v'})); localStorage.setItem('fsm.app.currentFarmId','farm-1'); return 1; })()`);
await c.send('Page.navigate', { url: BASE + '/home' });
await sleep(6000);

console.log(`=== "${SENTENCE}" ===`);
await c.send('Page.navigate', { url: BASE + '/cycles/cycle-1/record' });
await sleep(6000);

await ev(`(() => {
  const ta = document.querySelector('textarea');
  if (!ta) return 'NO TEXTAREA';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, ${JSON.stringify(SENTENCE)});
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`);
await sleep(2500);

console.log('CHIP:', await ev(`(() => {
  const li = document.querySelector('li span');
  return li ? li.innerText.replace(/\\s+/g, ' ').trim() : 'NO CHIP';
})()`));

console.log('PICKER:', await ev(`(() => {
  const s = document.querySelector('li select');
  if (!s) return 'none';
  return JSON.stringify({
    value: s.value,
    options: [...s.options].map(o => o.text).slice(0, 8),
  });
})()`));

console.log('SAVE ENABLED:', await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /^save /i.test(x.innerText));
  return b ? (b.disabled ? 'disabled: ' + b.innerText.trim() : 'enabled: ' + b.innerText.trim()) : 'NO SAVE BUTTON';
})()`));

console.log('CLICK:', await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /^save /i.test(x.innerText) && !x.disabled);
  if (!b) return 'not clickable';
  b.click(); return 'clicked';
})()`));
await sleep(5000);

const writes = await (await fetch(`${STUB}/__writes`)).json();
console.log('POSTED:', JSON.stringify(writes.map((w) => w.body?.payload ?? w.body)));
c.close();
