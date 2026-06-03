'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, Mail, Loader2, X, Trash2, ShieldCheck, Clock, Users2, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { PageHeader } from '@/components/app/page-header';
import { PermissionsPicker } from '@/components/app/permissions-picker';
import {
  apiErrorMessage, endpoints,
  type FarmMemberDto, type StaffInviteDto,
} from '@/lib/api';
import { readCurrentFarmId } from '@/lib/farm-context';
import { fmtDate } from '@/lib/format';
import { STAFF_DEFAULT_PRESET, type FarmRole } from '@/lib/permissions';
import { cn } from '@/lib/utils';

/**
 * Team page — manage farm members and outstanding invites.
 *
 * Lists active + invited members, plus a separate table for pending
 * staff-invite rows that haven't been accepted yet. The Invite dialog
 * uses a proper checkbox picker (no JSON) so the owner knows exactly
 * what they're granting.
 *
 * Team membership is farm-scoped: this page only ever shows members
 * for the currently-selected farm context. Switching farm (via the
 * Farms page) flips the query key and the list refetches.
 */
export default function UsersPage() {
  const farmId = readCurrentFarmId();
  const [openInvite, setOpenInvite] = useState(false);

  const members = useQuery({
    queryKey: ['farm-members', farmId],
    queryFn: () => endpoints.listFarmMembers(farmId as string),
    enabled: !!farmId,
  });

  const invites = useQuery({
    queryKey: ['farm-invites', farmId],
    queryFn: () => endpoints.listInvites(),
    enabled: !!farmId,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Team"
        title="Farm members"
        description="Owners, managers and staff who can access this farm. Permissions are farm-scoped — adding someone here only grants access to this one farm."
        actions={
          <Button size="sm" className="h-10" onClick={() => setOpenInvite(true)}>
            <Plus className="h-3.5 w-3.5" />
            Invite member
          </Button>
        }
      />

      <section>
        <h2 className="mb-2 text-[12px] font-semibold tracking-tight text-[var(--color-brand-primary-deep)]">
          Active members
        </h2>
        {members.isLoading ? (
          <SkeletonRows />
        ) : (members.data?.members ?? []).length === 0 ? (
          <EmptyState title="No team members yet" body="Invite your first staff member to get started." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white">
            {members.data!.members.map((m, i, arr) => (
              <MemberRow key={String(m.userId)} member={m} divider={i < arr.length - 1} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-[12px] font-semibold tracking-tight text-[var(--color-brand-primary-deep)]">
          Pending invites
        </h2>
        {invites.isLoading ? (
          <SkeletonRows count={2} />
        ) : (invites.data?.invites ?? []).filter((i) => i.status === 'invited').length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-6 text-center">
            <p className="text-[12.5px] text-[var(--color-brand-muted)]">
              No pending invites. New invitations show up here until they&rsquo;re accepted.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white">
            {invites.data!.invites
              .filter((i) => i.status === 'invited')
              .map((inv, i, arr) => (
                <InviteRow key={inv.id} invite={inv} divider={i < arr.length - 1} />
              ))}
          </div>
        )}
      </section>

      <InviteDialog open={openInvite} onClose={() => setOpenInvite(false)} />
    </div>
  );
}

function MemberRow({ member, divider }: { member: FarmMemberDto; divider: boolean }) {
  const initial = (member.name ?? 'F').trim().charAt(0).toUpperCase();
  const statusTone =
    member.status === 'active' ? 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]'
    : member.status === 'invited' ? 'bg-amber-50 text-amber-700'
    : 'bg-rose-50 text-rose-700';

  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', divider && 'border-b border-[var(--color-brand-border)]')}>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-primary-deep)] text-[12px] font-bold text-white">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-[var(--color-brand-fg)]">{member.name}</p>
        <p className="truncate text-[11.5px] text-[var(--color-brand-muted)]">{member.email}</p>
      </div>
      <div className="hidden text-right sm:block">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-muted-soft)]">
          {member.role}
        </p>
        <p className="text-[11px] text-[var(--color-brand-muted)]">
          {member.joinedAt ? `Joined ${fmtDate(member.joinedAt)}` : 'Pending'}
        </p>
      </div>
      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', statusTone)}>
        {member.status}
      </span>
    </div>
  );
}

function InviteRow({ invite, divider }: { invite: StaffInviteDto; divider: boolean }) {
  const qc = useQueryClient();
  const farmId = readCurrentFarmId();
  const revoke = useMutation({
    mutationFn: () => endpoints.revokeInvite(invite.id),
    onSuccess: () => {
      toast.success('Invite revoked.');
      qc.invalidateQueries({ queryKey: ['farm-invites', farmId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not revoke invite.')),
  });

  const expiringSoon = invite.expiresAt && new Date(invite.expiresAt).getTime() - Date.now() < 24 * 3600_000;

  return (
    <div className={cn('flex items-center gap-3 px-4 py-3', divider && 'border-b border-[var(--color-brand-border)]')}>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-muted)]">
        <Mail className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[var(--color-brand-fg)]">{invite.email}</p>
        <p className="truncate text-[11.5px] text-[var(--color-brand-muted)]">
          <span className="uppercase tracking-wider">{invite.role}</span>
          {' · '}
          {invite.expiresAt ? (
            <span className={cn(expiringSoon && 'text-amber-700')}>
              {expiringSoon && <AlertTriangle className="mr-0.5 inline h-3 w-3" />}
              Expires {fmtDate(invite.expiresAt)}
            </span>
          ) : 'No expiry'}
        </p>
      </div>
      <span className="hidden rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 sm:inline-flex sm:items-center sm:gap-1">
        <Clock className="h-2.5 w-2.5" />
        Pending
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-9"
        disabled={revoke.isPending}
        onClick={() => revoke.mutate()}
      >
        {revoke.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">Revoke</span>
      </Button>
    </div>
  );
}

function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-white">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn('h-14 animate-pulse bg-[var(--color-brand-surface-soft)]', i < count - 1 && 'border-b border-[var(--color-brand-border)]')} />
      ))}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-brand-input-border)] bg-white p-8 text-center">
      <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
        <Users2 className="h-4 w-4" />
      </span>
      <p className="mt-3 text-[13px] font-bold text-[var(--color-brand-fg)]">{title}</p>
      <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">{body}</p>
    </div>
  );
}

