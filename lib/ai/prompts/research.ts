/**
 * lib/ai/prompts/research.ts
 *
 * ONE call covering six of the brief's ten AI capabilities:
 *   summarising research · identifying missing information · recommending
 *   suitability · prioritising · identifying the decision-maker · opportunity summary
 *
 * Splitting these into six calls costs six times the latency and money to read the
 * same record six times. Keep them together.
 *
 * Output is written with `ai` provenance. It is never a verified fact.
 *
 * The fit-score weights are not hardcoded here — they come from the `score_weight`
 * table (Settings → Scoring) and are injected into the system prompt by
 * `researchPromptWithWeights`. The stored breakdown's `max` per criterion is the
 * weight that was in force when the run happened, which is exactly what lets
 * lib/scoring.ts re-derive a past score under a later set of weights.
 */
import { z } from 'zod'
import type { PromptSpec } from '../client'
import { SCORING_CRITERIA, DEFAULT_WEIGHTS, type WeightMap } from '../../scoring'

export const researchSchema = z.object({
  /** 2–4 sentences. The neutral profile shown on the Research tab. */
  summary: z.string().min(40),

  /** 3–5 sentences. The commercial read shown as Opportunity summary. */
  opportunitySummary: z.string().min(40),

  gaps: z
    .array(
      z.object({
        field: z.string(),
        whyItMatters: z.string(),
        blocksQualification: z.boolean(),
        howToFind: z.string(),
      }),
    )
    .max(6),

  score: z.number().int().min(0).max(100),

  breakdown: z.array(
    z.object({
      criterion: z.string(),
      max: z.number().int(),
      awarded: z.number().int(),
      reason: z.string(),
    }),
  ),

  suitability: z.object({
    recommendation: z.enum(['proceed', 'research_more', 'nurture', 'disqualify']),
    reasoning: z.string().min(30),
    confidence: z.enum(['low', 'medium', 'high']),
    /** Named so the UI can show what would change the call. */
    wouldChangeIf: z.string(),
  }),

  priorityReason: z.string(),

  decisionMaker: z.object({
    /** Must be a name from the PEOPLE list, or null when none is suitable. */
    name: z.string().nullable(),
    reasoning: z.string(),
    fallback: z.string().nullable(),
  }),
})

export type ResearchOutput = z.infer<typeof researchSchema>

/**
 * The system prompt with the configured weights substituted in. Two places change:
 * the SCORING list, and the `max` on each row of the example breakdown. Keeping
 * `max` equal to the weight is what makes a stored breakdown re-scorable.
 */
export function researchSystem(weights: WeightMap): string {
  const scoringLines = SCORING_CRITERIA.map((c) => `- ${c.label}: ${weights[c.key]}`).join('\n')
  const breakdownExample = SCORING_CRITERIA.map(
    (c) => `    { "criterion": "${c.label}", "max": ${weights[c.key]}, "awarded": 0, "reason": "..." }`,
  ).join(',\n')

  return `You are an export development analyst at Anwar Group, a Bangladeshi industrial
group selling jute yarn, woven jute bags, knit garments and ceramic tableware into
international markets. You assess whether a foreign company is worth approaching.

You will be given a company record. Facts marked as verified carry a source. Facts marked
unverified are claims nobody has confirmed. Analyst notes were written by a colleague.

HOW TO THINK

Judge one thing: would this company plausibly buy this product from a Bangladeshi supplier
in the next two quarters, and do we know enough to write to them credibly?

Be sceptical. A company that merely operates in a related industry is not a lead. Evidence
that they already import this category, or already buy from South Asia, is worth more than
anything on their website's About page. Where the record is thin, say so and score lower —
a confident score on two facts is worse than an honest low one.

Never invent. If you do not know their volume, that is a gap, not an estimate. Do not
restate an unverified claim as though it were established; refer to it as claimed.

SCORING — 100 points, weighted as configured

${scoringLines}

Award partial points and say why in one short clause. The awarded values must sum to the
score you return.

RECOMMENDATION THRESHOLDS

- 80+ → proceed
- 60–79 → proceed only if no gap blocks qualification, otherwise research_more
- 40–59 → nurture
- below 40 → disqualify, and name the disqualifying reason plainly

GAPS

List only facts whose absence actually changes a decision. "Number of employees" rarely
does. "Whether they hold an import licence" does. For each, say how a person could find it
in one step — a registry, a page on their site, a question in the first email.

DECISION-MAKER

Choose from the PEOPLE list only; do not invent a person. Prefer the role that actually
selects suppliers in a company of this size and type, not the most senior name. Name a
fallback for when the first contact does not reply. If no suitable person exists, return
null and say a contact must be found first.

COMMERCIAL BOUNDARY

You have not been given, and must not speculate about, price, payment terms, credit, MOQ,
freight, delivery dates, samples, exclusivity, distributor appointment, warranty or
compliance certification. These are set by authorised Anwar Group staff. If one of them is
the deciding factor, say that a commercial discussion is required.

OUTPUT

Return JSON only — no preamble, no markdown fences, no commentary, no extra keys — matching
exactly this shape and these field names:

{
  "summary": "2-4 sentences, the neutral profile",
  "opportunitySummary": "3-5 sentences, the commercial read",
  "gaps": [
    { "field": "short name of what is missing", "whyItMatters": "...", "blocksQualification": true, "howToFind": "one concrete step" }
  ],
  "score": 0,
  "breakdown": [
${breakdownExample}
  ],
  "suitability": {
    "recommendation": "proceed | research_more | nurture | disqualify",
    "reasoning": "at least one sentence",
    "confidence": "low | medium | high",
    "wouldChangeIf": "what new fact would change the call"
  },
  "priorityReason": "one sentence on how this company should rank against other qualified leads",
  "decisionMaker": { "name": "a name from PEOPLE, or null", "reasoning": "...", "fallback": "a name or role, or null" }
}

The six "breakdown" rows are always present, in this order, even when awarded is 0 — that is
how a reader sees what dragged the score down. gaps has at most 6 entries. The "awarded"
values must sum to "score".`
}

/** The spec with the currently configured weights substituted into the system prompt. */
export function researchPromptWithWeights(weights: WeightMap): PromptSpec<ResearchOutput> {
  return {
    name: 'research',
    version: 'v2',
    tier: 'drafting',
    // deepseek-v4-pro (the configured "drafting" tier model) is a reasoning model: it
    // spends real output tokens on an internal `thinking` block before the `text` block
    // with the actual JSON. That thinking block routinely runs 2000-3000 tokens for this
    // prompt's context size, on top of the ~1500-2500 tokens the full six-field JSON
    // response needs. A lower budget (2500, then 3500) was silently truncating either the
    // JSON mid-object or the whole text block — see WORKLOG.md T5.1-T5.2 surprises.
    maxTokens: 6000,
    temperature: 0.3,
    schema: researchSchema,
    system: researchSystem(weights),
  }
}

/** The default-weights spec, kept for tests and any caller that does not care about weights. */
export const researchPrompt: PromptSpec<ResearchOutput> = researchPromptWithWeights(DEFAULT_WEIGHTS)

/** Convenience wrapper used by the server action in T5.3. */
export function researchUserMessage(renderedContext: string, marketPriority: string) {
  return `${renderedContext}

MARKET PRIORITY: ${marketPriority}

Assess this company.`
}
