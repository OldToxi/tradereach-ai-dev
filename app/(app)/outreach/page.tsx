import { createServerClient } from '@/lib/supabase/server'
import { computeOutreach } from '@/lib/outreach'
import type { OutreachCompanyInput, OutreachMessageInput, OutreachReplyInput } from '@/lib/outreach'
import { OutreachScreen } from '@/components/OutreachScreen'

export default async function OutreachPage() {
  const supabase = await createServerClient()

  const [
    { data: companies },
    { data: messages },
    { data: replies },
  ] = await Promise.all([
    supabase.from('company').select('id, name, market, stage, next_touch_at'),
    supabase
      .from('message')
      .select(
        'company_id, kind, touch_number, subject, status, approved_at, scheduled_for, created_at, contact:contact_id(full_name), approver:approved_by(full_name)',
      )
      .in('status', ['sent', 'approved'])
      .order('created_at', { ascending: true }),
    supabase.from('reply').select('company_id, next_action, received_at'),
  ])

  const companyInputs: OutreachCompanyInput[] = (companies ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    market: c.market,
    stage: c.stage,
    nextTouchAt: c.next_touch_at,
  }))

  const messageInputs: OutreachMessageInput[] = (messages ?? [])
    .filter((m) => m.status === 'sent' || m.status === 'approved')
    .map((m) => ({
      companyId: m.company_id,
      contactName: m.contact?.full_name ?? null,
      kind: m.kind,
      touchNumber: m.touch_number,
      subject: m.subject,
      status: m.status as 'sent' | 'approved',
      approverName: m.approver?.full_name ?? null,
      approvedAt: m.approved_at,
      scheduledFor: m.scheduled_for,
      createdAt: m.created_at,
    }))

  const replyInputs: OutreachReplyInput[] = (replies ?? []).map((r) => ({
    companyId: r.company_id,
    nextAction: r.next_action,
    receivedAt: r.received_at,
  }))

  const rows = computeOutreach(companyInputs, messageInputs, replyInputs, new Date())

  return <OutreachScreen rows={rows} />
}
