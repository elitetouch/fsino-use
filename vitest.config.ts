import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Vitest runs the pure logic under src/lib — the quick-record parser
 * above all, which turns a dictated sentence into numbers that move a
 * farmer's flock count and therefore must not ship unverified.
 *
 * Deliberately NOT wired into `next build`. The build stays exactly as
 * it was, so adding tests cannot change what gets deployed.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(here, 'src') },
  },
});
