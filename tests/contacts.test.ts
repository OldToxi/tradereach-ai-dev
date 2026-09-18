import { describe, it, expect } from 'vitest'
import {
  contactableStatus,
  hasNamedContact,
  contactGateBlocks,
  isPastContactIdentification,
  findContactByName,
  relativeTime,
  domainOf,
  isSuppressed,
} from '../lib/contacts'

describe('contactableStatus', () => {
  const base = { provenance: 'verified', email: 'a@b.test', emailSource: 'Company website' }

  it('is Yes for a verified or human-approved contact at a live company', () => {
    expect(contactableStatus(base, { companyStage: 'outreach', suppressed: false })).toEqual({
      text: 'Yes',
      className: 'tag tag-ok',
    })
    expect(
      contactableStatus({ ...base, provenance: 'human_approved' }, { companyStage: 'outreach', suppressed: false }),
    ).toEqual({ text: 'Yes', className: 'tag tag-ok' })
  })

  it('blocks an unverified or ai-guessed address', () => {
    expect(
      contactableStatus({ ...base, provenance: 'unverified' }, { companyStage: 'outreach', suppressed: false }),
    ).toEqual({ text: 'Blocked — unverified', className: 'tag tag-alert' })
  })

  it('is nurture-only when the company is in the nurture stage, even if verified', () => {
    expect(contactableStatus(base, { companyStage: 'nurture', suppressed: false })).toEqual({
      text: 'Nurture only',
      className: 'tag',
    })
  })

  it('suppression wins over everything else', () => {
    expect(contactableStatus(base, { companyStage: 'outreach', suppressed: true })).toEqual({
      text: 'Blocked — suppressed',
      className: 'tag tag-alert',
    })
  })
})

describe('hasNamedContact / contactGateBlocks (T6.4)', () => {
  it('requires both an email and a recorded source', () => {
    expect(hasNamedContact([{ provenance: 'verified', email: 'a@b.test', emailSource: null }])).toBe(false)
    expect(hasNamedContact([{ provenance: 'verified', email: null, emailSource: 'Company website' }])).toBe(false)
    expect(hasNamedContact([{ provenance: 'unverified', email: 'a@b.test', emailSource: 'Company website' }])).toBe(
      true,
    )
  })

  it('only gates stages after contact_identification, never the stage itself', () => {
    expect(isPastContactIdentification('contact_identification')).toBe(false)
    expect(isPastContactIdentification('outreach')).toBe(true)
  })

  it('blocks advancing to outreach with no named contact, clears once one exists', () => {
    expect(contactGateBlocks('outreach', [])).toBe(true)
    expect(contactGateBlocks('outreach', [{ provenance: 'unverified', email: 'a@b.test', emailSource: 'x' }])).toBe(
      false,
    )
  })

  it('never blocks moving into contact_identification itself', () => {
    expect(contactGateBlocks('contact_identification', [])).toBe(false)
  })
})

describe('findContactByName', () => {
  const contacts = [
    { fullName: 'Aiko Tanaka', id: '1' },
    { fullName: '  Selin Aydın ', id: '2' },
  ]

  it('matches case- and whitespace-insensitively', () => {
    expect(findContactByName(contacts, 'aiko tanaka')?.id).toBe('1')
    expect(findContactByName(contacts, 'Selin Aydın')?.id).toBe('2')
  })

  it('returns null for no name or no match', () => {
    expect(findContactByName(contacts, null)).toBeNull()
    expect(findContactByName(contacts, 'Nobody Here')).toBeNull()
  })
})

describe('domainOf / isSuppressed', () => {
  it('strips protocol and www', () => {
    expect(domainOf('https://www.nileco.test/about')).toBe('nileco.test')
    expect(domainOf('nileco.test')).toBe('nileco.test')
    expect(domainOf(null)).toBeNull()
  })

  it('matches on the exact address, the address domain, or the company domain', () => {
    const suppressed = new Set(['nileco.test'])
    expect(isSuppressed('buyer@nileco.test', 'nileco.test', suppressed)).toBe(true)
    expect(isSuppressed('buyer@other.test', 'nileco.test/path', suppressed)).toBe(true)
    expect(isSuppressed('buyer@other.test', 'other.test', suppressed)).toBe(false)
    expect(isSuppressed(null, 'other.test', suppressed)).toBe(false)
  })
})

describe('relativeTime', () => {
  const now = new Date('2026-09-18T12:00:00Z')

  it('formats minutes, hours and days', () => {
    expect(relativeTime('2026-09-18T11:59:30Z', now)).toBe('just now')
    expect(relativeTime('2026-09-18T11:30:00Z', now)).toBe('30m ago')
    expect(relativeTime('2026-09-18T08:00:00Z', now)).toBe('4h ago')
    expect(relativeTime('2026-09-15T12:00:00Z', now)).toBe('3d ago')
  })
})
