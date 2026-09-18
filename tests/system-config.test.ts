/**
 * Settings → AI workflow (T11.4) spend config. system_config is a plain text store;
 * these tests pin the parsing and validation so a malformed row can never disable
 * the cap silently or produce a nonsense threshold.
 */
import { describe, it, expect } from 'vitest'
import {
  configFromRows,
  spendCapUsd,
  alertThresholdPct,
  capIsValid,
  alertIsValid,
  DEFAULT_SYSTEM_CONFIG,
} from '../lib/system-config'

describe('configFromRows', () => {
  it('falls back to defaults for missing rows', () => {
    const config = configFromRows([])
    expect(config.ai_monthly_cap_usd).toBe('120')
    expect(config.refusal_template).toContain('{authority}')
  })

  it('overrides with stored values and ignores unknown keys', () => {
    const config = configFromRows([
      { key: 'ai_monthly_cap_usd', value: '300' },
      { key: 'bogus', value: 'x' },
    ])
    expect(spendCapUsd(config)).toBe(300)
    expect(alertThresholdPct(config)).toBe(80)
  })
})

describe('spendCapUsd / alertThresholdPct', () => {
  it('parses whole numbers and rejects garbage by falling back', () => {
    expect(spendCapUsd(configFromRows([{ key: 'ai_monthly_cap_usd', value: '42' }]))).toBe(42)
    expect(spendCapUsd(configFromRows([{ key: 'ai_monthly_cap_usd', value: 'banana' }]))).toBe(120)
    expect(alertThresholdPct(configFromRows([{ key: 'ai_alert_threshold_pct', value: '200' }]))).toBe(80)
  })

  it('validates the editable inputs', () => {
    expect(capIsValid('120')).toBe(true)
    expect(capIsValid('0')).toBe(true)
    expect(capIsValid('-5')).toBe(false)
    expect(capIsValid('12.5')).toBe(false)
    expect(alertIsValid('80')).toBe(true)
    expect(alertIsValid('0')).toBe(false)
    expect(alertIsValid('101')).toBe(false)
  })

  it('ships a sane default config', () => {
    expect(spendCapUsd(DEFAULT_SYSTEM_CONFIG)).toBe(120)
    expect(alertThresholdPct(DEFAULT_SYSTEM_CONFIG)).toBe(80)
  })
})
