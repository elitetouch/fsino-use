'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  X, Loader2, Bird, Sparkles, Check, ArrowRight, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import {
  apiErrorMessage, endpoints,
  type TokenType, type TokenTier, type TokenPriceDto,
} from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Buy tokens dialog — choose token type × tier × quantity × gateway,
 * then redirect to the provider's hosted checkout. The component is
 * controlled (caller owns open state) so it can be opened from
 * /wallet, /setup/flocks, or any other surface that needs to refill.
 *
 * Initial values can be pre-set so the inline "buy tokens" prompt on
 * flock placement defaults to the right type/tier and the bird count
 * the user is trying to place.
 */
export function BuyTokensDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: { tokenType?: TokenType; tier?: TokenTier; quantity?: number };
}) {
  const qc = useQueryClient();

  const [tokenType, setTokenType] = useState<TokenType>(initial?.tokenType ?? 'broiler');
  const [tier, setTier] = useState<TokenTier>(initial?.tier ?? 'basic');
  const [quantity, setQuantity] = useState<number | ''>(initial?.quantity ?? 100);
  const [provider, setProvider] = useState<'paystack' | 'flutterwave'>('paystack');

  // Re-sync the initial values when the dialog re-opens with new defaults.
  useEffect(() => {
    if (!open) return;
    if (initial?.tokenType) setTokenType(initial.tokenType);
    if (initial?.tier) setTier(initial.tier);
    if (initial?.quantity != null) setQuantity(initial.quantity);
  }, [open, initial?.tokenType, initial?.tier, initial?.quantity]);

  // Lock scroll while open + Escape to close.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const prices = useQuery({
    queryKey: ['token-prices'],
    queryFn: () => endpoints.listPrices(),
    enabled: open,
  });

  const matchingPrice: TokenPriceDto | undefined = useMemo(
    () => prices.data?.prices.find((p) => p.tokenType === tokenType && p.tier === tier),
    [prices.data, tokenType, tier],
  );

  const buy = useMutation({
    mutationFn: () => endpoints.initializePurchase({
      token_type: tokenType,
      tier,
      quantity: Number(quantity || 0),
      provider,
      currency: matchingPrice?.currency,
      // Send the farmer back to the wallet page so we can poll the
      // reference and reflect SUCCESS / FAILED.
      callback_url: typeof window !== 'undefined'
        ? `${window.location.origin}/wallet?ref=__REF__`
        : undefined,
    }),
    onSuccess: (purchase) => {
      qc.invalidateQueries({ queryKey: ['token-balances'] });
      qc.invalidateQueries({ queryKey: ['token-purchases'] });
      if (purchase.authorizationUrl) {
        // Stash the reference so /wallet can poll it after redirect.
        try { window.sessionStorage.setItem('fsm.pendingPurchaseRef', purchase.reference); } catch {}
        window.location.href = purchase.authorizationUrl;
      } else {
        toast.error('Provider did not return an authorization URL. Please try again.');
      }
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not start payment.')),
  });

  if (!open) return null;

  const qty = Number(quantity || 0);
  const unitNaira = matchingPrice ? matchingPrice.unitPriceMinor / 100 : null;
  const subtotalNaira = unitNaira != null ? unitNaira * qty : null;
  const canSubmit = qty >= 1 && qty <= 10_000_000 && !!matchingPrice && !buy.isPending;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div aria-hidden className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="animate-fade-up relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_30px_80px_-30px_rgba(15,80,30,0.30)] sm:max-w-[460px] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-brand-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[14px] font-bold text-[var(--color-brand-fg)]">Buy tokens</p>
              <p className="text-[11px] text-[var(--color-brand-muted)]">One token = one bird you can place.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {/* Token type */}
          <div>
            <Label>Token type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['broiler', 'layer'] as const).map((t) => (
                <PickerTile
                  key={t}
                  active={tokenType === t}
                  onClick={() => setTokenType(t)}
                  title={t === 'broiler' ? 'Broiler' : 'Layer'}
                  sub={t === 'broiler' ? 'Meat birds' : 'Egg birds'}
                  icon={<Bird className="h-3.5 w-3.5" />}
                />
              ))}
            </div>
          </div>

          {/* Tier */}
          <div>
            <Label>Tier</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['basic', 'premium'] as const).map((t) => (
                <PickerTile
                  key={t}
                  active={tier === t}
                  onClick={() => setTier(t)}
                  title={t === 'basic' ? 'Basic' : 'Premium'}
                  sub={t === 'basic' ? 'Core tracking' : 'Cost + FCR + exports'}
                />
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div>
            <Label htmlFor="quantity">Number of birds (tokens)</Label>
            <Input
              id="quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={10_000_000}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
              placeholder="100"
            />
            <p className="mt-1 text-[11px] text-[var(--color-brand-muted)]">
              Round-trip from your account balance when you place a flock.
            </p>
          </div>

          {/* Provider */}
          <div>
            <Label>Payment method</Label>
            <div className="grid grid-cols-2 gap-2">
              <ProviderTile
                active={provider === 'paystack'}
                onClick={() => setProvider('paystack')}
                title="Paystack"
                hint="Card · Bank · USSD"
              />
              <ProviderTile
                active={provider === 'flutterwave'}
                onClick={() => setProvider('flutterwave')}
                title="Flutterwave"
                hint="Card · Bank · Mobile money"
              />
            </div>
          </div>

          {/* Order summary */}
          <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-muted-soft)]">
              Order summary
            </p>
            <div className="mt-2 space-y-1.5 text-[13px]">
              <Row label={`${qty.toLocaleString()} × ${capitalize(tokenType)} / ${capitalize(tier)}`}
                value={unitNaira != null ? formatMoney(unitNaira, matchingPrice?.currency ?? 'NGN') : '—'} />
              <Row label="Subtotal"
                value={subtotalNaira != null ? formatMoney(subtotalNaira, matchingPrice?.currency ?? 'NGN') : '—'} />
              <Row label="Gateway fee" value="Calculated at checkout" muted />
            </div>
            <p className="mt-2 inline-flex items-center gap-1 text-[10.5px] text-[var(--color-brand-muted)]">
              <ShieldCheck className="h-3 w-3" /> Secure checkout via {capitalize(provider)}.
            </p>
          </div>
        </div>

        <div className="border-t border-[var(--color-brand-border)] bg-white px-5 py-4">
          <Button
            onClick={() => buy.mutate()}
            disabled={!canSubmit}
            size="block"
            className="h-12"
          >
            {buy.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Continue to {capitalize(provider)}
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="mt-2 text-center text-[11px] text-[var(--color-brand-muted)]">
            You&rsquo;ll be redirected to {capitalize(provider)} to complete payment.
          </p>
        </div>
      </div>
    </div>
  );
}

