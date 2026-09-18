/**
 * lib/scoring.ts — pure helpers for the fit-score model (T11.3).
 *
 * The fit score is a weighted sum over six criteria. The weights live in the
 * `score_weight` table (editable in Settings → Scoring); this module holds the
 * canonical order, the defaults, and the two directions of the maths:
 *
 *   * `recalcScore`    — apply a new set of weights to a stored breakdown
 *                        (each row's `awarded / max` is the fraction earned under
 *                        the weights that were current when it was scored), so a
 *                        weight change can re-derive every past score without a
 *                        new AI call. Historical breakdowns are never rewritten.
 *   * `distributeBreakdown` — the inverse, used by the seed to build a consistent
 *                        baseline breakdown for a hand-set fit score.
 *
 * No Supabase, no cookies, no React. Criterion keys match the qualification fact
 * keys in lib/research.ts so a scored criterion can populate the Qualification
 * tab (except `market_priority`, which describes the market, not the company).
 */
import type { BreakdownItem } from './research'

export const SCORING_CRITERIA = [
  { key: 'imports_category', label: 'Imports this product category already' },
  { key: 'buys_south_asia', label: 'Buys from Bangladesh or South Asia today' },
  { key: 'volume_fit', label: 'Volume fits our monthly capacity' },
  { key: 'certification_match', label: 'Certification requirements we already meet' },
  { key: 'decision_maker_found', label: 'Named decision-maker identified' },
  { key: 'market_priority', label: 'Market priority' },
] as const

export type CriterionKey = (typeof SCORING_CRITERIA)[number]['key']

export type WeightMap = Record<CriterionKey, number>

export const DEFAULT_WEIGHTS: WeightMap = {
  imports_category: 30,
  buys_south_asia: 20,
  volume_fit: 15,
  certification_match: 15,
  decision_maker_found: 10,
  market_priority: 10,
}

/** The slider ceiling in the mock. A weight above this makes little commercial sense. */
export const MAX_WEIGHT = 40

/**
 * Merge `score_weight` rows into a WeightMap, falling back to the defaults for any
 * criterion the table is missing (e.g. a fresh DB before the seed defaults land).
 */
export function weightsFromRows(rows: Array<{ criterion_key: string; weight: number }>): WeightMap {
  const out: WeightMap = { ...DEFAULT_WEIGHTS }
  for (const row of rows) {
    const key = row.criterion_key as CriterionKey
    if (key in DEFAULT_WEIGHTS) out[key] = row.weight
  }
  return out
}

/** True only when every criterion has a non-negative integer and the six sum to 100. */
export function weightsAreValid(weights: WeightMap): boolean {
  return (
    SCORING_CRITERIA.every((c) => {
      const w = weights[c.key]
      return Number.isInteger(w) && w >= 0 && w <= MAX_WEIGHT
    }) && SCORING_CRITERIA.reduce((sum, c) => sum + weights[c.key], 0) === 100
  )
}

const KEY_PATTERNS: Array<[RegExp, CriterionKey]> = [
  [/import/i, 'imports_category'],
  [/south asia|bangladesh/i, 'buys_south_asia'],
  [/volume|capacity/i, 'volume_fit'],
  [/certif/i, 'certification_match'],
  [/decision[- ]maker/i, 'decision_maker_found'],
  [/market priority/i, 'market_priority'],
]

/**
 * Map a breakdown row's `criterion` text back to its key. The research prompt
 * guarantees the six rows in a fixed order, so a text match is preferred and the
 * index is the fallback for a model that rephrased or reordered them.
 */
export function criterionKeyForScoring(criterionText: string, index: number): CriterionKey {
  for (const [re, key] of KEY_PATTERNS) {
    if (re.test(criterionText)) return key
  }
  const i = Math.max(0, Math.min(index, SCORING_CRITERIA.length - 1))
  return SCORING_CRITERIA[i].key
}

/**
 * Re-derive the fit score from a stored breakdown under a new set of weights.
 * `awarded / max` is the fraction the model credited each criterion under the
 * weights in force at the time, so scaling that fraction by the new weight is
 * the only way to re-score a past run without calling the model again.
 */
export function recalcScore(breakdown: BreakdownItem[], weights: WeightMap): number {
  let total = 0
  breakdown.forEach((item, index) => {
    const key = criterionKeyForScoring(item.criterion, index)
    const weight = weights[key] ?? 0
    if (item.max > 0) total += (weight * item.awarded) / item.max
  })
  return Math.max(0, Math.min(100, Math.round(total)))
}

/**
 * Build a six-row breakdown whose `awarded` values sum to `score` and whose
 * `max` values are the given weights, distributing the score across criteria in
 * proportion to their weights (largest fractional remainder wins the rounding).
 * The seed uses this so a hand-set fit score has a self-consistent breakdown to
 * recalculate against.
 */
export function distributeBreakdown(
  score: number,
  weights: WeightMap,
): BreakdownItem[] {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const shares = SCORING_CRITERIA.map((c) => (weights[c.key] * clamped) / 100)
  const awarded = shares.map((s) => Math.floor(s))
  let remainder = clamped - awarded.reduce((a, b) => a + b, 0)

  const order = shares
    .map((share, i) => ({ frac: share - awarded[i], i }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let n = 0; n < remainder; n++) awarded[order[n % order.length].i]++

  return SCORING_CRITERIA.map((c, i) => ({
    criterion: c.label,
    max: weights[c.key],
    awarded: awarded[i],
    reason: 'Seeded baseline research',
  }))
}
