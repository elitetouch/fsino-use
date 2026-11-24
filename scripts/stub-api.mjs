/**
 * A stand-in for the real API so the offline path can be exercised
 * with a working session and real-looking data.
 *
 * Without this there was no way to reproduce "loads offline but shows
 * zero" — a made-up token gets a genuine 401 from production, so every
 * local probe ran with an empty cache and the symptom never appeared.
 */
import { createServer } from 'node:http';

const FARM = {
  id: 'farm-1',
  accountId: 'acct-1',
  name: 'Vini Integrated Farm',
  isActive: true,
  primaryProduction: 'broiler',
  vertical: 'poultry',
  membership: { role: 'owner', permissions: {} },
};
const FLOCK = {
  id: 'cycle-1',
  name: 'Batch A',
  farmId: 'farm-1',
  penId: 'pen-1',
  currentBirds: 463,
  current_birds: 463,
  placedBirds: 500,
  placed_birds: 500,
  productionType: 'broiler',
  production_type: 'broiler',
  currentAge: 21,
  current_age: 21,
  ageDays: 52,
  startDate: '2026-10-04',
  archivedAt: null,
  writeWindow: { state: 'open' },
};
const PEN = { id: 'pen-1', name: 'Pen 1', farmId: 'farm-1', capacity: 600, currentFlockId: 'cycle-1' };

const routes = (path) => {
  if (path.startsWith('/api/v1/health')) return { ok: true };
  if (path.startsWith('/api/v1/farms')) return { farms: [FARM] };
  if (path.startsWith('/api/v1/flocks/') && path.includes('/daily-records/calendar')) return { days: [] };
  // Before the generic /daily-records rule — the real path is
  // /flocks/<id>/daily-records/guidance, so order matters.
  if (path.startsWith('/api/v1/flocks/') && path.includes('guidance')) {
    return {
      flock: { id: FLOCK.id, current_birds: 480, production_type: 'broiler', current_age_days: 21 },
      // All eight sections the DTO declares. A real server sends them
      // all; omitting one here hid a crash rather than avoiding it.
      sections: {
        feed: { enabled: true, messages: [], last_entry: null, unit: 'bags' },
        water: { enabled: true, messages: [], usual_quantity: { low: 40, high: 80, avg: 60 } },
        vaccination: { enabled: true, messages: [] },
        treatment: { enabled: true, messages: [] },
        bird_count: { enabled: true, messages: [], living_birds: 480 },
        weight: { enabled: true, messages: [], usual_quantity: { low: 0.8, high: 1.6, avg: 1.2 } },
        eggs: { enabled: true, messages: [] },
        egg_size: { enabled: true, messages: [] },
      },
    };
  }
  if (path.startsWith('/api/v1/flocks/') && path.includes('/daily-records')) return { records: [] };
  if (path.includes('/finance')) {
    return {
      flock: { id: 'cycle-1', name: 'Batch A', placedBirds: 500, currentBirds: 480, productionType: 'broiler' },
      primaryCurrency: 'NGN',
      placement: { cost: 250000, currency: 'NGN', note: '' },
      expenses: {
        primaryCurrency: 'NGN', totalPrimary: 185000,
        byCategory: [{ category: 'feed', amount: 185000, count: 4 }],
        secondaryCurrencies: [],
      },
    };
  }
  if (path.startsWith('/api/v1/flocks')) return { flocks: [FLOCK] };
  if (path.startsWith('/api/v1/pens')) return { pens: [PEN] };
  if (path.startsWith('/api/v1/billing/balances')) return { balances: [{ tokenType: 'broiler', tier: 'basic', balance: 900 }], freemium: { enabled: false, used: true } };
  if (path.startsWith('/api/v1/alerts')) return { alerts: [] };
  if (path.startsWith('/api/v1/expenses')) return { expenses: [], totals: [] };
  if (path.includes('preferences')) {
    return {
      preferences: {
        effectiveDailyRecord: {
          feed: { include: true }, water: { include: true },
          bird_weight: { include: true, auto_average: false },
          eggs: { include: false }, mortality: { include: true },
          bird_count: { dead: true, culled: true, sold: true, lost: true },
          vaccination: { include: true }, treatment: { include: true },
        },
        dailyRecord: {
          feed: { include: true }, water: { include: true },
          bird_weight: { include: true, auto_average: false },
          eggs: { include: false }, mortality: { include: true },
          vaccination: { include: true }, treatment: { include: true },
        },
      },
    };
  }
  if (path.includes('report') || path.includes('summary')) {
    return { summary: { latestAvgWeightKg: 1.2, statusLabel: '[good]' }, series: [] };
  }
  if (path.includes('vocab-aliases')) return { aliases: [] };
  return {};
};

/** Every write the server actually received — the point of the test. */
const writes = [];

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Expose-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.url === '/__writes') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(writes));
  }
  if (req.url === '/__reset') {
    writes.length = 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('[]');
  }

  if (req.method !== 'GET') {
    let raw = '';
    req.on('data', (d) => { raw += d; });
    return req.on('end', () => {
      writes.push({
        method: req.method,
        url: req.url,
        farm: req.headers['x-farm-id'] ?? null,
        auth: req.headers.authorization ? 'bearer present' : 'MISSING',
        body: (() => { try { return JSON.parse(raw); } catch { return raw.slice(0, 200); } })(),
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: { record: { id: 'rec-' + writes.length } } }));
    });
  }
  const body = routes(req.url.split('?')[0] + (req.url.includes('?') ? '?' + req.url.split('?')[1] : ''));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ data: body }));
}).listen(4000, () => console.log('stub api on :4000'));
