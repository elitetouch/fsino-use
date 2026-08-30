/**
 * Web push subscription management for the PWA.
 *
 * The chain from "farmer taps enable" to "notification arrives" has six
 * links, each of which fails silently and independently:
 *
 *   1. The browser supports push at all
 *   2. The service worker is registered and active
 *   3. The user grants notification permission
 *   4. The browser mints a subscription against our VAPID key
 *   5. Our API stores it
 *   6. The backend has push enabled and a worker running
 *
 * Every function here reports WHICH link broke rather than returning a
 * bare boolean, because "notifications aren't working" is otherwise
 * unanswerable without a debugger and a farmer's phone in hand.
 */

import { endpoints } from '@/lib/api';

export type PushSupport =
  | { supported: true }
  | { supported: false; reason: string };

export type PushState = {
  /** Can this browser do push at all? */
  support: PushSupport;
  /** The OS/browser permission — 'default' means never asked. */
  permission: NotificationPermission;
  /** Is this specific device registered with our backend? */
  subscribed: boolean;
};

/**
 * Why push might be impossible here.
 *
 * The iOS case is the one worth special copy. Safari supports web push
 * ONLY for a PWA added to the home screen — in a normal Safari tab the
 * APIs are simply absent and no prompt can ever appear. Telling an
 * iPhone user "notifications are blocked" would be wrong and would send
 * them into Settings looking for a switch that isn't there.
 */
export function checkPushSupport(): PushSupport {
  if (typeof window === 'undefined') {
    return { supported: false, reason: 'Not available during server render.' };
  }

  if (!('serviceWorker' in navigator)) {
    return { supported: false, reason: 'This browser has no service worker support.' };
  }

  if (!('PushManager' in window)) {
    if (isIos() && !isStandalone()) {
      return {
        supported: false,
        reason:
          'On iPhone, notifications only work once the app is added to your Home Screen. Tap Share, then "Add to Home Screen", and open it from there.',
      };
    }
    return { supported: false, reason: 'This browser does not support push notifications.' };
  }

  if (!('Notification' in window)) {
    return { supported: false, reason: 'This browser does not support notifications.' };
  }

  return { supported: true };
}

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari's non-standard flag, still the only reliable iOS signal.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Current state, without prompting for anything. */
export async function getPushState(): Promise<PushState> {
  const support = checkPushSupport();

  if (!support.supported) {
    return { support, permission: 'denied', subscribed: false };
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();

  return {
    support,
    permission: Notification.permission,
    subscribed: existing !== null,
  };
}

/**
 * Turn push on for this device.
 *
 * Throws with a human-readable message on failure — every caller shows
 * it directly, so the text must make sense to a farmer, not a developer.
 */
export async function enablePush(): Promise<void> {
  const support = checkPushSupport();
  if (!support.supported) {
    throw new Error(support.reason);
  }

  // Fetch the key BEFORE prompting. If the server has no VAPID key
  // configured, prompting first would burn the user's one-shot
  // permission decision on a feature that cannot work — and a denied
  // permission cannot be re-requested, only changed in browser settings.
  const { publicKey } = await endpoints.getVapidKey();
  if (!publicKey) {
    throw new Error('Push is not configured on the server yet.');
  }

  const permission = await Notification.requestPermission();

  if (permission === 'denied') {
    throw new Error(
      'Notifications are blocked for this site. Turn them back on in your browser settings, then try again.',
    );
  }
  if (permission !== 'granted') {
    // 'default' — the user dismissed the prompt without choosing.
    throw new Error('Notification permission was not granted.');
  }

  const registration = await navigator.serviceWorker.ready;

  // Reuse an existing browser subscription when there is one. Calling
  // subscribe() twice with the same key returns the same endpoint, but
  // being explicit keeps the applicationServerKey mismatch case (after a
  // VAPID rotation) visible instead of silently throwing.
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      // Required to be true by every browser: we may only push messages
      // the user will actually see. Silent background pushes are not
      // permitted and attempting them gets the origin's push access
      // revoked.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  await registerWithBackend(subscription);
}

/**
 * Turn push off for this device.
 *
 * Unsubscribes locally AND revokes server-side. Doing only one leaves
 * the other believing push is on: revoke-only means the browser keeps a
 * live endpoint we no longer use, and unsubscribe-only means the backend
 * keeps sending into an endpoint that now 410s.
 */
export async function disablePush(): Promise<void> {
  const support = checkPushSupport();
  if (!support.supported) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;

  // Tell the server first. If the local unsubscribe succeeds and the API
  // call then fails, we have lost the identifier needed to revoke it and
  // the backend would keep trying until it accrues enough failures.
  try {
    await endpoints.unregisterPushDevice(endpoint);
  } catch {
    // Non-fatal: the user asked for this device to stop, and the local
    // unsubscribe below achieves that. The server will revoke on its own
    // once the endpoint starts returning 410.
  }

  await subscription.unsubscribe();
}

/**
 * Re-register the current subscription with the backend.
 *
 * Called on every app launch and in response to the service worker's
 * `pushsubscriptionchange`. Browsers rotate endpoints on their own
 * schedule without telling anyone, and a rotated endpoint is the most
 * common reason push silently stops working weeks after it was set up.
 *
 * Cheap because the API is an upsert keyed on the endpoint.
 */
export async function syncPushSubscription(): Promise<void> {
  const support = checkPushSupport();
  if (!support.supported) return;
  if (Notification.permission !== 'granted') return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await registerWithBackend(subscription);
}

async function registerWithBackend(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!p256dh || !auth) {
    throw new Error('The browser returned an incomplete subscription. Try again.');
  }

  await endpoints.registerPushDevice({
    transport: 'webpush',
    identifier: subscription.endpoint,
    keys: { p256dh, auth },
    platform: 'web',
    device_label: describeDevice(),
  });
}

/** Best-effort label so the device list in settings is recognisable. */
function describeDevice(): string {
  const ua = navigator.userAgent;

  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser';

  const platform = /Android/.test(ua)
    ? 'Android'
    : isIos()
      ? 'iPhone'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'Mac'
          : 'device';

  return `${browser} on ${platform}`.slice(0, 120);
}

/**
 * VAPID keys travel as base64url; PushManager.subscribe wants raw bytes.
 *
 * Not interchangeable — base64url swaps +/ for -_ and drops padding, so
 * feeding the string straight to atob throws InvalidCharacterError on
 * roughly half of all generated keys, which makes this look intermittent.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const raw = window.atob(base64);

  // Backed by an explicit ArrayBuffer, not the default ArrayBufferLike.
  // applicationServerKey requires a BufferSource over a real ArrayBuffer,
  // and `new Uint8Array(length)` widens to include SharedArrayBuffer,
  // which the DOM types reject.
  const output = new Uint8Array(new ArrayBuffer(raw.length));

  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}
