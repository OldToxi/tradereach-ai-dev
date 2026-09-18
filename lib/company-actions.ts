'use server'

/**
 * lib/company-actions.ts — server actions for the company detail screen (T4.2–T4.7).
 *
 * Every action here re-checks the role in `requirePermission` and lets RLS do the
 * real enforcement. The DB CHECK constraints (verified_needs_evidence,
 * ai_cannot_be_confirmed) and the `enforce_stage_gate` trigger are the source of
 * truth; these actions translate their refusals into readable messages.
 */
import { revalidatePath } from 'next/cache'
import { createServerClient } from './supabase/server'
import { requirePermission, canWrite } from './session'
import { writeAudit, AUDIT } from './audit'
import { STAGE_LABELS } from './companies'

export type CompanyActionState = { ok: boolean; error?: string; companyId?: string }

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

/* ------------------------------------------------------------------ */
/* T4.2 — add a company                                                */
/* ------------------------------------------------------------------ */

export async function addCompany(formData: FormData): Promise<CompanyActionState> {
  let actor
  try {
    actor = await requirePermission(canWrite, 'add companies')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const name = (formData.get('name') as string)?.trim()
  const website = (formData.get('website') as string)?.trim() || null
  const market = (formData.get('market') as string)?.trim()
  const company_type = (formData.get('company_type') as string)?.trim() || null
  const product_id = (formData.get('product_id') as string)?.trim() || null
  const owner_id = (formData.get('owner_id') as string)?.trim() || actor.id

  if (!name) return { ok: false, error: 'Company name is required.' }
  if (!market) return { ok: false, error: 'Choose a market.' }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('company')
    .insert({ name, website, market, company_type, product_id, owner_id })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.COMPANY_ADDED,
    objectType: 'company',
    objectId: data.id,
    detail: `Added company "${name}" in ${market}`,
  })

  revalidatePath('/companies')
  return { ok: true, companyId: data.id }
}

/* ------------------------------------------------------------------ */
/* T4.5 — add a source                                                 */
/* ------------------------------------------------------------------ */

export async function addSource(formData: FormData): Promise<CompanyActionState> {
  let actor
  try {
    actor = await requirePermission(canWrite, 'add sources')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const companyId = (formData.get('companyId') as string)?.trim()
  const doc = (formData.get('doc') as string)?.trim()
  const supports = (formData.get('supports') as string)?.trim() || null
  const quality = (formData.get('quality') as string)?.trim() || 'secondary'

  if (!companyId || !isUuid(companyId)) return { ok: false, error: 'Missing company.' }
  if (!doc) return { ok: false, error: 'Enter a URL or document.' }

  const looksLikeUrl = /^https?:\/\//i.test(doc)
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('source')
    .insert({
      company_id: companyId,
      title: doc,
      url: looksLikeUrl ? doc : null,
      supports,
      quality,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.SOURCE_ADDED,
    objectType: 'company',
    objectId: companyId,
    detail: `Added source "${doc}"${supports ? ` supporting: ${supports}` : ''}`,
  })

  revalidatePath(`/companies/${companyId}`)
  return { ok: true, companyId }
}

/* ------------------------------------------------------------------ */
/* T4.5 — analyst notes (human_approved, never rewritten by AI)        */
/* ------------------------------------------------------------------ */

export async function addAnalystNote(formData: FormData): Promise<CompanyActionState> {
  let actor
  try {
    actor = await requirePermission(canWrite, 'add analyst notes')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const companyId = (formData.get('companyId') as string)?.trim()
  const note = (formData.get('note') as string)?.trim()

  if (!companyId || !isUuid(companyId)) return { ok: false, error: 'Missing company.' }
  if (!note) return { ok: false, error: 'Write a note first.' }

  // One note per row, distinct key, provenance human_approved. AI is never given
  // these as fact, and nothing may overwrite them — the unique (company_id, key)
  // index plus a fresh key makes a rewrite impossible.
  const key = `analyst_note_${Date.now()}`

  const supabase = await createServerClient()
  const { error } = await supabase.from('fact').insert({
    company_id: companyId,
    key,
    value: note,
    provenance: 'human_approved',
    confirmed_by: actor.id,
    confirmed_at: new Date().toISOString(),
    is_qualification_criterion: false,
  })

  if (error) return { ok: false, error: error.message }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: 'Analyst note added',
    objectType: 'company',
    objectId: companyId,
    detail: note.slice(0, 120),
  })

  revalidatePath(`/companies/${companyId}`)
  return { ok: true, companyId }
}

/* ------------------------------------------------------------------ */
/* T4.4 / T4.6 — promote a fact to verified, gated on a source          */
/* ------------------------------------------------------------------ */

export async function promoteFactToVerified(formData: FormData): Promise<CompanyActionState> {
  let actor
  try {
    actor = await requirePermission(canWrite, 'verify facts')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const companyId = (formData.get('companyId') as string)?.trim()
  const factId = (formData.get('factId') as string)?.trim()
  const sourceId = (formData.get('sourceId') as string)?.trim()

  if (!companyId || !isUuid(companyId) || !factId || !isUuid(factId)) {
    return { ok: false, error: 'Missing fact.' }
  }
  if (!sourceId || !isUuid(sourceId)) {
    return { ok: false, error: 'Confirmation needs a source — add one first.' }
  }

  const supabase = await createServerClient()
  const { data: fact } = await supabase
    .from('fact')
    .select('key, is_qualification_criterion')
    .eq('id', factId)
    .single()

  const { error } = await supabase
    .from('fact')
    .update({
      provenance: 'verified',
      source_id: sourceId,
      confirmed_by: actor.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', factId)

  if (error) return { ok: false, error: error.message }

  const label = fact?.key ?? 'field'
  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: fact?.is_qualification_criterion ? AUDIT.CRITERION_CONFIRMED : AUDIT.FIELD_VERIFIED,
    objectType: 'company',
    objectId: companyId,
    detail: `Verified "${label}" against a source`,
  })

  revalidatePath(`/companies/${companyId}`)
  return { ok: true, companyId }
}

/* ------------------------------------------------------------------ */
/* T4.7 — change stage, with the SQL gate surfaced                     */
/* ------------------------------------------------------------------ */

export async function changeStage(formData: FormData): Promise<CompanyActionState> {
  let actor
  try {
    actor = await requirePermission(canWrite, 'move companies between stages')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const companyId = (formData.get('companyId') as string)?.trim()
  const stage = (formData.get('stage') as string)?.trim()

  if (!companyId || !isUuid(companyId)) return { ok: false, error: 'Missing company.' }
  if (!stage || !(stage in STAGE_LABELS)) return { ok: false, error: 'Unknown stage.' }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from('company')
    .update({ stage: stage as never })
    .eq('id', companyId)

  if (error) {
    // The enforce_stage_gate trigger raises the reason; surface it verbatim.
    return { ok: false, error: error.message }
  }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.STAGE_CHANGED,
    objectType: 'company',
    objectId: companyId,
    detail: `Stage → ${stage}`,
  })

  revalidatePath(`/companies/${companyId}`)
  revalidatePath('/companies')
  return { ok: true, companyId }
}
