'use server'

/**
 * lib/research-actions.ts — server actions for the AI research pack (T5.1-T5.6).
 *
 * runResearch is the only place that calls runPrompt(researchPrompt, ...). Its writes
 * go through the acting user's own client (RLS-checked), matching lib/company-actions.ts
 * — the AI call itself already goes through lib/ai/client.ts, which is the one place
 * allowed to write ai_run via the service role.
 */
import { revalidatePath } from 'next/cache'
import { createServerClient } from './supabase/server'
import { requirePermission, canWrite, canOverridePriority } from './session'
import { writeAudit, AUDIT } from './audit'
import { runPrompt, AIError } from './ai/client'
import { buildCompanyContext, buildProductContext, renderContext } from './ai/context'
import { researchPromptWithWeights, researchUserMessage } from './ai/prompts/research'
import { factsFromBreakdown, RESEARCH_DEPTHS, DISQUALIFY_REASONS, type ResearchDepth } from './research'
import { weightsFromRows } from './scoring'

export type ResearchActionState = {
  ok: boolean
  error?: string
  companyId?: string
  score?: number
  costUsd?: number
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

/* ------------------------------------------------------------------ */
/* T5.1-T5.4 — run AI research, one call, six outputs                  */
/* ------------------------------------------------------------------ */

export async function runResearch(formData: FormData): Promise<ResearchActionState> {
  let actor
  try {
    actor = await requirePermission(canWrite, 'run AI research')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const companyId = (formData.get('companyId') as string)?.trim()
  const depth = ((formData.get('depth') as string)?.trim() || 'standard') as ResearchDepth
  if (!companyId || !isUuid(companyId)) return { ok: false, error: 'Missing company.' }
  if (!(depth in RESEARCH_DEPTHS)) return { ok: false, error: 'Unknown depth.' }

  const supabase = await createServerClient()
  const { data: company, error: companyError } = await supabase
    .from('company')
    .select('id, name, market, product_id, marketRow:market!company_market_fkey(priority)')
    .eq('id', companyId)
    .maybeSingle()

  if (companyError || !company) return { ok: false, error: 'Company not found.' }

  let result
  try {
    const context = await buildCompanyContext(companyId, { includeUnverified: true })
    const product = company.product_id ? await buildProductContext(company.product_id) : undefined
    const rendered = renderContext(context, product)
    const marketPriority = company.marketRow?.priority ?? 'medium'
    const userMessage = `${researchUserMessage(rendered, marketPriority)}\n\nDEPTH: ${RESEARCH_DEPTHS[depth]}`

    // Score under the currently configured weights (Settings → Scoring), so a new
    // run and a recalculated past run agree on what "fit" means.
    const { data: weightRows } = await supabase
      .from('score_weight')
      .select('criterion_key, weight')
      .order('sort_order')
    const weights = weightsFromRows(weightRows ?? [])

    result = await runPrompt(researchPromptWithWeights(weights), userMessage, { companyId })
  } catch (err) {
    return { ok: false, error: err instanceof AIError ? err.message : 'AI research failed.' }
  }

  const { data: run, error: runError } = await supabase
    .from('research_run')
    .insert({
      company_id: companyId,
      ai_run_id: result.aiRunId,
      summary: result.data.summary,
      opportunity_summary: result.data.opportunitySummary,
      gaps: result.data.gaps,
      score: result.data.score,
      breakdown: result.data.breakdown,
      suitability: result.data.suitability,
      priority_reason: result.data.priorityReason,
      decision_maker: result.data.decisionMaker,
    })
    .select('id')
    .single()

  if (runError) return { ok: false, error: runError.message }

  const { error: scoreError } = await supabase
    .from('company')
    .update({ fit_score: result.data.score })
    .eq('id', companyId)
  if (scoreError) return { ok: false, error: scoreError.message }

  // Populate the qualification checklist with what the run found evidence for.
  // Never touches a fact already verified or human_approved — an AI guess must
  // not overwrite a person's confirmed answer (AGENTS.md rule 2).
  const { data: existing } = await supabase
    .from('fact')
    .select('key, provenance')
    .eq('company_id', companyId)
    .eq('is_qualification_criterion', true)
  const locked = new Set(
    (existing ?? []).filter((f) => f.provenance === 'verified' || f.provenance === 'human_approved').map((f) => f.key),
  )

  for (const f of factsFromBreakdown(result.data.breakdown)) {
    if (locked.has(f.key)) continue
    await supabase.from('fact').upsert(
      {
        company_id: companyId,
        key: f.key,
        value: f.value,
        provenance: 'ai',
        is_qualification_criterion: true,
      },
      { onConflict: 'company_id,key' },
    )
  }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.AI_RESEARCH,
    objectType: 'company',
    objectId: companyId,
    detail: `Depth: ${depth}. Score ${result.data.score}/100. Cost $${result.costUsd.toFixed(4)}.`,
  })

  revalidatePath(`/companies/${companyId}`)
  revalidatePath('/companies')
  return { ok: true, companyId, score: result.data.score, costUsd: result.costUsd }
}

