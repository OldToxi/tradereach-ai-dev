/**
 * lib/audit.ts — the record of what happened.
 *
 * The brief asks for "auditability of important actions" (§7). Important means
 * anything that could affect a buyer, a commitment, or a record someone later
 * relies on. When in doubt, write the row; they are cheap and the absence of one
 * is what makes an incident unexplainable.
 *
 * Writes go through the admin client on purpose: an audit row must land even when
 * the acting user could not have read the object, and must never be suppressed by
 * a policy. The table is append-only at the database level (DO INSTEAD NOTHING
 * rules on update and delete), so this module can only ever add.
 */
import { admin } from './supabase/admin'
import type { SessionUser } from './session'

export interface AuditInput {
  actorId?: string | null
  /** 'Rifat Hasan' | 'AI (sonnet-class)' | 'System' — what the trail shows. */
  actorLabel?: string
  event: string
  objectType?: string
  objectId?: string | null
  detail?: string
  ip?: string | null
}

/**
 * Never throws. A failed audit write must not roll back the action it describes —
 * losing the approval because the log was unavailable is the worse outcome. It
 * does log loudly, and T11.1's test asserts the row appears in the happy path.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    const { error } = await admin.from('audit_event').insert({
      actor_id: input.actorId ?? null,
      actor_label: input.actorLabel ?? 'System',
      event: input.event,
      object_type: input.objectType ?? null,
      object_id: input.objectId ?? null,
      detail: input.detail ?? null,
      ip: input.ip ?? null,
    })
    if (error) console.error('[audit] insert failed:', error.message, input)
  } catch (err) {
    console.error('[audit] threw:', err, input)
  }
}

/** Convenience: same thing, with the actor filled in from a session user. */
export function auditAs(user: SessionUser, ip?: string | null) {
  return (
    event: string,
    rest: Omit<AuditInput, 'event' | 'actorId' | 'actorLabel' | 'ip'> = {},
  ) =>
    writeAudit({
      ...rest,
      event,
      actorId: user.id,
      actorLabel: user.fullName,
      ip: ip ?? null,
    })
}

/** For AI runs, so the trail shows which model acted rather than "System". */
export function auditAsModel(model: string) {
  const tier = model.includes('haiku') ? 'haiku-class' : model.includes('opus') ? 'opus-class' : 'sonnet-class'
  return (event: string, rest: Omit<AuditInput, 'event' | 'actorLabel'> = {}) =>
    writeAudit({ ...rest, event, actorLabel: `AI (${tier})` })
}

/**
 * The events worth writing. Use these constants rather than free strings so the
 * audit filter dropdown in T11.1 has a fixed vocabulary.
 */
export const AUDIT = {
  // approvals and commercial control
  OUTREACH_APPROVED: 'Approved outreach',
  OUTREACH_REJECTED: 'Rejected outreach',
  CHANGES_REQUESTED: 'Requested changes',
  COMMERCIAL_HELD: 'Held for commercial release',
  COMMERCIAL_RELEASED: 'Commercial release granted',
  // data provenance
  FIELD_VERIFIED: 'Field verified',
  FIELD_UNVERIFIED: 'Field returned to unverified',
  SOURCE_ADDED: 'Source added',
  CRITERION_CONFIRMED: 'Qualification criterion confirmed',
  // catalog
  PRODUCT_ADDED: 'Product added',
  PRODUCT_EDITED: 'Product edited',
  MARKET_ADDED: 'Market added',
  MARKET_EDITED: 'Market edited',
  // lifecycle
  COMPANY_ADDED: 'Company added',
  STAGE_CHANGED: 'Stage changed',
  COMPANY_DISQUALIFIED: 'Company disqualified',
  SUPPRESSED: 'No further contact recorded',
  PRIORITY_OVERRIDDEN: 'Priority overridden',
  WEIGHTS_CHANGED: 'Scoring weights changed',
  TASK_CREATED: 'Task created',
  // AI
  AI_RESEARCH: 'Research run',
  AI_DRAFT: 'Draft generated',
  AI_FOLLOWUP: 'Follow-up generated',
  AI_TRIAGE: 'Reply classified',
  AI_RECLASSIFIED: 'Classification corrected by human',
  // connector
  GMAIL_CONNECTED: 'Gmail connected',
  GMAIL_DRAFT_CREATED: 'Gmail draft created',
  GMAIL_FAILED: 'Gmail call failed',
  REPLY_INGESTED: 'Reply ingested',
  // access
  ACCESS_REFUSED: 'Access refused',
  SIGNED_IN: 'Signed in',
  ROLE_CHANGED: 'Role changed',
} as const
