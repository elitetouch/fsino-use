'use client';

import { ExternalLink, MessageCircle, Users2 } from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';

/**
 * WhatsApp community — external link to the verified group chat.
 *
 * The link is wired via NEXT_PUBLIC_WHATSAPP_GROUP_URL so ops can
 * rotate the invite without a code deploy (WhatsApp invite links
 * become spam magnets and we sometimes need to swap them). If the
 * env var is unset the page shows a coming-soon state instead of a
 * broken link.
 *
 * We never auto-add users — WhatsApp opens on their device and they
 * choose whether to join. That's both the WhatsApp ToS and the polite
 * thing to do.
 */
export default function CommunityPage() {
  const groupUrl = process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL ?? '';
  const linkReady = groupUrl.startsWith('https://chat.whatsapp.com/')
    && !groupUrl.includes('replace-with-real-invite-code');

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Community"
        title="WhatsApp community"
        description="A verified group chat for farmers using FS Innovation across Nigeria, Ghana and Cameroon."
      />

      <section className="rounded-2xl border border-[var(--color-brand-border)] bg-gradient-to-br from-[#25D366]/10 to-white p-6 sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#25D366] text-white">
            <MessageCircle className="h-6 w-6" strokeWidth={2.2} />
          </span>

          <div className="flex-1">
            <h2 className="text-[18px] font-bold tracking-tight text-[var(--color-brand-fg)]">
              Join hundreds of African poultry farmers
            </h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--color-brand-fg-soft)]">
              Ask questions, share what worked, get faster answers than any
              support channel can offer. Our team is in the chat too — you
              don&apos;t need to file a ticket for a quick answer.
            </p>
          </div>

          {linkReady ? (
            <a
              href={groupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-5 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#1DA851]"
            >
              <MessageCircle className="h-4 w-4" />
              Request to join
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>
          ) : (
            <Button size="sm" disabled className="h-11 opacity-60">
              Invite link coming soon
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--color-brand-border)] bg-white p-5">
        <div className="flex items-start gap-3">
          <Users2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-brand-primary-deep)]" />
          <div>
            <p className="text-[13px] font-bold text-[var(--color-brand-fg)]">
              House rules
            </p>
            <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-[var(--color-brand-fg-soft)]">
              <li>• Poultry-related questions, tips and market chatter only.</li>
              <li>• No political, religious or off-topic content.</li>
              <li>• No selling of birds outside the announced buy-sell days.</li>
              <li>• Be kind. Everyone here is trying to run a better farm.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
