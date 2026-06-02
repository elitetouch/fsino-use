import Link from 'next/link';
import { cn } from '@/lib/utils';

const PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? 'https://play.google.com/store';

/**
 * "Get it on Google Play" button — built fresh in SVG/CSS rather than
 * the official artwork PNG so it scales crisp on retina/4K and inherits
 * our brand pill geometry. The Play logo is the standard four-color
 * trapezoid recreated as SVG.
 */
export function PlayStoreButton({
  className,
  tone = 'dark',
}: {
  className?: string;
  tone?: 'dark' | 'light';
}) {
  const isDark = tone === 'dark';
  return (
    <Link
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Get it on Google Play"
      className={cn(
        'group inline-flex h-14 items-center gap-3 rounded-full px-5 transition-all duration-200 active:scale-[0.98] sm:h-[60px] sm:px-6',
        isDark
          ? 'bg-[var(--color-brand-fg)] text-white hover:bg-black'
          : 'border-2 border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/15',
        className,
      )}
    >
      <PlayBadge />
      <span className="flex flex-col items-start leading-tight">
        <span className={cn('text-[10px] font-medium uppercase tracking-wider', isDark ? 'text-white/70' : 'text-white/70')}>
          Get it on
        </span>
        <span className="text-[16px] font-semibold tracking-tight">Google Play</span>
      </span>
    </Link>
  );
}

function PlayBadge() {
  return (
    <svg
      width="22"
      height="24"
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
