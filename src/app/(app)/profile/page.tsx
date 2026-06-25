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
    <div className="space-y-6">
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <IdentityBlock user={user} farms={farmsQuery.data?.farms ?? []} />
          <div className="space-y-4">
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
    onSuccess: () => {
      toast.success('Photo updated.');
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not upload your photo.')),
  });

  const remove = useMutation({
    mutationFn: () => endpoints.removeProfilePhoto(),
    onSuccess: () => {
      toast.success('Photo removed.');
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

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-white p-6">
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <Avatar src={user.photoUrl ?? null} name={user.name} size={104} />
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

        <p className="mt-4 text-[18px] font-bold tracking-tight text-[var(--color-brand-fg)]">
          {user.name}
        </p>
        {topRole && (
          <span className={cn(
            'mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
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

        {user.photoUrl && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4 h-8 text-[11.5px] text-[var(--color-brand-muted)]"
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

function Avatar({ src, name, size }: { src: string | null; name: string; size: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-full border-2 border-[var(--color-brand-border)] object-cover"
        style={{ width: size, height: size }}
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
      className="flex items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-deep)] text-white shadow-[0_8px_24px_-12px_rgba(15,80,30,0.30)]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
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
      <article className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5">
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
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button type="submit" size="sm" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save changes
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
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
          </div>
        </form>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[var(--color-brand-fg)]">Personal details</h2>
        <Button variant="outline" size="sm" className="h-8 text-[11.5px]" onClick={() => setEditing(true)}>
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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/40 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--color-brand-primary-deep)]">
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--color-brand-muted)]">{label}</p>
          <p className="truncate text-[13px] font-semibold text-[var(--color-brand-fg)]">{value}</p>
        </div>
      </div>
      {badge && (
        <span className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider',
          badge.tone === 'green'
            ? 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]'
            : 'bg-amber-100 text-amber-800',
        )}>
          {badge.tone === 'green' ? <ShieldCheck className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
          {badge.label}
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────── Farms ─────────────────────────── */

function FarmsBlock({ farms, loading }: { farms: FarmDto[]; loading: boolean }) {
  return (
    <article className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-[var(--color-brand-fg)]">Your farms</h2>
        <Link
          href="/farms"
          className="text-[11.5px] font-semibold text-[var(--color-brand-primary-deep)] hover:underline"
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
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/40 px-3 py-2.5 hover:border-[var(--color-brand-primary)]/40 hover:bg-white"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--color-brand-primary-deep)]">
                    {f.logoUrl ? (
                      <img src={f.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                    ) : (
                      <Tractor className="h-4 w-4" strokeWidth={2.2} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--color-brand-fg)]">{f.name}</p>
                    <p className="truncate text-[11px] text-[var(--color-brand-muted)]">
                      {[f.state, f.address].filter(Boolean).join(' · ') || 'No location set'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {f.membership?.role && (
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      f.membership.role === 'owner'
                        ? 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]'
                        : f.membership.role === 'manager'
                          ? 'bg-sky-50 text-sky-700'
                          : 'bg-[var(--color-brand-bg)] text-[var(--color-brand-fg-soft)]',
                    )}>
                      {f.membership.role}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-[var(--color-brand-muted)]" />
                </div>
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
