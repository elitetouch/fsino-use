'use client';

import { useEffect } from 'react';

/**
 * One-shot IntersectionObserver that toggles `.is-visible` on every
 * element with the `.reveal` class as it scrolls into view. The CSS
 * in globals.css does the actual animation; this hook just flips the
 * class so the transition fires.
 *
 * Mount this once near the top of any page that uses .reveal blocks.
 */
export function RevealOnScroll() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );

    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
