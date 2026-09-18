'use server'

/**
 * lib/user-actions.ts — server actions for Users & roles (T11.2).
 *
 * User administration is the one genuinely admin-only act in the app: inviting a
 * user creates an auth.user, which only the service role can do, and reading
 * last-sign-in for the team table comes from the same admin API. Role and market
 * assignment, by contrast, goes through the acting manager's user client so the
 * `profiles_manager_writes` RLS policy is the real enforcement.
 */
import { revalidatePath } from 'next/cache'
import { createServerClient } from './supabase/server'
import { admin } from './supabase/admin'
import { requirePermission, canManageUsers } from './session'
import { roleIsValid } from './users'
import type { Role } from './users'
import { writeAudit, AUDIT } from './audit'

export type UserActionState = { ok: boolean; error?: string }

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * The shared demo password, same as scripts/seed.ts. This build has no configured
 * outbound email, so "invite" creates the auth.user confirmed with this password
 * (matching how the seed's five accounts are made) rather than sending an email.
 * A real deployment would swap this for admin.auth.admin.inviteUserByEmail, which
 * this environment rejects for `.test` addresses and rate-limits.
 */
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'demo-password-2026'

function marketsFromForm(formData: FormData): string[] {
  return [...new Set(formData.getAll('markets').map((m) => String(m).trim()).filter(Boolean))]
}

export async function inviteUser(formData: FormData): Promise<UserActionState> {
  let actor
  try {
    actor = await requirePermission(canManageUsers, 'invite users')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const fullName = String(formData.get('full_name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const role = String(formData.get('role') ?? '').trim()
  const markets = marketsFromForm(formData)

  if (!fullName) return { ok: false, error: 'Name is required.' }
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' }
  if (!roleIsValid(role)) return { ok: false, error: 'Choose a valid role.' }

  const supabase = await createServerClient()
  const { data: existing } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle()
  if (existing) return { ok: false, error: 'A user with that email already exists.' }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error) return { ok: false, error: error.message }

  const userId = data?.user?.id
  if (!userId) return { ok: false, error: 'The invitation did not return a user.' }

  const { error: pErr } = await admin.from('profiles').insert({
    id: userId,
    email,
    full_name: fullName,
    role: role as Role,
    assigned_markets: markets,
  })
  if (pErr) return { ok: false, error: pErr.message }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.USER_INVITED,
    objectType: 'profile',
    objectId: userId,
    detail: `Invited ${fullName} (${email}) as ${role}`,
  })

  revalidatePath('/settings')
  return { ok: true }
}

export async function updateUserRole(formData: FormData): Promise<UserActionState> {
  let actor
  try {
    actor = await requirePermission(canManageUsers, 'manage roles')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const id = String(formData.get('id') ?? '').trim()
  const role = String(formData.get('role') ?? '').trim()
  const markets = marketsFromForm(formData)
  const prevRole = String(formData.get('prev_role') ?? '').trim()

  if (!id) return { ok: false, error: 'No user selected.' }
  if (!roleIsValid(role)) return { ok: false, error: 'Choose a valid role.' }

  // Separation of duties: a manager must not demote or promote themselves.
  if (id === actor.id && role !== prevRole) {
    return { ok: false, error: 'You cannot change your own role. Ask another manager.' }
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: role as Role, assigned_markets: markets })
    .eq('id', id)
    .select('id')

  if (error) return { ok: false, error: error.message }
  if (!data || data.length === 0) return { ok: false, error: 'User not found or not editable.' }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.ROLE_CHANGED,
    objectType: 'profile',
    objectId: id,
    detail: prevRole && prevRole !== role ? `${prevRole} → ${role}` : `Markets set for ${role}`,
  })

  revalidatePath('/settings')
  return { ok: true }
}
