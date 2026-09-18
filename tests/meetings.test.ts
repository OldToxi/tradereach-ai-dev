/**
 * The meeting brief is deterministic — assembled from verified facts, not a model
 * call — so the tests assert the two rules that make it safe in a room: the "do not
 * commit" list always names the canonical reserved matters (never the model's idea
 * of what is commercial), and the brief always names the Commercial Authority as the
 * only person who may answer those.
 */
import { describe, it, expect } from 'vitest'
import { buildMeetingBrief, meetingPrep, dueLabel, combineDateTime, formatWhen } from '../lib/meetings'
import { RESERVED_LABELS } from '../lib/guardrails'

describe('buildMeetingBrief', () => {
  const input = {
    companyName: 'Atlas Home Textiles Ltd',
    market: 'United Kingdom',
    companyType: 'Retail buyer',
    summary: 'Retail-facing textile importer with four UK supermarket accounts.',
    openQuestions: ['annual bag volume', 'laminated or plain hessian'],
    authorityName: 'Mahbub Rahman',
    verifiedFactCount: 6,
  }

  it('restates the research summary and the open questions', () => {
    const out = buildMeetingBrief(input)
    expect(out.text).toContain('Retail-facing textile importer')
    expect(out.text).toContain('annual bag volume')
    expect(out.text).toContain('laminated or plain hessian')
  })

  it('names the Commercial Authority and the full reserved-matter list', () => {
    const out = buildMeetingBrief(input)
    expect(out.text).toContain('Mahbub Rahman')
    for (const label of Object.values(RESERVED_LABELS)) {
      expect(out.text).toContain(label)
    }
  })

  it('carries the verified-fact count through to the footer', () => {
    expect(buildMeetingBrief(input).verifiedCount).toBe(6)
  })

  it('uses fallback questions when none were listed', () => {
    const out = buildMeetingBrief({ ...input, openQuestions: [] })
    expect(out.text).toContain('Ask them:')
    expect(out.text).toContain('annual volumes and order patterns')
  })
})

describe('meetingPrep', () => {
  it('flags commercial meetings as requiring the authority', () => {
    expect(meetingPrep({ brief: null, requires_commercial: true }).className).toBe('tag-alert')
  })
  it('shows a prepared brief as ready', () => {
    expect(meetingPrep({ brief: 'x', requires_commercial: false }).className).toBe('tag-ok')
  })
})

describe('dueLabel', () => {
  const now = new Date('2026-09-18T12:00:00Z')
  it('labels today, tomorrow and overdue', () => {
    expect(dueLabel('2026-09-18', now)).toBe('due today')
    expect(dueLabel('2026-09-19', now)).toBe('due tomorrow')
    expect(dueLabel('2026-09-10', now)).toBe('overdue')
    expect(dueLabel(null, now)).toBe('')
  })
})

describe('combineDateTime / formatWhen', () => {
  it('stores the entered GMT+6 time as UTC and formats it back in GMT+6', () => {
    const iso = combineDateTime('2026-09-24', '11:00')
    expect(iso).toBe(new Date('2026-09-24T11:00:00+06:00').toISOString())
    expect(formatWhen(iso).time).toBe('11:00')
    expect(formatWhen(iso).tz).toBe('GMT+6')
  })
})
