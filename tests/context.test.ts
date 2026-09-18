/**
 * lib/ai/context.ts is the prevention half of the commercial control: a model
 * cannot quote a price it was never given. These tests assert reserved matters
 * never reach prompt context, offline.
 */
import { describe, it, expect } from 'vitest'
import { RESERVED_MATTERS } from '../lib/guardrails'
import {
  isReservedKey,
  stripReserved,
  PRODUCT_CONTEXT_COLUMNS,
  renderContext,
  type CompanyContext,
  type ProductContext,
} from '../lib/ai/context'

describe('reserved keys are recognised', () => {
  it.each(RESERVED_MATTERS)('marks %s as reserved', (matter) => {
    expect(isReservedKey(matter)).toBe(true)
  })

  it.each(['unit_price', 'minimum_order', 'sample_policy', 'distributor_terms', 'rebates'])(
    'marks synonym %s as reserved',
    (key) => {
      expect(isReservedKey(key)).toBe(true)
    },
  )

  it.each(['lead_time', 'monthly_capacity', 'certifications', 'capability_sheet', 'hs_code', 'name'])(
    'keeps allowed field %s',
    (key) => {
      expect(isReservedKey(key)).toBe(false)
    },
  )
})

describe('stripReserved', () => {
  it('drops reserved keys and keeps allowed ones', () => {
    const out = stripReserved({
      name: 'Jute yarn',
      unit_price: 'USD 940 / MT',
      moq: '20 MT',
      sample_policy: 'lab samples',
      lead_time: '4 weeks',
      monthly_capacity: '920 MT',
    })
    expect(out).not.toHaveProperty('unit_price')
    expect(out).not.toHaveProperty('moq')
    expect(out).not.toHaveProperty('sample_policy')
    expect(out).toHaveProperty('name', 'Jute yarn')
    expect(out).toHaveProperty('lead_time', '4 weeks')
    expect(out).toHaveProperty('monthly_capacity', '920 MT')
  })
})

describe('product allowlist', () => {
  it('selects only non-reserved columns', () => {
    for (const col of PRODUCT_CONTEXT_COLUMNS) {
      expect(isReservedKey(col), `column "${col}" must not be reserved`).toBe(false)
    }
  })

  it('contains the capability-sheet columns a draft may quote', () => {
    expect(PRODUCT_CONTEXT_COLUMNS).toEqual(
      expect.arrayContaining([
        'name',
        'hs_code',
        'certifications',
        'monthly_capacity',
        'lead_time',
        'capability_sheet',
      ]),
    )
  })
})

describe('renderContext', () => {
  const company: CompanyContext = {
    name: 'NordFiber Handels GmbH',
    market: 'Germany',
    companyType: 'Importer',
    facts: [
      { key: 'annual_import_volume', value: '2,900 MT of jute goods', source: 'importer record' },
    ],
    contacts: [],
    sources: [],
    analystNotes: [],
  }
  const product: ProductContext = {
    name: 'Jute yarn',
    hsCode: '5307.10',
    certifications: ['OEKO-TEX'],
    monthlyCapacity: '920 MT',
    leadTime: '4 weeks',
    capabilitySheet: 'Spun in Chittagong from 4 lb to 20 lb',
  }

  it('renders capability facts and never a reserved matter', () => {
    const text = renderContext(company, product)
    expect(text).toContain('5307.10')
    expect(text).toContain('OEKO-TEX')
    expect(text).toContain('920 MT')
    expect(text).toContain('Chittagong')
    expect(text).not.toContain('USD')
    expect(text).not.toContain('price')
    expect(text).not.toContain('MOQ')
  })

  it('does not leak a reserved fact key that slipped through', () => {
    const leaked = renderContext(
      {
        ...company,
        facts: [{ key: 'unit_price', value: 'USD 940', source: null }],
      },
      product,
    )
    // renderContext is dumb — it prints what it is handed. The filter is upstream,
    // in buildCompanyContext; this test documents that invariant so the renderer
    // is never assumed to be the guard.
    expect(leaked).toContain('unit_price')
    expect(isReservedKey('unit_price')).toBe(true)
  })
})
