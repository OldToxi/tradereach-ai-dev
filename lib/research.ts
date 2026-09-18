/**
 * lib/research.ts — pure helpers for the AI research pack (T5.1-T5.6).
 *
 * No Supabase, no cookies, no React, no Anthropic SDK: plain functions so the rules
 * they encode (fit-score bar bands, which breakdown criterion maps to which
 * qualification fact, who ranks where) can be unit-tested without a request, a
 * database or an AI call.
 */
import type { ResearchOutput } from './ai/prompts/research'

export type BreakdownItem = ResearchOutput['breakdown'][number]
export type Gap = ResearchOutput['gaps'][number]

/** Bar colour band for a breakdown row, matching the mock's `b[2]/b[1]` thresholds. */
export function breakdownBarClass(awarded: number, max: number): 'hi' | 'mid' | 'lo' {
  if (max <= 0) return 'lo'
  const ratio = awarded / max
  if (ratio >= 0.8) return 'hi'
  if (ratio >= 0.5) return 'mid'
  return 'lo'
}

/**
 * The research prompt's scoring criteria are fixed phrases (see the SCORING section
 * of lib/ai/prompts/research.ts's system prompt), but the schema leaves `criterion`
 * as free text. This maps a returned criterion string to the canonical qualification
 * fact key it corresponds to, so a positive finding can populate the Qualification
 * tab instead of leaving it empty until a person re-types the same research by hand.
 *
 * "Market priority" has no company-level fact to populate — it describes the market,
 * not this company — so it is deliberately left unmapped. "Payment history / credit
 * signal" (the sixth canonical criterion) is not one of the prompt's five scored
 * criteria either; it stays a gap until a person or a later phase researches it.
 */
const CRITERION_KEY_PATTERNS: Array<[RegExp, string]> = [
  [/import/i, 'imports_category'],
  [/south asia|bangladesh/i, 'buys_south_asia'],
  [/volume|capacity/i, 'volume_fit'],
  [/certif/i, 'certification_match'],
  [/decision[- ]maker/i, 'decision_maker_found'],
]

export function criterionKeyFor(criterionText: string): string | null {
  for (const [re, key] of CRITERION_KEY_PATTERNS) {
    if (re.test(criterionText)) return key
  }
  return null
}

/**
 * Which breakdown rows are worth writing as an `ai`-provenance qualification fact.
 * Zero awarded points means the model found no evidence — nothing to state — so
 * those stay silent and the gap (if any) carries the explanation instead.
 */
export function factsFromBreakdown(
  breakdown: BreakdownItem[],
): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = []
  for (const b of breakdown) {
    const key = criterionKeyFor(b.criterion)
    if (!key) continue
    if (b.awarded <= 0) continue
    out.push({ key, value: b.reason })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Prioritisation (T5.5)                                               */
/* ------------------------------------------------------------------ */

export interface RankableCompany {
  id: string
  fitScore: number | null
  stage: string
}

/** A company only enters the ranking once it has a score and is still live. */
export function isRankable(c: RankableCompany): boolean {
  return c.fitScore != null && !['disqualified', 'no_contact', 'closed'].includes(c.stage)
}

export interface RankResult {
  rank: number
  total: number
}

/**
 * Deterministic rank among rankable companies: fit score descending, ties broken by
 * id so the order never changes between renders. Mirrors the mock's "#3 of 41" —
 * market priority, buying season and recency are already baked into the fit score
 * itself via the research prompt's weights, so re-deriving them here would double
 * count them.
 */
export function computeRank(companies: RankableCompany[], companyId: string): RankResult | null {
  const rankable = companies.filter(isRankable)
  const sorted = [...rankable].sort((a, b) => {
    if (b.fitScore! !== a.fitScore!) return b.fitScore! - a.fitScore!
    return a.id.localeCompare(b.id)
  })
  const idx = sorted.findIndex((c) => c.id === companyId)
  if (idx === -1) return null
  return { rank: idx + 1, total: sorted.length }
}

/** What the Priority card shows: an override always wins over the computed rank. */
export function displayRank(
  computed: RankResult | null,
  override: number | null,
): { rank: number; total: number; isOverride: boolean } | null {
  if (override != null && computed) return { rank: override, total: computed.total, isOverride: true }
  if (override != null && !computed) return { rank: override, total: override, isOverride: true }
  if (!computed) return null
  return { rank: computed.rank, total: computed.total, isOverride: false }
}

/* ------------------------------------------------------------------ */
/* Recommendation → stage mapping (T5.4)                               */
/* ------------------------------------------------------------------ */

export const RECOMMENDATION_LABELS: Record<ResearchOutput['suitability']['recommendation'], string> = {
  proceed: 'Proceed',
  research_more: 'Research more',
  nurture: 'Nurture',
  disqualify: 'Disqualify',
}

/* ------------------------------------------------------------------ */
/* Plain constants shared by the modal and the server action.          */
/*                                                                      */
/* Kept out of lib/research-actions.ts on purpose: a 'use server' file  */
/* may only export async functions — a non-function export there is a  */
/* build error (see WORKLOG.md T5.3-T5.6 surprises).                    */
/* ------------------------------------------------------------------ */

export const RESEARCH_DEPTHS = {
  standard: 'Standard — site, registry, trade flows',
  deep: 'Deep — plus news, LinkedIn signals, competitor supply',
  refresh: 'Refresh — re-check changed fields only',
} as const
export type ResearchDepth = keyof typeof RESEARCH_DEPTHS

export const DISQUALIFY_REASONS = [
  'Wrong product category',
  'Too small for our minimum run',
  'Already supplied by a group company',
  'Failed screening',
  'No decision-maker reachable',
  'Asked not to be contacted',
  'Other',
] as const
