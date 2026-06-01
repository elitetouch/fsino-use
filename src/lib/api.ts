'use client';

import axios, { AxiosError } from 'axios';
import { clearToken, readToken } from './auth';

const baseURL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.fsinnovation.net/api/v1';

export const api = axios.create({
  baseURL,
  timeout: 25_000,
  headers: { Accept: 'application/json' },
});

// Attach bearer on every request when present. SSR pages call client-side
// from useEffect/queries so this runs in the browser.
api.interceptors.request.use((config) => {
  const token = readToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global 401 handler — token went stale or was revoked server-side.
api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      clearToken();
      // Don't bounce mid-onboarding if the user is on a public route already.
      const pathname = window.location.pathname;
      if (!/^\/(login|register|verify|welcome|$)/.test(pathname)) {
        window.location.href = '/';
      }
    }
    return Promise.reject(err);
  },
);

/** Unwrap `{ data: ... }` envelope used by ApiController->success(). */
function unwrap<T>(promise: Promise<{ data: { data?: T } & T }>): Promise<T> {
  return promise.then((r) => (r.data?.data ?? r.data) as T);
}

/** Best-effort extraction of a human error message from any API failure. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err instanceof AxiosError) {
    const body = err.response?.data as
      | { message?: string; errors?: Record<string, string[]> }
      | undefined;
    if (body?.message) return body.message;
    const first = body?.errors ? Object.values(body.errors)[0] : undefined;
    if (first && first.length > 0) return first[0];
  }
  return fallback;
}

// -----------------------------------------------------------------------
// Auth endpoints — match the existing tenant API on /api/v1
// -----------------------------------------------------------------------

export type RegisterPayload = {
  name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
};

export type AuthSession = {
  user: {
    id: string | number;
    name: string;
    email: string;
    phone?: string | null;
    emailVerifiedAt?: string | null;
    phoneVerifiedAt?: string | null;
  };
  token: string;
};

export const endpoints = {
  register: (payload: RegisterPayload) =>
    unwrap<AuthSession>(api.post('/register', payload)),

  login: (email: string, password: string) =>
    unwrap<AuthSession>(api.post('/login', { email, password })),

  logout: () => api.post('/logout'),

  profile: () => unwrap<{ user: AuthSession['user'] }>(api.get('/profile')),

  /** Request a verification code (email or phone — backend decides channel). */
  resendVerificationCode: (channel: 'email' | 'phone' = 'phone') =>
    api.post('/resend-otp', { channel }),

  /** Submit the 4-6 digit code to verify the account. */
  verifyCode: (code: string, channel: 'email' | 'phone' = 'phone') =>
    unwrap<{ user: AuthSession['user'] }>(
      api.post('/verify-email', { code, channel }),
    ),
};
