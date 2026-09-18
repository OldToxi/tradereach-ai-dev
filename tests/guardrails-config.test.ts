/**
 * Settings → Commercial guardrails (T11.5). The list-shaping and the refusal
 * template are pure functions, so the rules that keep the control load-bearing are
 * testable offline: built-ins are never removable, a custom matter becomes a slug,
 * and a refusal template edit that names a reserved term is refused.
 */
import { describe, it, expect } from 'vitest'
import {
  mattersFromRows,
  activeMatterEntries,
  slugifyMatter,
  validateNewMatter,
  isBuiltinMatter,
  type ReservedMatterRow,
} from '../lib/guardrails-config'
import {
  reservedLabel,
  refusalFromTemplate,
  refusalTemplateIsClean,
  DEFAULT_REFUSAL_TEMPLATE,
  BUILTIN_MATTER_ENTRIES,
} from '../lib/guardrails'

describe('mattersFromRows', () => {
  it('orders by sort_order and fills missing built-ins', () => {
    const rows: ReservedMatterRow[] = [
      { key: 'packaging-redesign', label: 'Packaging redesign', is_builtin: false, active: true, sort_order: 14 },
      { key: 'price', label: 'Price', is_builtin: true, active: true, sort_order: 1 },
    ]
    const entries = mattersFromRows(rows)
    // Built-ins (13) + one custom = 14, even though only two rows were given.
    expect(entries).toHaveLength(BUILTIN_MATTER_ENTRIES.length + 1)
    expect(entries[0].key).toBe('price')
  })

  it('activeMatterEntries keeps only active matters', () => {
    const rows: ReservedMatterRow[] = [
      { key: 'price', label: 'Price', is_builtin: true, active: true, sort_order: 1 },
      { key: 'custom', label: 'Custom', is_builtin: false, active: false, sort_order: 14 },
    ]
    const active = activeMatterEntries(rows)
    expect(active.some((e) => e.key === 'custom')).toBe(false)
    expect(active.some((e) => e.key === 'price')).toBe(true)
  })
})

describe('slugifyMatter / validateNewMatter', () => {
  it('turns free text into a slug key', () => {
    expect(slugifyMatter('Packaging redesign')).toBe('packaging-redesign')
    expect(slugifyMatter('  MOQ!  ')).toBe('moq')
  })

  it('rejects duplicates, empties and junk', () => {
    const existing = BUILTIN_MATTER_ENTRIES
    expect(validateNewMatter('Price', existing)).toMatch(/already reserved/)
    expect(validateNewMatter('   ', existing)).toMatch(/Name the matter/)
    expect(validateNewMatter('!!!', existing)).toMatch(/letters and numbers/)
    expect(validateNewMatter('Packaging redesign', existing)).toBeNull()
  })

  it('identifies built-ins', () => {
    expect(isBuiltinMatter('price')).toBe(true)
    expect(isBuiltinMatter('packaging-redesign')).toBe(false)
  })
})

describe('refusal template', () => {
  it('interpolates the authority and market placeholders', () => {
    const text = refusalFromTemplate(DEFAULT_REFUSAL_TEMPLATE, {
      authority: 'Mahbub Rahman',
      market: 'Türkiye',
    })
    expect(text).toContain('Mahbub Rahman')
    expect(text).toContain('Türkiye')
    expect(text).not.toContain('{authority}')
    expect(text).not.toContain('{market}')
  })

  it('keeps the default keyword-free (the invariant reply drafts rely on)', () => {
    expect(refusalTemplateIsClean(DEFAULT_REFUSAL_TEMPLATE)).toBe(true)
  })

  it('rejects an edit that names a reserved term', () => {
    const bad = DEFAULT_REFUSAL_TEMPLATE.replace('commercial matters', 'pricing and payment terms')
    expect(refusalTemplateIsClean(bad)).toBe(false)
  })

  it('labels a custom matter key for display', () => {
    expect(reservedLabel('price')).toBe('Price')
    expect(reservedLabel('packaging-redesign')).toBe('Packaging Redesign')
  })
})
