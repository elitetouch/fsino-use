'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowRight, ExternalLink, Loader2, MessageCircle, Phone, Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-header';
import {
  apiErrorMessage, endpoints,
  type SupportThreadDto, type SupportThreadStatus,
} from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Contact us — three ways to reach FS Innovation, in the order most
 * users prefer them:
 *
 *   1. Call — for account-blocking issues where the farmer needs a
 *      human right now. Number lives in NEXT_PUBLIC_SUPPORT_PHONE so
 *      it can be rotated without a deploy.
 *   2. WhatsApp DM + community — for quick questions with peer + team.
 *   3. Message support — for anything non-urgent that benefits from a
 *      written record (billing corrections, feature requests, bug
 *      reports). Backed by the same support-thread system the admin
 *      portal reads, so replies land in the same inbox.
 *
 * Env-driven contact channels degrade gracefully — an unset phone or
 * WhatsApp link shows a disabled state rather than a broken link.
 */
export default function ContactPage() {
  const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '';
  const supportHours = process.env.NEXT_PUBLIC_SUPPORT_HOURS ?? 'Weekdays 8am to 6pm WAT';
  const whatsappGroup = process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL ?? '';

  const phoneReady = /^\+?\d{6,20}$/.test(supportPhone.replace(/\s/g, ''));
  const whatsappReady = whatsappGroup.startsWith('https://chat.whatsapp.com/')
    && !whatsappGroup.includes('replace-with-real-invite-code');
  const whatsappDm = phoneReady
    ? `https://wa.me/${supportPhone.replace(/[^\d]/g, '')}`
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Contact"
        title="How can we help?"
        description="Reach us the way that fits the moment — phone, WhatsApp, or a written message the team picks up in order."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <ChannelCard
          icon={Phone}
          title="Call us"
          hint={supportHours}
          cta={phoneReady ? `Call ${supportPhone}` : 'Phone line coming soon'}
          href={phoneReady ? `tel:${supportPhone}` : undefined}
          tone="brand"
        />
        <ChannelCard
          icon={MessageCircle}
          title="WhatsApp us directly"
          hint="1-on-1 chat with the support team. Fastest for anything you can describe in a couple of lines."
          cta={whatsappDm ? 'Open WhatsApp' : 'Phone number coming soon'}
          href={whatsappDm ?? undefined}
          external
          tone="whatsapp"
        />
      </div>

      {whatsappReady && (
        <a
          href={whatsappGroup}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between rounded-2xl border border-[#25D366]/30 bg-[#25D366]/5 p-4 transition-colors hover:bg-[#25D366]/10"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366] text-white">
              <MessageCircle className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-[13.5px] font-bold text-[var(--color-brand-fg)]">
                Or join the WhatsApp community
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--color-brand-fg-soft)]">
                Talk to other farmers using FS Innovation across the region.
              </p>
            </div>
          </div>
          <span className="text-[#25D366] transition-transform group-hover:translate-x-1">
            <ArrowRight className="h-5 w-5" />
          </span>
        </a>
      )}

      <SupportInbox />
    </div>
  );
}

function ChannelCard({
  icon: Icon,
  title,
  hint,
  cta,
  href,
  external,
  tone,
}: {
  icon: React.ElementType;
  title: string;
  hint: string;
  cta: string;
  href?: string;
  external?: boolean;
  tone: 'brand' | 'whatsapp';
}) {
  const disabled = !href;
  const iconClasses = tone === 'whatsapp'
    ? 'bg-[#25D366] text-white'
    : 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]';
  const ctaClasses = tone === 'whatsapp'
    ? 'bg-[#25D366] text-white hover:bg-[#1DA851]'
    : 'bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-deep)]';

  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-white p-5">
      <div className="flex items-start gap-3">
        <span className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconClasses)}>
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="flex-1">
          <h3 className="text-[15px] font-bold tracking-tight text-[var(--color-brand-fg)]">
            {title}
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-brand-fg-soft)]">
            {hint}
          </p>
        </div>
      </div>

      <div className="mt-4">
        {disabled ? (
          <span className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--color-brand-surface-soft)] px-4 text-[13px] text-[var(--color-brand-muted)]">
            {cta}
          </span>
        ) : (
          <a
            href={href}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className={cn(
              'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-bold transition-colors',
              ctaClasses,
            )}
          >
            {cta}
            {external && <ExternalLink className="h-3.5 w-3.5 opacity-80" />}
          </a>
        )}
      </div>
    </div>
  );
}

