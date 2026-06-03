import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlayStoreButton } from './play-store-button';

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-white">
      <div
        className="mx-auto px-6 pb-24 pt-10 sm:px-8 md:pb-32 lg:px-12"
        style={{ maxWidth: 'var(--container-page)' }}
      >
        <div
          className="reveal relative overflow-hidden rounded-[28px] px-8 py-16 text-center text-white sm:px-12 md:py-20 lg:rounded-[36px] lg:px-16 lg:py-24"
          style={{
            background:
              'linear-gradient(160deg, #15a34a 0%, #0f7c39 55%, #0a4d24 100%)',
          }}
        >
          {/* Decoration */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: `
                radial-gradient(50% 35% at 18% 12%, rgba(167, 243, 194, 0.22) 0%, transparent 60%),
                radial-gradient(45% 30% at 85% 88%, rgba(255, 255, 255, 0.10) 0%, transparent 65%)
              `,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div
            aria-hidden
            className="animate-blob pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
          />

          <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
            Ready when you are
          </p>
          <h2
            className="relative mx-auto mt-4 max-w-3xl font-extrabold leading-[1.04] tracking-tight"
            style={{ fontSize: 'var(--text-hero)' }}
          >
            Run a tighter farm starting today.
          </h2>
          <p
            className="relative mx-auto mt-5 max-w-xl leading-relaxed text-white/85"
            style={{ fontSize: 'var(--text-lead)' }}
          >
            Free to start. 5-minute setup. Cancel any time — your data is
            always yours.
          </p>

          <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild variant="secondary" size="lg" className="group h-14 px-7 text-[16px] sm:h-[60px]">
              <Link href="/register">
                Open the web app
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <PlayStoreButton tone="light" />
          </div>

          <p className="relative mt-6 text-sm text-white/75">
            Already on Farm Support Innovation?{' '}
            <Link href="/login" className="font-semibold text-white underline-offset-4 hover:underline">
              Log in →
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
