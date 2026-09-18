import { describe, it, expect } from 'vitest'
import {
  SCORING_CRITERIA,
  DEFAULT_WEIGHTS,
  MAX_WEIGHT,
  weightsFromRows,
  weightsAreValid,
  criterionKeyForScoring,
  recalcScore,
  distributeBreakdown,
} from '../lib/scoring'

describe('weightsAreValid', () => {
  it('accepts the defaults', () => {
    expect(weightsAreValid(DEFAULT_WEIGHTS)).toBe(true)
  })

  it('rejects weights that do not sum to 100', () => {
    expect(weightsAreValid({ ...DEFAULT_WEIGHTS, market_priority: 11 })).toBe(false)
  })

  it('rejects fractional and negative weights', () => {
    expect(weightsAreValid({ ...DEFAULT_WEIGHTS, volume_fit: 14.5 })).toBe(false)
    expect(weightsAreValid({ ...DEFAULT_WEIGHTS, imports_category: -1 })).toBe(false)
  })

  it('rejects any weight above the slider ceiling', () => {
    expect(weightsAreValid({ ...DEFAULT_WEIGHTS, imports_category: MAX_WEIGHT + 1 })).toBe(false)
  })
})

describe('weightsFromRows', () => {
  it('merges stored rows over the defaults', () => {
    const weights = weightsFromRows([
      { criterion_key: 'imports_category', weight: 25 },
      { criterion_key: 'market_priority', weight: 15 },
    ])
    expect(weights.imports_category).toBe(25)
    expect(weights.market_priority).toBe(15)
    expect(weights.volume_fit).toBe(DEFAULT_WEIGHTS.volume_fit)
  })

  it('ignores unknown criterion keys', () => {
    const weights = weightsFromRows([{ criterion_key: 'nonsense', weight: 99 }])
    expect(weights).toEqual(DEFAULT_WEIGHTS)
  })
})

describe('criterionKeyForScoring', () => {
  it('maps each canonical label to its key', () => {
    for (const c of SCORING_CRITERIA) {
      expect(criterionKeyForScoring(c.label, 0)).toBe(c.key)
    }
  })

  it('falls back to the index when the text is unrecognised', () => {
    expect(criterionKeyForScoring('something else entirely', 2)).toBe('volume_fit')
  })
})

describe('recalcScore and distributeBreakdown', () => {
  it('round-trips every band boundary', () => {
    for (const score of [0, 39, 58, 79, 91, 100]) {
      const breakdown = distributeBreakdown(score, DEFAULT_WEIGHTS)
      expect(breakdown).toHaveLength(SCORING_CRITERIA.length)
      expect(breakdown.reduce((sum, r) => sum + r.awarded, 0)).toBe(score)
      expect(recalcScore(breakdown, DEFAULT_WEIGHTS)).toBe(score)
    }
  })

  it('re-scores a stored breakdown under new weights', () => {
    const breakdown = SCORING_CRITERIA.map((c) => ({
      criterion: c.label,
      max: DEFAULT_WEIGHTS[c.key],
      awarded: 0,
      reason: 'test',
    }))
    breakdown[0].awarded = DEFAULT_WEIGHTS.imports_category

    expect(recalcScore(breakdown, DEFAULT_WEIGHTS)).toBe(DEFAULT_WEIGHTS.imports_category)

    const reweighted = { ...DEFAULT_WEIGHTS, imports_category: 10 }
    expect(recalcScore(breakdown, reweighted)).toBe(10)
  })

  it('ignores zero-max rows and clamps to the 0–100 range', () => {
    const breakdown = [
      { criterion: 'Imports this product category already', max: 0, awarded: 40, reason: 'n/a' },
      { criterion: 'Volume fits our monthly capacity', max: 10, awarded: 100, reason: 'n/a' },
    ]
    const score = recalcScore(breakdown, DEFAULT_WEIGHTS)
    expect(score).toBe(100)
  })
})
