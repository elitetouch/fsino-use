/** Phase 3: does the farmer see what the money means, before saving? */
import { writeFileSync } from 'node:fs';
const BASE = process.argv[2]; const MODE = process.argv[3] ?? 'online';
const SENTENCE = process.argv[4] ?? 'I bought 10 bags of feed for 45,000';
const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page = list.find((t) => t.type === 'page');
const c = await new Promise((resolve) => {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map(); let id = 0;
  ws.onopen = () => resolve({ send(m, p = {}) { id += 1; ws.send(JSON.stringify({ id, method: m, params: p })); return new Promise((res, rej) => pending.set(id, { res, rej })); }, close: () => ws.close() });
  ws.onmessage = (raw) => { const m = JSON.parse(raw.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } };
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (e) => c.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }).then((r) => r.result?.value);
const net = (offline) => c.send('Network.emulateNetworkConditions', { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Network.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await net(false);
await c.send('Page.navigate', { url: BASE + '/' }); await sleep(2500);
await ev(`(() => { localStorage.setItem('fsm.app.token','t'); localStorage.setItem('fsm.app.user',JSON.stringify({id:1,name:'v'})); localStorage.setItem('fsm.app.currentFarmId','farm-1'); return 1; })()`);
// Visit the finance tab so the cycle-to-date figure is in the cache.
await c.send('Page.navigate', { url: BASE + '/cycles/cycle-1?tab=finance' }); await sleep(5000);
await c.send('Page.navigate', { url: BASE + '/home' }); await sleep(5000);
if (MODE === 'offline') await net(true);
await c.send('Page.navigate', { url: BASE + '/cycles/cycle-1/record' }); await sleep(6000);
await ev(`(() => { const ta = document.querySelector('textarea'); const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set; setter.call(ta, ${JSON.stringify(SENTENCE)}); ta.dispatchEvent(new Event('input',{bubbles:true})); return 1; })()`);
await sleep(2500);
console.log(`[${MODE}] "${SENTENCE}"`);
console.log('  impact panel:', await ev(`(() => {
  const t = document.body.innerText.replace(/\\s+/g,' ');
  const m = t.match(/\\u20A6[^.]*?(a bird|in|out)[^.]*\\.?/);
  const cyc = t.match(/That puts this cycle at [^.]*\\./);
  return JSON.stringify({ line: m ? m[0].trim().slice(0,90) : 'NOT FOUND', cycle: cyc ? cyc[0] : null });
})()`));
const shot = await c.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(`impact-${MODE}.png`, Buffer.from(shot.data, 'base64'));
c.close();
