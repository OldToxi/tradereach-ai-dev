/**
 * The weekly read-out is aggregation, not reasoning — deterministic by design (four
 * prompts only, AGENTS.md §5). The tests assert it never invents: every sentence it
 * emits must be provable from the numbers handed to it.
 */
import { describe, it, expect } from 'vitest'
import { buildWeeklyReadout } from '../lib/readout'

const base = {
  researched: 12,
  newThisWeek: 3,
  qualified: 5,
  contacted: 8,
  replied: 4,
  replyRatePct: 50,
  meetings: 2,
  followUpsDue: 1,
  needsResearch: 2,
  marketBars: [
    { market: 'Türkiye', count: 6 },
    { market: 'Germany', count: 3 },
    { market: 'UAE', count: 1 },
  ],
}

describe('buildWeeklyReadout', () => {
  it('states the researched/qualified/outreach numbers it was given', () => {
    const out = buildWeeklyReadout(base)
    expect(out).toContain('from 9 to 12 researched companies')
    expect(out).toContain('5 are qualified')
    expect(out).toContain('8 companies are in active outreach')
    expect(out).toContain('50% reply rate')
  })

  it('names the leading and trailing market', () => {
    const out = buildWeeklyReadout(base)
    expect(out).toContain('Türkiye leads the board')
    expect(out).toContain('UAE has the least movement')
  })

  it('lists suggested moves from the backlog', () => {
    const out = buildWeeklyReadout(base)
    expect(out).toContain('1 follow-up due today')
    expect(out).toContain('2 companies still blocked on qualification data')
  })

  it('gives a clear-board move when there is no backlog', () => {
    const out = buildWeeklyReadout({ ...base, followUpsDue: 0, needsResearch: 0 })
    expect(out).toContain('no backlog')
  })
})
