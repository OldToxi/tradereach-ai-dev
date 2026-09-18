/**
 * lib/catalog.ts — pure helpers for the catalog screens (products, markets).
 *
 * No Supabase, no cookies, no React here: these are plain functions so the rules
 * they encode can be unit-tested without a request or a database.
 */
import type { Role } from './session'

/**
 * Catalog rows (products and markets) are writable by managers only. This mirrors
 * the `product_write` / `market_write` RLS policies in 0002_rls.sql — the UI hides
 * the write controls and the server action re-checks, but the database is the
 * enforcement.
 */
export const canManageCatalog = (role: Role): boolean => role === 'manager'

interface MarketFocus {
  country: string
  product_focus: string | null
}

/**
 * Which markets we promote a product in, derived from `market.product_focus`.
 *
 * Product names follow "<material/type> <noun>" ("Woven jute bags"), and the
 * market focus strings list those nouns ("Jute yarn, bags"). Matching on the
 * final noun — yarn, bags, garments, tableware — is what keeps "Woven jute bags"
 * out of "Jute yarn" markets, where "jute" alone would match both.
 */
export function marketsForProduct(productName: string, markets: MarketFocus[]): string[] {
  const noun = productName.trim().toLowerCase().split(/\s+/).pop()
  if (!noun) return []
  return markets
    .filter((m) => {
      if (!m.product_focus) return false
      return m.product_focus.toLowerCase().split(/[^a-z]+/).includes(noun)
    })
    .map((m) => m.country)
}

/** Display label for a market-note key; falls back to a readable key. */
export function marketNoteLabel(key: string): string {
  return MARKET_NOTE_LABELS[key] ?? key.replace(/_/g, ' ')
}

const MARKET_NOTE_LABELS: Record<string, string> = {
  why_this_market: 'Why this market',
  import_volume: 'Import volume',
  duty: 'Duty',
  buying_season: 'Buying season',
  language: 'Language',
  local_rules: 'Local rules',
}

/** Canonical display order for a market note, matching the mock card. */
export const MARKET_NOTE_ORDER = [
  'why_this_market',
  'import_volume',
  'duty',
  'buying_season',
  'language',
  'local_rules',
] as const

export function marketNoteOrderIndex(key: string): number {
  const i = MARKET_NOTE_ORDER.indexOf(key as (typeof MARKET_NOTE_ORDER)[number])
  return i === -1 ? MARKET_NOTE_ORDER.length : i
}

export const MARKET_PRIORITY_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  watch: 'Watch',
}

export const MARKET_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  under_review: 'Under review',
  watchlist: 'Watchlist',
  paused: 'Paused',
}

export const MARKET_PRIORITY_CLASS: Record<string, string> = {
  high: 'tag-ok',
  medium: 'tag-due',
  watch: '',
}

export const MARKET_STATUS_CLASS: Record<string, string> = {
  active: 'tag-ok',
  under_review: 'tag-due',
  watchlist: '',
  paused: 'tag-alert',
}

export const DEFAULT_SEND_WINDOW = '08:00–17:00, Mon–Fri'
export const DEFAULT_REQUIRED_BEFORE_SENDING =
  'Named decision-maker · one verified trade source · product fit stated in the first two lines'
export const DEFAULT_LEGAL_NOTE =
  'GDPR applies. Contact must have a lawful-interest basis recorded; unsubscribe honoured permanently.'

export interface MarketGuardrails {
  send_window: string
  weekly_outreach_cap: number
  required_before_sending: string
  legal_note: string
}

/**
 * Resolve a market's stored guardrails, falling back to safe defaults when a
 * field is unset. The T7.4 pre-send checks read the same values through this
 * helper, so an empty guardrail fails closed rather than failing open.
 */
export function marketGuardrails(market: {
  send_window: string | null
  weekly_outreach_cap: number
  required_before_sending: string | null
  legal_note: string | null
}): MarketGuardrails {
  return {
    send_window: market.send_window?.trim() || DEFAULT_SEND_WINDOW,
    weekly_outreach_cap: market.weekly_outreach_cap,
    required_before_sending:
      market.required_before_sending?.trim() || DEFAULT_REQUIRED_BEFORE_SENDING,
    legal_note: market.legal_note?.trim() || DEFAULT_LEGAL_NOTE,
  }
}

/* ------------------------------------------------------------------ */
/* Market fit (T13.1) — a deterministic read-out of stored research     */
/* ------------------------------------------------------------------ */

/**
 * The products screen's "Market fit" panel is NOT a new model call — AGENTS.md §5 caps
 * us at four prompts, and research is already a prompt. What is shown here is an
 * aggregate of the research scores the `research` prompt already wrote to
 * `research_run`, grouped by the market each researched company sits in. The wording is
 * deterministic, but the scores underneath are AI output and stay AI-badged.
 */
export interface MarketFitInput {
  market: string
  score: number
}

export interface MarketFitSummary {
  hasData: boolean
  researchedCompanies: number
  marketsAnalyzed: number
  strongest: string[]
  strongestScore: number | null
  weakest: string[]
  weakestScore: number | null
  byMarket: Array<{ market: string; companies: number; avgScore: number }>
}

export function marketFitSummary(runs: MarketFitInput[]): MarketFitSummary {
  if (runs.length === 0) {
    return {
      hasData: false,
      researchedCompanies: 0,
      marketsAnalyzed: 0,
      strongest: [],
      strongestScore: null,
      weakest: [],
      weakestScore: null,
      byMarket: [],
    }
  }

  const totals = new Map<string, { total: number; count: number }>()
  for (const r of runs) {
    const cur = totals.get(r.market) ?? { total: 0, count: 0 }
    cur.total += r.score
    cur.count += 1
    totals.set(r.market, cur)
  }

  const byMarket = [...totals.entries()]
    .map(([market, v]) => ({ market, companies: v.count, avgScore: Math.round(v.total / v.count) }))
    .sort((a, b) => b.avgScore - a.avgScore)

  const top = byMarket[0].avgScore
  const bottom = byMarket[byMarket.length - 1].avgScore
  const strongest = byMarket.filter((r) => r.avgScore === top).map((r) => r.market)
  // A single market can't be both strongest and weakest — the mock only names a
  // "weakest" when there is a real spread to speak of.
  const weakest = byMarket.length > 1 && bottom !== top
    ? byMarket.filter((r) => r.avgScore === bottom).map((r) => r.market)
    : []

  return {
    hasData: true,
    researchedCompanies: runs.length,
    marketsAnalyzed: byMarket.length,
    strongest,
    strongestScore: top,
    weakest,
    weakestScore: weakest.length ? bottom : null,
    byMarket,
  }
}

/** The one-sentence read-out shown under the AI badge. */
export function marketFitText(summary: MarketFitSummary): string {
  if (!summary.hasData) return ''
  const list = (arr: string[]) => arr.join(' and ')
  const strongest = `Strongest fit sits with ${list(summary.strongest)} (average fit score ${summary.strongestScore}).`
  const weakest = summary.weakest.length
    ? ` Weakest fit is ${list(summary.weakest)} (average fit score ${summary.weakestScore}).`
    : ''
  return strongest + weakest
}
