/**
 * The reply draft is deterministic — a template, not a fifth model call — so the one
 * thing it must never do is volunteer a reserved term. These tests assert the split:
 * the technical half is answered, the commercial half is deferred, and the deferral
 * wording names no reserved keyword. If any of these fails, the export desk has
 * committed to something it has no authority to commit to.
 */
import { describe, it, expect } from 'vitest'
import {
  buildReplyDraft,
  replyDraftIsClean,
  suppressKeyFor,
  categoryLabel,
  nextActionLabel,
  intentLabel,
  urgencyLabel,
  confidenceLabel,
  firstName,
} from '../lib/replies'
import { scanPatterns } from '../lib/guardrails'
import { isSuppressed } from '../lib/contacts'

const SPLIT = {
  contactName: 'Selin Aydın',
  senderName: 'Nusrat Jahan',
  senderTitle: 'Export Executive',
  answerable: ['the technical specification for the 8 lb count'],
  reserved: [{ matter: 'price', theirWords: 'what would your price per tonne be, CIF İzmir' }],
  authorityName: 'Mahbub Rahman',
  market: 'Türkiye',
  threadSubject: 'Consistent 8 lb jute yarn from Chittagong',
}

describe('buildReplyDraft', () => {
  it('answers the answerable half with a concrete commitment', () => {
    const draft = buildReplyDraft(SPLIT)
    expect(draft.body).toContain("I'll send you the technical specification for the 8 lb count.")
    expect(draft.subject).toBe('Re: Consistent 8 lb jute yarn from Chittagong')
  })

  it('defers the reserved half without naming a single reserved keyword', () => {
    const draft = buildReplyDraft(SPLIT)
    expect(draft.body).toContain('Mahbub Rahman')
    expect(draft.body).toContain('Türkiye')
    // The buyer asked for a price. The draft must not say "price", "per tonne", a
    // number, or any other reserved matter — the guardrail would hold it.
    expect(scanPatterns(draft.body)).toHaveLength(0)
    expect(draft.body.toLowerCase()).not.toContain('price')
    expect(draft.body.toLowerCase()).not.toContain('per tonne')
    expect(draft.deferredCount).toBe(1)
  })

  it('is clean when there is nothing reserved (a pure technical reply)', () => {
    const draft = buildReplyDraft({ ...SPLIT, reserved: [] })
    expect(scanPatterns(draft.body)).toHaveLength(0)
    expect(draft.deferredCount).toBe(0)
    expect(draft.body).not.toContain('commercial points')
  })

  it('passes replyDraftIsClean for the hardest case (reserved price + samples)', () => {
    const draft = buildReplyDraft({
      ...SPLIT,
      reserved: [
        { matter: 'price', theirWords: 'what would your price per tonne be' },
        { matter: 'samples', theirWords: 'send us a sample for our lab' },
      ],
    })
    expect(replyDraftIsClean(draft)).toBe(true)
    expect(scanPatterns(draft.body)).toHaveLength(0)
  })
})

describe('suppressKeyFor', () => {
  it('prefers the email domain', () => {
    expect(suppressKeyFor('s.aydin@yildiztekstil.test', 'https://www.yildiztekstil.test')).toBe(
      'yildiztekstil.test',
    )
  })

  it('falls back to the website domain when there is no email', () => {
    expect(suppressKeyFor(null, 'https://www.nordfiber.test/about')).toBe('nordfiber.test')
  })

  it('returns null when there is nothing to suppress', () => {
    expect(suppressKeyFor(null, null)).toBeNull()
  })

  it('produces a key that isSuppressed then matches, in both directions (T9.6)', () => {
    const email = 's.aydin@yildiztekstil.test'
    const website = 'https://www.yildiztekstil.test'
    const key = suppressKeyFor(email, website)
    expect(key).toBe('yildiztekstil.test')
    const suppressed = new Set<string>([key as string])
    // The buyer's address matches on domain, and so does the company website.
    expect(isSuppressed(email, website, suppressed)).toBe(true)
    expect(isSuppressed(null, website, suppressed)).toBe(true)
    // An unrelated buyer in the same market is untouched.
    expect(isSuppressed('buyer@nordfiber.test', null, suppressed)).toBe(false)
  })
})

describe('labels', () => {
  it('maps the vocabulary the triage prompt produces', () => {
    expect(categoryLabel('pricing_request')).toBe('Pricing request')
    expect(nextActionLabel('escalate_commercial')).toBe('Escalate to commercial')
    expect(intentLabel('positive')).toBe('Positive')
    expect(urgencyLabel('within_24h')).toBe('Reply within 24h')
    expect(confidenceLabel(0.91)).toBe('High (0.91)')
    expect(confidenceLabel(0.55)).toBe('Medium (0.55)')
    expect(confidenceLabel(0.2)).toBe('Low (0.20)')
    expect(confidenceLabel(null)).toBe('—')
  })

  it('first name extraction', () => {
    expect(firstName('Selin Aydın')).toBe('Selin')
    expect(firstName(null)).toBe('there')
  })
})
