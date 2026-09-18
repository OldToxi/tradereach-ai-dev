'use server'

/**
 * lib/scoring-actions.ts — server actions for Settings → Scoring (T11.3).
 *
 * Changing a weight re-derives every company's fit_score from its latest stored
 * research_run breakdown — no new AI call. The breakdowns themselves are never
 * rewritten, so a past decision stays explainable; the change is recorded as one
 * audit row (AUDIT.WEIGHTS_CHANGED) naming what moved and how many scores changed.
 *
 * All writes go through the acting manager's own client so RLS is the real
 * enforcement: score_weight_write allows only managers, and the recalc's
 * company.fit_score updates ride the existing company_update policy (managers can
 * write any market).
 */
import { revalidatePath } from 'next/cache'
import { createServerClient } from './supabase/server'
import { requirePermission, canManageUsers } from './session'
import { writeAudit, AUDIT } from './audit'
import {
  SCORING_CRITERIA,
  weightsAreValid,
  weightsFromRows,
  recalcScore,
  type WeightMap,
} from './scoring'
import type { BreakdownItem } from './research'

export type ScoringActionState = { ok: boolean; error?: string; recalculated?: number }

export async function saveWeights(formData: FormData): Promise<ScoringActionState> {
  let actor
  try {
    actor = await requirePermission(canManageUsers, 'change scoring weights')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const next = {} as WeightMap
  for (const c of SCORING_CRITERIA) {
    const raw = formData.get(`weight_${c.key}`)
    next[c.key] = Number(raw)
  }

  if (!weightsAreValid(next)) {
    return { ok: false, error: 'Weights must be whole numbers from 0 to 40 and add up to 100.' }
  }

  const supabase = await createServerClient()

  const { data: rows } = await supabase.from('score_weight').select('criterion_key, weight').order('sort_order')
  const before = weightsFromRows(rows ?? [])

  const changed = SCORING_CRITERIA.filter((c) => before[c.key] !== next[c.key])

  for (const c of SCORING_CRITERIA) {
    const { error } = await supabase
      .from('score_weight')
      .update({ weight: next[c.key], updated_at: new Date().toISOString() })
      .eq('criterion_key', c.key)
    if (error) return { ok: false, error: error.message }
  }

  // Latest breakdown per company, newest run first. Managers see every market, so
  // this reads the whole table through the user client.
  const { data: runs } = await supabase
    .from('research_run')
    .select('company_id, breakdown')
    .order('created_at', { ascending: false })

  const latest = new Map<string, BreakdownItem[]>()
  for (const run of runs ?? []) {
    if (latest.has(run.company_id)) continue
    latest.set(run.company_id, (run.breakdown ?? []) as BreakdownItem[])
  }

  let recalculated = 0
  await Promise.all(
    [...latest.entries()].map(async ([companyId, breakdown]) => {
      const score = recalcScore(breakdown, next)
      const { error } = await supabase.from('company').update({ fit_score: score }).eq('id', companyId)
      if (!error) recalculated++
    }),
  )

  const detail =
    (changed.length
      ? changed.map((c) => `${c.label} ${before[c.key]} → ${next[c.key]}`).join(' · ')
      : 'Weights unchanged') + ` · ${recalculated} scores recalculated`

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.WEIGHTS_CHANGED,
    objectType: 'score_weight',
    detail,
  })

  revalidatePath('/settings')
  revalidatePath('/companies')
  return { ok: true, recalculated }
}
