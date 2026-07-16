'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertTriangle, BellOff, Check, ChevronDown, ChevronUp, Loader2,
  ShieldCheck, ThumbsDown, ThumbsUp, TriangleAlert, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiErrorMessage, endpoints, type FlockAlertDto } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Alerts feed — the early-warning surface on the home dashboard.
 *
 * Polls the active alert list every 60 seconds (the backend rule
 * evaluator runs hourly, so a tighter interval would be wasteful).
 * Each row exposes three actions:
 *
 *   - Acknowledge   →  "I've seen this" (alert stays but leaves unread)
 *   - Dismiss       →  "not useful right now"
 *   - Helpful / False alarm → the ML label pipeline. Every mark makes
 *                              the eventual model better; we surface
 *                              it after acknowledge so farmers only
 *                              rate alerts they actually looked at.
 *
 * Silent when the farmer has no active alerts — we don't show a "no
 * alerts" empty state because a green dashboard already communicates
 * "all clear" more efficiently than an empty card.
 */
export function AlertsFeed({ className }: { className?: string }) {
  const alerts = useQuery({
    queryKey: ['alerts', { status: 'active' }],
    queryFn: () => endpoints.listAlerts({ status: 'active', per_page: 50 }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const rows = alerts.data?.alerts ?? [];
  const activeCount = alerts.data?.meta?.activeCount ?? 0;

  // Only render when there's something to see. Zero-alert state is
  // "the dashboard doesn't say anything" — more honest than a happy
  // green empty card that competes with real signal.
  if (alerts.isLoading || rows.length === 0) return null;

  return (
    <section className={cn(
      'rounded-2xl border border-[var(--color-brand-border)] bg-white',
      className,
    )}>
      <header className="flex items-center justify-between border-b border-[var(--color-brand-border)] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <TriangleAlert className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
              Alerts
            </p>
            <h2 className="text-[14px] font-bold tracking-tight text-[var(--color-brand-fg)]">
              {activeCount} active {activeCount === 1 ? 'alert' : 'alerts'}
            </h2>
          </div>
        </div>
      </header>

      <ul className="divide-y divide-[var(--color-brand-border)]">
        {rows.map((alert) => (
          <AlertRow key={alert.id} alert={alert} />
        ))}
      </ul>
    </section>
  );
}

function AlertRow({ alert }: { alert: FlockAlertDto }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [dismissReason, setDismissReason] = useState('');

  const acknowledge = useMutation({
    mutationFn: () => endpoints.acknowledgeAlert(alert.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not acknowledge.')),
  });

  const dismiss = useMutation({
    mutationFn: () => endpoints.dismissAlert(alert.id, dismissReason.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      setDismissing(false);
      setDismissReason('');
      toast.success('Alert dismissed.');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not dismiss.')),
  });

  const feedback = useMutation({
    mutationFn: (kind: 'helpful' | 'false_alarm') =>
      endpoints.submitAlertFeedback(alert.id, kind),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Thanks — your rating trains the alert engine.');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not save feedback.')),
  });

  const isAck = alert.acknowledgedAt !== null;

  return (
    <li className={cn('px-4 py-3 sm:px-5', isAck && 'bg-[var(--color-brand-surface-soft)]/40')}>
      <div className="flex items-start gap-3">
        <SeverityDot severity={alert.severity} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={cn(
              'text-[13.5px] leading-snug tracking-tight text-[var(--color-brand-fg)]',
              !isAck && 'font-bold',
            )}>
              {alert.headline}
            </p>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 rounded-md p-1 text-[var(--color-brand-muted)] hover:bg-[var(--color-brand-surface-soft)]"
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              {expanded
                ? <ChevronUp className="h-4 w-4" />
                : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          <p className="mt-0.5 text-[11px] text-[var(--color-brand-muted)]">
            {alert.topic} · fired {timeAgo(alert.firedAt)}
            {isAck ? ' · acknowledged' : ''}
          </p>

          {expanded && (
            <div className="mt-3 space-y-3 rounded-lg bg-[var(--color-brand-surface-soft)]/60 p-3">
              <p className="text-[12px] leading-relaxed text-[var(--color-brand-fg-soft)]">
                {alert.detail}
              </p>

              {alert.userFeedback === null ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] text-[var(--color-brand-muted)]">
                    Was this alert useful?
                  </p>
                  <Button
                    size="sm" variant="outline"
                    disabled={feedback.isPending}
                    onClick={() => feedback.mutate('helpful')}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" /> Helpful
                  </Button>
                  <Button
                    size="sm" variant="outline"
                    disabled={feedback.isPending}
                    onClick={() => feedback.mutate('false_alarm')}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" /> False alarm
                  </Button>
                </div>
              ) : (
                <p className="text-[11px] text-[var(--color-brand-muted)]">
                  You rated this: <strong className="text-[var(--color-brand-fg)]">
                    {alert.userFeedback === 'helpful' ? 'Helpful' : 'False alarm'}
                  </strong>
                </p>
              )}
            </div>
          )}

          {dismissing && (
            <div className="mt-3 rounded-lg border border-[var(--color-brand-border)] bg-white p-3">
              <label className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">
                Reason (optional)
              </label>
              <input
                type="text"
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value.slice(0, 500))}
                placeholder="e.g. Already handled — no longer relevant."
                className="mt-1 block h-9 w-full rounded-md border border-[var(--color-brand-input-border)] bg-white px-2.5 text-[12.5px] focus:border-[var(--color-brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => dismiss.mutate()} disabled={dismiss.isPending}>
                  {dismiss.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Confirm dismiss
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setDismissing(false); setDismissReason(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!dismissing && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {!isAck && (
                <Button
                  size="sm" variant="outline"
                  disabled={acknowledge.isPending}
                  onClick={() => acknowledge.mutate()}
                >
                  {acknowledge.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Check className="h-3.5 w-3.5" />}
                  Acknowledge
                </Button>
              )}
              <Button
                size="sm" variant="outline"
                onClick={() => setDismissing(true)}
              >
                <BellOff className="h-3.5 w-3.5" />
                Dismiss
              </Button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function SeverityDot({ severity }: { severity: FlockAlertDto['severity'] }) {
  const iconMap = {
    critical: { icon: AlertTriangle, cls: 'bg-rose-100 text-rose-700' },
    high: { icon: AlertTriangle, cls: 'bg-rose-50 text-rose-700' },
    medium: { icon: TriangleAlert, cls: 'bg-amber-50 text-amber-800' },
    info: { icon: ShieldCheck, cls: 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]' },
  } as const;
  const conf = iconMap[severity] ?? iconMap.info;
  const Icon = conf.icon;
  return (
    <span
      aria-label={`Severity ${severity}`}
      className={cn(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
        conf.cls,
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
    </span>
  );
}

/**
 * Compact "5m ago" / "2h ago" / "3d ago" formatter — the alert card is
 * dense, and full timestamps waste vertical real estate on rows the
 * farmer scans in seconds.
 */
function timeAgo(iso: string | null): string {
  if (iso === null) return 'recently';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'recently';
  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
