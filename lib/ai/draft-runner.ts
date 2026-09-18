/**
 * lib/ai/draft-runner.ts — generates first-touch and follow-up drafts (T7.1, T7.7).
 *
 * Lives alongside lib/ai/client.ts and lib/ai/context.ts — the two files
 * lib/supabase/admin.ts's header already names as deliberate exceptions to its
 * three-caller rule. A message row that starts life as AI output is written the
 * same way ai_run/research_run are: through the service role, not the requesting
 * user's own client. A human's later approve/release/reject actions go through
 * lib/message-actions.ts on the user's own client, like every other human-initiated
 * write in this codebase.
 */
import { admin } from '../supabase/admin'
import { runPrompt, runRaw } from './client'
import { buildCompanyContext, buildProductContext, renderContext } from './context'
import { draftPrompt, draftUserMessage } from './prompts/draft'
import { followupPrompt, followupUserMessage } from './prompts/followup'
import { checkDraft, type ReservedMatterEntry } from '../guardrails'
import { activeMatterEntries, type ReservedMatterRow } from '../guardrails-config'
import { writeAudit, AUDIT } from '../audit'
import { ROLE_LABELS } from '../nav'
import { nextTouchNumber } from '../messages'
import type { Role } from '../session'

export interface DraftActor {
  id: string
  fullName: string
  role: Role
}

export class DraftError extends Error {}

async function guardrailCheck(body: string) {
  // The configured matter list (Settings → Commercial guardrails) feeds the
  // meaning-based model pass; built-ins remain the deterministic authority. A
  // read failure must not skip the check — checkDraft's built-in default keeps
  // the canonical matters covered, so we fall back to no custom list.
  let active: ReservedMatterEntry[] | undefined
  try {
    const { data } = await admin
      .from('reserved_matter')
      .select('key, label, is_builtin, active, sort_order')
    active = activeMatterEntries((data ?? []) as ReservedMatterRow[])
  } catch {
    active = undefined
  }
  return checkDraft(body, (system, user) => runRaw(system, user, 'classify'), active)
}

async function primaryContact(companyId: string) {
  const { data } = await admin
    .from('contact')
    .select('id, full_name, role_title, email, provenance')
    .eq('company_id', companyId)
    .eq('is_primary', true)
    .maybeSingle()
  return data
}

async function writeHoldAuditIfNeeded(messageId: string, guardrailClear: boolean, matter: string | null) {
  if (guardrailClear) return
  await writeAudit({
    actorLabel: 'System',
    event: AUDIT.COMMERCIAL_HELD,
    objectType: 'message',
    objectId: messageId,
    detail: `Reserved matter detected: ${matter}`,
  })
}

/* ------------------------------------------------------------------ */
/* T7.1 — first-touch                                                  */
/* ------------------------------------------------------------------ */

export async function generateFirstTouch(companyId: string, actor: DraftActor): Promise<{ messageId: string }> {
  const { data: company } = await admin
    .from('company')
    .select('id, name, market, product_id')
    .eq('id', companyId)
    .single()
  if (!company) throw new DraftError('Company not found.')

  const contact = await primaryContact(companyId)
  if (
    !contact ||
    !contact.email ||
    !(contact.provenance === 'verified' || contact.provenance === 'human_approved')
  ) {
    throw new DraftError('Add a verified decision-maker before drafting outreach.')
  }

  const { data: existing } = await admin
    .from('message')
    .select('id')
    .eq('company_id', companyId)
    .eq('kind', 'first_touch')
    .limit(1)
  if (existing && existing.length > 0) {
    throw new DraftError('A first-touch message already exists for this company.')
  }

  const context = await buildCompanyContext(companyId)
  if (context.facts.length === 0) {
    // Not just a token-budget concern (see draft.ts's maxTokens comment) — an empty
    // VERIFIED FACTS section means there is nothing for the EVIDENCE RULE to let the
    // model say about this company at all. Drafting from nothing isn't personalised
    // outreach, it's a form letter with the mail-merge field left blank.
    throw new DraftError('Run AI research or verify at least one fact before drafting outreach — there is nothing to personalise the message with yet.')
  }

  const { data: latestRun } = await admin
    .from('research_run')
    .select('opportunity_summary')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const product = company.product_id ? await buildProductContext(company.product_id) : undefined
  const rendered = renderContext(context, product)
  const angle =
    latestRun?.opportunity_summary ??
    `General fit for ${product?.name ?? 'our product'}, based on their verified company facts.`

  const userMessage = draftUserMessage({
    context: rendered,
    contactName: contact.full_name,
    contactRole: contact.role_title ?? '',
    senderName: actor.fullName,
    senderTitle: ROLE_LABELS[actor.role],
    angle,
  })

  const result = await runPrompt(draftPrompt, userMessage, { companyId })
  const guardrail = await guardrailCheck(result.data.body)

  const { data: msg, error } = await admin
    .from('message')
    .insert({
      company_id: companyId,
      contact_id: contact.id,
      kind: 'first_touch',
      touch_number: 1,
      subject: result.data.subject,
      ai_body: result.data.body,
      why: result.data.why,
      claims_used: result.data.claimsUsed,
      status: guardrail.clear ? 'awaiting_approval' : 'held_commercial',
      reserved_matter: guardrail.primaryMatter,
      ai_run_id: result.aiRunId,
    })
    .select('id')
    .single()
  if (error || !msg) throw new DraftError(error?.message ?? 'Could not save the draft.')

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.AI_DRAFT,
    objectType: 'message',
    objectId: msg.id,
    detail: `First-touch draft for ${company.name}${guardrail.clear ? '' : ` — held: ${guardrail.primaryMatter}`}`,
  })
  await writeHoldAuditIfNeeded(msg.id, guardrail.clear, guardrail.primaryMatter)

  return { messageId: msg.id }
}

