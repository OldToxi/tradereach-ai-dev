import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { currentUser } from '@/lib/session'
import {
  AUDIT_CSV_HEADER,
  AUDIT_GROUPS,
  auditRowsToCsvBody,
  eventsInGroup,
  ipToString,
  type AuditGroup,
  type AuditRowView,
} from '@/lib/audit-view'
import { sha256 } from '@/lib/messages'

export const dynamic = 'force-dynamic'

/** Export the full (filtered) trail as CSV, capped so a huge history can't blow memory. */
const MAX_EXPORT = 5000

export async function GET(request: Request) {
  await currentUser()
  const supabase = await createServerClient()

  const groupParam = new URL(request.url).searchParams.get('group') ?? ''
  const group: AuditGroup = (AUDIT_GROUPS as readonly string[]).includes(groupParam)
    ? (groupParam as AuditGroup)
    : 'all'
  const events = eventsInGroup(group)

  let query = supabase
    .from('audit_event')
    .select('id, created_at, actor_label, event, object_type, object_id, detail, ip')
  if (events.length > 0) query = query.in('event', events)

  const { data } = await query.order('created_at', { ascending: false }).limit(MAX_EXPORT)

  const rows: AuditRowView[] = (data ?? []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    actorLabel: r.actor_label,
    event: r.event,
    objectType: r.object_type,
    objectId: r.object_id,
    detail: r.detail,
    ip: ipToString(r.ip),
  }))

  const body = [AUDIT_CSV_HEADER, auditRowsToCsvBody(rows)].filter(Boolean).join('\n')
  const digest = await sha256(body)
  const csv = `${body}\n# ${rows.length} events · exported ${new Date().toISOString()}\n# sha256 ${digest}\n`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
