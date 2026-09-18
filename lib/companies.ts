/**
 * lib/companies.ts — pure helpers for the companies screen (T4.1).
 *
 * No Supabase, no cookies, no React: plain functions so the rules they encode
 * (stage labels, fit-score bar colour, the stage-driven next action) can be
 * unit-tested without a request or a database.
 */

/** Database `stage` enum → the label the mock shows in the filter and table. */
export const STAGE_LABELS: Record<string, string> = {
  market_selection: 'Market selection',
  company_research: 'Research',
  qualification: 'Qualification',
  contact_identification: 'Contact identification',
  outreach: 'Outreach',
  follow_up: 'Follow-up',
  reply: 'Reply',
  meeting: 'Meeting',
  commercial_discussion: 'Commercial discussion',
  nurture: 'Nurture',
  disqualified: 'Disqualified',
  no_contact: 'No contact',
  closed: 'Closed',
}

/** Filter dropdown, in the mock's order. */
export const STAGE_OPTIONS = [
  'market_selection',
  'company_research',
  'qualification',
  'contact_identification',
  'outreach',
  'follow_up',
  'reply',
  'meeting',
  'commercial_discussion',
  'nurture',
  'disqualified',
] as const

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? stage
}

/** Fit-score bar colour band, matching the mock's thresholds. */
export function fitBarClass(score: number | null | undefined): 'hi' | 'mid' | 'lo' | 'none' {
  if (score == null) return 'none'
  if (score >= 80) return 'hi'
  if (score >= 60) return 'mid'
  return 'lo'
}

/**
 * A short, stage-driven next action for the table. T10.x replaces this with the
 * precise pipeline next action (touch number, due date); for the list this is a
 * stable, honest fallback derived from where the company actually is.
 */
export function companyNextAction(c: {
  stage: string
  gapCount: number
  disqualified_reason: string | null
}): string {
  switch (c.stage) {
    case 'market_selection':
    case 'company_research':
      return c.gapCount > 0 ? `Research incomplete — ${c.gapCount} field(s) missing` : 'Run AI research'
    case 'qualification':
      return c.gapCount > 0
        ? `Confirm ${c.gapCount} remaining ${c.gapCount === 1 ? 'criterion' : 'criteria'}`
        : 'Advance to contact identification'
    case 'contact_identification':
      return 'Find a named sourcing contact'
    case 'outreach':
      return 'Approve first-touch draft'
    case 'follow_up':
      return 'Follow-up due'
    case 'reply':
      return 'Triage reply and draft response'
    case 'meeting':
      return 'Prepare call brief'
    case 'commercial_discussion':
      return 'Escalate pricing/terms to commercial authority'
    case 'nurture':
      return 'Quarterly nurture touch'
    case 'disqualified':
      return `Closed — ${c.disqualified_reason || 'reason recorded'}`
    case 'no_contact':
    case 'closed':
      return 'Closed'
    default:
      return 'Next action TBD'
  }
}

export interface CompanyRow {
  id: string
  name: string
  market: string
  company_type: string | null
  stage: string
  fit_score: number | null
  ownerName: string | null
  decisionMaker: string | null
  gapCount: number
  hasQualificationFacts: boolean
  disqualified_reason: string | null
}

/** The "Data" column: how many qualification fields still need verification. */
export function dataCell(c: Pick<CompanyRow, 'gapCount' | 'hasQualificationFacts'>): {
  text: string
  className: string
} {
  if (c.gapCount > 0) return { text: `${c.gapCount} missing`, className: 'tag tag-due' }
  if (c.hasQualificationFacts) return { text: 'Complete', className: 'tag tag-ok' }
  return { text: 'Not researched', className: 'tag' }
}
