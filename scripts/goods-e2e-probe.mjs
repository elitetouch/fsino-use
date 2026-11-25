/**
 * The bug this exists for: an expense posted correctly and then
 * rendered as a blank row, because the quantity the farmer said was
 * never carried into the ledger. Checking the request body alone
 * would have passed. So this probe reads the RENDERED ROW.
 *
 *   node goods-e2e-probe.mjs <baseUrl> "<sentence>"
 */
const BASE = process.argv[2] ?? 'http://localhost:3123';
const STUB = 'http://localhost:4000';
const SENTENCE = process.argv[3] ?? 'I bought 3 bags of feed for 45000';

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
console.log('typed:', await ev(`(() => {
  const ta = document.querySelector('textarea');
  if (!ta) return 'NO TEXTAREA';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, ${JSON.stringify(SENTENCE)});
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`));
await sleep(2000);

console.log('chip:', await ev(`JSON.stringify(
  [...document.querySelectorAll('span')]
    .map(s => s.innerText.replace(/\\s+/g,' ').trim())
    .filter(t => /Spent/i.test(t) && t.length < 80).slice(0, 3))`));

console.log('save:', await ev(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /^save /i.test(x.innerText) && !x.disabled);
  if (!b) return 'NO ENABLED SAVE BUTTON';
  b.click(); return 'clicked: ' + b.innerText.trim();
})()`));
await sleep(5000);

const writes = await (await fetch(`${STUB}/__writes`)).json();
const exp = writes.filter((w) => w.url.includes('expenses'));
console.log('POSTED:', JSON.stringify(exp.map((w) => w.body)));

// The part that actually failed for the user.
await c.send('Page.navigate', { url: BASE + '/expenses' });
await sleep(6000);
console.log('LEDGER ROWS:', await ev(`JSON.stringify(
  [...document.querySelectorAll('li, [class*="rounded"]')]
    .map(n => n.innerText ? n.innerText.replace(/\\s+/g,' ').trim() : '')
    .filter(t => /₦|N45/.test(t) && t.length < 160).slice(0, 6))`));

const errs = [...new Set(c.events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => e.params.exceptionDetails?.exception?.description))].filter(Boolean);
console.log(errs.length ? 'EXCEPTIONS: ' + errs.map(e => String(e).slice(0,140)).join(' | ') : 'exceptions: none');
c.close();