function PickerTile({
  active, onClick, title, sub, icon,
}: {
  active: boolean; onClick: () => void; title: string; sub: string; icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-all',
        active
          ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-accent)]/40'
          : 'border-[var(--color-brand-input-border)] bg-white hover:border-[var(--color-brand-primary)]/40',
      )}
    >
      <div className="flex items-center gap-1.5">
        {icon && (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[var(--color-brand-primary)]/15 text-[var(--color-brand-primary-deep)]">
            {icon}
          </span>
        )}
        <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">{title}</p>
      </div>
      <p className="text-[11px] text-[var(--color-brand-muted)]">{sub}</p>
    </button>
  );
}

function ProviderTile({
  active, onClick, title, hint,
}: { active: boolean; onClick: () => void; title: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-between rounded-lg border-2 p-3 text-left transition-all',
        active
          ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-accent)]/40'
          : 'border-[var(--color-brand-input-border)] bg-white hover:border-[var(--color-brand-primary)]/40',
      )}
    >
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">{title}</p>
        <p className="truncate text-[11px] text-[var(--color-brand-muted)]">{hint}</p>
      </div>
      {active && <Check className="h-3.5 w-3.5 text-[var(--color-brand-primary-deep)]" strokeWidth={2.5} />}
    </button>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn('text-[12.5px]', muted ? 'text-[var(--color-brand-muted)]' : 'text-[var(--color-brand-fg-soft)]')}>{label}</span>
      <span className={cn('text-[12.5px] font-semibold', muted ? 'text-[var(--color-brand-muted)]' : 'text-[var(--color-brand-fg)]')}>{value}</span>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}
