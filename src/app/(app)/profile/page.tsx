'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Camera, Check, ChevronRight, Crown, Image as ImageIcon, Loader2,
  Mail, Pencil, Phone, ShieldCheck, ShieldOff, Trash2, Tractor, User as UserIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { PageHeader } from '@/components/app/page-header';
import {
  apiErrorMessage, endpoints, normalisePhone,
  type AppUserDto, type FarmDto,
} from '@/lib/api';
import { readUser, writeUser, type AppUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

/**
 * Profile page — owner / staff personal record.
 *
 * Three blocks, top → bottom:
 *
 *   1. Identity card: avatar + name + role across farms. Photo
 *      upload + remove live here as small actions on the avatar.
 *   2. Contact card: email + phone with verified badges. Inline edit
 *      flips the block into a form; cancel restores the view.
 *   3. Farms card: list of every farm the user belongs to + their role
 *      on each. "Manage" deep-links to the farm detail page.
 *
 * Edit pattern: each block toggles independently between view and edit
 * — keeps the page fast (no full-form re-render) and lets the user
 * change one thing at a time. The mutations invalidate the profile
 * query so the view block re-paints with the server's authoritative
 * response.
 */
export default function ProfilePage() {
  const qc = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => endpoints.profile(),
    staleTime: 30_000,
  });

  const farmsQuery = useQuery({
    queryKey: ['farms'],
    queryFn: () => endpoints.listFarms(),
    staleTime: 60_000,
  });

  // Local user snapshot from localStorage seeds the avatar/name before
  // the network round-trips — same trick the topbar uses to avoid a
  // first-paint flash.
  const [seed] = useState<AppUser | null>(() => readUser());
  const user = profileQuery.data ?? seed;

  // After every successful mutation, write the server response back to
  // localStorage so other pages (topbar, dashboard greeting) pick up
  // the new name/photo without their own refetch.
  useEffect(() => {
    if (profileQuery.data) {
      writeUser(profileQuery.data as unknown as AppUser);
    }
  }, [profileQuery.data]);

  return (
    // `w-full max-w-full overflow-x-hidden` is a deliberate belt-and-
    // braces guard. Even if a child card somehow ships an unexpectedly
    // long value (a 64-character email, a sprawling vaccine name, etc.),
    // the page itself cannot push beyond the viewport so the user never
    // gets a horizontal scrollbar or a pinch-to-zoom prompt.
    <div className="w-full max-w-full space-y-4 overflow-x-hidden sm:space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Your profile"
        description="Manage your personal details, photo and farm memberships."
      />

      {profileQuery.isLoading && !user ? (
        <SkeletonStack />
      ) : !user ? (
        <ErrorState onRetry={() => qc.invalidateQueries({ queryKey: ['profile'] })} />
      ) : (
        // Single column on mobile (cards stack), 2-col only at lg+ where
        // the viewport can carry both side-by-side without cramping the
        // contact form's labels or the farms list rows.
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <IdentityBlock user={user} farms={farmsQuery.data?.farms ?? []} />
          <div className="min-w-0 space-y-3 sm:space-y-4">
            <ContactBlock user={user} />
            <FarmsBlock farms={farmsQuery.data?.farms ?? []} loading={farmsQuery.isLoading} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Identity ─────────────────────────── */

function IdentityBlock({ user, farms }: { user: AppUserDto; farms: FarmDto[] }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // Role across farms: owner outranks manager outranks staff. We show
  // the highest-rank label as a small badge under the name.
  const topRole = useMemo<'owner' | 'manager' | 'staff' | null>(() => {
    const order: Array<'owner' | 'manager' | 'staff'> = ['owner', 'manager', 'staff'];
    for (const r of order) {
      if (farms.some((f) => f.membership?.role === r)) return r;
    }
    return null;
  }, [farms]);

  const upload = useMutation({
    mutationFn: (file: File) => endpoints.uploadProfilePhoto(file),
    // Write the server's authoritative user back into the cache so the
    // UI updates without waiting for a refetch. Then also invalidate so
    // any other consumer of `['profile']` revalidates against the
    // server. setQueryData alone is faster (zero round-trips); the
    // invalidate is the belt to its braces.
    onSuccess: (data) => {
      toast.success('Photo updated.');
      qc.setQueryData(['profile'], data.user);
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not upload your photo.')),
  });

  const remove = useMutation({
    mutationFn: () => endpoints.removeProfilePhoto(),
    onSuccess: (data) => {
      toast.success('Photo removed.');
      qc.setQueryData(['profile'], data.user);
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not remove your photo.')),
  });

  const onPick = () => fileRef.current?.click();
  const onFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate(file);
    e.target.value = ''; // allow re-picking the same file
  };

  // Centered, vertical layout at every breakpoint. The previous
  // horizontal-on-mobile variant introduced a flex row where the text
  // wrapper could fight the avatar for width, which on narrow phones
  // (320–360px) produced subtle overflow when long names + role pills +
  // the Remove-photo Button (whitespace-nowrap by Button defaults) all
  // tried to fit on the same row. Going vertical removes that whole
  // class of bug — the avatar takes one row, every text element takes
  // a row of its own with full breakpoint width.
  return (
    <article className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white p-4 sm:p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative shrink-0">
          <Avatar src={user.photoUrl ?? null} name={user.name} size={88} sizeSm={104} />
          <button
            type="button"
            onClick={onPick}
            disabled={upload.isPending}
            className={cn(
              'absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[var(--color-brand-primary)] text-white shadow-md transition hover:bg-[var(--color-brand-primary-deep)]',
              upload.isPending && 'opacity-60',
            )}
            aria-label="Upload photo"
          >
            {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={onFile}
          />
        </div>

        <div className="w-full min-w-0">
          {/* break-words handles the pathological "single 40-character
              token" case (e.g. a typed-in display name without spaces);
              line-clamp-2 keeps the avatar block predictable in height. */}
          <p className="line-clamp-2 break-words text-[16px] font-bold tracking-tight text-[var(--color-brand-fg)] sm:text-[18px]">
            {user.name}
          </p>
          {topRole && (
            <span className={cn(
              'mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
              topRole === 'owner'
                ? 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]'
                : topRole === 'manager'
                  ? 'bg-sky-50 text-sky-700'
                  : 'bg-[var(--color-brand-bg)] text-[var(--color-brand-fg-soft)]',
            )}>
              {topRole === 'owner' && <Crown className="h-3 w-3" />}
              {topRole}
            </span>
          )}
          <p className="mt-1 text-[11.5px] text-[var(--color-brand-muted)]">
            {farms.length === 0
              ? 'No farm memberships yet'
              : `${farms.length} ${farms.length === 1 ? 'farm' : 'farms'}`}
          </p>
        </div>

        {user.photoUrl && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[11.5px] text-[var(--color-brand-muted)]"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
          >
            <Trash2 className="h-3 w-3" />
            Remove photo
          </Button>
        )}
      </div>
    </article>
  );
}

/**
 * Mobile-aware avatar — defaults to `size` (mobile) and bumps to
 * `sizeSm` at the `sm:` breakpoint via inline CSS variables consumed in
 * an arbitrary-value class. Lets the identity card show a compact 80px
 * thumbnail next to a horizontal row on phones and the full 104px hero
 * on tablets/desktop without two render paths.
 */
function Avatar({
  src, name, size, sizeSm,
}: {
  src: string | null;
  name: string;
  size: number;
  sizeSm?: number;
}) {
  const smSize = sizeSm ?? size;
  const style = {
    '--avatar-size': `${size}px`,
    '--avatar-size-sm': `${smSize}px`,
  } as React.CSSProperties;
  const fontStyle = {
    ...style,
    fontSize: `${Math.round(size * 0.38)}px`,
  } as React.CSSProperties;

  if (src) {
    return (
      // key={src} forces React to swap the <img> when the URL changes,
      // bypassing both React reconciliation reuse AND any browser memory
      // cache that holds the previous element's loaded blob.
      <img
        key={src}
        src={src}
        alt={name}
        className="block h-[var(--avatar-size)] w-[var(--avatar-size)] rounded-full border-2 border-[var(--color-brand-border)] object-cover sm:h-[var(--avatar-size-sm)] sm:w-[var(--avatar-size-sm)]"
        style={style}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('') || 'F';
  return (
    <div
      className="flex h-[var(--avatar-size)] w-[var(--avatar-size)] items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-deep)] text-white shadow-[0_8px_24px_-12px_rgba(15,80,30,0.30)] sm:h-[var(--avatar-size-sm)] sm:w-[var(--avatar-size-sm)]"
      style={fontStyle}
    >
      <span className="font-bold tracking-tight">{initials}</span>
    </div>
  );
}

/* ─────────────────────────── Contact ─────────────────────────── */

function ContactBlock({ user }: { user: AppUserDto }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ? String(user.phone) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset locals when the canonical user changes (after a save) so a
  // subsequent edit toggle reads the fresh values.
  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone ? String(user.phone) : '');
  }, [user.name, user.email, user.phone]);

  const save = useMutation({
    mutationFn: () => {
      // Only send fields the user actually changed — the backend uses
      // `sometimes` so omitted fields stay untouched, and email/phone
      // changes flip verified-at on the server. Omitting unchanged
      // values avoids forcing a redundant re-verification.
      const payload: Partial<{ name: string; email: string; phone: string }> = {};
      if (name.trim() && name !== user.name) payload.name = name.trim();
      if (email.trim() && email !== user.email) payload.email = email.trim();
      const cleaned = normalisePhone(phone);
      if (cleaned && cleaned !== String(user.phone ?? '')) payload.phone = cleaned;
      return endpoints.updateProfile(payload);
    },
    onSuccess: (data) => {
      const msgs: string[] = ['Profile updated.'];
      if (data.emailChanged) msgs.push('Verify your new email.');
      if (data.phoneChanged) msgs.push('Verify your new phone.');
      toast.success(msgs.join(' '));
      setEditing(false);
      setErrors({});
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => {
      const ax = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      const fieldErrs = ax.response?.data?.errors ?? null;
      if (fieldErrs) {
        const next: Record<string, string> = {};
        for (const [k, v] of Object.entries(fieldErrs)) {
          next[k] = Array.isArray(v) ? (v[0] ?? '') : String(v);
        }
        setErrors(next);
      }
      toast.error(apiErrorMessage(err, 'Could not save your profile.'));
    },
  });

  if (editing) {
    return (
      <article className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-[var(--color-brand-fg)]">Personal details</h2>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        >
          <div>
            <Label htmlFor="profile-name">Full name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              disabled={save.isPending}
            />
            <FieldError message={errors.name} />
          </div>
          <div>
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={save.isPending}
            />
            <FieldError message={errors.email} />
            {email !== user.email && (
              <p className="mt-1 text-[11px] text-[var(--color-brand-muted)]">
                Changing your email will require a new verification code.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="profile-phone">Phone</Label>
            <Input
              id="profile-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="+234 801 234 5678"
              disabled={save.isPending}
            />
            <FieldError message={errors.phone} />
            {phone && normalisePhone(phone) !== String(user.phone ?? '') && (
              <p className="mt-1 text-[11px] text-[var(--color-brand-muted)]">
                Changing your phone will require a new verification code.
              </p>
            )}
          </div>
          {/* Full-width-stacked buttons on mobile so the thumb has a
              comfortable Save target; inline pair on sm+. */}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                setEditing(false);
                setErrors({});
                setName(user.name);
                setEmail(user.email);
                setPhone(user.phone ? String(user.phone) : '');
              }}
              disabled={save.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="w-full sm:w-auto"
              disabled={save.isPending}
            >
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save changes
            </Button>
          </div>
        </form>
      </article>
    );
  }

  return (
    <article className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-bold text-[var(--color-brand-fg)]">Personal details</h2>
        <Button variant="outline" size="sm" className="h-8 shrink-0 text-[11.5px]" onClick={() => setEditing(true)}>
          <Pencil className="h-3 w-3" />
          Edit
        </Button>
      </div>
      <div className="space-y-3">
        <DetailRow icon={UserIcon} label="Full name" value={user.name} />
        <DetailRow
          icon={Mail}
          label="Email"
          value={user.email}
          badge={user.emailVerifiedAt
            ? { label: 'Verified', tone: 'green' }
            : { label: 'Unverified', tone: 'amber' }}
        />
        <DetailRow
          icon={Phone}
          label="Phone"
          value={user.phone ? String(user.phone) : 'Not set'}
          badge={user.phone ? (user.phoneVerifiedAt
            ? { label: 'Verified', tone: 'green' }
            : { label: 'Unverified', tone: 'amber' }) : undefined}
        />
      </div>
    </article>
  );
}

function DetailRow({
  icon: Icon, label, value, badge,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  badge?: { label: string; tone: 'green' | 'amber' };
}) {
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/40 px-3 py-2.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--color-brand-primary-deep)]">
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--color-brand-muted)]">{label}</p>
          {/* break-all (not truncate) on the value: emails / phone
              numbers are a single unbroken token, so word-break needs
              to be character-level. truncate hides text that no
              ellipsis can really fix on a narrow viewport — wrapping is
              better than concealing. */}
          <p className="break-all text-[13px] font-semibold text-[var(--color-brand-fg)]">{value}</p>
          {badge && (
            <span className={cn(
              'mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider',
              badge.tone === 'green'
                ? 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]'
                : 'bg-amber-100 text-amber-800',
            )}>
              {badge.tone === 'green' ? <ShieldCheck className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
              {badge.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Farms ─────────────────────────── */

function FarmsBlock({ farms, loading }: { farms: FarmDto[]; loading: boolean }) {
  return (
    <article className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[14px] font-bold text-[var(--color-brand-fg)]">Your farms</h2>
        <Link
          href="/farms"
          className="shrink-0 text-[11.5px] font-semibold text-[var(--color-brand-primary-deep)] hover:underline"
        >
          View all
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-[var(--color-brand-bg)]" />
          ))}
        </div>
      ) : farms.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-brand-input-border)] px-3 py-6 text-center text-[12px] text-[var(--color-brand-muted)]">
          You don&rsquo;t belong to any farms yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {farms.map((f) => (
            <li key={f.id}>
              <Link
                href={`/farms/${f.id}`}
                className="flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/40 px-3 py-2.5 hover:border-[var(--color-brand-primary)]/40 hover:bg-white"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white text-[var(--color-brand-primary-deep)]">
                  {f.logoUrl ? (
                    <img src={f.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                  ) : (
                    <Tractor className="h-4 w-4" strokeWidth={2.2} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  {/* line-clamp-2 + break-words handles farms with long
                      names without the row growing taller than two lines. */}
                  <p className="line-clamp-2 break-words text-[13px] font-semibold text-[var(--color-brand-fg)]">{f.name}</p>
                  <p className="line-clamp-1 break-words text-[11px] text-[var(--color-brand-muted)]">
                    {[f.state, f.address].filter(Boolean).join(' · ') || 'No location set'}
                  </p>
                </div>
                {f.membership?.role && (
                  <span className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                    f.membership.role === 'owner'
                      ? 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]'
                      : f.membership.role === 'manager'
                        ? 'bg-sky-50 text-sky-700'
                        : 'bg-[var(--color-brand-bg)] text-[var(--color-brand-fg-soft)]',
                  )}>
                    {f.membership.role}
                  </span>
                )}
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-[var(--color-brand-muted)] sm:block" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/* ─────────────────────────── Skeletons / Errors ─────────────────────────── */

function SkeletonStack() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="h-72 animate-pulse rounded-2xl bg-white" />
      <div className="space-y-4">
        <div className="h-56 animate-pulse rounded-2xl bg-white" />
        <div className="h-40 animate-pulse rounded-2xl bg-white" />
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-10 text-center">
      <ImageIcon className="mx-auto h-6 w-6 text-[var(--color-brand-muted)]" />
      <p className="mt-3 text-[13px] font-bold text-[var(--color-brand-fg)]">
        Could not load your profile
      </p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
