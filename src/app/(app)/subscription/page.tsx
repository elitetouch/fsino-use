'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bird, Check, Cpu, Info, Loader2, Plus, ShieldCheck,
  ShoppingCart, Sparkles, Wallet as WalletIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import { BuyTokensDialog } from '@/components/billing/buy-tokens-dialog';
import { Gate } from '@/lib/access';
import {
  endpoints,
  type DevicePriceDto, type TokenPriceDto, type TokenType, type TokenTier,
} from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Subscription page — the "what am I paying for" view.
 *
 * Two revenue lines the farmer has to understand to place a flock:
 *
 *   1. TOKENS — per-bird debit on placement, one token per bird per
 *      cycle. Priced in the farm's currency by (tokenType × tier).
 *      Pulled live from GET /billing/prices so a currency / market
 *      change on the admin side lands here without a redeploy.
 *
 *   2. PENKEEP DEVICE — one-off hardware cost, needed only for the
 *      Premium plan's climate-monitoring features. Value comes from
 *      NEXT_PUBLIC_PENKEEP_DEVICE_PRICE so support can adjust per
 *      market without a code change.
 *
 * The feature lists on each plan reflect what's ACTUALLY shipped, not
 * marketing promises. Basic covers the record-keeping loop; Premium
 * layers on the PENKEEP-driven climate features, alerts and cost /
 * harvest projections. If a feature isn't live yet, it doesn't
 * appear here — no fabrication.
 */
export default function SubscriptionPage() {
  const [openBuy, setOpenBuy] = useState(false);
  const [buyDefaults, setBuyDefaults] = useState<{ tokenType?: TokenType; tier?: TokenTier } | undefined>();

  const prices = useQuery({
    queryKey: ['token-prices'],
    queryFn: () => endpoints.listPrices(),
  });

  const balances = useQuery({
    queryKey: ['token-balances'],
    queryFn: () => endpoints.listBalances(),
  });

  // Group prices by tier so each plan card can list all its bird-type
  // prices in one place: "Broiler ₦X / bird · Layer ₦Y / bird".
  const pricesByTier = useMemo(() => {
    const out = { basic: [] as TokenPriceDto[], premium: [] as TokenPriceDto[] };
    for (const p of prices.data?.prices ?? []) {
      if (p.tier === 'basic') out.basic.push(p);
      else if (p.tier === 'premium') out.premium.push(p);
    }
    return out;
  }, [prices.data]);

  const totalBalance = (balances.data?.balances ?? []).reduce((s, b) => s + b.balance, 0);
  const primaryCurrency = prices.data?.prices?.[0]?.currency ?? 'NGN';

  function openBuyFor(tier: TokenTier) {
    setBuyDefaults({ tier, tokenType: 'broiler' });
    setOpenBuy(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Subscription"
        title="Plan and billing"
        description="One token, one bird, one tracked cycle. Choose the plan that matches how you run your farm."
      />

      {/* Current balance strip. Silent until we have real data so the
          page doesn't flash zeros while the query fetches. */}
      {balances.data && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-accent)] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[var(--color-brand-primary-deep)]">
              <WalletIcon className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
                Current balance
              </p>
              <p className="text-[15px] font-bold text-[var(--color-brand-fg)]">
                {totalBalance.toLocaleString()} token{totalBalance === 1 ? '' : 's'}
                <span className="ml-2 text-[12px] font-medium text-[var(--color-brand-fg-soft)]">
                  ({(balances.data?.balances ?? []).length} bucket{(balances.data?.balances ?? []).length === 1 ? '' : 's'})
                </span>
              </p>
            </div>
          </div>
          <Gate perm="billing.manage">
            <Button size="sm" onClick={() => { setBuyDefaults(undefined); setOpenBuy(true); }}>
              <Plus className="h-3.5 w-3.5" /> Buy tokens
            </Button>
          </Gate>
        </section>
      )}

      {/* Plans grid — Basic and Premium side-by-side. Prices pulled
          live from the backend so we never hardcode a stale figure. */}
      <section className="grid gap-5 lg:grid-cols-2">
        <PlanCard
          tier="basic"
          title="Basic"
          eyebrow="For daily record-keeping"
          summary="Everything a farmer needs to run a cycle without paper — daily logging, breed-standard benchmarks, and a bank-ready PDF at harvest."
          features={BASIC_FEATURES}
          notIncluded={PREMIUM_ONLY_FEATURES}
          prices={pricesByTier.basic}
          loading={prices.isLoading}
          onBuy={() => openBuyFor('basic')}
          accent="mint"
        />
        <PlanCard
          tier="premium"
          title="Premium"
          eyebrow="Full pen intelligence"
          summary="Everything Basic includes, plus the PENKEEP device streaming pen climate 24/7 into breed-standard verdicts, alerts, and cost / harvest projections."
          features={PREMIUM_FEATURES}
          prices={pricesByTier.premium}
          loading={prices.isLoading}
          onBuy={() => openBuyFor('premium')}
          accent="brand"
          highlighted
        />
      </section>

      {/* Hardware fees — one card per active device SKU the super
          admin has published in the device_prices table. Only relevant
          for Premium so they sit in their own subordinate section,
          not in the plan grid where a reader might confuse them with
          a token price. */}
      <HardwareFees />

      {/* Rules explainer — extended version of the /setup/flocks
          "How tokens work" panel. Farmers, bank readers and support
          all share the same model. */}
      <TokenRulesPanel />

      {/* Bottom CTA — anchor for anyone who scrolled past the plan
          cards to read the rules first. */}
      <section className="rounded-2xl border border-[var(--color-brand-primary)] bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-deep)] p-6 text-white sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/80">
              Ready to place a cycle?
            </p>
            <h2 className="mt-1 text-[20px] font-bold tracking-tight text-white sm:text-[22px]">
              Buy tokens now — no subscription, no recurring fee
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-white/80">
              Pay only for the birds you place. Tokens don&apos;t expire on the shelf — only when a cycle uses them.
            </p>
          </div>
          <Gate perm="billing.manage">
            <Button
              size="lg"
              className="h-11 bg-white text-[var(--color-brand-primary-deep)] hover:bg-white/90"
              onClick={() => { setBuyDefaults(undefined); setOpenBuy(true); }}
            >
              <ShoppingCart className="h-4 w-4" /> Buy tokens
            </Button>
          </Gate>
        </div>
      </section>

      <BuyTokensDialog
        open={openBuy}
        onClose={() => setOpenBuy(false)}
        initial={buyDefaults}
      />
    </div>
  );
}

