'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing, BellOff, Loader2, Send, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { endpoints, apiErrorMessage } from '@/lib/api';
import {
  enablePush, disablePush, getPushState, type PushState,
} from '@/lib/push';

/**
 * Turn notifications on or off for THIS device.
 *
 * Separate from the category toggles below it, because they answer
 * different questions and failing to separate them is why push settings
 * confuse people. The category toggles are "which things do I care
 * about" and follow the user across every device they own. This card is
 * "does this particular handset ring", and it cannot follow them
 * anywhere — permission is granted per browser, per device.
 *
 * A farmer who switched every category on and still hears nothing
 * because they never granted permission on their phone is the exact
 * failure this card exists to make visible.
 */
export function PushDeviceCard() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await getPushState());
    } catch {
      // getPushState only throws if the service worker never becomes
      // ready, which is itself the answer: push cannot work here.
      setState({
        support: { supported: false, reason: 'The app is still starting up. Try again in a moment.' },
        permission: 'default',
        subscribed: false,
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onEnable = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await enablePush();
      await refresh();
      setNotice('Notifications are on for this device.');
    } catch (e) {
      setError(e instanceof Error ? e.message : apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onDisable = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await disablePush();
      await refresh();
      setNotice('This device will no longer receive notifications.');
    } catch (e) {
      setError(e instanceof Error ? e.message : apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /**
   * The test send is the only honest answer to "is this working?".
   *
   * It reports the DEVICE COUNT rather than just succeeding, because
   * "sent to 0 devices" is the diagnostic — it means the subscription
   * never reached the backend, which no amount of local state can tell
   * you.
   */
  const onTest = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { delivered } = await endpoints.sendTestPush();
      setNotice(
        delivered > 0
          ? `Test sent to ${delivered} device${delivered === 1 ? '' : 's'}. It should arrive in a few seconds.`
          : 'The server accepted it but found no registered device. Try turning notifications off and on again.',
      );
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't send the test notification."));
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return (
      <div className="rounded-xl border border-[var(--color-brand-border)] bg-white p-4">
        <div className="h-16 animate-pulse rounded-lg bg-[var(--color-brand-surface-soft)]" />
      </div>
    );
  }

  // Push is impossible on this browser. The reason is specific — most
  // usefully for iPhone users, who need Add to Home Screen, not a
  // settings change.
  if (!state.support.supported) {
    return (
      <Notice
        tone="warn"
        icon={<ShieldAlert className="h-4 w-4" />}
        title="Notifications aren't available here"
        body={state.support.reason}
      />
    );
  }

  // Permission was actively refused. requestPermission() can never
  // prompt again after this — only the browser's own site settings can
  // undo it, so offering an "Enable" button would be a button that
  // cannot work.
  if (state.permission === 'denied') {
    return (
      <Notice
        tone="warn"
        icon={<BellOff className="h-4 w-4" />}
        title="Notifications are blocked"
        body="You (or this browser) blocked notifications for this site. Open your browser's site settings, allow notifications for this app, then reload this page."
      />
    );
  }

  const on = state.subscribed && state.permission === 'granted';

  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-white">
      <div className="flex items-start gap-3 p-4">
        <span
          className={[
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            on
              ? 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]'
              : 'bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-muted)]',
          ].join(' ')}
        >
          {on ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-[var(--color-brand-fg)]">
            {on ? 'Notifications are on for this device' : 'Turn on notifications for this device'}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--color-brand-muted)]">
            {on
              ? 'Alerts will reach this device even when the app is closed. Choose which ones below.'
              : 'Your alert choices below only reach you once this device is switched on.'}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant={on ? 'outline' : 'primary'} onClick={on ? onDisable : onEnable} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {on ? 'Turn off' : 'Turn on notifications'}
            </Button>

            {on && (
              <Button size="sm" variant="outline" onClick={onTest} disabled={busy}>
                <Send className="h-3.5 w-3.5" />
                Send a test
              </Button>
            )}
          </div>

          {error && (
            <p className="mt-2.5 text-[12px] font-medium text-[var(--color-brand-danger)]">{error}</p>
          )}
          {notice && !error && (
            <p className="mt-2.5 text-[12px] font-medium text-[var(--color-brand-primary-deep)]">{notice}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Notice({
  tone, icon, title, body,
}: {
  tone: 'warn';
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  void tone;
  return (
    <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--color-brand-muted)]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-[var(--color-brand-fg)]">{title}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--color-brand-muted)]">{body}</p>
        </div>
      </div>
    </div>
  );
}
