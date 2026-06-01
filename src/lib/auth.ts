'use client';

/**
 * Token + profile storage. Tenant Sanctum bearer lives in localStorage
 * under a namespaced key so it never collides with an admin token on the
 * same host (defensive — these apps deploy to different domains).
 */
const TOKEN_KEY = 'fsm.app.token';
const USER_KEY = 'fsm.app.user';

export type AppUser = {
  id: string | number;
  name: string;
  email: string;
  phone?: string | null;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
};

export function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* no-op */
  }
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  } catch {
    /* no-op */
  }
}

export function readUser(): AppUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

export function writeUser(user: AppUser): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* no-op */
  }
}
