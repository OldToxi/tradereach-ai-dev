/**
 * lib/ai/triage-runner.ts — runs the triage prompt and writes its output (T9.3).
 *
 * Lives alongside lib/ai/draft-runner.ts. The classification is AI output, so the
 * result is written through the service role the same way ai_run/research_run and
 * the AI draft runner do — not through the requesting user's own client. A human's
 * later reclassify (corrected_category) goes through lib/reply-actions.ts on the
 * user's own client.
 *
 * One call, two of the brief's AI capabilities: classifying the reply and
 * recommending the next action. The schema (prompts/triage.ts) forces the model to
 * separate what the export desk may answer from what a Commercial Authority must.
 */
import { admin } from '../supabase/admin'
import { runPrompt } from './client'
import { triagePrompt, triageUserMessage, type TriageOutput } from './prompts/triage'
import { writeAudit, AUDIT } from '../audit'

export class TriageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TriageError'
  }
}

export interface TriageResult {
  replyId: string
  category: string
  nextAction: string
  suggestedStage: string
}

export async function triageReply(
  replyId: string,
  actor: { id: string; fullName: string },
): Promise<TriageResult> {
  const { data: reply } = await admin
    .from('reply')
    .select('id, body, company_id, contact_id, message_id')
    .eq('id', replyId)
    .single()
  if (!reply) throw new TriageError('Reply not found.')

  const [{ data: company }, { data: contact }, { data: message }] = await Promise.all([
    admin.from('company').select('name, stage').eq('id', reply.company_id).single(),
    reply.contact_id
      ? admin.from('contact').select('full_name').eq('id', reply.contact_id).maybeSingle()
      : Promise.resolve({ data: null }),
    reply.message_id
      ? admin.from('message').select('human_body, ai_body').eq('id', reply.message_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const userMessage = triageUserMessage({
    companyName: company?.name ?? 'Unknown company',
    contactName: contact?.full_name ?? 'Unknown contact',
    ourLastMessage: message ? (message.human_body ?? message.ai_body) : '',
    replyBody: reply.body,
    currentStage: company?.stage ?? 'reply',
  })

  const result = await runPrompt<TriageOutput>(triagePrompt, userMessage, { companyId: reply.company_id })
  const t = result.data

  const { error } = await admin
    .from('reply')
    .update({
      category: t.category,
      intent: t.intent,
      intent_note: t.intentNote,
      urgency: t.urgency,
      confidence: t.confidence,
      reasoning: t.reasoning,
      answerable: t.answerable,
      reserved: t.reserved,
      next_action: t.nextAction.action,
      next_action_reasoning: t.nextAction.reasoning,
      next_action_owner: t.nextAction.owner,
      revisit_on: t.nextAction.revisitOn ?? null,
      suggested_stage: t.suggestedStage,
      ai_run_id: result.aiRunId,
    })
    .eq('id', reply.id)
  if (error) throw new TriageError(error.message)

  await writeAudit({
    // The classification is the model's act, not the human's — see auditAsModel().
    actorLabel: 'AI (classify-tier)',
    event: AUDIT.AI_TRIAGE,
    objectType: 'reply',
    objectId: reply.id,
    detail: `${t.category} · confidence ${t.confidence.toFixed(2)} · next action ${t.nextAction.action}`,
  })

  return {
    replyId: reply.id,
    category: t.category,
    nextAction: t.nextAction.action,
    suggestedStage: t.suggestedStage,
  }
}
