'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MarketingNav } from '@/components/marketing/nav';
import { MarketingHero } from '@/components/marketing/hero';
import { StatsBar } from '@/components/marketing/stats';
import { Platforms } from '@/components/marketing/platforms';
import { Features } from '@/components/marketing/features';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { Audience } from '@/components/marketing/audience';
import { FinalCTA } from '@/components/marketing/final-cta';
import { MarketingFooter } from '@/components/marketing/footer';
import { RevealOnScroll } from '@/components/util/reveal-on-scroll';
import { readToken } from '@/lib/auth';

/**
 * Marketing landing page.
 *
 * A real web app marketing page — not a mobile mockup translation.
 * Structure: nav → hero → stats → features → how-it-works → audience
 * → final CTA → footer.
 *
 * Authed users get fast-forwarded into the app. Everyone else gets a
 * scroll-revealed reading experience with the brand green used as an
 * accent on a calm, light background.
 */
export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    if (readToken()) router.replace('/home');
  }, [router]);

  return (
    <>
      <RevealOnScroll />
      <MarketingNav />
      <main>
        <MarketingHero />
        <StatsBar />
        <Platforms />
        <Features />
        <HowItWorks />
        <Audience />
        <FinalCTA />
      </main>
      <MarketingFooter />
    </>
  );
}
