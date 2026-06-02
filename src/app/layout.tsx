import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Providers } from './providers';
import { SwRegistration } from '@/components/offline/sw-registration';
import { OfflineBanner } from '@/components/offline/offline-banner';
import { IosInstallPrompt } from '@/components/offline/ios-install-prompt';
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
    'Manage your poultry farm with ease. Track flocks, vaccinations, feed and finances — works online and offline, built for African poultry farmers.',
  applicationName: appName,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'FarmSpeak',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
      { url: '/logo.svg', type: 'image/svg+xml' },
    ],
    apple: '/logo.png',
    shortcut: '/logo.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#15a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <head>
        {/* iOS-specific PWA hints (Next.js metadata covers most of this,
            but a couple of older bits live outside the metadata API). */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FarmSpeak" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Safari + iOS pinned-tab colour. */}
        <link rel="mask-icon" href="/logo.svg" color="#15a34a" />
      </head>
      <body className="min-h-screen antialiased">
        <SwRegistration />
        <OfflineBanner />
        <Providers>{children}</Providers>
        <IosInstallPrompt />
      </body>
    </html>
  );
}
