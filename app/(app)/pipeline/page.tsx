import { createServerClient } from '@/lib/supabase/server'
import { currentUser, canWrite } from '@/lib/session'
import { PipelineScreen, type PipelineCard, type HoldingLaneCounts } from '@/components/PipelineScreen'

const CLOSED = new Set(['disqualified', 'no_contact', 'closed'])

interface CompanyQuery {
  id: string
  name: string
  market: string
  company_type: string | null
  stage: string
  fit_score: number | null
}

export default async function PipelinePage() {
  const supabase = await createServerClient()
  const user = await currentUser()

  const [
    { data: companies, error },
    { data: criterionFacts },
    { data: primaryContacts },
    { data: blockingTasks },
    { data: awaitingApproval },
    { data: heldCommercial },
  ] = await Promise.all([
    supabase
      .from('company')
      .select('id, name, market, company_type, stage, fit_score')
      .order('name')
      .returns<CompanyQuery[]>(),
    supabase.from('fact').select('company_id, provenance').eq('is_qualification_criterion', true),
    supabase.from('contact').select('company_id, full_name, email, email_source').eq('is_primary', true),
    supabase.from('task').select('company_id').eq('done', false).eq('blocks_stage', true),
    supabase.from('message').select('company_id').eq('status', 'awaiting_approval'),
    supabase.from('message').select('company_id').eq('status', 'held_commercial'),
  ])

  if (error) {
    return (
      <div>
        <div className="pagehead">
          <div className="grow">
            <h1>Opportunity pipeline</h1>
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <p style={{ color: 'var(--alert)', margin: 0 }}>Could not load pipeline: {error.message}</p>
        </div>
      </div>
    )
  }

  const gaps = new Map<string, number>()
  const hasFacts = new Set<string>()
  for (const f of criterionFacts ?? []) {
    hasFacts.add(f.company_id)
    if (f.provenance !== 'verified') gaps.set(f.company_id, (gaps.get(f.company_id) ?? 0) + 1)
  }

  const contacts = new Map<string, { name: string; hasNamedContact: boolean }>()
  for (const c of primaryContacts ?? []) {
    contacts.set(c.company_id, {
      name: c.full_name,
      hasNamedContact: !!(c.email && c.email_source),
    })
  }

  const blocking = new Map<string, number>()
  for (const t of blockingTasks ?? []) {
    if (!t.company_id) continue
    blocking.set(t.company_id, (blocking.get(t.company_id) ?? 0) + 1)
  }

  const cards: PipelineCard[] = (companies ?? []).map((c) => {
    const contact = contacts.get(c.id)
    return {
      id: c.id,
      name: c.name,
      market: c.market,
      company_type: c.company_type,
      stage: c.stage,
      fit_score: c.fit_score,
      decisionMaker: contact?.name ?? null,
      gapCount: gaps.get(c.id) ?? 0,
      hasNamedContact: contact?.hasNamedContact ?? false,
      openBlockingTasks: blocking.get(c.id) ?? 0,
    }
  })

  const needsResearch = cards.filter((c) => c.gapCount > 0 && !CLOSED.has(c.stage)).length
  const lanes: HoldingLaneCounts = {
    needs_research: needsResearch,
    nurturing: cards.filter((c) => c.stage === 'nurture').length,
    awaiting_approval: new Set((awaitingApproval ?? []).map((m) => m.company_id)).size,
    awaiting_commercial: new Set((heldCommercial ?? []).map((m) => m.company_id)).size,
    disqualified: cards.filter((c) => c.stage === 'disqualified').length,
    no_contact: cards.filter((c) => c.stage === 'no_contact').length,
    closed: cards.filter((c) => c.stage === 'closed').length,
  }

  return <PipelineScreen companies={cards} lanes={lanes} canWrite={canWrite(user)} />
}
