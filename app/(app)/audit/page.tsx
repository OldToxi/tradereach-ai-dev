import { createServerClient } from '@/lib/supabase/server'
import { currentUser } from '@/lib/session'
import { AuditScreen, type AuditRowView } from '@/components/AuditScreen'
import {
  AUDIT_GROUPS,
  AUDIT_PAGE_SIZE,
  eventsInGroup,
  ipToString,
  type AuditGroup,
} from '@/lib/audit-view'

export const dynamic = 'force-dynamic'

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { group?: string; page?: string }
}) {
  // Any authenticated user may read the trail — RLS `audit_read` is `auth.uid() is not null`.
  await currentUser()
  const supabase = await createServerClient()

  const group: AuditGroup = (AUDIT_GROUPS as readonly string[]).includes(searchParams.group ?? '')
    ? (searchParams.group as AuditGroup)
    : 'all'
  const requestedPage = Math.max(1, Number.parseInt(searchParams.page ?? '1', 10) || 1)

  const events = eventsInGroup(group)

  let countQuery = supabase.from('audit_event').select('id', { count: 'exact', head: true })
  let rowsQuery = supabase
    .from('audit_event')
    .select('id, created_at, actor_label, event, object_type, object_id, detail, ip')
  if (events.length > 0) {
    countQuery = countQuery.in('event', events)
    rowsQuery = rowsQuery.in('event', events)
  }

  const [{ count }, { data }] = await Promise.all([
    countQuery,
    rowsQuery
      .order('created_at', { ascending: false })
      .range((requestedPage - 1) * AUDIT_PAGE_SIZE, requestedPage * AUDIT_PAGE_SIZE - 1),
  ])

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)

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

  return (
    <AuditScreen rows={rows} total={total} page={page} totalPages={totalPages} group={group} />
  )
}
