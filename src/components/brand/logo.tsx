'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { brand } from '@/config/brand';

type Tone = 'color' | 'white';

interface Props {
  className?: string;
  /** Width in px. Height auto-scales to preserve aspect ratio. */
  size?: number;
  /** Optional fixed height instead of width — useful when you need pixel-perfect
   *  vertical alignment in a topbar of a known height. */
  height?: number;
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
export function Logo({ className, size = 120, height, tone = 'color' }: Props) {
  const [src, setSrc] = useState<string>('/logo.png');

  // When `height` is provided we lock vertical size and let width auto-scale —
  // this is what topbars need for pixel-perfect alignment. When only `size`
  // is provided we lock the width and the height adjusts (the older API).
  const inlineStyle: React.CSSProperties =
    height !== undefined
      ? { height: `${height}px`, width: 'auto' }
      : { height: 'auto' };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={brand.name}
      {...(height !== undefined ? {} : { width: size })}
      style={{
        ...inlineStyle,
        ...(tone === 'white'
          ? {
              filter:
                'brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0,0,0,0.18))',
            }
          : null),
      }}
      className={cn('block select-none object-contain', className)}
      onError={() => {
        if (src !== '/logo.svg') setSrc('/logo.svg');
      }}
      draggable={false}
    />
  );
}
