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
  currentBirds: 480,
  current_birds: 480,
  placedBirds: 500,
  placed_birds: 500,
  productionType: 'broiler',
  production_type: 'broiler',
  currentAge: 21,
  current_age: 21,
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
      sections: {
        feed: { messages: [], last_entry: null },
        water: { messages: [] },
        weight: { messages: [], usual_quantity: { low: 0.8, high: 1.6 } },
        eggs: { messages: [] },
        mortality: { messages: [] },
        vaccination: { messages: [] },
        treatment: { messages: [] },
      },
    };
  }
  if (path.startsWith('/api/v1/flocks/') && path.includes('/daily-records')) return { records: [] };
  if (path.startsWith('/api/v1/flocks')) return { flocks: [FLOCK] };
  if (path.startsWith('/api/v1/pens')) return { pens: [PEN] };
  if (path.startsWith('/api/v1/billing/balances')) return { balances: [{ tokenType: 'broiler', tier: 'basic', balance: 900 }], freemium: { enabled: false, used: true } };
  if (path.startsWith('/api/v1/alerts')) return { alerts: [] };
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

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const body = routes(req.url.split('?')[0] + (req.url.includes('?') ? '?' + req.url.split('?')[1] : ''));
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ data: body }));
}).listen(4000, () => console.log('stub api on :4000'));
