import { describe, it, expect } from 'vitest'
import {
  canManageCatalog,
  marketsForProduct,
  marketNoteLabel,
  marketNoteOrderIndex,
  marketGuardrails,
  DEFAULT_REQUIRED_BEFORE_SENDING,
  DEFAULT_LEGAL_NOTE,
  DEFAULT_SEND_WINDOW,
  MARKET_PRIORITY_LABELS,
  MARKET_STATUS_LABELS,
  MARKET_PRIORITY_CLASS,
  MARKET_STATUS_CLASS,
} from '../lib/catalog'

describe('catalog write permission', () => {
  it('lets only managers manage the catalog', () => {
    expect(canManageCatalog('manager')).toBe(true)
    expect(canManageCatalog('executive')).toBe(false)
    expect(canManageCatalog('commercial')).toBe(false)
    expect(canManageCatalog('auditor')).toBe(false)
  })
})

describe('marketsForProduct', () => {
  const markets = [
    { country: 'Türkiye', product_focus: 'Jute yarn' },
    { country: 'Germany', product_focus: 'Jute yarn, bags' },
    { country: 'Japan', product_focus: 'Jute yarn, tableware' },
    { country: 'United Kingdom', product_focus: 'Bags, garments' },
    { country: 'UAE', product_focus: 'Bags, tableware' },
    { country: 'Brazil', product_focus: 'Garments, tableware' },
    { country: 'Egypt', product_focus: 'Jute yarn' },
  ]

  it('matches markets by the product noun, not shared material words', () => {
    expect(marketsForProduct('Jute yarn', markets)).toEqual(['Türkiye', 'Germany', 'Japan', 'Egypt'])
    expect(marketsForProduct('Woven jute bags', markets)).toEqual(['Germany', 'United Kingdom', 'UAE'])
    expect(marketsForProduct('Knit garments', markets)).toEqual(['United Kingdom', 'Brazil'])
    expect(marketsForProduct('Ceramic tableware', markets)).toEqual(['Japan', 'UAE', 'Brazil'])
  })

  it('does not match a market whose focus lacks the noun', () => {
    // "Ceramic tableware" must not match a jute-only market, and vice versa.
    expect(marketsForProduct('Ceramic tableware', [{ country: 'Türkiye', product_focus: 'Jute yarn' }])).toEqual([])
    expect(marketsForProduct('Jute yarn', [{ country: 'UAE', product_focus: 'Bags, tableware' }])).toEqual([])
  })
})

describe('market note display', () => {
  it('labels every seeded note key', () => {
    expect(marketNoteLabel('why_this_market')).toBe('Why this market')
    expect(marketNoteLabel('import_volume')).toBe('Import volume')
    expect(marketNoteLabel('local_rules')).toBe('Local rules')
  })

  it('falls back to a readable key for unknown notes', () => {
    expect(marketNoteLabel('some_new_fact')).toBe('some new fact')
  })

  it('orders notes as the mock card does', () => {
    const keys = ['local_rules', 'why_this_market', 'duty']
    const sorted = keys.slice().sort((a, b) => marketNoteOrderIndex(a) - marketNoteOrderIndex(b))
    expect(sorted).toEqual(['why_this_market', 'duty', 'local_rules'])
  })

  it('has a label and a tag class for every priority and status value', () => {
    for (const p of ['high', 'medium', 'watch']) {
      expect(MARKET_PRIORITY_LABELS[p]).toBeTruthy()
      expect(MARKET_PRIORITY_CLASS).toHaveProperty(p)
    }
    for (const s of ['active', 'under_review', 'watchlist', 'paused']) {
      expect(MARKET_STATUS_LABELS[s]).toBeTruthy()
      expect(MARKET_STATUS_CLASS).toHaveProperty(s)
    }
  })
})

describe('marketGuardrails', () => {
  const base = {
    send_window: null,
    weekly_outreach_cap: 12,
    required_before_sending: null,
    legal_note: null,
  }

  it('fails closed with safe defaults when nothing is stored', () => {
    expect(marketGuardrails(base)).toEqual({
      send_window: DEFAULT_SEND_WINDOW,
      weekly_outreach_cap: 12,
      required_before_sending: DEFAULT_REQUIRED_BEFORE_SENDING,
      legal_note: DEFAULT_LEGAL_NOTE,
    })
  })

  it('keeps stored values and trims whitespace', () => {
    expect(
      marketGuardrails({
        ...base,
        send_window: ' 09:00–17:00 Asia/Tokyo ',
        required_before_sending: ' Named decision-maker ',
        legal_note: ' APPI applies. ',
      }),
    ).toEqual({
      send_window: '09:00–17:00 Asia/Tokyo',
      weekly_outreach_cap: 12,
      required_before_sending: 'Named decision-maker',
      legal_note: 'APPI applies.',
    })
  })

  it('preserves a zero weekly cap instead of treating it as unset', () => {
    expect(marketGuardrails({ ...base, weekly_outreach_cap: 0 }).weekly_outreach_cap).toBe(0)
  })
})