function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const farmId = readCurrentFarmId();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FarmRole>('staff');
  const [permissions, setPermissions] = useState<Record<string, true>>({ ...STAFF_DEFAULT_PRESET });
  const [error, setError] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: () => endpoints.createInvite({
      email: email.trim().toLowerCase(),
      role,
      // Owner/manager bypass permissions server-side — only meaningful
      // for the staff role.
      permissions: role === 'staff' ? permissions : undefined,
      expiresInHours: 168, // 7 days — a humane default
    }),
    onSuccess: () => {
      toast.success(`Invite sent to ${email}.`);
      qc.invalidateQueries({ queryKey: ['farm-invites', farmId] });
      setEmail('');
      setRole('staff');
      setPermissions({ ...STAFF_DEFAULT_PRESET });
      setError(null);
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not send invite.')),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div aria-hidden className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="animate-fade-up relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_30px_80px_-30px_rgba(15,80,30,0.30)] sm:max-w-[640px] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-brand-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[14px] font-bold text-[var(--color-brand-fg)]">Invite a member</p>
              <p className="text-[11px] text-[var(--color-brand-muted)]">They&rsquo;ll get an email with a 7-day join link.</p>
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

        <form
          onSubmit={(e) => { e.preventDefault(); setError(null); invite.mutate(); }}
          className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
        >
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
              required
            />
          </div>

          <div>
            <Label>Role</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(['owner', 'manager', 'staff'] as const).map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  className={cn(
                    'rounded-xl border-2 p-3 text-left transition-all',
                    role === r
                      ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-accent)]/40'
                      : 'border-[var(--color-brand-input-border)] bg-white hover:border-[var(--color-brand-primary)]/40',
                  )}
                >
                  <p className="text-[13px] font-bold capitalize text-[var(--color-brand-fg)]">{r}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--color-brand-muted)]">
                    {r === 'owner'
                      ? 'Full access incl. billing + members.'
                      : r === 'manager'
                        ? 'Full access except owner-only actions.'
                        : 'Custom permissions — pick below.'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {role === 'staff' && (
            <div>
              <Label>Permissions</Label>
              <PermissionsPicker value={permissions} onChange={setPermissions} />
            </div>
          )}

          {role !== 'staff' && (
            <div className="rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)] p-3.5 text-[12px] text-[var(--color-brand-muted)]">
              {role === 'owner'
                ? 'Owners can do everything on the farm, including billing, removing members, and managing other owners. Grant carefully.'
                : 'Managers can do everything except transferring ownership and certain billing limits. They cannot grant the owner role.'}
            </div>
          )}

          <FieldError message={error ?? undefined} />
        </form>

        <div className="border-t border-[var(--color-brand-border)] bg-white px-5 py-4">
          <Button
            type="button"
            size="block"
            disabled={!email.trim() || invite.isPending}
            onClick={() => { setError(null); invite.mutate(); }}
          >
            {invite.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Mail className="h-4 w-4" />
            Send invite
          </Button>
        </div>
      </div>
    </div>
  );
}
