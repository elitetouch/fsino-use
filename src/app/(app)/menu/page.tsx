'use client';

import {
  LayoutDashboard, BarChart3, Tractor, User, Bird, Users2, Settings,
  CreditCard, Info, Phone, MessageCircle, Receipt, Snowflake, Package, FileText,
} from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { MenuList } from '@/components/app/menu-list';
import { readUser } from '@/lib/auth';
import { useVertical } from '@/lib/vertical';

/**
 * Menu — desktop counterpart of the mobile Menu screen. Section-listed
 * navigation, useful for users who like a one-screen "everything here"
 * overview without scanning a sidebar.
 */
export default function MenuPage() {
  const user = readUser();
  const firstName = user?.name?.split(' ')[0] ?? 'Farmer';

  // A poultry farmer — which is nearly every user — sees exactly the
  // menu they have always seen. The cold-chain entries appear only on
  // a farm that is one, and the flock entries step aside there,
  // because a cold room has no cycle to manage.
  const { vertical, unitPlural } = useVertical();
  const isColdChain = vertical === 'cold_chain';

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Menu"
        title="Menu"
        description={`Welcome ${user?.name ?? firstName} — everything you need is here.`}
      />

      <MenuList
        groups={[
          {
            heading: 'Farm Support Innovation',
            items: [
              ...(isColdChain
                ? [
                    { href: '/cold-rooms', label: unitPlural, icon: Snowflake, hint: 'Live temperature and alerts' },
                    { href: '/cold-chain/batches', label: 'Stock in store', icon: Package, hint: 'What is in each room' },
                    { href: '/cold-chain/report', label: 'Breach report', icon: FileText, hint: 'Excursions, for an insurer or auditor' },
                  ]
                : [
                    { href: '/home',    label: 'Dashboard', icon: LayoutDashboard, hint: 'Current cycle results' },
                    { href: '/reports', label: 'Reports',   icon: BarChart3,      hint: 'PDFs and exports for the bank' },
                  ]),
            ],
          },
          {
            heading: 'Account',
            items: [
              { href: '/farms',         label: 'Farms',           icon: Tractor,    hint: 'Switch or add a farm' },
              { href: '/profile',       label: 'Profile',         icon: User },
              ...(isColdChain
                ? []
                : [{ href: '/pens-flocks', label: 'Pens and flocks', icon: Bird, hint: 'Manage pens and active flocks' }]),
              { href: '/users',         label: 'Users',           icon: Users2,     hint: 'Invite staff and managers' },
              { href: '/settings',      label: 'Settings',        icon: Settings,   hint: 'Preferences, language and units' },
              { href: '/expenses',      label: 'Expenses',        icon: Receipt,    hint: 'Log feed, drugs, fuel and other costs' },
              { href: '/subscription',  label: 'Subscription',    icon: CreditCard, hint: 'Plan and billing' },
            ],
          },
          // Shop / Pen accessories — hidden until the storefront can
          // fulfil orders. Route + page kept live for direct links.
          {
            heading: 'Customer support',
            items: [
              { href: '/about',     label: 'About this app',    icon: Info,           hint: 'What we\'re building and why' },
              { href: '/contact',   label: 'Contact us',        icon: Phone,          hint: 'Call, WhatsApp or message support' },
              { href: '/community', label: 'WhatsApp community', icon: MessageCircle, hint: 'Join other African farmers',    external: true },
            ],
          },
        ]}
      />
    </div>
  );
}
