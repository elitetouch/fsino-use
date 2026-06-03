'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Wallet, Bird, Plus, RefreshCw, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import { BuyTokensDialog } from '@/components/billing/buy-tokens-dialog';
import {
  apiErrorMessage, endpoints,
  type TokenBalanceDto, type TokenPurchaseDto, type TokenType, type TokenTier,
} from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Wallet — current token balances + purchase history + buy dialog.
 *
 * On mount, if there's a pending purchase reference stashed in
 * sessionStorage (set just before the provider redirect), we poll the
 * status and surface a toast so the user knows whether it landed.
 */
export default function WalletPage() {
  const qc = useQueryClient();
  const [openBuy, setOpenBuy] = useState(false);
  const [buyDefaults, setBuyDefaults] = useState<{ tokenType?: TokenType; tier?: TokenTier; quantity?: number } | undefined>();

  const balances = useQuery({
    queryKey: ['token-balances'],
    queryFn: () => endpoints.listBalances(),
  });

  const purchases = useQuery({
    queryKey: ['token-purchases'],
    queryFn: () => endpoints.listPurchases(),
  });

  const totalBirds = (balances.data?.balances ?? []).reduce((s, b) => s + b.balance, 0);

  function openBuyFor(b?: TokenBalanceDto) {
    setBuyDefaults(b ? { tokenType: b.tokenType, tier: b.tier, quantity: 100 } : undefined);
    setOpenBuy(true);
  }

  return (
    <div className="space-y-5">
      {/* useSearchParams must be wrapped in Suspense — Next.js requires
          this so client-only hooks don't break static prerender. The
          poller runs invisibly inside it. */}
      <Suspense fallback={null}>
        <PurchasePoller
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['token-balances'] });
            qc.invalidateQueries({ queryKey: ['token-purchases'] });
          }}
        />
      </Suspense>

      <PageHeader
        eyebrow="Wallet"
        title="Tokens & purchases"
        description="One token = one bird you can place. Top up before your next cycle."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => { balances.refetch(); purchases.refetch(); }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button size="sm" className="h-10" onClick={() => openBuyFor()}>
              <Plus className="h-3.5 w-3.5" />
              Buy tokens
            </Button>
          </div>
        }
      />

      {/* Total balance hero */}
      <section className="overflow-hidden rounded-xl bg-[var(--color-brand-primary-dark)] p-5 text-white">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">Total tokens</p>
            <p className="mt-1 text-[28px] font-extrabold leading-none tracking-tight sm:text-[34px]">
              {balances.isLoading ? '—' : totalBirds.toLocaleString()}
            </p>
            <p className="mt-1 text-[12px] text-white/80">
              Across all token types and tiers.
            </p>
          </div>
          {balances.data?.freemium && !balances.data.freemium.used && balances.data.freemium.enabled && (
            <span className="rounded-md bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
              1 freemium flock available
            </span>
          )}
        </div>
      </section>

      {/* Balances grid */}
      <section>
        <h2 className="mb-2 text-[13px] font-semibold tracking-tight text-[var(--color-brand-primary-deep)]">Balances by token</h2>
        {balances.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-white" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(balances.data?.balances ?? []).map((b) => (
              <BalanceCard key={`${b.tokenType}-${b.tier}`} balance={b} onTopUp={() => openBuyFor(b)} />
            ))}
          </div>
        )}
      </section>

      {/* Purchase history */}
      <section>
        <h2 className="mb-2 text-[13px] font-semibold tracking-tight text-[var(--color-brand-primary-deep)]">Recent purchases</h2>
        {purchases.isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-white" />
        ) : (purchases.data?.purchases ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-8 text-center">
            <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">No purchases yet</p>
            <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
              Your first purchase will show here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white">
            {(purchases.data?.purchases ?? []).map((p, i) => (
              <PurchaseRow key={p.reference} purchase={p} divider={i < (purchases.data?.purchases.length ?? 0) - 1} />
            ))}
          </div>
        )}
      </section>

      <BuyTokensDialog open={openBuy} onClose={() => setOpenBuy(false)} initial={buyDefaults} />
    </div>
  );
}

function BalanceCard({ balance, onTopUp }: { balance: TokenBalanceDto; onTopUp: () => void }) {
  const low = balance.balance < 100;
  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
          <Bird className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <span className={cn(
          'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
          low ? 'bg-amber-50 text-amber-700' : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]',
        )}>
          {capitalize(balance.tier)}
        </span>
      </div>
      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-muted-soft)]">
        {capitalize(balance.tokenType)} tokens
      </p>
      <p className="text-[22px] font-extrabold leading-none tracking-tight text-[var(--color-brand-fg)]">
        {balance.balance.toLocaleString()}
      </p>
      <button
        type="button"
        onClick={onTopUp}
        className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-brand-primary-deep)] hover:underline"
      >
        <Plus className="h-3 w-3" /> Top up
      </button>
    </div>
  );
}

