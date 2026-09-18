import { describe, it, expect } from 'vitest'
import {
  ROLES,
  ROLE_LABELS,
  roleIsValid,
  canApproveFor,
  canReleaseFor,
  marketsLabel,
} from '../lib/users'

describe('role vocabulary', () => {
  it('accepts exactly the four roles and rejects anything else', () => {
    expect(ROLES).toEqual(['executive', 'manager', 'commercial', 'auditor'])
    for (const r of ROLES) expect(roleIsValid(r)).toBe(true)
    expect(roleIsValid('admin')).toBe(false)
    expect(roleIsValid('')).toBe(false)
  })

  it('maps every role to a human label', () => {
    expect(ROLE_LABELS.manager).toBe('Export Manager')
    expect(ROLE_LABELS.commercial).toBe('Commercial Authority')
    expect(ROLE_LABELS.auditor).toBe('Read-only Auditor')
    expect(ROLE_LABELS.executive).toBe('Export Executive')
  })
})

describe('role capabilities', () => {
  it('only manager and commercial can approve', () => {
    expect(canApproveFor('manager')).toBe(true)
    expect(canApproveFor('commercial')).toBe(true)
    expect(canApproveFor('executive')).toBe(false)
    expect(canApproveFor('auditor')).toBe(false)
  })

  it('only commercial can release terms', () => {
    expect(canReleaseFor('commercial')).toBe(true)
    expect(canReleaseFor('manager')).toBe(false)
    expect(canReleaseFor('executive')).toBe(false)
    expect(canReleaseFor('auditor')).toBe(false)
  })
})

describe('marketsLabel', () => {
  it('shows All for commercial and auditor regardless of assigned markets', () => {
    expect(marketsLabel('commercial', [])).toBe('All')
    expect(marketsLabel('auditor', [])).toBe('All')
    expect(marketsLabel('commercial', ['Japan'])).toBe('All')
  })

  it('joins the assigned markets for executives and managers', () => {
    expect(marketsLabel('executive', ['Japan', 'UAE'])).toBe('Japan, UAE')
    expect(marketsLabel('manager', ['Türkiye', 'Germany', 'United Kingdom'])).toBe(
      'Türkiye, Germany, United Kingdom',
    )
  })

  it('falls back to All when a scoped role has no markets', () => {
    expect(marketsLabel('executive', [])).toBe('All')
    expect(marketsLabel('manager', [])).toBe('All')
  })
})
