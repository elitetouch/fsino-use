/**
 * Does the offline banner still cover the header? Screenshot it at
 * phone width with the network cut, and measure the two rectangles
 * rather than eyeballing them.
 */
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:3123';

const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page = list.find((t) => t.type === 'page');
const c = await new Promise((resolve, reject) => {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  let id = 0;
  ws.onopen = () =>
    resolve({
      send(method, params = {}) {
        id += 1;
        ws.send(JSON.stringify({ id, method, params }));
        return new Promise((res, rej) => pending.set(id, { res, rej }));
      },
      close: () => ws.close(),
    });
  ws.onerror = reject;
  ws.onmessage = (raw) => {
    const m = JSON.parse(raw.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
    }
  };
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (e) =>
  c.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })
   .then((r) => r.result?.value);

await c.send('Page.enable');
await c.send('Runtime.enable');
await c.send('Network.enable');
await c.send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
});

const net = (offline) =>
  c.send('Network.emulateNetworkConditions', {
    offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  });

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
await sleep(6000);

await net(true);
await c.send('Page.navigate', { url: BASE + '/home' });
await sleep(6000);

// Measure: does the banner's box overlap the header's box?
const geometry = await ev(`(() => {
  const banner = document.querySelector('[role="status"]');
  const header = document.querySelector('header');
  const burger = header && header.querySelector('button');
  const r = (el) => el ? (({top,bottom,height}) => ({top: Math.round(top), bottom: Math.round(bottom), height: Math.round(height)}))(el.getBoundingClientRect()) : null;
  const b = r(banner), h = r(header), k = r(burger);
  return JSON.stringify({
    banner: b, header: h, hamburger: k,
    bannerPosition: banner ? getComputedStyle(banner).position : null,
    overlaps: !!(b && h) && b.bottom > h.top,
    hamburgerVisible: !!(k && b) && k.top >= b.bottom,
  });
})()`);
console.log(geometry);

const shot = await c.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(process.argv[3] ?? 'banner.png', Buffer.from(shot.data, 'base64'));
console.log('screenshot written');
c.close();
