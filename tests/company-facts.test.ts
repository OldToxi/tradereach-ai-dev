import { describe, it, expect } from 'vitest'
import {
  factLabel,
  isAnalystNoteKey,
  qualificationStatus,
  nextStage,
  isPastQualification,
  gateBlocksAdvance,
  gateReason,
  provenanceClass,
  provenanceLabel,
  QUALIFICATION_CRITERIA,
} from '../lib/company-facts'

describe('factLabel', () => {
  it('maps known keys to human labels', () => {
    expect(factLabel('imports_category')).toBe('Imports this product category')
    expect(factLabel('credit_signal')).toBe('Payment history / credit signal')
  })

  it('falls back to a readable key', () => {
    expect(factLabel('importer_licence')).toBe('Importer licence')
    expect(factLabel('some_new_key')).toBe('some new key')
  })

  it('labels analyst notes consistently', () => {
    expect(factLabel('analyst_note')).toBe('Analyst note')
    expect(factLabel('analyst_note_1699999999999')).toBe('Analyst note')
  })
})

describe('isAnalystNoteKey', () => {
  it('recognises seeded and generated note keys', () => {
    expect(isAnalystNoteKey('analyst_note')).toBe(true)
    expect(isAnalystNoteKey('analyst_note_1')).toBe(true)
    expect(isAnalystNoteKey('legal_name')).toBe(false)
  })
})

describe('qualificationStatus', () => {
  it('counts verified as confirmed', () => {
    const s = qualificationStatus([
      { provenance: 'verified' },
      { provenance: 'verified' },
      { provenance: 'unverified' },
    ])
    expect(s).toEqual({ confirmed: 2, total: 3 })
  })

  it('handles an empty list', () => {
    expect(qualificationStatus([])).toEqual({ confirmed: 0, total: 0 })
  })
})

describe('pipeline advance', () => {
  it('walks the pipeline in order', () => {
    expect(nextStage('company_research')).toBe('qualification')
    expect(nextStage('qualification')).toBe('contact_identification')
    expect(nextStage('commercial_discussion')).toBeNull()
    expect(nextStage('disqualified')).toBeNull()
  })
})

describe('stage gate', () => {
  it('only counts post-qualification stages as gated', () => {
    expect(isPastQualification('qualification')).toBe(false)
    expect(isPastQualification('contact_identification')).toBe(true)
    expect(isPastQualification('outreach')).toBe(true)
    expect(isPastQualification('nurture')).toBe(false)
  })

  it('blocks advance only past qualification with unverified criteria', () => {
    expect(gateBlocksAdvance(1, 'contact_identification')).toBe(true)
    expect(gateBlocksAdvance(0, 'contact_identification')).toBe(false)
    expect(gateBlocksAdvance(3, 'qualification')).toBe(false)
  })

  it('phrases the reason, singular and plural', () => {
    expect(gateReason(1)).toContain('1 qualification field')
    expect(gateReason(2)).toContain('2 qualification fields')
  })
})

describe('provenance', () => {
  it('maps the four provenance values to badge class and label', () => {
    expect(provenanceClass('verified')).toBe('prov-v')
    expect(provenanceClass('unverified')).toBe('prov-u')
    expect(provenanceClass('ai')).toBe('prov-a')
    expect(provenanceClass('human_approved')).toBe('prov-h')
    expect(provenanceClass('nonsense')).toBe('prov-u')
    expect(provenanceLabel('verified')).toBe('Verified')
    expect(provenanceLabel('human_approved')).toBe('Human-approved')
  })
})

describe('QUALIFICATION_CRITERIA', () => {
  it('lists the six canonical criteria', () => {
    expect(QUALIFICATION_CRITERIA.map((c) => c.key)).toEqual([
      'imports_category',
      'buys_south_asia',
      'volume_fit',
      'certification_match',
      'decision_maker_found',
      'credit_signal',
    ])
  })
})
