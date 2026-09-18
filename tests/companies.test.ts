import { describe, it, expect } from 'vitest'
import {
  stageLabel,
  fitBarClass,
  companyNextAction,
  dataCell,
  STAGE_OPTIONS,
} from '../lib/companies'

describe('stageLabel', () => {
  it('maps every database stage to the mock label', () => {
    expect(stageLabel('company_research')).toBe('Research')
    expect(stageLabel('contact_identification')).toBe('Contact identification')
    expect(stageLabel('follow_up')).toBe('Follow-up')
    expect(stageLabel('commercial_discussion')).toBe('Commercial discussion')
  })

  it('falls back to the raw value for an unknown stage', () => {
    expect(stageLabel('some_future_stage')).toBe('some_future_stage')
  })

  it('has labels for every filter option', () => {
    for (const s of STAGE_OPTIONS) expect(stageLabel(s)).toBeTruthy()
  })
})

describe('fitBarClass', () => {
  it('bands by the mock thresholds (80 and 60)', () => {
    expect(fitBarClass(91)).toBe('hi')
    expect(fitBarClass(80)).toBe('hi')
    expect(fitBarClass(79)).toBe('mid')
    expect(fitBarClass(60)).toBe('mid')
    expect(fitBarClass(39)).toBe('lo')
    expect(fitBarClass(null)).toBe('none')
  })
})

describe('companyNextAction', () => {
  const base = { gapCount: 0, disqualified_reason: null }

  it('is honest about a qualification stage that still has gaps', () => {
    expect(companyNextAction({ ...base, stage: 'qualification', gapCount: 2 })).toBe(
      'Confirm 2 remaining criteria',
    )
    expect(companyNextAction({ ...base, stage: 'qualification' })).toBe(
      'Advance to contact identification',
    )
  })

  it('names the disqualification reason when closed', () => {
    expect(
      companyNextAction({ ...base, stage: 'disqualified', disqualified_reason: 'Licence unverifiable' }),
    ).toBe('Closed — Licence unverifiable')
  })

  it('covers every stage without throwing', () => {
    for (const s of STAGE_OPTIONS) expect(typeof companyNextAction({ ...base, stage: s })).toBe('string')
  })
})

describe('dataCell', () => {
  it('shows missing count, complete, or not-researched', () => {
    expect(dataCell({ gapCount: 2, hasQualificationFacts: true })).toEqual({
      text: '2 missing',
      className: 'tag tag-due',
    })
    expect(dataCell({ gapCount: 0, hasQualificationFacts: true })).toEqual({
      text: 'Complete',
      className: 'tag tag-ok',
    })
    expect(dataCell({ gapCount: 0, hasQualificationFacts: false })).toEqual({
      text: 'Not researched',
      className: 'tag',
    })
  })
})
