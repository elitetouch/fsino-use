import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/brand/logo';

/**
 * Auth-flow shell. Light background, sticky header with a back link and
 * the brand logo on the right (small, so the form gets the focus).
 * The wide container keeps content centered up to ~480px so it reads
 * like a native form on both phone and laptop.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-[var(--color-brand-bg)]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-brand-border)]/70 bg-white/85 px-5 py-3 backdrop-blur">
        <Link
          href="/"
          aria-label="Back"
          className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-brand-fg)] hover:bg-[var(--color-brand-accent)]/40"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Logo size={92} />
        <span className="h-10 w-10" aria-hidden />
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-5 py-8 sm:py-12">
        {children}
      </div>
    </main>
  );
}
