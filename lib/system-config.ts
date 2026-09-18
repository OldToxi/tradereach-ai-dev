/**
 * lib/system-config.ts — pure helpers for the system_config table (T11.4, T11.5).
 *
 * system_config is a single-row-per-key text store. Three keys exist:
 *   ai_monthly_cap_usd     — the AI spend cap enforced in lib/ai/client.ts
 *   ai_alert_threshold_pct — the alert shown in Settings → AI workflow
 *   refusal_template       — the standard refusal wording (T11.5)
 *
 * No Supabase, no React. The server page and actions read/write the table; this
 * module owns the defaults, the parsing, and the validation so those rules can be
 * unit-tested.
 */
import { DEFAULT_REFUSAL_TEMPLATE } from './guardrails'

export const SYSTEM_CONFIG_KEYS = [
  'ai_monthly_cap_usd',
  'ai_alert_threshold_pct',
  'refusal_template',
] as const

export type SystemConfigKey = (typeof SYSTEM_CONFIG_KEYS)[number]

export type SystemConfig = Record<SystemConfigKey, string>

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  ai_monthly_cap_usd: '120',
  ai_alert_threshold_pct: '80',
  refusal_template: DEFAULT_REFUSAL_TEMPLATE,
}

/** Merge system_config rows over the defaults, so a fresh DB still yields a value. */
export function configFromRows(rows: Array<{ key: string; value: string }>): SystemConfig {
  const out: SystemConfig = { ...DEFAULT_SYSTEM_CONFIG }
  for (const row of rows) {
    if ((SYSTEM_CONFIG_KEYS as readonly string[]).includes(row.key)) {
      out[row.key as SystemConfigKey] = row.value
    }
  }
  return out
}

export function spendCapUsd(config: SystemConfig): number {
  const n = Number(config.ai_monthly_cap_usd)
  return Number.isFinite(n) && n > 0 ? n : Number(DEFAULT_SYSTEM_CONFIG.ai_monthly_cap_usd)
}

export function alertThresholdPct(config: SystemConfig): number {
  const n = Number(config.ai_alert_threshold_pct)
  return Number.isFinite(n) && n > 0 && n <= 100
    ? n
    : Number(DEFAULT_SYSTEM_CONFIG.ai_alert_threshold_pct)
}

/** The cap is a whole-dollar amount; 0 disables enforcement (still a valid choice). */
export function capIsValid(value: string): boolean {
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 && n <= 100_000
}

/** The alert threshold is a whole percent in 1..100. */
export function alertIsValid(value: string): boolean {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 100
}
