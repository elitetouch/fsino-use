import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PLAY_STORE_URL } from '@/lib/links';

/**
 * "Get it on Google Play" button — built fresh in SVG/CSS rather than
 * the official artwork PNG so it scales crisp on retina/4K and inherits
 * our brand pill geometry. The Play logo is the standard four-color
 * trapezoid recreated as SVG. (Google's brand guidelines do ask for the
 * supplied artwork; worth swapping if the listing is ever reviewed for
 * badge compliance.)
 *
 * Sizes: `md` for hero and end-of-page CTAs, `sm` for the footer, where
 * it sits among body text and must not shout.
 *
 * Mirrored by `src/components/play-store-badge.tsx` in fsino-landing.
 */
export function PlayStoreButton({
  className,
  tone = 'dark',
  size = 'md',
}: {
  className?: string;
  tone?: 'dark' | 'light';
  size?: 'sm' | 'md';
}) {
  const isDark = tone === 'dark';
  const sm = size === 'sm';

  return (
    <Link
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Get FSI Farm Manager on Google Play"
      className={cn(
        'group inline-flex items-center rounded-full transition-all duration-200 active:scale-[0.98]',
        sm ? 'h-11 gap-2.5 px-4' : 'h-14 gap-3 px-5 sm:h-[60px] sm:px-6',
        isDark
          ? 'bg-[var(--color-brand-fg)] text-white hover:bg-black'
          : 'border-2 border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/15',
        className,
      )}
    >
      <PlayBadge size={sm ? 18 : 22} />
      <span className="flex flex-col items-start leading-tight">
        <span
          className={cn(
            'font-medium uppercase tracking-wider text-white/70',
            sm ? 'text-[9px]' : 'text-[0.625rem]',
          )}
        >
          Get it on
        </span>
        <span className={cn('font-semibold tracking-tight', sm ? 'text-[13px]' : 'text-[1rem]')}>
          Google Play
        </span>
      </span>
    </Link>
  );
}

function PlayBadge({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={(size / 22) * 24}
      viewBox="0 0 22 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="transition-transform group-hover:scale-105"
    >
      {/* Trapezoidal triangles in the official Play color palette */}
      <path d="M0.5 1.2 L0.5 22.8 L11.3 12 Z" fill="#34A853" />
      <path d="M0.5 1.2 L15.5 9.6 L11.3 12 Z" fill="#FBBC04" />
      <path d="M0.5 22.8 L15.5 14.4 L11.3 12 Z" fill="#EA4335" />
      <path d="M15.5 9.6 L20.5 12 L15.5 14.4 L11.3 12 Z" fill="#4285F4" />
    </svg>
  );
}
