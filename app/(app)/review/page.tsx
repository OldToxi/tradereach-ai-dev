import { createServerClient } from '@/lib/supabase/server'
import { currentUser, canApprove, canReleaseCommercial } from '@/lib/session'
import { AUDIT } from '@/lib/audit'
import { PRODUCT_CONTEXT_COLUMNS } from '@/lib/ai/context'
import { scanPatterns, reservedLabel } from '@/lib/guardrails'
import { isSuppressed } from '@/lib/contacts'
import {
  buildPreSendChecks,
  highlightSegments,
  countUnresolvedClaims,
  isWithinSendWindow,
  recipientAllowed,
} from '@/lib/messages'
import { ReviewScreen, type ReviewListItem, type ReviewDetail } from '@/components/ReviewScreen'

export default async function ReviewPage({ searchParams }: { searchParams: { id?: string } }) {
  const user = await currentUser()
  const supabase = await createServerClient()

  const { data: messages } = await supabase
    .from('message')
    .select(
      'id, company_id, contact_id, kind, touch_number, subject, ai_body, human_body, why, claims_used, status, reserved_matter, released_by, created_at, company:company_id(name, market, website), contact:contact_id(full_name, email, provenance, lawful_basis)',
    )
    .in('status', ['awaiting_approval', 'held_commercial'])
    .order('created_at', { ascending: true })

  const list = (messages ?? []).filter((m) => m.company)

  // T8.3 — approved messages still missing a Gmail draft (the inline attempt at
  // approval time failed) need a visible, retryable state, not a silent drop.
  const { data: needsDraft } = await supabase
    .from('message')
    .select('id, subject, company_id, approved_by, company:company_id(name), profiles!message_approved_by_fkey(full_name)')
    .eq('status', 'approved')
    .is('gmail_draft_id', null)
    .order('approved_at', { ascending: false })
    .limit(20)

  const needsDraftIds = (needsDraft ?? []).map((m) => m.id)
  const { data: failures } = needsDraftIds.length
    ? await supabase
        .from('audit_event')
        .select('object_id, detail, created_at')
        .eq('event', AUDIT.GMAIL_FAILED)
        .in('object_id', needsDraftIds)
        .order('created_at', { ascending: false })
    : { data: [] as { object_id: string | null; detail: string | null; created_at: string }[] }
  const lastFailure = new Map<string, string>()
  for (const f of failures ?? []) {
    if (f.object_id && !lastFailure.has(f.object_id)) lastFailure.set(f.object_id, f.detail ?? 'Unknown error')
  }

  const needsGmailDraft = (needsDraft ?? [])
    .filter((m) => m.company)
    .map((m) => ({
      id: m.id,
      companyName: m.company!.name,
      subject: m.subject,
      approvedByName: m.profiles?.full_name ?? '—',
      isMine: m.approved_by === user.id,
      lastError: lastFailure.get(m.id) ?? null,
    }))

  const list_items: ReviewListItem[] = list.map((m) => ({
    id: m.id,
    title: `${m.kind === 'first_touch' ? 'First-touch' : `Follow-up ${m.touch_number}`} — ${m.company!.name}`,
    companyId: m.company_id,
    contactName: m.contact?.full_name ?? null,
    age: m.created_at,
    blocked: m.status === 'held_commercial',
    kind: m.kind,
    touchNumber: m.touch_number,
  }))

  const selectedId = searchParams.id && list.find((m) => m.id === searchParams.id) ? searchParams.id : list[0]?.id
  const selected = list.find((m) => m.id === selectedId) ?? null

  let detail: ReviewDetail | null = null

  if (selected) {
    const [{ data: facts }, { data: market }, { data: suppression }] = await Promise.all([
      supabase
        .from('fact')
        .select('key')
        .eq('company_id', selected.company_id)
        .in('provenance', ['verified', 'human_approved']),
      supabase
        .from('market')
        .select('send_window, weekly_outreach_cap')
        .eq('country', selected.company!.market)
        .maybeSingle(),
      supabase.from('suppression').select('email_or_domain'),
    ])

    const { data: marketCompanies } = await supabase
      .from('company')
      .select('id')
      .eq('market', selected.company!.market)
    const companyIds = (marketCompanies ?? []).map((c) => c.id)
    const since = new Date()
    since.setDate(since.getDate() - 7)
    const { data: weeklyMessages } = companyIds.length
      ? await supabase
          .from('message')
          .select('id')
          .in('company_id', companyIds)
          .in('status', ['approved', 'sent'])
          .gte('created_at', since.toISOString())
      : { data: [] as { id: string }[] }

    const body = selected.human_body ?? selected.ai_body
    const findings = scanPatterns(body)
    const riskSpans = findings.map((f) => ({ start: f.offset, end: f.offset + f.sentence.length }))
    const claimsUsed = (selected.claims_used ?? []) as Array<{ claim: string; fromFact: string }>
    const verifiedKeys = (facts ?? []).map((f) => f.key)
    const unresolvedClaims = countUnresolvedClaims(claimsUsed, verifiedKeys, [...PRODUCT_CONTEXT_COLUMNS])

    const suppressedSet = new Set((suppression ?? []).map((s) => s.email_or_domain.toLowerCase()))
    const suppressed = isSuppressed(selected.contact?.email ?? null, selected.company!.website, suppressedSet)

    const checks = buildPreSendChecks({
      contact: selected.contact ? { provenance: selected.contact.provenance, email: selected.contact.email } : null,
      claimsUsed,
      unresolvedClaims,
      body,
      kind: selected.kind,
      touchNumber: selected.touch_number,
      recipientAllowed: recipientAllowed(selected.contact?.email ?? null),
      withinSendWindow: isWithinSendWindow(market?.send_window ?? null, new Date()),
      weeklySent: weeklyMessages?.length ?? 0,
      weeklyCap: market?.weekly_outreach_cap ?? 12,
      guardrailClear: findings.length === 0,
      released: selected.released_by != null,
      lawfulBasisRecorded: !!selected.contact?.lawful_basis,
      suppressed,
    })

    detail = {
      id: selected.id,
      companyId: selected.company_id,
      companyName: selected.company!.name,
      market: selected.company!.market,
      contactName: selected.contact?.full_name ?? null,
      contactEmail: selected.contact?.email ?? null,
      subject: selected.subject,
      body,
      segments: highlightSegments(body, claimsUsed, riskSpans),
      why: (selected.why ?? []) as string[],
      status: selected.status,
      reservedMatter: selected.reserved_matter,
      reservedMatterLabel: selected.reserved_matter ? reservedLabel(selected.reserved_matter) : null,
      released: selected.released_by != null,
      age: selected.created_at,
      checks,
    }
  }

  return (
    <ReviewScreen
      list={list_items}
      selectedId={selected?.id ?? null}
      detail={detail}
      role={user.role}
      canApprove={canApprove(user)}
      canReleaseCommercial={canReleaseCommercial(user)}
      needsGmailDraft={needsGmailDraft}
    />
  )
}
