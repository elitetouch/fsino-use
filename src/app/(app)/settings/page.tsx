'use client';

import { Settings as Cog } from 'lucide-react';
import { ComingSoon } from '@/components/app/coming-soon';

// `'use client'` is required here because we pass a Lucide icon (a
// component reference / function) as a prop to ComingSoon, which is a
// client component. Server → client component props must be
// serialisable, and functions are not — so the page itself has to live
// on the client.
export default function Page() {
  return (
    <ComingSoon
      icon={Cog}
      eyebrow="Settings"
      title="Settings"
      body="App preferences, language, units (kg / lb), date format and notifications — all coming in v1.2."
    />
  );
}
