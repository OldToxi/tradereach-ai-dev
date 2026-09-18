/**
 * lib/ai/prompts/followup.ts — touches 2 and 3.
 *
 * Cadence: touch 2 at +4 working days, touch 3 at +11, then the lead rests in
 * nurture. Follow-ups stop the moment any reply arrives — that is enforced in the
 * cadence query, not here.
 *
 * The failure mode this prompt exists to prevent is the follow-up that says
 * "just bumping this to the top of your inbox", which is a message about the
 * sender's needs, not the reader's.
 */
import { z } from 'zod'
import type { PromptSpec } from '../client'

export const followupSchema = z.object({
  subject: z.string().min(5).max(90),
  body: z.string().min(40),
  /** What new thing this touch brings that touch 1 did not. */
  newAngle: z.string(),
  why: z.array(z.string()).min(2).max(4),
  claimsUsed: z.array(z.object({ claim: z.string(), fromFact: z.string() })),
  wordCount: z.number().int(),
  /** True when the model judges a further touch would be counterproductive. */
  recommendStopping: z.boolean(),
})

export type FollowupOutput = z.infer<typeof followupSchema>

export const followupPrompt: PromptSpec<FollowupOutput> = {
  name: 'followup',
  version: 'v1',
  tier: 'drafting',
  maxTokens: 1200,
  temperature: 0.5,
  schema: followupSchema,
  system: `You write follow-up emails for Anwar Group's export desk. The reader received an
earlier email from us and did not reply.

THE RULE THAT MATTERS

A follow-up must carry something the first email did not. A new fact, a different angle on
their business, a shorter and sharper question. If you have nothing new, say so by setting
recommendStopping to true rather than writing a message that only asks again.

Never write: "just following up", "bumping this", "did you see my last email", "I wanted to
circle back", or any sentence about your own persistence. The reader does not owe you a
reply and reminding them of that costs goodwill.

Reply in the same thread, so do not reintroduce Anwar Group at length. One clause of
context is enough.

LENGTH BY TOUCH

- Touch 2: under 90 words. One new angle, one question.
- Touch 3: under 50 words. Close warmly, leave the door open, name a time to revisit. This
  is the last message; make it easy to say "come back in March" rather than nothing.

EVIDENCE AND COMMERCIAL RULES

Identical to first contact. Only verified facts and published product capability. No price,
payment terms, credit, MOQ, freight, delivery date, samples, exclusivity, distributor
appointment, warranty or compliance claims — including softened or conditional forms.

OUTPUT

Return JSON only, matching the schema. Plain text body.`,
}

export function followupUserMessage(args: {
  context: string
  touchNumber: 2 | 3
  previousMessages: Array<{ sentAt: string; subject: string; body: string }>
  daysSinceLast: number
  opens: number
}) {
  const history = args.previousMessages
    .map((m) => `--- sent ${m.sentAt} | subject: ${m.subject}\n${m.body}`)
    .join('\n\n')

  return `${args.context}

WHAT WE ALREADY SENT:
${history}

THIS IS TOUCH ${args.touchNumber}. ${args.daysSinceLast} days since the last message.
They opened it ${args.opens} time(s) and did not reply.

Write the follow-up.`
}
