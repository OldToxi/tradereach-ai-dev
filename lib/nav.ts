import type { Role } from './session'

export interface NavItem {
  label: string
  href: string
  count?: number
  hot?: boolean
  roles?: Role[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Opportunity pipeline', href: '/pipeline' },
    ],
  },
  {
    label: 'What we sell, where',
    items: [
      { label: 'Products', href: '/products' },
      { label: 'Target markets', href: '/markets' },
    ],
  },
  {
    label: 'Who we sell to',
    items: [
      { label: 'Companies', href: '/companies' },
      { label: 'Decision-makers', href: '/contacts' },
    ],
  },
  {
    label: 'Conversations',
    items: [
      { label: 'Review queue', href: '/review' },
      { label: 'Sent & follow-ups', href: '/outreach' },
      { label: 'Replies', href: '/replies' },
      { label: 'Meetings & tasks', href: '/meetings' },
    ],
  },
  {
    label: 'Control',
    items: [
      { label: 'Audit trail', href: '/audit' },
      { label: 'Settings & access', href: '/settings', roles: ['manager'] },
    ],
  },
]

export const ROLE_LABELS: Record<Role, string> = {
  executive: 'Export Executive',
  manager: 'Export Manager',
  commercial: 'Commercial Authority',
  auditor: 'Read-only Auditor',
}

export function navForRole(role: Role): NavGroup[] {
  return NAV.map((g) => ({
    label: g.label,
    items: g.items.filter((i) => !i.roles || i.roles.includes(role)),
  })).filter((g) => g.items.length > 0)
}

export function crumbFor(pathname: string): string {
  for (const g of NAV) {
    for (const i of g.items) {
      if (i.href === pathname || (i.href !== '/dashboard' && pathname.startsWith(i.href))) {
        return i.label
      }
    }
  }
  return 'TradeReach AI'
}
