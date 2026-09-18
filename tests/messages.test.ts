import { describe, it, expect } from 'vitest'
import {
  wordLimitFor,
  countWords,
  addWorkingDays,
  cadenceFor,
  nextTouchNumber,
  isFollowupDue,
  buildPreSendChecks,
  parseSendWindow,
  isWithinSendWindow,
  recipientAllowed,
  highlightSegments,
  claimIsResolved,
  countUnresolvedClaims,
  sha256,
} from '../lib/messages'

describe('wordLimitFor / countWords', () => {
  it('first touch is 140, follow-up 2 is 90, follow-up 3 is 50', () => {
    expect(wordLimitFor('first_touch', 1)).toBe(140)
    expect(wordLimitFor('follow_up', 2)).toBe(90)
    expect(wordLimitFor('follow_up', 3)).toBe(50)
  })

  it('counts words by whitespace, ignoring extra spacing', () => {
    expect(countWords('  one  two   three ')).toBe(3)
    expect(countWords('')).toBe(0)
  })
})

describe('addWorkingDays / cadenceFor', () => {
  it('skips weekends', () => {
    // Friday 2026-09-18 + 1 working day -> Monday 2026-09-21
    const fri = new Date('2026-09-18T00:00:00Z')
    expect(addWorkingDays(fri, 1).toISOString().slice(0, 10)).toBe('2026-09-21')
    expect(addWorkingDays(fri, 4).toISOString().slice(0, 10)).toBe('2026-09-24')
  })

  it('touch2 is +4 working days, touch3 is +11, both from the first touch', () => {
    const first = new Date('2026-09-18T00:00:00Z') // Friday
    const { touch2Due, touch3Due } = cadenceFor(first)
    expect(touch2Due.toISOString().slice(0, 10)).toBe('2026-09-24')
    expect(touch3Due.toISOString().slice(0, 10)).toBe('2026-10-05')
  })
})

describe('nextTouchNumber', () => {
  it('is null with no first touch sent', () => {
    expect(nextTouchNumber([], false)).toBeNull()
  })

  it('is 2 after touch 1, 3 after touch 2, null after touch 3', () => {
    expect(nextTouchNumber([{ touchNumber: 1, createdAt: 'x' }], false)).toBe(2)
    expect(
      nextTouchNumber(
        [
          { touchNumber: 1, createdAt: 'x' },
          { touchNumber: 2, createdAt: 'y' },
        ],
        false,
      ),
    ).toBe(3)
    expect(
      nextTouchNumber(
        [
          { touchNumber: 1, createdAt: 'x' },
          { touchNumber: 2, createdAt: 'y' },
          { touchNumber: 3, createdAt: 'z' },
        ],
        false,
      ),
    ).toBeNull()
  })

  it('stops the moment any reply exists, regardless of touch history', () => {
    expect(nextTouchNumber([{ touchNumber: 1, createdAt: 'x' }], true)).toBeNull()
  })
})

describe('isFollowupDue', () => {
  const cadence = cadenceFor(new Date('2026-09-18T00:00:00Z'))

  it('is false before the due date, true on/after it', () => {
    expect(isFollowupDue(cadence, 2, new Date('2026-09-20T00:00:00Z'))).toBe(false)
    expect(isFollowupDue(cadence, 2, new Date('2026-09-24T00:00:00Z'))).toBe(true)
  })
})

describe('parseSendWindow / isWithinSendWindow', () => {
  it('parses a mock-style send window string', () => {
    const parsed = parseSendWindow('08:00–17:00 Europe/Berlin, Mon–Fri')
    expect(parsed).toEqual({
      startMinutes: 480,
      endMinutes: 1020,
      timeZone: 'Europe/Berlin',
      days: [1, 2, 3, 4, 5],
    })
  })

  it('returns null for unparseable text', () => {
    expect(parseSendWindow('sometime, probably')).toBeNull()
    expect(parseSendWindow(null)).toBeNull()
  })

  it('fails open (true) when the window text cannot be parsed', () => {
    expect(isWithinSendWindow('nonsense', new Date())).toBe(true)
    expect(isWithinSendWindow(null, new Date())).toBe(true)
  })

  it('correctly evaluates a real window at a known instant', () => {
    // 2026-09-18T10:00:00Z is noon in Europe/Berlin (UTC+2 in September) — within 08-17
    expect(isWithinSendWindow('08:00–17:00 Europe/Berlin, Mon–Fri', new Date('2026-09-18T10:00:00Z'))).toBe(true)
    // 2026-09-18T22:00:00Z is midnight in Berlin — outside the window
    expect(isWithinSendWindow('08:00–17:00 Europe/Berlin, Mon–Fri', new Date('2026-09-18T22:00:00Z'))).toBe(false)
    // 2026-09-19 is a Saturday
    expect(isWithinSendWindow('08:00–17:00 Europe/Berlin, Mon–Fri', new Date('2026-09-19T10:00:00Z'))).toBe(false)
  })
})