function PurchaseRow({ purchase, divider }: { purchase: TokenPurchaseDto; divider: boolean }) {
  const naira = (purchase.totalChargedMinor ?? purchase.amountMinor) / 100;
  const statusTone = purchase.status === 'success'
    ? { Icon: CheckCircle2, cls: 'text-[var(--color-brand-primary-deep)]', label: 'Success' }
    : purchase.status === 'pending'
      ? { Icon: Clock, cls: 'text-amber-600', label: 'Pending' }
      : { Icon: XCircle, cls: 'text-rose-600', label: capitalize(purchase.status) };
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', divider && 'border-b border-[var(--color-brand-border)]')}>
      <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-brand-surface-soft)]', statusTone.cls)}>
        <statusTone.Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[var(--color-brand-fg)]">
          {purchase.quantity.toLocaleString()} × {capitalize(purchase.tokenType)} · {capitalize(purchase.tier)}
        </p>
        <p className="truncate text-[11.5px] text-[var(--color-brand-muted)]">
          {capitalize(purchase.provider)} · {purchase.reference} · {purchase.createdAt?.slice(0, 10) ?? ''}
        </p>
      </div>
      <div className="text-right">
        <p className={cn('text-[12px] font-bold', statusTone.cls)}>{statusTone.label}</p>
        <p className="text-[11.5px] text-[var(--color-brand-muted)]">
          {formatMoney(naira, purchase.currency)}
        </p>
      </div>
    </div>
  );
}

/**
 * Post-redirect purchase poller. Reads ?ref= from the URL (with a
 * sessionStorage fallback for gateways that strip query params), polls
 * /billing/purchases/{ref} every 2s up to 15 attempts, and surfaces
 * the outcome via toast.
 *
 * Lives in its own component so that useSearchParams (a CSR-only hook)
 * sits inside the Suspense boundary the page provides — Next.js's
 * static prerender otherwise errors with "should be wrapped in a
 * suspense boundary".
 */
function PurchasePoller({ onSuccess }: { onSuccess?: () => void }) {
  const search = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Gateways append their reference under different param names.
    // Read whichever is present, with this priority:
    //   reference  — Paystack's primary
    //   trxref     — Paystack's mirror
    //   tx_ref     — Flutterwave's primary
    //   transaction_id — Flutterwave's mirror (numeric, but we treat
    //                    as opaque string; backend reference is what
    //                    our DB indexes on)
    //   ref        — our own legacy placeholder (kept for older redirects)
    // Fall back to sessionStorage if all are stripped (some networks
    // intercept the redirect and drop query params).
    const fromUrl =
      search?.get('reference')
      ?? search?.get('trxref')
      ?? search?.get('tx_ref')
      ?? search?.get('ref');

    let refFromStorage: string | null = null;
    try { refFromStorage = window.sessionStorage.getItem('fsm.pendingPurchaseRef'); } catch {}

    // Guard against the old `__REF__` literal sneaking through a
    // stale bookmark.
    const ref =
      fromUrl && fromUrl !== '__REF__' && fromUrl !== ''
        ? fromUrl
        : refFromStorage;
    if (!ref) return;

    let alive = true;
    let attempts = 0;
    const poll = async () => {
      if (!alive) return;
      try {
        const res = await endpoints.showPurchase(ref);
        const p = res.purchase;
        if (p.status === 'success') {
          toast.success(`Purchase confirmed — ${p.quantity.toLocaleString()} ${p.tokenType}/${p.tier} tokens added.`);
          try { window.sessionStorage.removeItem('fsm.pendingPurchaseRef'); } catch {}
          onSuccess?.();
          router.replace('/wallet');
          return;
        }
        if (p.status === 'failed' || p.status === 'abandoned') {
          toast.error(`Payment ${p.status}.`);
          try { window.sessionStorage.removeItem('fsm.pendingPurchaseRef'); } catch {}
          router.replace('/wallet');
          return;
        }
        attempts++;
        if (attempts < 15) setTimeout(poll, 2_000);
      } catch (err) {
        if (attempts === 0) toast.error(apiErrorMessage(err, 'Could not verify the payment yet.'));
      }
    };
    void poll();
    return () => { alive = false; };
  }, [search, router, onSuccess]);

  return null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}
