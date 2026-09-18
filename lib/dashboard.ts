/**
 * lib/dashboard.ts — pure helpers for the dashboard (T10.6/T10.7).
 *
 * No Supabase, no cookies, no React: the KPI, funnel, market-bar, needs-you-today and
 * data-health numbers are derived from a normalised company snapshot so the rules
 * ("qualified" means every qualification criterion verified; "contacted" means it has
 * passed outreach) can be unit-tested without a database.
 */

export interface CompanySnapshot {
  id: string
  stage: string
  market: string
  hasQualificationFacts: boolean
  gapCount: number
  hasReply: boolean
  hasMeeting: boolean
  createdAt: string
}

const CLOSED_LANES = ['disqualified', 'no_contact', 'closed']
const CONTACTED_STAGES = ['outreach', 'follow_up', 'reply', 'meeting', 'commercial_discussion']

/** A company is "qualified for outreach" once it has qualification facts and no open gap. */
export function isQualified(c: CompanySnapshot): boolean {
  return c.hasQualificationFacts && c.gapCount === 0 && !CLOSED_LANES.includes(c.stage)
}

export interface Kpis {
  researched: number
  newThisWeek: number
  qualified: number
  qualifiedPct: number
}

export function computeKpis(companies: CompanySnapshot[], now = new Date()): Kpis {
  const researched = companies.length
  const weekAgo = now.getTime() - 7 * 864e5
  const newThisWeek = companies.filter((c) => new Date(c.createdAt).getTime() >= weekAgo).length
  const qualified = companies.filter(isQualified).length
  return {
    researched,
    newThisWeek,
    qualified,
    qualifiedPct: researched ? Math.round((qualified / researched) * 100) : 0,
  }
}

export interface FunnelRow {
  label: string
  count: number
}

export function computeFunnel(companies: CompanySnapshot[]): FunnelRow[] {
  return [
    { label: 'Researched', count: companies.length },
    { label: 'Qualified', count: companies.filter(isQualified).length },
    { label: 'Contacted', count: companies.filter((c) => CONTACTED_STAGES.includes(c.stage)).length },
    { label: 'Replied', count: companies.filter((c) => c.hasReply).length },
    { label: 'Meeting', count: companies.filter((c) => c.hasMeeting || c.stage === 'meeting').length },
    { label: 'Commercial', count: companies.filter((c) => c.stage === 'commercial_discussion').length },
  ]
}

/** Bar colour band for a funnel row, matching the mock's thresholds. */
export function funnelBarClass(count: number, max: number): 'hi' | 'mid' | 'lo' {
  if (max <= 0) return 'lo'
  const ratio = count / max
  if (ratio >= 0.32) return 'hi'
  if (ratio >= 0.11) return 'mid'
  return 'lo'
}

export interface MarketBar {
  market: string
  count: number
}

/** Active (non-closed) leads per market, most first. */
export function computeMarketBars(companies: CompanySnapshot[]): MarketBar[] {
  const counts = new Map<string, number>()
  for (const c of companies) {
    if (CLOSED_LANES.includes(c.stage)) continue
    counts.set(c.market, (counts.get(c.market) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([market, count]) => ({ market, count }))
    .sort((a, b) => b.count - a.count || a.market.localeCompare(b.market))
}

export interface NeedKind {
  /** Deterministic urgency tier — lower runs first. */
  tier: number
}

export type NeedTone = 'alert' | 'due' | 'ok' | 'plain'

export interface NeedItem {
  companyId: string
  company: string
  market: string
  what: string
  tone: NeedTone
  ageLabel: string
  /** Milliseconds this item has been waiting — higher is more "at risk of going cold". */
  ageMs: number
  route: string
  routeLabel: string
  tier: number
}

/**
 * The "Needs you today" ranking. Deterministic: urgency tier first (commercial
 * escalation, then untriaged reply, then approval, follow-up, missing data, meeting),
 * then the oldest waiting item wins — a lead that has waited longest is the one most at
 * risk of going cold.
 */
export function rankNeeds(items: NeedItem[]): NeedItem[] {
  return [...items].sort((a, b) => a.tier - b.tier || b.ageMs - a.ageMs)
}

/** "51h", "7d", "1d", "just now" — the age column's human form. */
export function humanAge(ms: number): string {
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${Math.max(mins, 0)}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}
