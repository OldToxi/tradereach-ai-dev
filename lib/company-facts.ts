/**
 * lib/company-facts.ts — pure helpers for the company detail screen (T4.3–T4.7).
 *
 * No Supabase, no cookies, no React: plain functions so the rules they encode
 * (fact labels, the qualification checklist, the stage gate) can be unit-tested
 * without a request or a database.
 */

/** Fact keys that render as analyst notes in the Research tab, never as a fact row. */
export function isAnalystNoteKey(key: string): boolean {
  return key === 'analyst_note' || key.startsWith('analyst_note_')
}

/** Human label for a fact key; falls back to a readable version of the key. */
const FACT_LABELS: Record<string, string> = {
  legal_name: 'Legal name',
  registration: 'Registration',
  website: 'Website',
  company_type: 'Type',
  employees: 'Employees',
  imports_category: 'Imports this product category',
  current_suppliers: 'Current suppliers',
  annual_revenue: 'Annual revenue',
  screening: 'Screening',
  buys_south_asia: 'Buys from South Asia today',
  volume_fit: 'Volume fits our capacity',
  certification_match: 'Certification match',
  decision_maker_found: 'Decision-maker identified',
  credit_signal: 'Payment history / credit signal',
  importer_licence: 'Importer licence',
  annual_volume: 'Annual volume',
  product_line: 'Product line',
  analyst_note: 'Analyst note',
}

export function factLabel(key: string): string {
  if (isAnalystNoteKey(key)) return 'Analyst note'
  return FACT_LABELS[key] ?? key.replace(/_/g, ' ')
}

/**
 * The six canonical qualification criteria. The checklist in T4.6 is rendered
 * from a company's own `is_qualification_criterion` facts — the six keys here are
 * the vocabulary the seed uses, and they double as the empty-state hint for a
 * company that has not been researched yet.
 */
export const QUALIFICATION_CRITERIA = [
  { key: 'imports_category', label: 'Imports this product category' },
  { key: 'buys_south_asia', label: 'Buys from South Asia today' },
  { key: 'volume_fit', label: 'Volume fits our capacity' },
  { key: 'certification_match', label: 'Certification match' },
  { key: 'decision_maker_found', label: 'Decision-maker identified' },
  { key: 'credit_signal', label: 'Payment history / credit signal' },
] as const

export interface QualificationFact {
  provenance: string
}

/** "N of M confirmed" — confirmed means the fact is verified, matching the gate. */
export function qualificationStatus(facts: QualificationFact[]): { confirmed: number; total: number } {
  return {
    confirmed: facts.filter((f) => f.provenance === 'verified').length,
    total: facts.length,
  }
}

/** Pipeline order for the "advance" control. Terminal and side lanes are not in it. */
export const ADVANCE_ORDER = [
  'market_selection',
  'company_research',
  'qualification',
  'contact_identification',
  'outreach',
  'follow_up',
  'reply',
  'meeting',
  'commercial_discussion',
] as const

export function nextStage(stage: string): string | null {
  const i = ADVANCE_ORDER.indexOf(stage as (typeof ADVANCE_ORDER)[number])
  if (i === -1 || i === ADVANCE_ORDER.length - 1) return null
  return ADVANCE_ORDER[i + 1]
}

/**
 * The stage gate (T4.7). The DB trigger `enforce_stage_gate` blocks a company from
 * moving into any post-qualification stage while a qualification fact is
 * unverified; this mirrors that rule so the UI can disable the control and say
 * why, rather than fire a request the database will refuse.
 */
export function isPastQualification(stage: string): boolean {
  return ['contact_identification', 'outreach', 'follow_up', 'reply', 'meeting', 'commercial_discussion'].includes(
    stage,
  )
}

export function gateBlocksAdvance(unverifiedCriteria: number, targetStage: string): boolean {
  return isPastQualification(targetStage) && unverifiedCriteria > 0
}

export function gateReason(unverifiedCriteria: number): string {
  return `Cannot advance: ${unverifiedCriteria} qualification field${unverifiedCriteria === 1 ? '' : 's'} still unverified. Confirm them in the Qualification tab first.`
}

/* ------------------------------------------------------------------ */
/* Provenance badges                                                   */
/* ------------------------------------------------------------------ */

const PROVENANCE_CLASS: Record<string, string> = {
  verified: 'prov-v',
  unverified: 'prov-u',
  ai: 'prov-a',
  human_approved: 'prov-h',
}

const PROVENANCE_LABEL: Record<string, string> = {
  verified: 'Verified',
  unverified: 'Unverified',
  ai: 'AI-generated',
  human_approved: 'Human-approved',
}

export function provenanceClass(p: string): string {
  return PROVENANCE_CLASS[p] ?? 'prov-u'
}

export function provenanceLabel(p: string): string {
  return PROVENANCE_LABEL[p] ?? 'Unverified'
}
