import { describe, it, expect } from 'vitest'
import {
  breakdownBarClass,
  criterionKeyFor,
  factsFromBreakdown,
  isRankable,
  computeRank,
  displayRank,
} from '../lib/research'

describe('breakdownBarClass', () => {
  it('bands by the awarded/max ratio, matching the mock thresholds', () => {
    expect(breakdownBarClass(30, 30)).toBe('hi')
    expect(breakdownBarClass(24, 30)).toBe('hi')
    expect(breakdownBarClass(15, 30)).toBe('mid')
    expect(breakdownBarClass(5, 30)).toBe('lo')
    expect(breakdownBarClass(0, 30)).toBe('lo')
  })

  it('treats a zero-max criterion as low rather than dividing by zero', () => {
    expect(breakdownBarClass(0, 0)).toBe('lo')
  })
})

describe('criterionKeyFor', () => {
  it('maps the research prompt\'s fixed criterion phrasing to canonical fact keys', () => {
    expect(criterionKeyFor('Imports this product category already')).toBe('imports_category')
    expect(criterionKeyFor('Buys from Bangladesh or South Asia today')).toBe('buys_south_asia')
    expect(criterionKeyFor('Volume fits our monthly capacity')).toBe('volume_fit')
    expect(criterionKeyFor('Certification requirements we already meet')).toBe('certification_match')
    expect(criterionKeyFor('A named decision-maker has been identified')).toBe('decision_maker_found')
  })

  it('leaves market priority unmapped — it describes the market, not the company', () => {
    expect(criterionKeyFor('Market priority')).toBeNull()
  })

  it('returns null for anything unrecognised', () => {
    expect(criterionKeyFor('Something else entirely')).toBeNull()
  })
})

describe('factsFromBreakdown', () => {
  it('only writes a fact for criteria the model actually found evidence for', () => {
    const facts = factsFromBreakdown([
      { criterion: 'Imports this product category already', max: 30, awarded: 30, reason: 'Confirmed importer' },
      { criterion: 'Buys from Bangladesh or South Asia today', max: 20, awarded: 0, reason: 'No evidence found' },
      { criterion: 'Market priority', max: 10, awarded: 10, reason: 'High-priority market' },
    ])
    expect(facts).toEqual([{ key: 'imports_category', value: 'Confirmed importer' }])
  })
})

describe('isRankable', () => {
  it('requires a score and excludes closed-out stages', () => {
    expect(isRankable({ id: 'a', fitScore: 70, stage: 'qualification' })).toBe(true)
    expect(isRankable({ id: 'b', fitScore: null, stage: 'qualification' })).toBe(false)
    expect(isRankable({ id: 'c', fitScore: 20, stage: 'disqualified' })).toBe(false)
    expect(isRankable({ id: 'd', fitScore: 20, stage: 'no_contact' })).toBe(false)
    expect(isRankable({ id: 'e', fitScore: 20, stage: 'closed' })).toBe(false)
  })
})

describe('computeRank', () => {
  const companies = [
    { id: 'a', fitScore: 91, stage: 'commercial_discussion' },
    { id: 'b', fitScore: 87, stage: 'outreach' },
    { id: 'c', fitScore: 78, stage: 'qualification' },
    { id: 'd', fitScore: 39, stage: 'disqualified' }, // excluded
    { id: 'e', fitScore: null, stage: 'company_research' }, // excluded
  ]

  it('ranks by fit score descending among rankable companies only', () => {
    expect(computeRank(companies, 'a')).toEqual({ rank: 1, total: 3 })
    expect(computeRank(companies, 'c')).toEqual({ rank: 3, total: 3 })
  })

  it('returns null for a company outside the rankable set', () => {
    expect(computeRank(companies, 'd')).toBeNull()
    expect(computeRank(companies, 'nope')).toBeNull()
  })

  it('breaks ties deterministically by id', () => {
    const tied = [
      { id: 'z', fitScore: 60, stage: 'qualification' },
      { id: 'a', fitScore: 60, stage: 'qualification' },
    ]
    expect(computeRank(tied, 'a')).toEqual({ rank: 1, total: 2 })
    expect(computeRank(tied, 'z')).toEqual({ rank: 2, total: 2 })
  })
})

describe('displayRank', () => {
  it('prefers the manual override over the computed rank, keeping the computed total', () => {
    expect(displayRank({ rank: 3, total: 41 }, 1)).toEqual({ rank: 1, total: 41, isOverride: true })
  })

  it('falls back to the computed rank when there is no override', () => {
    expect(displayRank({ rank: 3, total: 41 }, null)).toEqual({ rank: 3, total: 41, isOverride: false })
  })

  it('returns null when neither an override nor a computed rank exists', () => {
    expect(displayRank(null, null)).toBeNull()
  })
})
