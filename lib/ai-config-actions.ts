'use server'

/**
 * lib/ai-config-actions.ts — server actions for Settings → AI workflow (T11.4).
 *
 * The spend cap and alert threshold are the only AI settings a manager may change
 * at runtime; the model names and temperatures are read from server environment
 * variables and shown read-only (see lib/ai/workflow.ts and the pane). The cap is
 * read by lib/ai/client.ts on every prompt call, so a save takes effect on the
 * next run with no redeploy.
 *
 * Writes go through the acting manager's own client so RLS is the real
 * enforcement (system_config_write allows only managers).
 */
import { revalidatePath } from 'next/cache'
import { createServerClient } from './supabase/server'
import { requirePermission, canManageUsers } from './session'
import { writeAudit, AUDIT } from './audit'
import { capIsValid, alertIsValid } from './system-config'

export type AiConfigActionState = { ok: boolean; error?: string }

export async function saveSpendConfig(formData: FormData): Promise<AiConfigActionState> {
  let actor
  try {
    actor = await requirePermission(canManageUsers, 'change the AI spend cap')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const cap = (formData.get('ai_monthly_cap_usd') as string)?.trim() ?? ''
  const alert = (formData.get('ai_alert_threshold_pct') as string)?.trim() ?? ''

  if (!capIsValid(cap)) {
    return { ok: false, error: 'Spend cap must be a whole dollar amount from 0 to 100,000.' }
  }
  if (!alertIsValid(alert)) {
    return { ok: false, error: 'Alert threshold must be a whole percent from 1 to 100.' }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.from('system_config').upsert(
    [
      { key: 'ai_monthly_cap_usd', value: String(Number(cap)) },
      { key: 'ai_alert_threshold_pct', value: String(Number(alert)) },
    ],
    { onConflict: 'key' },
  )
  if (error) return { ok: false, error: error.message }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.AI_CONFIG_CHANGED,
    objectType: 'system_config',
    detail: `Spend cap USD ${Number(cap)} · alert at ${Number(alert)}%`,
  })

  revalidatePath('/settings')
  return { ok: true }
}