/* ─────────────────────────── PLAN CARD ─────────────────────────── */

function PlanCard({
  tier,
  title,
  eyebrow,
  summary,
  features,
  notIncluded,
  prices,
  loading,
  onBuy,
  accent,
  highlighted,
}: {
  tier: TokenTier;
  title: string;
  eyebrow: string;
  summary: string;
  features: readonly string[];
  notIncluded?: readonly string[];
  prices: TokenPriceDto[];
  loading: boolean;
  onBuy: () => void;
  accent: 'mint' | 'brand';
  highlighted?: boolean;
}) {
  return (
    <div className={cn(
      'flex flex-col overflow-hidden rounded-2xl border bg-white',
      highlighted
        ? 'border-[var(--color-brand-primary)] shadow-lg shadow-[var(--color-brand-primary)]/10'
        : 'border-[var(--color-brand-border)]',
    )}>
      {highlighted && (
        <div className="bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-primary-deep)] px-5 py-2 text-center">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-white">
            Most complete
          </p>
        </div>
      )}
      <div className="p-6 sm:p-7">
        <div className="flex items-start gap-3">
          <span className={cn(
            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            accent === 'brand'
              ? 'bg-[var(--color-brand-primary)] text-white'
              : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]',
          )}>
            <Sparkles className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
              {eyebrow}
            </p>
            <h3 className="mt-0.5 text-[20px] font-bold tracking-tight text-[var(--color-brand-fg)]">
              {title}
            </h3>
          </div>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-brand-fg-soft)]">
          {summary}
        </p>

        {/* Price grid — one row per bird type present in the tier. */}
        <div className="mt-5 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--color-brand-border)] p-3 text-[12.5px] text-[var(--color-brand-muted)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading prices…
            </div>
          ) : prices.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-brand-border)] p-3 text-[12.5px] text-[var(--color-brand-muted)]">
              Pricing for this plan isn&apos;t configured for your market yet — contact support.
            </div>
          ) : (
            prices.map((p) => (
              <PriceRow key={`${p.tokenType}-${p.tier}`} price={p} />
            ))
          )}
        </div>

        {/* Features list — what the farmer actually gets. */}
        <ul className="mt-5 space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--color-brand-fg-soft)]">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-primary-deep)]" strokeWidth={2.5} />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {notIncluded && notIncluded.length > 0 && (
          <div className="mt-4 rounded-lg bg-[var(--color-brand-surface-soft)]/60 p-3">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--color-brand-muted)]">
              Not in this plan
            </p>
            <ul className="mt-1.5 space-y-1 text-[11.5px] leading-relaxed text-[var(--color-brand-muted)]">
              {notIncluded.map((n) => (
                <li key={n}>· {n}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-auto border-t border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/40 p-5">
        <Gate perm="billing.manage" fallback={<p className="text-[11.5px] text-[var(--color-brand-muted)]">Ask the farm owner or a billing manager to top up.</p>}>
          <Button
            className={cn(
              'w-full',
              highlighted && 'bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-deep)]',
            )}
            variant={highlighted ? 'default' : 'outline'}
            onClick={onBuy}
          >
            <ShoppingCart className="h-4 w-4" /> Buy {tier === 'premium' ? 'Premium' : 'Basic'} tokens
          </Button>
        </Gate>
      </div>
    </div>
  );
}

function PriceRow({ price }: { price: TokenPriceDto }) {
  const majorUnits = price.unitPriceMinor / 100;
  const formatted = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: price.currency,
    maximumFractionDigits: 0,
  }).format(majorUnits);
  const label = price.tokenType === 'broiler' ? 'Broiler' : 'Layer';

  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/50 px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <Bird className="h-3.5 w-3.5 text-[var(--color-brand-muted)]" />
        <span className="text-[12.5px] font-semibold text-[var(--color-brand-fg)]">{label}</span>
      </div>
      <div className="text-right">
        <p className="text-[15px] font-bold tabular-nums text-[var(--color-brand-fg)]">{formatted}</p>
        <p className="text-[10.5px] text-[var(--color-brand-muted)]">per bird per cycle</p>
      </div>
    </div>
  );
}

