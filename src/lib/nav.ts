import {
  BarChart3, Bird, CreditCard, FileText, Info, LayoutDashboard, MessageCircle,
  Package, Phone, Receipt, Settings, Snowflake, Stethoscope, Tractor,
  TrendingUp, User, Users2, Wallet,
} from 'lucide-react';
import { DEFAULT_VERTICAL, type Vertical } from '@/lib/vertical';

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

/**
 * Cold chain's navigation.
 *
 * Not the poultry list with items hidden — a different list. A cold
 * store has no flock to place, no bird to diagnose, no breed report to
 * run, and no token to spend; leaving those greyed out would say the
 * product is for someone else and this operator is using the cut-down
 * version. What they do have is rooms, stock and a breach report.
 *
 * Expenses stays: diesel for the generator is the operator's largest
 * controllable cost, and the reason several of them will log anything
 * at all. Sales and Wallet go: nothing is sold per bird here, and
 * billing is on device subscription rather than tokens.
 */
const COLD_CHAIN_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/cold-rooms', label: 'Cold rooms', icon: Snowflake },
      { href: '/cold-chain/batches', label: 'Stock in store', icon: Package },
      { href: '/cold-chain/report', label: 'Breach report', icon: FileText },
    ],
  },
  {
    heading: 'Account',
    items: [
      { href: '/farms', label: 'Farms', icon: Tractor },
      { href: '/profile', label: 'Profile', icon: User },
      { href: '/users', label: 'Users', icon: Users2 },
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/expenses', label: 'Expenses', icon: Receipt },
      { href: '/subscription', label: 'Subscription', icon: CreditCard },
    ],
  },
  {
    heading: 'Customer support',
    items: [
      { href: '/about', label: 'About this app', icon: Info },
      { href: '/contact', label: 'Contact us', icon: Phone },
      { href: '/community', label: 'WhatsApp community', icon: MessageCircle },
    ],
  },
];

/**
 * The navigation for a given vertical.
 *
 * Only cold chain diverges so far. Greenhouse, irrigation and
 * aquaculture keep the poultry shape because their screens are not
 * built yet, and showing a farmer a menu of links that go nowhere is
 * worse than showing them the one they already know.
 */
export function navGroupsFor(vertical: Vertical = DEFAULT_VERTICAL): NavGroup[] {
  return vertical === 'cold_chain' ? COLD_CHAIN_GROUPS : NAV_GROUPS;
}
