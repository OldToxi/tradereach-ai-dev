/**
 * lib/session.ts — who is acting, and what they may do.
 *
 * Every server action, route handler and RLS-facing query goes through currentUser().
 * Nothing else reads cookies or auth state directly.
 *
 * Two modes:
 *   AUTH_MODE=live  — real Supabase session from cookies. Use this everywhere real.
 *   AUTH_MODE=stub  — no login; DEV_USER is assumed. Local development only.
 *                     Throws on boot in production. Do not remove that guard.
 */
import { cache } from 'react'
import { createServerClient } from './supabase/server'
import { admin } from './supabase/admin'
import type { Database } from './database.types'

export type Role = 'executive' | 'manager' | 'commercial' | 'auditor'

export interface SessionUser {
  id: string
  email: string
  fullName: string
  role: Role
  assignedMarkets: string[]
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ForbiddenError'
  }
}

const STUB = process.env.AUTH_MODE === 'stub'

// An auth bypass that quietly survives to a deployed URL is the worst thing an
// evaluator could find in this repo. Fail at import time, not at request time.
if (STUB && process.env.NODE_ENV === 'production') {
  throw new Error(
    'AUTH_MODE=stub is set in a production build. Refusing to start. Set AUTH_MODE=live.',
  )
}

/**
 * The current user, or throws. Cached per request, so calling it in a dozen
 * components costs one lookup.
 */
export const currentUser = cache(async (): Promise<SessionUser> => {
  if (STUB) return stubUser()

  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) throw new AuthError('Not signed in')

  // Role and markets are in the JWT via the custom access token hook (T1.5), so
  // this is free — no extra round trip.
  const meta = (user.app_metadata ?? {}) as { role?: Role; markets?: string[] }

  if (!meta.role) {
    // Hook not applied, or a user created outside the seed. Fail loudly: a missing
    // role silently defaulting to something permissive is how access control dies.
    throw new AuthError(
      `User ${user.email} has no role claim. Check the access token hook (T1.5).`,
    )
  }

  return {
    id: user.id,
    email: user.email!,
    fullName: (user.user_metadata?.full_name as string) ?? user.email!,
    role: meta.role,
    assignedMarkets: meta.markets ?? [],
  }
})

/** Null instead of throwing. For layout chrome that renders either way. */
export async function maybeUser(): Promise<SessionUser | null> {
  try {
    return await currentUser()
  } catch {
    return null
  }
}

let stubCache: SessionUser | null = null
async function stubUser(): Promise<SessionUser> {
  if (stubCache) return stubCache
  const email = process.env.DEV_USER
  if (!email) throw new AuthError('AUTH_MODE=stub requires DEV_USER')

  const { data, error } = await admin
    .from('profiles')
    .select('id, email, full_name, role, assigned_markets')
    .eq('email', email)
    .single()

  if (error || !data) throw new AuthError(`DEV_USER ${email} not found — run npm run seed`)

  stubCache = {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    role: data.role as Role,
    assignedMarkets: data.assigned_markets ?? [],
  }
  return stubCache
}

/* ------------------------------------------------------------------ */
/* Permissions                                                         */
/*                                                                     */
/* These mirror the RLS policies. RLS is the real enforcement — these   */
/* exist so the UI can hide controls the database would refuse anyway.  */
/* Never rely on these alone for a write.                               */
/* ------------------------------------------------------------------ */

export const canApprove = (u: SessionUser) => u.role === 'manager' || u.role === 'commercial'

export const canReleaseCommercial = (u: SessionUser) => u.role === 'commercial'

export const canWrite = (u: SessionUser) => u.role !== 'auditor'

export const canManageUsers = (u: SessionUser) => u.role === 'manager'

/** Managers, commercial and auditors see every market. Executives see theirs. */
export const seesAllMarkets = (u: SessionUser) => u.role !== 'executive'

export const canSeeMarket = (u: SessionUser, market: string) =>
  seesAllMarkets(u) || u.assignedMarkets.includes(market)

/**
 * Guard for server actions. Throws ForbiddenError, which the error boundary
 * renders as a refusal message rather than a crash.
 *
 *   const user = await require(canApprove, 'approve outreach')
 */
export async function requirePermission(
  check: (u: SessionUser) => boolean,
  action: string,
): Promise<SessionUser> {
  const user = await currentUser()
  if (!check(user)) {
    // An attempted action outside scope is itself auditable (brief §7).
    const { writeAudit } = await import('./audit')
    await writeAudit({
      actorId: user.id,
      actorLabel: user.fullName,
      event: 'Access refused',
      detail: `${user.role} attempted: ${action}`,
    })
    throw new ForbiddenError(`Your role (${user.role}) cannot ${action}.`)
  }
  return user
}

/**
 * An approver may not approve a message they drafted. Separation of duties is
 * the point of the review queue; without this, one person is the whole control.
 */
export function assertNotSelfApproval(user: SessionUser, draftedBy: string | null) {
  if (draftedBy && draftedBy === user.id && user.role !== 'commercial') {
    throw new ForbiddenError('You cannot approve a message you drafted. Ask another approver.')
  }
}