function SupportInbox() {
  const qc = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const threads = useQuery({
    queryKey: ['support-threads'],
    queryFn: () => endpoints.listSupportThreads({ per_page: 25 }),
  });

  const canSubmit = subject.trim().length >= 3
    && body.trim().length >= 10
    && subject.length <= 200
    && body.length <= 5000;

  const create = useMutation({
    mutationFn: () => endpoints.createSupportThread({
      subject: subject.trim(),
      body: body.trim(),
    }),
    onSuccess: () => {
      toast.success('Message sent. We\'ll reply here as soon as we\'ve looked at it.');
      qc.invalidateQueries({ queryKey: ['support-threads'] });
      setComposerOpen(false);
      setSubject('');
      setBody('');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not send your message.')),
  });

  const rows = threads.data?.threads ?? [];

  return (
    <section className="rounded-2xl border border-[var(--color-brand-border)] bg-white">
      <header className="flex items-center justify-between border-b border-[var(--color-brand-border)] px-4 py-3 sm:px-5">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--color-brand-primary-deep)]">
            Message support
          </p>
          <h2 className="mt-0.5 text-[15px] font-bold tracking-tight text-[var(--color-brand-fg)]">
            Your conversations with our team
          </h2>
        </div>
        {!composerOpen && (
          <Button size="sm" onClick={() => setComposerOpen(true)}>
            <Send className="h-3.5 w-3.5" />
            New message
          </Button>
        )}
      </header>

      {composerOpen && (
        <div className="border-b border-[var(--color-brand-border)] bg-[var(--color-brand-surface-soft)]/40 p-4 sm:p-5">
          <div className="space-y-3">
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, 200))}
                placeholder="e.g. Wrong flock count after voiding a mortality record"
                className="mt-1 h-10 w-full rounded-md border border-[var(--color-brand-input-border)] bg-white px-2.5 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--color-brand-muted)]">
                Describe the issue
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 5000))}
                rows={5}
                placeholder="Give as much detail as you can — which flock, which page, what you expected, what happened. Screenshots welcome via WhatsApp."
                className="mt-1 w-full rounded-md border border-[var(--color-brand-input-border)] bg-white px-3 py-2 text-[13px]"
              />
              <p className="mt-1 text-[11px] text-[var(--color-brand-muted)]">
                {body.length}/5000 · we usually reply within a working day.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => create.mutate()} disabled={!canSubmit || create.isPending}>
                {create.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Send className="h-3.5 w-3.5" />}
                Send message
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setComposerOpen(false); setSubject(''); setBody(''); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {threads.isLoading ? (
        <div className="flex items-center justify-center p-8 text-[13px] text-[var(--color-brand-muted)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your messages…
        </div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-[13px] text-[var(--color-brand-fg-soft)]">
            You haven&apos;t opened any support threads yet.
          </p>
          <p className="mt-1 text-[12px] text-[var(--color-brand-muted)]">
            Anything you send here reaches our support inbox — enquiries, complaints, feature ideas, bugs.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-brand-border)]">
          {rows.map((t) => (
            <ThreadRow key={t.id} thread={t} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ThreadRow({ thread }: { thread: SupportThreadDto }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:px-5">
      <StatusPill status={thread.status} />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold text-[var(--color-brand-fg)]">
          {thread.subject}
        </p>
        <p className="mt-0.5 text-[11.5px] text-[var(--color-brand-muted)]">
          {thread.messagesCount ?? 0} message{(thread.messagesCount ?? 0) === 1 ? '' : 's'}
          {thread.lastMessageAt ? ` · last activity ${new Date(thread.lastMessageAt).toLocaleDateString()}` : ''}
        </p>
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: SupportThreadStatus }) {
  const map: Record<SupportThreadStatus, { label: string; cls: string }> = {
    open: { label: 'Open', cls: 'bg-amber-50 text-amber-800' },
    pending: { label: 'Awaiting you', cls: 'bg-[var(--color-brand-accent)] text-[var(--color-brand-primary-deep)]' },
    resolved: { label: 'Resolved', cls: 'bg-emerald-50 text-emerald-800' },
    closed: { label: 'Closed', cls: 'bg-[var(--color-brand-surface-soft)] text-[var(--color-brand-muted)]' },
  };
  const conf = map[status] ?? map.open;
  return (
    <span className={cn(
      'inline-block shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em]',
      conf.cls,
    )}>
      {conf.label}
    </span>
  );
}