/* ------------------------------------------------------------------ */
/* T7.7 — follow-ups (touch 2/3), cadence enforced by nextTouchNumber   */
/* ------------------------------------------------------------------ */

export async function generateFollowup(companyId: string, actor: DraftActor): Promise<{ messageId: string }> {
  const { data: company } = await admin
    .from('company')
    .select('id, name, market, product_id')
    .eq('id', companyId)
    .single()
  if (!company) throw new DraftError('Company not found.')

  const { data: history } = await admin
    .from('message')
    .select('id, touch_number, subject, ai_body, human_body, created_at, contact_id')
    .eq('company_id', companyId)
    .in('kind', ['first_touch', 'follow_up'])
    .order('touch_number', { ascending: true })
  if (!history || history.length === 0) throw new DraftError('No first-touch message sent yet.')

  const { data: replies } = await admin.from('reply').select('id').eq('company_id', companyId).limit(1)
  const hasReplied = (replies?.length ?? 0) > 0

  const touch = nextTouchNumber(
    history.map((h) => ({ touchNumber: h.touch_number, createdAt: h.created_at })),
    hasReplied,
  )
  if (!touch) {
    throw new DraftError(
      hasReplied
        ? 'This company has replied — no further follow-up is due.'
        : 'Follow-up cadence is exhausted for this company (three touches sent).',
    )
  }

  const contactId = history[history.length - 1].contact_id
  const contact = contactId
    ? (await admin.from('contact').select('id, full_name, email').eq('id', contactId).maybeSingle()).data
    : await primaryContact(companyId)
  if (!contact?.email) throw new DraftError('No contact on record for this company.')

  const context = await buildCompanyContext(companyId)
  const product = company.product_id ? await buildProductContext(company.product_id) : undefined
  const rendered = renderContext(context, product)

  const previousMessages = history.map((h) => ({
    sentAt: h.created_at,
    subject: h.subject,
    body: h.human_body ?? h.ai_body,
  }))
  const last = history[history.length - 1]
  const daysSinceLast = Math.max(0, Math.round((Date.now() - new Date(last.created_at).getTime()) / 86_400_000))

  const userMessage = followupUserMessage({
    context: rendered,
    touchNumber: touch,
    previousMessages,
    daysSinceLast,
    opens: 0, // no open-tracking exists yet — see WORKLOG.md
  })

  const result = await runPrompt(followupPrompt, userMessage, { companyId })

  if (result.data.recommendStopping) {
    await writeAudit({
      actorId: actor.id,
      actorLabel: actor.fullName,
      event: AUDIT.AI_FOLLOWUP,
      objectType: 'company',
      objectId: companyId,
      detail: 'Model recommended stopping — no follow-up drafted. Consider moving to nurture.',
    })
    throw new DraftError('The model recommends nurture instead of another touch — no draft was created.')
  }

  const guardrail = await guardrailCheck(result.data.body)

  const { data: msg, error } = await admin
    .from('message')
    .insert({
      company_id: companyId,
      contact_id: contact.id,
      kind: 'follow_up',
      touch_number: touch,
      subject: result.data.subject,
      ai_body: result.data.body,
      why: result.data.why,
      claims_used: result.data.claimsUsed,
      status: guardrail.clear ? 'awaiting_approval' : 'held_commercial',
      reserved_matter: guardrail.primaryMatter,
      ai_run_id: result.aiRunId,
    })
    .select('id')
    .single()
  if (error || !msg) throw new DraftError(error?.message ?? 'Could not save the draft.')

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.AI_FOLLOWUP,
    objectType: 'message',
    objectId: msg.id,
    detail: `Touch ${touch} draft for ${company.name}${guardrail.clear ? '' : ` — held: ${guardrail.primaryMatter}`}`,
  })
  await writeHoldAuditIfNeeded(msg.id, guardrail.clear, guardrail.primaryMatter)

  return { messageId: msg.id }
}
