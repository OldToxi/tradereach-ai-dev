/**
 * lib/users.ts — pure helpers for Users & roles (T11.2).
 *
 * No Supabase, no cookies, no React. The role→capability mapping and the markets
 * display rule live here so they can be unit-tested and shared by the team table
 * (client) and the server actions (server) without pulling either side's deps in.
 */

export type Role = 'executive' | 'manager' | 'commercial' | 'auditor'

export const ROLES: readonly Role[] = ['executive', 'manager', 'commercial', 'auditor']

export const ROLE_LABELS: Record<Role, string> = {
  executive: 'Export Executive',
  manager: 'Export Manager',
  commercial: 'Commercial Authority',
  auditor: 'Read-only Auditor',
}

export function roleIsValid(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value)
}

/** Approval is the manager + commercial step, mirroring `can_approve()` in RLS. */
export function canApproveFor(role: Role): boolean {
  return role === 'manager' || role === 'commercial'
}

/** Only the Commercial Authority releases reserved terms, mirroring RLS. */
export function canReleaseFor(role: Role): boolean {
  return role === 'commercial'
}

/**
 * How the team table shows a member's markets. Commercial and auditor always see
 * every market (RLS `sees_all_markets()`), so they show "All"; executives and
 * managers show the markets actually assigned to them (a manager's list is
 * informational, not a boundary).
 */
export function marketsLabel(role: Role, markets: readonly string[]): string {
  if (role === 'commercial' || role === 'auditor') return 'All'
  if (!markets || markets.length === 0) return 'All'
  return markets.join(', ')
}

export interface TeamMemberView {
  id: string
  email: string
  fullName: string
  role: Role
  markets: string[]
  lastSeen: string | null
  isSelf: boolean
}