/* ─────────────────────────── HARDWARE FEES ─────────────────────────── */

/**
 * Renders one card per active device SKU the super admin has published
 * (typically just PENKEEP today; future accessories join automatically
 * as the admin adds rows). Fetches from GET /billing/device-prices —
 * so support can update the price / add a market without a redeploy.
 *
 * Empty state (no active rows) is intentionally silent — the user
 * doesn't need to know a section exists if there's nothing to buy.
 */
function HardwareFees() {
  const devicePrices = useQuery({
    queryKey: ['device-prices'],
    queryFn: () => endpoints.listDevicePrices(),
  });

  if (devicePrices.isLoading) {
    return (
      <section className="rounded-2xl border border-dashed border-[var(--color-brand-border)] bg-white p-5 text-[12.5px] text-[var(--color-brand-muted)]">
        <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" /> Loading hardware pricing…
      </section>
    );
  }

  const rows = devicePrices.data?.prices ?? [];
  if (rows.length === 0) return null;

  return (
    <section className="space-y-3">
      {rows.map((price) => (
        <DeviceFeeCard key={price.deviceKey} price={price} />
      ))}
    </section>
  );
}

function DeviceFeeCard({ price }: { price: DevicePriceDto }) {
  const majorUnits = price.unitPriceMinor / 100;
  const formatted = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: price.currency,
    maximumFractionDigits: 0,
  }).format(majorUnits);

  // Copy is keyed on device_key so a new SKU added by the super admin
  // shows a sensible default label + description even before we ship
  // dedicated copy for it. PENKEEP gets the full pitch; anything else
  // falls back to the label the admin set.
  const isPenkeep = price.deviceKey === 'penkeep_station';
  const title = price.label ?? (isPenkeep ? 'PENKEEP pen climate station' : humaniseDeviceKey(price.deviceKey));
  const body = isPenkeep
    ? 'One PENKEEP covers a full pen with three heater zones and monitors temperature, humidity, ammonia and CO₂ around the clock. Only needed if you\'re on Premium — Basic runs on record-keeping alone.'
    : 'One-off hardware. Reach out to support to order.';

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white">
      <div className="grid gap-4 p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-6 sm:p-7">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <Cpu className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
            Hardware, one-off
          </p>
          <h3 className="mt-0.5 text-[16px] font-bold tracking-tight text-[var(--color-brand-fg)]">
            {title}
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-brand-fg-soft)]">
            {body}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[20px] font-bold tabular-nums text-[var(--color-brand-fg)]">{formatted}</p>
          <p className="text-[10.5px] text-[var(--color-brand-muted)]">per device</p>
          <a
            href="/contact"
            className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-brand-primary-deep)] hover:underline"
          >
            Talk to support to order →
          </a>
        </div>
      </div>
    </div>
  );
}