/* ------------------------------------------------------------------ */
/* T5.4 — "Make a task" from a missing-information gap                 */
/* ------------------------------------------------------------------ */

export type TaskActionState = { ok: boolean; error?: string; companyId?: string }

export async function createTask(formData: FormData): Promise<TaskActionState> {
  let actor
  try {
    actor = await requirePermission(canWrite, 'create tasks')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const companyId = (formData.get('companyId') as string)?.trim()
  const title = (formData.get('title') as string)?.trim()
  const blocksStage = formData.get('blocksStage') === 'true'
  const assigneeId = (formData.get('assigneeId') as string)?.trim() || null

  if (!companyId || !isUuid(companyId)) return { ok: false, error: 'Missing company.' }
  if (!title) return { ok: false, error: 'Task needs a title.' }

  const supabase = await createServerClient()
  const { error } = await supabase.from('task').insert({
    company_id: companyId,
    title,
    assignee_id: assigneeId && isUuid(assigneeId) ? assigneeId : null,
    blocks_stage: blocksStage,
  })
  if (error) return { ok: false, error: error.message }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.TASK_CREATED,
    objectType: 'company',
    objectId: companyId,
    detail: title,
  })

  revalidatePath(`/companies/${companyId}`)
  return { ok: true, companyId }
}

/* ------------------------------------------------------------------ */
/* T5.5 — manager priority override, mandatory reason                  */
/* ------------------------------------------------------------------ */

export async function overridePriority(formData: FormData): Promise<TaskActionState> {
  let actor
  try {
    actor = await requirePermission(canOverridePriority, 'override priority ranking')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const companyId = (formData.get('companyId') as string)?.trim()
  const rankRaw = (formData.get('rank') as string)?.trim()
  const reason = (formData.get('reason') as string)?.trim()

  if (!companyId || !isUuid(companyId)) return { ok: false, error: 'Missing company.' }
  const rank = Number(rankRaw)
  if (!Number.isInteger(rank) || rank < 1) return { ok: false, error: 'Enter a rank of 1 or higher.' }
  if (!reason) return { ok: false, error: 'A reason is required to override priority.' }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('company')
    .update({ priority_override: rank, priority_override_reason: reason })
    .eq('id', companyId)
  if (error) return { ok: false, error: error.message }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.PRIORITY_OVERRIDDEN,
    objectType: 'company',
    objectId: companyId,
    detail: `Set to #${rank} — ${reason}`,
  })

  revalidatePath(`/companies/${companyId}`)
  return { ok: true, companyId }
}

/* ------------------------------------------------------------------ */
/* T5.6 — disqualify, with optional permanent domain suppression       */
/* ------------------------------------------------------------------ */

function domainOf(website: string | null): string | null {
  if (!website) return null
  const stripped = website.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  const host = stripped.split('/')[0].trim().toLowerCase()
  return host || null
}

export async function disqualifyCompany(formData: FormData): Promise<TaskActionState> {
  let actor
  try {
    actor = await requirePermission(canWrite, 'disqualify companies')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const companyId = (formData.get('companyId') as string)?.trim()
  const reason = (formData.get('reason') as string)?.trim()
  const note = (formData.get('note') as string)?.trim()
  const suppress = formData.get('suppress') === 'true'

  if (!companyId || !isUuid(companyId)) return { ok: false, error: 'Missing company.' }
  if (!reason) return { ok: false, error: 'Choose a reason.' }

  const supabase = await createServerClient()
  const { data: company } = await supabase
    .from('company')
    .select('website')
    .eq('id', companyId)
    .single()

  const fullReason = note ? `${reason} — ${note}` : reason

  const { error } = await supabase
    .from('company')
    .update({ stage: 'disqualified', disqualified_reason: fullReason })
    .eq('id', companyId)
  if (error) return { ok: false, error: error.message }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.COMPANY_DISQUALIFIED,
    objectType: 'company',
    objectId: companyId,
    detail: fullReason,
  })

  const domain = suppress ? domainOf(company?.website ?? null) : null
  if (domain) {
    const { error: suppressError } = await supabase
      .from('suppression')
      .insert({ email_or_domain: domain, reason: `Disqualified: ${fullReason}` })
    // A duplicate suppression (already suppressed) is not a failure — the goal is
    // already achieved. Any other error is worth surfacing.
    if (suppressError && suppressError.code !== '23505') return { ok: false, error: suppressError.message }
    if (!suppressError) {
      await writeAudit({
        actorId: actor.id,
        actorLabel: actor.fullName,
        event: AUDIT.SUPPRESSED,
        objectType: 'company',
        objectId: companyId,
        detail: `Domain "${domain}" suppressed permanently`,
      })
    }
  }

  revalidatePath(`/companies/${companyId}`)
  revalidatePath('/companies')
  return { ok: true, companyId }
}
