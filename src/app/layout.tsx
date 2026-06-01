import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-jakarta',
});

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Farm Support Innovation';

export const metadata: Metadata = {
  title: { default: appName, template: `%s · ${appName}` },
  description:
    'Manage your poultry farm with ease. Track flocks, vaccinations, feed and finances — built for African poultry farmers.',
  applicationName: appName,
};

export const viewport: Viewport = {
  themeColor: '#15a34a',
  width: 'device-width',
  initialScale: 1,
  // Cap zoom so the app stays usable, but don't lock it (a11y).
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
