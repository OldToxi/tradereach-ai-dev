/**
 * The dashboard numbers are derived, not stored, so the tests pin the rules:
 * "qualified" means every qualification criterion is verified (and the company is not
 * closed), and the "needs you today" ranking puts the commercial escalation first and
 * then surfaces the oldest item at risk of going cold.
 */
import { describe, it, expect } from 'vitest'
import {
  isQualified,
  computeKpis,
  computeFunnel,
  computeMarketBars,
  funnelBarClass,
  rankNeeds,
  humanAge,
  type CompanySnapshot,
  type NeedItem,
} from '../lib/dashboard'

const snap = (over: Partial<CompanySnapshot>): CompanySnapshot => ({
  id: '1',
  stage: 'qualification',
  market: 'Germany',
  hasQualificationFacts: true,
  gapCount: 0,
  hasReply: false,
  hasMeeting: false,
  createdAt: '2026-09-18T00:00:00Z',
  ...over,
})

describe('isQualified', () => {
  it('is true with verified criteria and no gaps', () => {
    expect(isQualified(snap({}))).toBe(true)
  })
  it('is false with an open gap', () => {
    expect(isQualified(snap({ gapCount: 1 }))).toBe(false)
  })
  it('is false for a closed company even when clean', () => {
    expect(isQualified(snap({ stage: 'disqualified', gapCount: 0 }))).toBe(false)
  })
})

describe('computeKpis', () => {
  it('counts researched, new this week, qualified and the share', () => {
    const now = new Date('2026-09-18T00:00:00Z')
    const kpis = computeKpis(
      [
        snap({ id: 'a', createdAt: '2026-09-15T00:00:00Z' }),
        snap({ id: 'b', createdAt: '2026-09-01T00:00:00Z', gapCount: 1 }),
      ],
      now,
    )
    expect(kpis.researched).toBe(2)
    expect(kpis.newThisWeek).toBe(1)
    expect(kpis.qualified).toBe(1)
    expect(kpis.qualifiedPct).toBe(50)
  })
})

describe('computeFunnel / computeMarketBars', () => {
  it('builds the six funnel rows in order', () => {
    const funnel = computeFunnel([
      snap({ id: 'a', stage: 'outreach' }),
      snap({ id: 'b', stage: 'reply', hasReply: true }),
    ])
    expect(funnel.map((f) => f.label)).toEqual([
      'Researched',
      'Qualified',
      'Contacted',
      'Replied',
      'Meeting',
      'Commercial',
    ])
    expect(funnel[0].count).toBe(2)
    expect(funnel[3].count).toBe(1)
  })

  it('sorts market bars by count and drops closed lanes', () => {
    const bars = computeMarketBars([
      snap({ id: 'a', market: 'Germany' }),
      snap({ id: 'b', market: 'Türkiye' }),
      snap({ id: 'c', market: 'Türkiye' }),
      snap({ id: 'd', market: 'Japan', stage: 'closed' }),
    ])
    expect(bars[0]).toEqual({ market: 'Türkiye', count: 2 })
    expect(bars.some((b) => b.market === 'Japan')).toBe(false)
  })
})

describe('funnelBarClass', () => {
  it('bands by ratio of the largest stage', () => {
    expect(funnelBarClass(10, 10)).toBe('hi')
    expect(funnelBarClass(2, 10)).toBe('mid')
    expect(funnelBarClass(1, 10)).toBe('lo')
  })
})

describe('rankNeeds', () => {
  const item = (over: Partial<NeedItem>): NeedItem => ({
    companyId: '1',
    company: 'C',
    market: 'M',
    what: 'x',
    tone: 'plain',
    ageLabel: '',
    ageMs: 0,
    route: '/',
    routeLabel: '',
    tier: 5,
    ...over,
  })

  it('puts the commercial escalation first, then oldest within a tier', () => {
    const ranked = rankNeeds([
      item({ companyId: 'a', tier: 2, ageMs: 1000 }),
      item({ companyId: 'b', tier: 0, ageMs: 1 }),
      item({ companyId: 'c', tier: 2, ageMs: 9000 }),
    ])
    expect(ranked.map((n) => n.companyId)).toEqual(['b', 'c', 'a'])
  })
})

describe('humanAge', () => {
  it('formats minutes, hours and days', () => {
    expect(humanAge(20 * 60000)).toBe('20m')
    expect(humanAge(2 * 3600e3)).toBe('2h')
    expect(humanAge(3 * 24 * 3600e3)).toBe('3d')
  })
})
