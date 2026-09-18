'use server'

/**
 * lib/guardrails-actions.ts — server actions for Settings → Commercial guardrails
 * (T11.5): add/remove a reserved matter and edit the standard refusal template.
 *
 * Built-in matters (is_builtin = true) cannot be removed at all — the brief (§4)
 * fixes them and the deterministic pattern pass is authoritative for them. Only a
 * custom matter can be removed, and it is deleted outright. A custom matter is
 * added as a slug and is caught by the meaning-based model pass. The refusal
 * template is validated to stay keyword-free (refusalTemplateIsClean) so the
 * invariant that a reply draft never trips the guardrail survives an edit.
 *
 * Writes go through the acting manager's own client (RLS: manager only).
 */
import { revalidatePath } from 'next/cache'
import { createServerClient } from './supabase/server'
import { requirePermission, canManageUsers } from './session'
import { writeAudit, AUDIT } from './audit'
import { refusalTemplateIsClean } from './guardrails'
import {
  slugifyMatter,
  validateNewMatter,
  isBuiltinMatter,
  type ReservedMatterRow,
} from './guardrails-config'

export type GuardrailsActionState = { ok: boolean; error?: string }

async function loadRows(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data } = await supabase
    .from('reserved_matter')
    .select('key, label, is_builtin, active, sort_order')
    .order('sort_order')
  return (data ?? []) as ReservedMatterRow[]
}

export async function addReservedMatter(formData: FormData): Promise<GuardrailsActionState> {
  let actor
  try {
    actor = await requirePermission(canManageUsers, 'reserve a commercial matter')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const label = (formData.get('label') as string)?.trim() ?? ''
  const supabase = await createServerClient()
  const rows = await loadRows(supabase)

  const err = validateNewMatter(label, rows.map((r) => ({ key: r.key, label: r.label })))
  if (err) return { ok: false, error: err }

  const key = slugifyMatter(label)
  const maxOrder = rows.reduce((max, r) => Math.max(max, r.sort_order), 0)

  const { error } = await supabase.from('reserved_matter').insert({
    key,
    label,
    is_builtin: false,
    active: true,
    sort_order: maxOrder + 1,
  })
  if (error) return { ok: false, error: error.message }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.GUARDRAIL_MATTER_ADDED,
    objectType: 'reserved_matter',
    objectId: key,
    detail: `Reserved matter added: ${label}`,
  })

  revalidatePath('/settings')
  return { ok: true }
}

export async function removeReservedMatter(formData: FormData): Promise<GuardrailsActionState> {
  let actor
  try {
    actor = await requirePermission(canManageUsers, 'remove a reserved matter')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const key = (formData.get('key') as string)?.trim()
  if (!key) return { ok: false, error: 'Missing matter.' }

  const supabase = await createServerClient()
  const rows = await loadRows(supabase)
  const row = rows.find((r) => r.key === key)
  if (!row) return { ok: false, error: 'Matter not found.' }

  // Built-ins are the fixed control from the brief (§4). Removing "price" would
  // be removing the control itself, so only custom matters may be removed.
  if (isBuiltinMatter(key)) {
    return { ok: false, error: 'Built-in matters are always blocked and cannot be removed.' }
  }

  const { error } = await supabase.from('reserved_matter').delete().eq('key', key)
  if (error) return { ok: false, error: error.message }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.GUARDRAIL_MATTER_REMOVED,
    objectType: 'reserved_matter',
    objectId: key,
    detail: `Reserved matter removed: ${row.label}`,
  })

  revalidatePath('/settings')
  return { ok: true }
}

export async function saveRefusalTemplate(formData: FormData): Promise<GuardrailsActionState> {
  let actor
  try {
    actor = await requirePermission(canManageUsers, 'edit the refusal template')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const template = (formData.get('template') as string)?.trim() ?? ''
  if (!template) return { ok: false, error: 'Write the refusal wording.' }
  if (!template.includes('{authority}') || !template.includes('{market}')) {
    return { ok: false, error: 'The template must keep the {authority} and {market} placeholders.' }
  }
  if (!refusalTemplateIsClean(template)) {
    return {
      ok: false,
      error:
        'That wording names a reserved term. A refusal must never name price, payment terms or another reserved matter — reword it.',
    }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.from('system_config').upsert(
    { key: 'refusal_template', value: template },
    { onConflict: 'key' },
  )
  if (error) return { ok: false, error: error.message }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.REFUSAL_TEMPLATE_UPDATED,
    objectType: 'system_config',
    detail: 'Standard refusal template updated',
  })

  revalidatePath('/settings')
  return { ok: true }
}