function humaniseDeviceKey(key: string): string {
  return key
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

/* ─────────────────────────── TOKEN RULES ─────────────────────────── */

/**
 * Extended version of the "How tokens work" panel on the flock-placement
 * page. Adds the deduction / expiry / refund policy the farmer needs
 * before spending money.
 */
function TokenRulesPanel() {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-gradient-to-br from-[var(--color-brand-accent)] to-white">
      <div className="p-6 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary)] text-white">
            <ShieldCheck className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
              How this works
            </p>
            <h2 className="mt-0.5 text-[18px] font-bold tracking-tight text-[var(--color-brand-fg)]">
              One token, one bird, one tracked cycle
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-brand-fg-soft)]">
              Tokens are how you pay for flock tracking. Each placed bird debits one token from the matching{' '}
              <strong className="text-[var(--color-brand-fg)]">token type × tier</strong> bucket, and that single debit keeps the cycle live for the full production window. No daily fees. No recurring charges per record.
            </p>
          </div>
        </div>

        {/* Cycle windows by type. */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <CycleTypeCard label="Broiler" window="7 weeks per token" body="Full meat-bird cycle from placement to sale." />
          <CycleTypeCard label="Layer" window="18 months per token" body="Brood, pullet, onset of lay, through peak." />
          <CycleTypeCard label="Dual-purpose" window="18 months per token" body="Priced and windowed on the layer policy." />
        </div>

        {/* Deduction rules. */}
        <div className="mt-6 rounded-xl border border-[var(--color-brand-border)] bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-primary-deep)]">
            When tokens are deducted
          </p>
          <ul className="mt-2.5 space-y-2 text-[12.5px] leading-relaxed text-[var(--color-brand-fg-soft)]">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-primary-deep)]" strokeWidth={2.5} />
              <span>
                <strong className="text-[var(--color-brand-fg)]">At placement.</strong> The moment you place a flock, the app debits one token per bird from the matching bucket. If the bucket runs short, placement is blocked — you top up and try again.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-primary-deep)]" strokeWidth={2.5} />
              <span>
                <strong className="text-[var(--color-brand-fg)]">Type + tier must match.</strong> Broiler tokens can&apos;t cover a layer cycle, and Basic tokens can&apos;t cover a Premium placement. Each debit pulls from its exact bucket.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-primary-deep)]" strokeWidth={2.5} />
              <span>
                <strong className="text-[var(--color-brand-fg)]">No per-record charge.</strong> Once the placement debit lands, every daily record, weight sample, vaccination log and PDF export for that cycle is free.
              </span>
            </li>
          </ul>
        </div>

        {/* Expiry + archive rules. */}
        <div className="mt-4 rounded-xl border border-[var(--color-brand-border)] bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-primary-deep)]">
            When cycles end (and tokens do their job)
          </p>
          <ul className="mt-2.5 space-y-2 text-[12.5px] leading-relaxed text-[var(--color-brand-fg-soft)]">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-primary-deep)]" strokeWidth={2.5} />
              <span>
                <strong className="text-[var(--color-brand-fg)]">Cycle window expires.</strong> When the production window (7 weeks broiler / 18 months layer) passes, the flock auto-archives. The pen is freed for the next placement, the cycle&apos;s data stays on file for reports, and the token has done its job.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-primary-deep)]" strokeWidth={2.5} />
              <span>
                <strong className="text-[var(--color-brand-fg)]">All birds gone.</strong> A flock that drops to zero birds — sold, culled or lost — auto-archives the same day.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-primary-deep)]" strokeWidth={2.5} />
              <span>
                <strong className="text-[var(--color-brand-fg)]">You archive early.</strong> Ending a cycle early frees the pen immediately. The data stays; the used token is not returned.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-primary-deep)]" strokeWidth={2.5} />
              <span>
                <strong className="text-[var(--color-brand-fg)]">One pen, one active flock.</strong> A pen holds one active flock at a time. Place a new cycle only after the previous one is archived.
              </span>
            </li>
          </ul>
        </div>

        {/* Wallet policy. */}
        <div className="mt-4 rounded-xl border border-[var(--color-brand-border)] bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-primary-deep)]">
            About your token wallet
          </p>
          <ul className="mt-2.5 space-y-2 text-[12.5px] leading-relaxed text-[var(--color-brand-fg-soft)]">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-primary-deep)]" strokeWidth={2.5} />
              <span>
                <strong className="text-[var(--color-brand-fg)]">Unused tokens don&apos;t expire on the shelf.</strong> Buy in bulk if you&apos;re planning multiple cycles — they wait in your wallet until you place a flock.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-primary-deep)]" strokeWidth={2.5} />
              <span>
                <strong className="text-[var(--color-brand-fg)]">Refunds only for undelivered tokens.</strong> If a purchase fails after payment (rare — the gateway usually catches it), the failed order is refunded to your original payment method. Once a token is delivered to your wallet, it&apos;s yours — no refund on delivered tokens.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-primary-deep)]" strokeWidth={2.5} />
              <span>
                <strong className="text-[var(--color-brand-fg)]">One wallet per farm.</strong> Every staff member with billing permission tops up the same wallet. Balances and purchase history are visible on the Wallet page.
              </span>
            </li>
            <li className="flex items-start gap-2 rounded-lg bg-[var(--color-brand-surface-soft)]/60 p-2.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-brand-primary-deep)]" strokeWidth={2.5} />
              <span className="text-[12px] text-[var(--color-brand-muted)]">
                Questions about a specific charge or bulk discount? Reach us on the <a href="/contact" className="font-semibold text-[var(--color-brand-primary-deep)] hover:underline">Contact us</a> page — support usually replies same-day.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function CycleTypeCard({ label, window, body }: { label: string; window: string; body: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-white px-4 py-3.5">
      <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-primary-deep)]">
        {label}
      </p>
      <p className="mt-1 text-[14px] font-bold text-[var(--color-brand-fg)]">
        {window}
      </p>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--color-brand-muted)]">
        {body}
      </p>
    </div>
  );
}

