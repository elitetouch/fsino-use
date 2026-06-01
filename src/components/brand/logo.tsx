'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { brand } from '@/config/brand';

type Tone = 'color' | 'white';

interface Props {
  className?: string;
  size?: number;
  tone?: Tone;
}

/**
 * Official Farm Support Innovation logo. Source priority: /logo.png (raster
 * master) with onError fallback to /logo.svg. The wordmark is baked into
 * the source artwork — no extra text is layered on. Render at >= 100px wide
 * in dense layouts so the wordmark stays readable.
 *
 * `tone="white"` recolours opaque pixels to white via filter chain — same
 * geometry, pure white tone, for use on dark/photographic backgrounds.
 */
export function Logo({ className, size = 120, tone = 'color' }: Props) {
  const [src, setSrc] = useState<string>('/logo.png');

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={brand.name}
      width={size}
      style={{
        height: 'auto',
        ...(tone === 'white'
          ? {
              filter:
                'brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0,0,0,0.18))',
            }
          : null),
      }}
      className={cn('block select-none', className)}
      onError={() => {
        if (src !== '/logo.svg') setSrc('/logo.svg');
      }}
      draggable={false}
    />
  );
}
