'use server'

/**
 * lib/readout-actions.ts — server actions for the weekly read-out (T10.7).
 *
 * The read-out is derived from live numbers (see lib/readout.ts), not a model call,
 * and the panel is workspace-wide: RLS lets only roles that see every market read or
 * write it. Generating a new read-out stores a row and leaves it "reviewed by no one"
 * until a human marks it reviewed — the review flow is the feature.
 */
import { revalidatePath } from 'next/cache'
import { createServerClient } from './supabase/server'
import { requirePermission, canWrite, seesAllMarkets, type SessionUser } from './session'
import { writeAudit, AUDIT } from './audit'
import { buildWeeklyReadout } from './readout'
import { computeMarketBars, type CompanySnapshot } from './dashboard'

export type ReadoutActionState = { ok: boolean; error?: string; note?: string }

async function guard(): Promise<SessionUser | { ok: false; error: string }> {
  try {
    return await requirePermission((u) => canWrite(u) && seesAllMarkets(u), 'generate the weekly read-out')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }
}

export async function generateReadout(): Promise<ReadoutActionState> {
  const actor = await guard()
  if (!('id' in actor)) return actor

  const supabase = await createServerClient()

  const [
    { data: companies },
    { data: criterionFacts },
    { data: replies },
    { data: meetings },
    { data: dueTasks },
  ] = await Promise.all([
    supabase.from('company').select('id, stage, market, created_at'),
    supabase.from('fact').select('company_id, provenance').eq('is_qualification_criterion', true),
    supabase.from('message').select('company_id').eq('kind', 'reply'),
    supabase.from('meeting').select('company_id'),
    supabase
      .from('task')
      .select('id')
      .eq('done', false)
      .lte('due_on', new Date().toISOString().slice(0, 10)),
  ])

  const gap = new Map<string, number>()
  const hasFacts = new Set<string>()
  for (const f of criterionFacts ?? []) {
    hasFacts.add(f.company_id)
    if (f.provenance !== 'verified') gap.set(f.company_id, (gap.get(f.company_id) ?? 0) + 1)
  }
  const replied = new Set((replies ?? []).map((r) => r.company_id))
  const met = new Set((meetings ?? []).map((m) => m.company_id))

  const snapshots: CompanySnapshot[] = (companies ?? []).map((c) => ({
    id: c.id,
    stage: c.stage,
    market: c.market,
    hasQualificationFacts: hasFacts.has(c.id),
    gapCount: gap.get(c.id) ?? 0,
    hasReply: replied.has(c.id),
    hasMeeting: met.has(c.id),
    createdAt: c.created_at,
  }))

  const qualified = snapshots.filter((c) => c.hasQualificationFacts && c.gapCount === 0)
  const repliedCount = snapshots.filter((c) => c.hasReply).length
  const contacted = snapshots.filter((c) =>
    ['outreach', 'follow_up', 'reply', 'meeting', 'commercial_discussion'].includes(c.stage),
  ).length

  const body = buildWeeklyReadout({
    researched: snapshots.length,
    newThisWeek: snapshots.filter((c) => new Date(c.createdAt).getTime() >= Date.now() - 7 * 864e5).length,
    qualified: qualified.length,
    contacted,
    replied: repliedCount,
    replyRatePct: contacted ? Math.round((repliedCount / contacted) * 100) : 0,
    meetings: (meetings ?? []).length,
    followUpsDue: (dueTasks ?? []).length,
    needsResearch: snapshots.filter((c) => c.gapCount > 0).length,
    marketBars: computeMarketBars(snapshots),
  })

  const { data: row, error } = await supabase
    .from('weekly_readout')
    .insert({ body })
    .select('id')
    .single()
  if (error || !row) return { ok: false, error: error?.message ?? 'Could not store the read-out.' }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.READOUT_GENERATED,
    objectType: 'weekly_readout',
    objectId: row.id,
    detail: 'Weekly read-out generated',
  })

  revalidatePath('/dashboard')
  return { ok: true, note: 'Read-out generated — mark it reviewed once you have read it.' }
}

export async function markReadoutReviewed(formData: FormData): Promise<ReadoutActionState> {
  const actor = await guard()
  if (!('id' in actor)) return actor

  const id = (formData.get('id') as string)?.trim()
  if (!id) return { ok: false, error: 'Missing read-out.' }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('weekly_readout')
    .update({ reviewed_at: new Date().toISOString(), reviewed_by: actor.id })
    .eq('id', id)
  if (error) return { ok: false, error: error.message }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.READOUT_REVIEWED,
    objectType: 'weekly_readout',
    objectId: id,
    detail: 'Read-out marked reviewed',
  })

  revalidatePath('/dashboard')
  return { ok: true, note: 'Read-out marked as reviewed.' }
}