/* ─────────────────────────── FEATURE LISTS ─────────────────────────── */

/**
 * Features must reflect what the app actually ships, not marketing
 * copy. Adding a bullet here is a promise the tenant portal already
 * delivers on for the tier in question.
 */
const BASIC_FEATURES = [
  'Daily record wizard — feed, water, mortality, vaccines, weight, sales.',
  'Breed-standard benchmarks (Ross 308, Cobb 500, Hy-Line, Lohmann, ISA) — every metric rated against the target for the exact age of your birds.',
  'Cycle report — birds, feed, mortality, FCR, cost and margin, exportable as bank-ready PDF and CSV.',
  'Vaccination schedule built from your breed\'s protocol, with off-schedule tracking for anything you administer outside the standard.',
  'Expenses ledger and per-cycle finance view (placement + operating cost + revenue + margin).',
  'Unlimited pens, unlimited past cycles, unlimited staff.',
] as const;

const PREMIUM_FEATURES = [
  'Everything in Basic, plus:',
  'PENKEEP pen climate station — live temperature, humidity, ammonia and CO₂, streamed to the dashboard 24/7.',
  'Age-based temperature comfort verdict — every day rated against the breed\'s physiological target for that age.',
  'Real-time alerts — feed drop, mortality spike, climate stress, ammonia spike, weight stall — the moment the data trips a rule.',
  'Cost projection and harvest-day forecast — see the end of the cycle from day 15.',
  'Peer benchmarking — how this cycle compares to your own past cycles at the same age.',
] as const;

const PREMIUM_ONLY_FEATURES = [
  'PENKEEP pen climate station (hardware sold separately).',
  'Real-time climate alerts and stress verdicts.',
  'Cost projection and harvest-day forecast.',
  'Peer benchmarking across past cycles.',
] as const;
