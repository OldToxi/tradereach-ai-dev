/**
 * lib/audit-view.ts — read-side helpers for the audit trail (T11.1).
 *
 * `lib/audit.ts` owns the write side (the `AUDIT` vocabulary and `writeAudit`).
 * This module owns the read side: the filter groups from the mock, the event→group
 * mapping, and CSV serialisation for the export. Pure functions only — no Supabase,
 * no React — so the group mapping and the CSV format can be unit-tested.
 */

export const AUDIT_GROUPS = ['all', 'approvals', 'ai', 'field_changes', 'connector', 'access'] as const
export type AuditGroup = (typeof AUDIT_GROUPS)[number]

export const AUDIT_GROUP_LABELS: Record<AuditGroup, string> = {
  all: 'All event types',
  approvals: 'Approvals',
  ai: 'AI generations',
  field_changes: 'Field changes',
  connector: 'Connector calls',
  access: 'Access changes',
}

/** Server-side page size for the paginated trail. */
export const AUDIT_PAGE_SIZE = 25

/**
 * The fixed vocabulary from `lib/audit.ts`, bucketed into the mock's five filter
 * groups. An event added to `AUDIT` later but not mapped here still appears under
 * "All" — the specific group filters are the only thing it misses.
 */
const EVENT_GROUP: Record<string, AuditGroup> = {
  // approvals and commercial control
  'Approved outreach': 'approvals',
  'Rejected outreach': 'approvals',
  'Requested changes': 'approvals',
  'Held for commercial release': 'approvals',
  'Commercial release granted': 'approvals',
  // AI generations
  'Research run': 'ai',
  'Draft generated': 'ai',
  'Follow-up generated': 'ai',
  'Reply classified': 'ai',
  'Classification corrected by human': 'ai',
  // field / record changes
  'Field verified': 'field_changes',
  'Field returned to unverified': 'field_changes',
  'Source added': 'field_changes',
  'Qualification criterion confirmed': 'field_changes',
  'Product added': 'field_changes',
  'Product edited': 'field_changes',
  'Market added': 'field_changes',
  'Market edited': 'field_changes',
  'Company added': 'field_changes',
  'Stage changed': 'field_changes',
  'Company disqualified': 'field_changes',
  'No further contact recorded': 'field_changes',
  'Priority overridden': 'field_changes',
  'Scoring weights changed': 'field_changes',
  'Task created': 'field_changes',
  'Decision-maker added': 'field_changes',
  'Primary decision-maker set': 'field_changes',
  'Reply draft prepared': 'field_changes',
  'Escalated to Commercial Authority': 'field_changes',
  'Meeting scheduled': 'field_changes',
  'Weekly read-out generated': 'field_changes',
  'Weekly read-out reviewed': 'field_changes',
  // connector calls
  'Gmail connected': 'connector',
  'Gmail draft created': 'connector',
  'Gmail call failed': 'connector',
  'Reply ingested': 'connector',
  // access
  'Access refused': 'access',
  'Signed in': 'access',
  'Role changed': 'access',
  'User invited': 'access',
}

/** The group an event belongs to; unknown events fall back to `all`. */
export function auditGroupFor(event: string): AuditGroup {
  return EVENT_GROUP[event] ?? 'all'
}

export function auditGroupLabel(group: AuditGroup): string {
  return AUDIT_GROUP_LABELS[group]
}

/** The event strings that make up a group, for the `.in('event', …)` query. */
export function eventsInGroup(group: AuditGroup): string[] {
  if (group === 'all') return []
  return Object.entries(EVENT_GROUP)
    .filter(([, g]) => g === group)
    .map(([event]) => event)
}

/* ------------------------------------------------------------------ */
/* CSV export (T11.1)                                                  */
/* ------------------------------------------------------------------ */

export interface AuditRowView {
  id: number
  createdAt: string
  actorLabel: string
  event: string
  objectType: string | null
  objectId: string | null
  detail: string | null
  ip: string | null
}

export const AUDIT_CSV_HEADER = 'time,actor,event,object_type,object_id,detail,ip'

function csvField(value: string | number | null | undefined): string {
  if (value == null) return ''
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** The data rows only (no header, no footer). */
export function auditRowsToCsvBody(rows: AuditRowView[]): string {
  return rows
    .map((r) => [r.createdAt, r.actorLabel, r.event, r.objectType, r.objectId, r.detail, r.ip].map(csvField).join(','))
    .join('\n')
}

/** The `inet` column is generated as `unknown`; coerce it to a display string. */
export function ipToString(ip: unknown): string | null {
  if (ip == null) return null
  if (typeof ip === 'string') return ip
  if (typeof ip === 'number') return String(ip)
  if (typeof ip === 'object') {
    const o = ip as { toString?: () => string }
    if (typeof o?.toString === 'function') return o.toString()
  }
  return String(ip)
}
