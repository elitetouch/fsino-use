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
// Auth endpoints — wired to the tenant API on /api/v1.
//
// Verified against:
//   POST /api/v1/register                          public
//   POST /api/v1/login                             public
//   POST /api/v1/auth/verify-email                 authenticated (bearer)
//   POST /api/v1/auth/resend-verification-code     authenticated (bearer)
//
// Backend rules (RegisterRequest):
//   name              required, max:255
//   email             required, email, unique
//   phone             required, digits_between:7,20, unique  (digits only!)
//   password          required, min:8, confirmed              (=> password_confirmation)
// -----------------------------------------------------------------------

export type RegisterPayload = {
  name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
};

export type AppUserDto = {
  id: string | number;
  name: string;
  email: string;
  phone?: string | null;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  photoUrl?: string | null;
};

export type AuthSession = {
  user: AppUserDto;
  token: string;
};

/**
 * Strip every non-digit so the value satisfies digits_between:7,20.
 * Accepts inputs like "+234 701-234-5678" → "2347012345678".
 */
export function normalisePhone(input: string): string {
  return input.replace(/\D/g, '');
}

export const endpoints = {
  register: (payload: RegisterPayload) =>
    unwrap<AuthSession>(
      api.post('/register', { ...payload, phone: normalisePhone(payload.phone) }),
    ),

  login: (email: string, password: string) =>
    unwrap<AuthSession>(api.post('/login', { email, password })),

  logout: () => api.post('/logout'),

  profile: () => unwrap<AppUserDto>(api.get('/profile')),

  /**
   * Verify the email by submitting the 6-digit code emailed via
   * EmailVerificationCodeMail. Authenticated route — the bearer issued
   * by /register must be present (axios interceptor handles it).
   */
  verifyEmail: (code: string) =>
    unwrap<{ verified: boolean; user: AppUserDto }>(
      api.post('/auth/verify-email', { code }),
    ),

  /**
   * Trigger a fresh 6-digit code to the user's email. No body —
   * server already knows who the bearer belongs to.
   */
  resendVerificationCode: () =>
    api.post('/auth/resend-verification-code'),
};
