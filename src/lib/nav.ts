import {
  BarChart3, Bird, CreditCard, Info, LayoutDashboard, MessageCircle, Phone,
  Receipt, Settings, Stethoscope, Tractor, TrendingUp, User, Users2, Wallet,
} from 'lucide-react';

/**
 * The single navigation definition.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * This list used to be duplicated, verbatim, in sidebar.tsx and
 * mobile-drawer.tsx. The copies drifted the first time anything was
 * added: "Disease check" went into the desktop sidebar and not the
 * mobile drawer, so the entire feature was invisible to phone users —
 * who are most of the user base, on a farm, holding the camera.
 *
 * Two lists that must stay identical will not stay identical. One list,
 * two renderers.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  /**
   * Marks a feature that is live but unfinished, rendered as a small
   * pill beside the label.
   *
   * Not decoration: disease check has been observed both refusing
   * genuine droppings and, before its guards were fixed, confidently
   * diagnosing a photograph of groceries. Farmers need to know the
   * answer is provisional BEFORE they act on it.
   */
  beta?: boolean;
};

export type NavGroup = {
  heading?: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    // No heading on the first group — the brand block above it already
    // identifies the workspace, and a label there crowds the logo.
    items: [
      { href: '/home', label: 'Dashboard', icon: LayoutDashboard },
      // Sits in the first group deliberately. Someone opening this has
      // already seen something wrong with their birds; burying a health
      // check under "Account" costs minutes that matter.
      { href: '/diagnose', label: 'Disease check', icon: Stethoscope, beta: true },
      { href: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    heading: 'Account',
    items: [
      { href: '/farms', label: 'Farms', icon: Tractor },
      { href: '/profile', label: 'Profile', icon: User },
      { href: '/pens-flocks', label: 'Pens and flocks', icon: Bird },
      { href: '/users', label: 'Users', icon: Users2 },
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/wallet', label: 'Wallet', icon: Wallet },
      { href: '/expenses', label: 'Expenses', icon: Receipt },
      { href: '/sales', label: 'Sales', icon: TrendingUp },
      { href: '/subscription', label: 'Subscription', icon: CreditCard },
    ],
  },
  // Shop / Pen accessories — hidden until the storefront can fulfil
  // orders. Route and page stay live for direct links.
  {
    heading: 'Customer support',
    items: [
      { href: '/about', label: 'About this app', icon: Info },
      { href: '/contact', label: 'Contact us', icon: Phone },
      { href: '/community', label: 'WhatsApp community', icon: MessageCircle },
    ],
  },
];
