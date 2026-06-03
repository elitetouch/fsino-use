'use client';

import {
  LayoutDashboard, BarChart3, Tractor, User, Bird, Users2, Settings,
  CreditCard, ShoppingBag, Info, Phone, MessageCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/app/page-header';
import { MenuList } from '@/components/app/menu-list';
import { readUser } from '@/lib/auth';

/**
 * Menu — desktop counterpart of the mobile Menu screen. Section-listed
 * navigation, useful for users who like a one-screen "everything here"
 * overview without scanning a sidebar.
 */
export default function MenuPage() {
  const user = readUser();
  const firstName = user?.name?.split(' ')[0] ?? 'Farmer';

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
            heading: 'Farmspeak',
            items: [
              { href: '/home',    label: 'Dashboard', icon: LayoutDashboard, hint: 'Current cycle results' },
              { href: '/reports', label: 'Reports',   icon: BarChart3,      hint: 'PDFs and exports for the bank' },
            ],
          },
          {
            heading: 'Account',
            items: [
              { href: '/farms',         label: 'Farms',           icon: Tractor,    hint: 'Switch or add a farm' },
              { href: '/profile',       label: 'Profile',         icon: User },
              { href: '/pens-flocks',   label: 'Pens and flocks', icon: Bird,       hint: 'Manage pens and active flocks' },
              { href: '/users',         label: 'Users',           icon: Users2,     hint: 'Invite staff and managers' },
              { href: '/settings',      label: 'Settings',        icon: Settings,   hint: 'Preferences, language and units' },
              { href: '/subscription',  label: 'Subscription',    icon: CreditCard, hint: 'Plan and billing' },
            ],
          },
          {
            heading: 'Shop',
            items: [
              { href: '/shop',  label: 'Pen accessories', icon: ShoppingBag, hint: 'Feeders, drinkers, brooders' },
            ],
          },
          {
            heading: 'Customer support',
            items: [
              { href: '/about',     label: 'About this app',    icon: Info,           hint: 'Version, terms and privacy' },
              { href: '/contact',   label: 'Call us',           icon: Phone,          hint: 'Speak to a real human' },
              { href: '/community', label: 'WhatsApp community', icon: MessageCircle, hint: 'Join other farmers',         external: true },
            ],
          },
        ]}
      />
    </div>
  );
}
