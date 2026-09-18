/**
 * lib/ai/prompts/triage.ts — reply classification and next action.
 *
 * One call, two of the brief's AI capabilities: classifying incoming replies and
 * recommending the next action.
 *
 * The case this prompt is built around is the split reply — a buyer asks one thing
 * we can answer today and one thing only a Commercial Authority may answer. Handling
 * that correctly is the most convincing moment in the demo, so the schema forces the
 * model to separate the two rather than produce one blended response.
 */
import { z } from 'zod'
import type { PromptSpec } from '../client'

export const CATEGORIES = [
  'buying_interest',
  'information_request',
  'pricing_request',
  'not_now',
  'wrong_person',
  'not_interested',
  'unsubscribe',
  'auto_reply',
] as const

export const triageSchema = z.object({
  category: z.enum(CATEGORIES),
  intent: z.enum(['positive', 'neutral', 'negative', 'none']),
  intentNote: z.string(),
  urgency: z.enum(['same_day', 'within_24h', 'within_week', 'none']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(20),

  /** What we can answer ourselves, today. */
  answerable: z.array(z.string()),
  /** What must go to a Commercial Authority. Empty when nothing is reserved. */
  reserved: z.array(
    z.object({
      matter: z.string(),
      theirWords: z.string(),
    }),
  ),

  nextAction: z.object({
    action: z.enum([
      'draft_reply',
      'escalate_commercial',
      'book_meeting',
      'nurture',
      'no_further_contact',
      'find_new_contact',
      'no_action',
    ]),
    reasoning: z.string(),
    /** Role that must carry it out. */
    owner: z.enum(['executive', 'manager', 'commercial']),
    /** ISO date, or null. For not_now replies, take the date from their message. */
    revisitOn: z.string().nullable(),
  }),

  suggestedStage: z.enum([
    'reply',
    'meeting',
    'commercial_discussion',
    'nurture',
    'disqualified',
    'no_contact',
  ]),
})

export type TriageOutput = z.infer<typeof triageSchema>

export const triagePrompt: PromptSpec<TriageOutput> = {
  name: 'triage',
  version: 'v1',
  tier: 'classify',
  maxTokens: 1500,
  temperature: 0,
  schema: triageSchema,
  system: `You triage replies to Anwar Group's export outreach. You sort the message, decide
what happens next, and separate what our export desk may answer from what it may not.

CATEGORIES

- buying_interest — wants to proceed, discuss volumes, or start a relationship
- information_request — asks for specification, certification, documents, capability
- pricing_request — asks about price, payment, credit, MOQ, freight, delivery or any
  commercial term. Use this even when the message also asks something technical
- not_now — interested in principle, wrong timing. Capture the date they give
- wrong_person — redirects us elsewhere, internally or externally
- not_interested — a clear no
- unsubscribe — asks us to stop writing. Treat any such request as absolute
- auto_reply — out of office, unmonitored mailbox, delivery notice. Not a human reply

THE SPLIT — read carefully

Buyers routinely ask two things in one message. Put every request they made into exactly
one of two lists:

- answerable: things our export desk can answer from published capability — specification,
  counts and sizes, certifications we hold, capacity, port, lead time as a general
  capability, company background
- reserved: price, payment terms, credit, MOQ, freight cost, a delivery date promised to
  them, samples, exclusivity, distributor appointment, warranty, compliance certification
  for their market, discounts, contract length

Quote their own words in 'theirWords' so a person can see what was matched.

When reserved is non-empty, the category is pricing_request and nextAction.action is
escalate_commercial with owner "commercial" — even if the answerable list is longer. The
technical half is still drafted, but the commercial half decides the routing.

NEXT ACTION

Pick the one action that moves this forward. Prefer the smallest useful step.
- A reply asking for documents → draft_reply, owner executive
- Anything reserved → escalate_commercial, owner commercial
- Explicit interest in talking → book_meeting, owner manager
- not_now → nurture, with revisitOn set from the date they named
- unsubscribe or a firm no with hostility → no_further_contact
- auto_reply naming a better address → find_new_contact
- auto_reply with nothing useful → no_action

CONFIDENCE

Be honest. Below 0.6 means a person should read it themselves; say so in reasoning. A
confident wrong classification is worse than an uncertain right one.

OUTPUT

Return JSON only, matching the schema.`,
}

export function triageUserMessage(args: {
  companyName: string
  contactName: string
  ourLastMessage: string
  replyBody: string
  currentStage: string
}) {
  return `COMPANY: ${args.companyName}
FROM: ${args.contactName}
CURRENT STAGE: ${args.currentStage}

WHAT WE SENT:
${args.ourLastMessage}

THEIR REPLY:
${args.replyBody}

Triage this reply.`
}
