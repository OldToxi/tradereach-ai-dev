import { describe, it, expect } from 'vitest'
import { navForRole, crumbFor } from '../lib/nav'

describe('role-aware navigation', () => {
  it('hides Settings & access from executives', () => {
    const control = navForRole('executive').find((g) => g.label === 'Control')
    expect(control?.items.some((i) => i.href === '/settings')).toBe(false)
  })

  it('hides Settings & access from auditors', () => {
    const control = navForRole('auditor').find((g) => g.label === 'Control')
    expect(control?.items.some((i) => i.href === '/settings')).toBe(false)
  })

  it('shows Settings & access to managers', () => {
    const control = navForRole('manager').find((g) => g.label === 'Control')
    expect(control?.items.some((i) => i.href === '/settings')).toBe(true)
  })

  it('keeps the core workspace for every role', () => {
    for (const role of ['executive', 'manager', 'commercial', 'auditor'] as const) {
      const groups = navForRole(role)
      expect(groups[0].label).toBe('Workspace')
      expect(groups[0].items.some((i) => i.href === '/dashboard')).toBe(true)
    }
  })

  it('resolves a breadcrumb for a known route', () => {
    expect(crumbFor('/review')).toBe('Review queue')
    expect(crumbFor('/settings')).toBe('Settings & access')
  })
})
