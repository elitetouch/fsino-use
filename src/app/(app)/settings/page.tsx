import { Settings as Cog } from 'lucide-react';
import { ComingSoon } from '@/components/app/coming-soon';

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
