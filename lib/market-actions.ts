'use server'

/**
 * lib/market-actions.ts — server actions for the market catalog.
 *
 * Managers may add or edit a market, mirroring the `market_write` RLS policy.
 * RLS is the real enforcement; this turns a policy refusal into a readable
 * message and an audit row.
 */
import { revalidatePath } from 'next/cache'
import { createServerClient } from './supabase/server'
import { requirePermission } from './session'
import { canManageCatalog } from './catalog'
import { writeAudit, AUDIT } from './audit'

export type MarketActionState = { ok: boolean; error?: string }

const PRIORITIES = ['high', 'medium', 'watch'] as const

export async function saveMarket(formData: FormData): Promise<MarketActionState> {
  let actor
  try {
    actor = await requirePermission((u) => canManageCatalog(u.role), 'manage markets')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const id = (formData.get('id') as string)?.trim() || null
  const country = (formData.get('country') as string)?.trim()
  const product_focus = (formData.get('product_focus') as string)?.trim() || null
  const priorityRaw = (formData.get('priority') as string)?.trim() || 'medium'
  const capRaw = (formData.get('weekly_outreach_cap') as string)?.trim()
  const send_window = (formData.get('send_window') as string)?.trim() || null
  const required_before_sending = (formData.get('required_before_sending') as string)?.trim() || null
  const legal_note = (formData.get('legal_note') as string)?.trim() || null

  if (!country) return { ok: false, error: 'Country is required.' }

  const priority = (PRIORITIES.includes(priorityRaw as (typeof PRIORITIES)[number])
    ? priorityRaw
    : 'medium') as (typeof PRIORITIES)[number]

  let weekly_outreach_cap = 12
  if (capRaw) {
    const n = Number(capRaw)
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Weekly outreach cap must be a non-negative number.' }
    weekly_outreach_cap = Math.round(n)
  }

  const row = { country, product_focus, priority, weekly_outreach_cap, send_window, required_before_sending, legal_note }

  const supabase = await createServerClient()
  const { error } = id
    ? await supabase.from('market').update(row).eq('id', id)
    : await supabase.from('market').insert(row)

  if (error) return { ok: false, error: error.message }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: id ? AUDIT.MARKET_EDITED : AUDIT.MARKET_ADDED,
    objectType: 'market',
    objectId: id ?? undefined,
    detail: id ? `Edited market "${country}"` : `Added market "${country}"`,
  })

  revalidatePath('/markets')
  return { ok: true }
}
