import { createServerClient } from '@/lib/supabase/server'
import { currentUser, canWrite, seesAllMarkets } from '@/lib/session'
import {
  computeKpis,
  computeFunnel,
  computeMarketBars,
  humanAge,
  type CompanySnapshot,
  type NeedItem,
} from '@/lib/dashboard'
import { formatWhen } from '@/lib/meetings'
import {
  DashboardScreen,
  type DataHealth,
  type FollowUpItem,
  type ReadoutView,
} from '@/components/DashboardScreen'

const CONTACTED_STAGES = ['outreach', 'follow_up', 'reply', 'meeting', 'commercial_discussion']
const CLOSED = new Set(['disqualified', 'no_contact', 'closed'])

interface CompanyQuery {
  id: string
  name: string
  market: string
  stage: string
  company_type: string | null
  fit_score: number | null
  created_at: string
}

interface CompanyRef {
  name: string
  market: string
}

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const user = await currentUser()

  const [
    { data: companies, error },
    { data: criterionFacts },
    { data: allFacts },
    { data: repliedMessages },
    { data: untriagedReplies },
    { data: pricingReplies },
    { data: buyingInterest },
    { data: awaitingApproval },
    { data: approvedMessages },
    { data: meetings },
    { data: dueTasks },
    { data: readoutRows },
  ] = await Promise.all([
    supabase
      .from('company')
      .select('id, name, market, stage, company_type, fit_score, created_at')
      .order('name')
      .returns<CompanyQuery[]>(),
    supabase.from('fact').select('company_id, provenance').eq('is_qualification_criterion', true),
    supabase.from('fact').select('provenance'),
    supabase.from('message').select('company_id').eq('kind', 'reply'),
    supabase.from('reply').select('id, company_id, received_at').is('category', null),
    supabase.from('reply').select('id, company_id, received_at').eq('category', 'pricing_request'),
    supabase.from('reply').select('id').eq('category', 'buying_interest'),
    supabase
      .from('message')
      .select('id, company_id, created_at')
      .eq('status', 'awaiting_approval'),
    supabase.from('message').select('id').eq('status', 'approved'),
    supabase
      .from('meeting')
      .select('id, company_id, starts_at')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at'),
    supabase
      .from('task')
      .select('id, company_id, title, due_on')
      .eq('done', false)
      .not('due_on', 'is', null)
      .lte('due_on', new Date().toISOString().slice(0, 10)),
    supabase
      .from('weekly_readout')
      .select('id, body, generated_at, reviewed_by, profiles!weekly_readout_reviewed_by_fkey(full_name)')
      .order('generated_at', { ascending: false })
      .limit(1),
  ])

  if (error) {
    return (
      <div>
        <div className="pagehead">
          <div className="grow">
            <h1>Dashboard</h1>
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <p style={{ color: 'var(--alert)', margin: 0 }}>Could not load dashboard: {error.message}</p>
        </div>
      </div>
    )
  }

  const companyMap = new Map<string, CompanyRef>((companies ?? []).map((c) => [c.id, c]))
  const refOf = (id: string | null): CompanyRef | undefined => (id ? companyMap.get(id) : undefined)

  const gaps = new Map<string, number>()
  const hasFacts = new Set<string>()
  for (const f of criterionFacts ?? []) {
    hasFacts.add(f.company_id)
    if (f.provenance !== 'verified') gaps.set(f.company_id, (gaps.get(f.company_id) ?? 0) + 1)
  }

  const repliedSet = new Set((repliedMessages ?? []).map((r) => r.company_id))
  const metSet = new Set((meetings ?? []).map((m) => m.company_id))

  const snapshots: CompanySnapshot[] = (companies ?? []).map((c) => ({
    id: c.id,
    stage: c.stage,
    market: c.market,
    hasQualificationFacts: hasFacts.has(c.id),
    gapCount: gaps.get(c.id) ?? 0,
    hasReply: repliedSet.has(c.id),
    hasMeeting: metSet.has(c.id) || c.stage === 'meeting',
    createdAt: c.created_at,
  }))

  const kpis = computeKpis(snapshots)
  const funnel = computeFunnel(snapshots)
  const marketBars = computeMarketBars(snapshots)

  const contacted = snapshots.filter((c) => CONTACTED_STAGES.includes(c.stage)).length
  const repliedCount = snapshots.filter((c) => c.hasReply).length
  const contactedAwaiting = snapshots.filter((c) =>
    ['outreach', 'follow_up'].includes(c.stage) && !c.hasReply,
  ).length
  const replyRatePct = contacted ? Math.round((repliedCount / contacted) * 100) : 0

  const now = Date.now()
  const draftsOlder48h = (awaitingApproval ?? []).filter(
    (m) => now - new Date(m.created_at).getTime() > 48 * 3600e3,
  ).length

  // Needs-you ranking: urgency tier first, then oldest/soonest within the tier.
  const needs: NeedItem[] = []

  for (const r of pricingReplies ?? []) {
    const ref = refOf(r.company_id)
    if (!ref) continue
    needs.push({
      companyId: r.company_id,
      company: ref.name,
      market: ref.market,
      what: 'Reply mentions pricing — needs Commercial Authority',
      tone: 'alert',
      ageLabel: humanAge(now - new Date(r.received_at).getTime()),
      ageMs: now - new Date(r.received_at).getTime(),
      route: '/replies',
      routeLabel: 'Triage',
      tier: 0,
    })
  }

  for (const r of untriagedReplies ?? []) {
    const ref = refOf(r.company_id)
    if (!ref) continue
    needs.push({
      companyId: r.company_id,
      company: ref.name,
      market: ref.market,
      what: 'Reply awaiting triage',
      tone: 'alert',
      ageLabel: humanAge(now - new Date(r.received_at).getTime()),
      ageMs: now - new Date(r.received_at).getTime(),
      route: '/replies',
      routeLabel: 'Triage',
      tier: 1,
    })
  }

  for (const m of awaitingApproval ?? []) {
    const ref = refOf(m.company_id)
    needs.push({
      companyId: m.company_id,
      company: ref?.name ?? 'Unknown company',
      market: ref?.market ?? '',
      what: 'First-touch draft awaiting approval',
      tone: 'due',
      ageLabel: humanAge(now - new Date(m.created_at).getTime()),
      ageMs: now - new Date(m.created_at).getTime(),
      route: '/review',
      routeLabel: 'Review',
      tier: 2,
    })
  }

  for (const t of dueTasks ?? []) {
    const ref = refOf(t.company_id)
    needs.push({
      companyId: t.company_id ?? t.id,
      company: ref?.name ?? 'Task',
      market: ref?.market ?? '',
      what: t.title,
      tone: 'due',
      ageLabel: t.due_on ? `${t.due_on} due` : 'due',
      ageMs: t.due_on ? now - new Date(`${t.due_on}T00:00:00Z`).getTime() : 0,
      route: '/meetings',
      routeLabel: 'Open',
      tier: 3,
    })
  }

  for (const c of companies ?? []) {
    const g = gaps.get(c.id) ?? 0
    if (g > 0 && !CLOSED.has(c.stage)) {
      needs.push({
        companyId: c.id,
        company: c.name,
        market: c.market,
        what: 'AI flagged missing data',
        tone: 'plain',
        ageLabel: humanAge(now - new Date(c.created_at).getTime()),
        ageMs: now - new Date(c.created_at).getTime(),
        route: `/companies/${c.id}`,
        routeLabel: 'Research',
        tier: 4,
      })
    }
  }

  for (const m of meetings ?? []) {
    const ref = refOf(m.company_id)
    const when = formatWhen(m.starts_at)
    needs.push({
      companyId: m.company_id,
      company: ref?.name ?? 'Meeting',
      market: ref?.market ?? '',
      what: 'Meeting confirmed — prep brief ready',
      tone: 'ok',
      ageLabel: `${when.day} ${when.time}`,
      ageMs: -new Date(m.starts_at).getTime(),
      route: '/meetings',
      routeLabel: 'Prepare',
      tier: 5,
    })
  }

  const provenanceCounts = { verified: 0, unverified: 0, ai: 0, human_approved: 0 }
  for (const f of allFacts ?? []) {
    if (f.provenance === 'verified') provenanceCounts.verified++
    else if (f.provenance === 'unverified') provenanceCounts.unverified++
    else if (f.provenance === 'ai') provenanceCounts.ai++
    else if (f.provenance === 'human_approved') provenanceCounts.human_approved++
  }

  const dataHealth: DataHealth = {
    verified: provenanceCounts.verified,
    unverified: provenanceCounts.unverified,
    ai: provenanceCounts.ai,
    humanApproved: (approvedMessages ?? []).length,
  }

  const followUpList: FollowUpItem[] = (dueTasks ?? []).slice(0, 3).map((t) => ({
    id: t.id,
    name: refOf(t.company_id)?.name ?? 'Task',
    detail: t.due_on ? `Due ${t.due_on} · ${t.title}` : t.title,
  }))

  const nextMeeting = meetings?.[0]
    ? formatWhen(meetings[0].starts_at)
    : null
  const nextMeetingLabel = nextMeeting ? `${nextMeeting.day} ${nextMeeting.time} GMT+6` : null

  const readoutRow = readoutRows?.[0] ?? null
  const readout: ReadoutView | null = readoutRow
    ? {
        id: readoutRow.id,
        body: readoutRow.body,
        generated_at: readoutRow.generated_at,
        reviewedBy:
          (readoutRow as unknown as { profiles?: { full_name: string } | null }).profiles?.full_name ??
          null,
      }
    : null

  const canManageReadout = canWrite(user) && seesAllMarkets(user)

  return (
    <DashboardScreen
      firstName={user.fullName.split(' ')[0]}
      kpis={kpis}
      draftsAwaiting={(awaitingApproval ?? []).length}
      draftsOlder48h={draftsOlder48h}
      contactedAwaiting={contactedAwaiting}
      followUpsDue={(dueTasks ?? []).length}
      newReplies={(untriagedReplies ?? []).length}
      buyingInterest={(buyingInterest ?? []).length}
      meetings={(meetings ?? []).length}
      nextMeeting={nextMeetingLabel}
      needs={needs}
      funnel={funnel}
      replyRatePct={replyRatePct}
      marketBars={marketBars}
      dataHealth={dataHealth}
      readout={readout}
      canGenerateReadout={canManageReadout}
      followUpList={followUpList}
    />
  )
}
