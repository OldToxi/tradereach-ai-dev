/**
 * lib/pipeline.ts — pure helpers for the opportunity pipeline (T10.4/T10.5).
 *
 * No Supabase, no cookies, no React: the stage ordering, the move rules and the
 * holding-lane vocabulary are plain functions so the one rule that matters — which
 * moves the database will refuse, and why — can be unit-tested without a request.
 *
 * The move rules here mirror `enforce_stage_gate` (supabase/migrations/0012) exactly.
 * The trigger is the source of truth; this file only lets the UI explain a refusal
 * *before* the round-trip, so a drag that would be refused is refused in the UI.
 */

/** The nine board columns, left to right, in the mock's order. */
export const PIPELINE_STAGES = [
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

/** The full stage enum order, including the four holding-lane stages. */
export const STAGE_ORDER = [
  ...PIPELINE_STAGES,
  'nurture',
  'disqualified',
  'no_contact',
  'closed',
] as const

export function stageRank(stage: string): number {
  return (STAGE_ORDER as readonly string[]).indexOf(stage)
}

export function isPipelineStage(stage: string): boolean {
  return (PIPELINE_STAGES as readonly string[]).includes(stage)
}

const ADVANCE_STAGES = [
  'contact_identification',
  'outreach',
  'follow_up',
  'reply',
  'meeting',
  'commercial_discussion',
]

const NAMED_CONTACT_STAGES = ['outreach', 'follow_up', 'reply', 'meeting', 'commercial_discussion']

export interface StageMoveContext {
  /** Unverified qualification criteria — blocks leaving qualification. */
  gapCount: number
  /** A contact with both an email and a recorded email source. */
  hasNamedContact: boolean
  /** Open tasks flagged `blocks_stage` — block *forward* advancement only. */
  openBlockingTasks: number
}

/**
 * Why moving `from` → `to` will be refused, or null when the move is allowed.
 * Order and wording match the trigger, so a refusal shown here is the same one the
 * database would raise.
 */
export function moveBlockReason(from: string, to: string, ctx: StageMoveContext): string | null {
  if (ADVANCE_STAGES.includes(to) && ctx.gapCount > 0) {
    return `${ctx.gapCount} qualification field(s) are still unverified`
  }
  if (NAMED_CONTACT_STAGES.includes(to) && !ctx.hasNamedContact) {
    return 'No named decision-maker with a recorded email source yet'
  }
  if (
    stageRank(to) > stageRank(from) &&
    ADVANCE_STAGES.includes(to) &&
    ctx.openBlockingTasks > 0
  ) {
    return `${ctx.openBlockingTasks} open task(s) block stage advancement`
  }
  return null
}

/** Lead tone for a card's left border, from the mock's hot/warm/cold/risk scale. */
export function leadTone(stage: string, gapCount: number): 'hot' | 'warm' | 'cold' | 'risk' {
  if (['reply', 'meeting', 'commercial_discussion'].includes(stage)) return 'hot'
  if (['outreach', 'follow_up', 'contact_identification'].includes(stage)) return 'warm'
  return gapCount > 0 ? 'cold' : 'warm'
}

export interface HoldingLane {
  key: string
  label: string
  hint: string
}

/** The seven holding lanes from the mock. Some are stages, some are derived states. */
export const HOLDING_LANES: HoldingLane[] = [
  { key: 'needs_research', label: 'Needs more research', hint: 'AI listed a missing fact that blocks qualification' },
  { key: 'nurturing', label: 'Nurturing', hint: 'Right buyer, wrong quarter' },
  { key: 'awaiting_approval', label: 'Awaiting approval', hint: 'Draft written, no approver yet' },
  { key: 'awaiting_commercial', label: 'Awaiting commercial release', hint: 'Message touches price or terms' },
  { key: 'disqualified', label: 'Disqualified', hint: 'Reason recorded' },
  { key: 'no_contact', label: 'No further contact', hint: 'Asked us to stop — permanent' },
  { key: 'closed', label: 'Closed', hint: 'Won, lost or dormant' },
]

/** Attaches live counts to the canonical lane list. Missing keys read as 0. */
export function holdingLanesWithCounts(counts: Record<string, number>): Array<HoldingLane & { count: number }> {
  return HOLDING_LANES.map((lane) => ({ ...lane, count: counts[lane.key] ?? 0 }))
}