describe('recipientAllowed', () => {
  it('matches the %.test allowlist pattern', () => {
    expect(recipientAllowed('buyer@company.test')).toBe(true)
    expect(recipientAllowed('buyer@company.com')).toBe(false)
    expect(recipientAllowed(null)).toBe(false)
  })
})

describe('buildPreSendChecks', () => {
  const base = {
    contact: { provenance: 'verified', email: 'a@b.test' },
    claimsUsed: [{ claim: 'x', fromFact: 'imports_category' }],
    unresolvedClaims: 0,
    body: 'short body',
    kind: 'first_touch',
    touchNumber: 1,
    recipientAllowed: true,
    withinSendWindow: true,
    weeklySent: 3,
    weeklyCap: 12,
    guardrailClear: true,
    released: false,
    lawfulBasisRecorded: true,
    suppressed: false,
  }

  it('all pass on a clean input', () => {
    const checks = buildPreSendChecks(base)
    expect(checks.every((c) => c.status === 'ok')).toBe(true)
    expect(checks).toHaveLength(9)
  })

  it('flags a missing/unverified contact', () => {
    const checks = buildPreSendChecks({ ...base, contact: null })
    expect(checks[0]).toEqual({ label: 'Named decision-maker with a verified address', status: 'block' })
  })

  it('flags unresolved claims for both the claim-tracing and unverified-field checks', () => {
    const checks = buildPreSendChecks({ ...base, unresolvedClaims: 1 })
    expect(checks[1].status).toBe('block')
    expect(checks[2].status).toBe('block')
  })

  it('flags over the word limit', () => {
    const checks = buildPreSendChecks({ ...base, body: 'word '.repeat(200) })
    expect(checks.find((c) => c.label.includes('Under'))?.status).toBe('block')
  })

  it('flags a reserved commercial matter and an exceeded weekly cap', () => {
    const checks = buildPreSendChecks({ ...base, guardrailClear: false, weeklySent: 12, weeklyCap: 12 })
    expect(checks.find((c) => c.label === 'No reserved commercial matter')?.status).toBe('block')
    expect(checks.find((c) => c.label.startsWith('Weekly cap'))?.status).toBe('block')
  })

  it('treats a released reserved matter as clear — the release is the authorisation', () => {
    const checks = buildPreSendChecks({ ...base, guardrailClear: false, released: true })
    expect(checks.find((c) => c.label === 'No reserved commercial matter')?.status).toBe('ok')
  })

  it('flags a suppressed contact even if lawful basis is recorded', () => {
    const checks = buildPreSendChecks({ ...base, suppressed: true })
    expect(checks.find((c) => c.label.includes('Unsubscribe'))?.status).toBe('block')
  })
})

describe('claimIsResolved / countUnresolvedClaims', () => {
  const verifiedKeys = ['imports_category', 'buys_south_asia']
  const productFields = ['monthly_capacity', 'certifications']

  it('matches an exact fact key', () => {
    expect(claimIsResolved('imports_category', verifiedKeys, productFields)).toBe(true)
  })

  it('matches a loose paraphrase either direction', () => {
    expect(claimIsResolved('the imports_category field', verifiedKeys, productFields)).toBe(true)
    expect(claimIsResolved('capacity', verifiedKeys, productFields)).toBe(true)
  })

  it('does not match an unrelated or empty label', () => {
    expect(claimIsResolved('decision maker found', verifiedKeys, productFields)).toBe(false)
    expect(claimIsResolved('', verifiedKeys, productFields)).toBe(false)
  })

  it('counts only the unresolved claims', () => {
    const claims = [{ fromFact: 'imports_category' }, { fromFact: 'made up thing' }]
    expect(countUnresolvedClaims(claims, verifiedKeys, productFields)).toBe(1)
  })
})

describe('sha256', () => {
  it('is deterministic and matches a known digest', async () => {
    expect(await sha256('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
    expect(await sha256('a')).toBe(await sha256('a'))
    expect(await sha256('a')).not.toBe(await sha256('b'))
  })
})

describe('highlightSegments', () => {
  it('highlights an exact claim substring as why', () => {
    const segs = highlightSegments('They import jute yarn already.', [{ claim: 'import jute yarn' }], [])
    expect(segs).toEqual([
      { text: 'They ', kind: 'plain' },
      { text: 'import jute yarn', kind: 'why' },
      { text: ' already.', kind: 'plain' },
    ])
  })

  it('silently skips a claim that cannot be found verbatim', () => {
    const segs = highlightSegments('Plain body.', [{ claim: 'not present' }], [])
    expect(segs).toEqual([{ text: 'Plain body.', kind: 'plain' }])
  })

  it('gives risk spans priority over an overlapping why claim', () => {
    const body = 'I can arrange a sample this month.'
    const riskStart = body.indexOf('a sample')
    const segs = highlightSegments(
      body,
      [{ claim: 'I can arrange a sample this month' }],
      [{ start: riskStart, end: riskStart + 'a sample'.length }],
    )
    const riskSeg = segs.find((s) => s.kind === 'risk')
    expect(riskSeg?.text).toBe('a sample')
    expect(segs.some((s) => s.kind === 'why')).toBe(false)
  })
})
