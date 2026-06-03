'use client';

import axios, { AxiosError } from 'axios';
import { clearToken, readToken } from './auth';
import { readCurrentFarmId } from './farm-context';

/**
 * NEXT_PUBLIC_API_BASE_URL is the API **host root** (e.g.
 * `https://api.fsinnovation.net`). The code prepends `/api/v1` itself.
 *
 * Defensive: if the env var was set the old way (with `/api/v1` already
 * appended), we strip it before re-adding — so a misconfigured Vercel
 * env doesn't double up to `/api/v1/api/v1/...`. Either form works.
 */
function resolveBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.fsinnovation.net').trim();
  const trimmed = raw.replace(/\/+$/, '');
  // Strip a trailing /api/v1 (or /api) if present so we can safely re-add it.
  const host = trimmed.replace(/\/api(?:\/v\d+)?$/i, '');
  return `${host}/api/v1`;
}

export const api = axios.create({
  baseURL: resolveBase(),
  timeout: 25_000,
  headers: { Accept: 'application/json' },
});

// Attach bearer + current-farm-id on every request. SSR pages call
// client-side from useEffect/queries so this runs in the browser.
api.interceptors.request.use((config) => {
  const token = readToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // X-Farm-ID is required by farm.context-protected routes (pens, flocks,
  // daily records). Routes that don't need it ignore the header safely.
  const farmId = readCurrentFarmId();
  if (farmId && config.headers && !config.headers['X-Farm-ID']) {
    config.headers['X-Farm-ID'] = farmId;
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

  // ───────────── Farms ─────────────
  listFarms: () => unwrap<{ farms: FarmDto[] }>(api.get('/farms')),

  createFarm: (payload: CreateFarmPayload) =>
    unwrap<{ farm: FarmDto }>(api.post('/farms', payload)),

  showFarm: (id: string) =>
    unwrap<{ farm: FarmDto }>(api.get(`/farms/${id}`)),

  // ───────────── Pens (require X-Farm-ID — auto-injected) ─────────────
  listPens: () => unwrap<{ pens: PenDto[] }>(api.get('/pens')),

  createPen: (payload: CreatePenPayload) =>
    unwrap<{ pen: PenDto }>(api.post('/pens', payload)),

  // ───────────── Flocks (require X-Farm-ID) ─────────────
  /**
   * List flocks for the current farm. By default returns active only.
   * Pass `pen_id` to scope to a single pen and `includeArchived` to get
   * the full history (used by the pen-detail page).
   */
  listFlocks: (params?: { pen_id?: string; includeArchived?: boolean }) =>
    unwrap<{ flocks: FlockDto[] }>(
      api.get('/flocks', {
        params: {
          ...(params?.pen_id ? { pen_id: params.pen_id } : {}),
          ...(params?.includeArchived ? { include_archived: 1 } : {}),
        },
      }),
    ),

  createFlock: (payload: CreateFlockPayload) =>
    unwrap<{ flock: FlockDto }>(api.post('/flocks', payload)),

  /**
   * Archive a flock. Backend warns with 409 + FLOCK_ARCHIVE_WARNING if
   * the flock is still active (has birds or is in-date) unless `force`
   * is true — pass true once the user confirms.
   */
  archiveFlock: (id: string, force = false) =>
    api.delete(`/flocks/${id}`, { params: force ? { force: 'true' } : undefined }),

  // ───────────── Reference data ─────────────
  listBreeds: (params?: { production_type?: string; search?: string; country?: string }) =>
    unwrap<{ breeds: BreedDto[] }>(api.get('/breeds', { params })),

  listHatcheries: (params?: { country?: string; search?: string }) =>
    unwrap<{ hatcheries: HatcheryDto[] }>(api.get('/hatcheries', { params })),

  // ───────────── Billing — token wallet ─────────────
  listBalances: () =>
    unwrap<{ balances: TokenBalanceDto[]; freemium: { enabled: boolean; used: boolean } }>(
      api.get('/billing/balances'),
    ),

  listPrices: () => unwrap<{ prices: TokenPriceDto[] }>(api.get('/billing/prices')),

  listPurchases: () =>
    unwrap<{ purchases: TokenPurchaseDto[] }>(api.get('/billing/purchases')),

  showPurchase: (reference: string) =>
    unwrap<{ purchase: TokenPurchaseDto }>(api.get(`/billing/purchases/${reference}`)),

  /**
   * Start a token purchase. The existing /billing/purchases endpoint
   * historically returns snake_case keys (authorization_url, token_type,
   * etc.) — the list/show endpoints we added return camelCase. Normalise
   * snake → camel here so the rest of the app sees one shape regardless.
   */
  initializePurchase: async (payload: InitializePurchasePayload): Promise<TokenPurchaseDto> => {
    const raw = await unwrap<Record<string, unknown>>(api.post('/billing/purchases', payload));
    const get = <T,>(k1: string, k2: string): T | undefined =>
      (raw[k1] ?? raw[k2]) as T | undefined;
    return {
      id: get<string>('id', 'id'),
      reference: get<string>('reference', 'reference') ?? '',
      provider: (get<TokenPurchaseDto['provider']>('provider', 'provider') ?? payload.provider),
      tokenType: (get<TokenType>('tokenType', 'token_type') ?? payload.token_type),
      tier: (get<TokenTier>('tier', 'tier') ?? payload.tier),
      quantity: Number(get('quantity', 'quantity') ?? payload.quantity),
      amountMinor: Number(get('amountMinor', 'amount_minor') ?? 0),
      feeMinor: get<number>('feeMinor', 'fee_minor') ?? null,
      totalChargedMinor: Number(
        get('totalChargedMinor', 'total_charged_minor') ?? get('amountMinor', 'amount_minor') ?? 0,
      ),
      currency: get<string>('currency', 'currency') ?? 'NGN',
      status: get<TokenPurchaseDto['status']>('status', 'status') ?? 'pending',
      authorizationUrl: get<string>('authorizationUrl', 'authorization_url') ?? null,
      createdAt: get<string>('createdAt', 'created_at') ?? null,
    };
  },
};

// ────────────── Billing DTOs ──────────────

export type TokenType = 'broiler' | 'layer';
export type TokenTier = 'basic' | 'premium';

export type TokenBalanceDto = {
  tokenType: TokenType;
  tier: TokenTier;
  balance: number;
  updatedAt?: string | null;
};

export type TokenPriceDto = {
  id?: string;
  tokenType: TokenType;
  tier: TokenTier;
  unitPriceMinor: number;
  currency: string;
};

export type TokenPurchaseDto = {
  id?: string;
  reference: string;
  provider: 'paystack' | 'flutterwave';
  tokenType: TokenType;
  tier: TokenTier;
  quantity: number;
  amountMinor: number;
  feeMinor?: number | null;
  totalChargedMinor: number;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'abandoned';
  authorizationUrl?: string | null;
  createdAt?: string | null;
  failedAt?: string | null;
  succeededAt?: string | null;
};

export type InitializePurchasePayload = {
  token_type: TokenType;
  tier: TokenTier;
  quantity: number;
  provider: 'paystack' | 'flutterwave';
  currency?: string;
  callback_url?: string;
};

// ─────────────────────── DTOs ───────────────────────

export type FarmDto = {
  id: string;
  accountId: string;
  name: string;
  state?: string | null;
  address?: string | null;
  lga?: string | null;
  countryCode?: string | null;
  timezone?: string | null;
  farmType?: string | null;
  primaryProduction?: 'broiler' | 'layer' | 'mixed' | null;
  estimatedCapacity?: number | null;
  targetMarket?: string | null;
  isActive: boolean;
  logoUrl?: string | null;
  farmStat?: {
    activeFlocksCount?: number;
    activePensCount?: number;
    occupiedPensCount?: number;
    freePens?: number;
  };
  canCreateFlock?: boolean;
};

export type CreateFarmPayload = {
  farm_name: string;
  state?: string;
  address?: string;
  lga?: string;
  timezone?: string;
  farm_type?: string;
  primary_production?: 'broiler' | 'layer' | 'mixed';
  estimated_capacity?: number;
  target_market?: string;
};

export type PenDto = {
  id: string;
  farmId: string;
  name: string;
  penType?: string | null;
  capacity?: number | null;
  houseCode?: string | null;
  notes?: string | null;
  isActive: boolean;
  occupancy?: {
    status: 'free' | 'occupied';
    activeFlock?: null | {
      id: string;
      name: string;
      productionType: string;
      currentBirds: number;
      validUntil: string | null;
    };
  };
};

export type CreatePenPayload = {
  name: string;
  pen_type?: string;
  capacity?: number;
  house_code?: string;
  notes?: string;
};

export type FlockDto = {
  id: string;
  farmId: string;
  penId?: string | null;
  name?: string | null;
  productionType: 'broiler' | 'layer' | 'dual_purpose';
  breed: string;
  placedBirds: number;
  currentBirds: number | null;
  ageDays: number | null;
  cycleWeeks: number | null;
  startDate: string;
  validUntil?: string | null;
  isActive?: boolean;
  archivedAt?: string | null;
};

export type CreateFlockPayload = {
  pen_id?: string;
  production_type: 'broiler' | 'layer' | 'dual_purpose';
  placed_birds: number;
  breed: string;
  breed_id?: string;
  hatchery_id?: string;
  age_when_placed: number;
  flock_price: number;
  start_date: string; // YYYY-MM-DD
  tier: 'basic' | 'premium';
};

export type BreedDto = {
  id: string;
  name: string;
  productionType?: 'broiler' | 'layer' | 'dual_purpose';
  breederCompany?: string | null;
};

export type HatcheryDto = {
  id: string;
  name: string;
  country?: string;
};
