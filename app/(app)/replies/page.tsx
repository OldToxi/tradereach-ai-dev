import { createServerClient } from '@/lib/supabase/server'
import { currentUser, canWrite } from '@/lib/session'
import { ingestReplies } from '@/lib/reply-ingest'
import { categoryLabel } from '@/lib/replies'
import type { ReservedPoint } from '@/lib/replies'
import { RepliesScreen, type ReplyListItem, type ReplyDetail, type ThreadOption } from '@/components/RepliesScreen'

export default async function RepliesPage({ searchParams }: { searchParams: { id?: string } }) {
  const user = await currentUser()
  const supabase = await createServerClient()

  // No worker, no cron: new mail is read once, on page load. Failure degrades to
  // "show what's already in the database", so a page render never depends on Gmail.
  await ingestReplies()

  const { data: replies } = await supabase
    .from('reply')
    .select(
      'id, body, category, intent, intent_note, urgency, confidence, reasoning, answerable, reserved, next_action, next_action_reasoning, next_action_owner, revisit_on, suggested_stage, corrected_category, received_at, is_simulated, company_id, company:company_id(name, market, website), contact:contact_id(full_name, email), message:message_id(subject)',
    )
    .order('received_at', { ascending: false })

  const rows = (replies ?? []).filter((r) => r.company)

  const list: ReplyListItem[] = rows.map((r) => ({
    id: r.id,
    companyName: r.company!.name,
    contactName: r.contact?.full_name ?? null,
    category: categoryLabel(r.corrected_category ?? r.category),
    isNew: Date.now() - new Date(r.received_at).getTime() < 48 * 3_600_000,
    isSimulated: r.is_simulated,
    when: r.received_at,
  }))

  const selectedId = searchParams.id && rows.find((r) => r.id === searchParams.id) ? searchParams.id : rows[0]?.id
  const selected = rows.find((r) => r.id === selectedId) ?? null

  let detail: ReplyDetail | null = null
  if (selected) {
    detail = {
      id: selected.id,
      companyId: selected.company_id,
      companyName: selected.company!.name,
      market: selected.company!.market,
      contactName: selected.contact?.full_name ?? null,
      contactEmail: selected.contact?.email ?? null,
      subject: selected.message?.subject ?? `Re: ${selected.company!.name}`,
      body: selected.body,
      receivedAt: selected.received_at,
      isSimulated: selected.is_simulated,
      category: selected.category,
      intent: selected.intent,
      intentNote: selected.intent_note,
      urgency: selected.urgency,
      confidence: selected.confidence,
      reasoning: selected.reasoning,
      answerable: selected.answerable ?? [],
      reserved: (selected.reserved ?? []) as unknown as ReservedPoint[],
      nextAction: selected.next_action,
      nextActionReasoning: selected.next_action_reasoning,
      nextActionOwner: selected.next_action_owner,
      suggestedStage: selected.suggested_stage,
      correctedCategory: selected.corrected_category,
    }
  }

  const { data: contacts } = await supabase
    .from('contact')
    .select('id, full_name, company:company_id(name)')
    .not('email', 'is', null)
    .order('full_name', { ascending: true })
    .limit(40)
  const threads: ThreadOption[] = (contacts ?? [])
    .filter((c) => c.company)
    .map((c) => ({ contactId: c.id, label: `${c.company!.name} — ${c.full_name}` }))

  return (
    <RepliesScreen
      list={list}
      selectedId={selected?.id ?? null}
      detail={detail}
      threads={threads}
      canWrite={canWrite(user)}
    />
  )
}
