/**
 * lib/guardrails-config.ts — pure helpers for the reserved_matter list (T11.5).
 *
 * The Settings → Commercial guardrails pane lets a manager add or remove matters.
 * The built-in rows (is_builtin = true) mirror the ReservedMatter union and are
 * what the deterministic pattern pass recognises; custom rows are caught by the
 * meaning-based model pass. This module owns the list-shaping logic so the server
 * page/actions and the guardrail callers share one reading of the table.
 *
 * No Supabase, no React.
 */
import { BUILTIN_MATTER_ENTRIES, type ReservedMatterEntry } from './guardrails'

/** A row exactly as stored in reserved_matter. */
export interface ReservedMatterRow {
  key: string
  label: string
  is_builtin: boolean
  active: boolean
  sort_order: number
}

/** Rows → entries, ordered by sort_order. Built-ins are never dropped. */
export function mattersFromRows(rows: ReservedMatterRow[]): ReservedMatterEntry[] {
  const byKey = new Map<string, ReservedMatterEntry>()
  for (const row of rows) {
    byKey.set(row.key, { key: row.key, label: row.label })
  }
  // Fill any missing built-ins first so a fresh DB still blocks the canonical list.
  for (const b of BUILTIN_MATTER_ENTRIES) {
    if (!byKey.has(b.key)) byKey.set(b.key, b)
  }
  const order = new Map(rows.map((r) => [r.key, r.sort_order]))
  return [...byKey.values()].sort((a, b) => {
    const ao = order.get(a.key) ?? 1000
    const bo = order.get(b.key) ?? 1000
    return ao - bo || a.key.localeCompare(b.key)
  })
}

/** Only the matters the guardrail should block on: built-ins always, plus active customs. */
export function activeMatterEntries(rows: ReservedMatterRow[]): ReservedMatterEntry[] {
  // Built-ins are the fixed control (§4) and are always blocked, even if a row is
  // missing or was ever toggled. Only a custom matter can be switched off (active).
  const inactiveCustom = new Set(
    rows.filter((r) => !r.is_builtin && !r.active).map((r) => r.key),
  )
  return mattersFromRows(rows).filter((e) => !inactiveCustom.has(e.key))
}

/** A new matter slug from free text: lowercase, spaces/hyphens, ASCII-ish. */
export function slugifyMatter(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Validate a new custom matter. Returns an error string, or null when acceptable. */
export function validateNewMatter(label: string, existing: ReservedMatterEntry[]): string | null {
  const cleaned = label.trim()
  if (!cleaned) return 'Name the matter you want to reserve.'
  if (cleaned.length > 60) return 'Keep the name under 60 characters.'
  const slug = slugifyMatter(cleaned)
  if (!slug) return 'Use letters and numbers in the name.'
  if (existing.some((e) => e.key === slug)) return 'That matter is already reserved.'
  return null
}

/** True when a matter key is one of the built-ins (cannot be fully removed). */
export function isBuiltinMatter(key: string): boolean {
  return BUILTIN_MATTER_ENTRIES.some((e) => e.key === key)
}
