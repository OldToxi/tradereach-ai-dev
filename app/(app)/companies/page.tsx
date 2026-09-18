import { createServerClient } from '@/lib/supabase/server'
import { currentUser } from '@/lib/session'
import type { CompanyRow } from '@/lib/companies'
import { CompaniesScreen } from '@/components/CompaniesScreen'

interface CompanyQuery {
  id: string
  name: string
  market: string
  company_type: string | null
  stage: string
  fit_score: number | null
  disqualified_reason: string | null
  profiles: { full_name: string } | null
}

export default async function CompaniesPage() {
  const supabase = await createServerClient()
  const user = await currentUser()

  const [
    { data: companies, error },
    { data: criterionFacts },
    { data: primaryContacts },
    { data: markets },
    { data: products },
    { data: owners },
  ] = await Promise.all([
    supabase
      .from('company')
      .select(
        'id, name, market, company_type, stage, fit_score, disqualified_reason, profiles!company_owner_id_fkey(full_name)',
      )
      .order('name')
      .returns<CompanyQuery[]>(),
    supabase
      .from('fact')
      .select('company_id, provenance')
      .eq('is_qualification_criterion', true),
    supabase.from('contact').select('company_id, full_name').eq('is_primary', true),
    supabase.from('market').select('country').order('country'),
    supabase.from('product').select('id, name').order('name'),
    // RLS returns only the profiles the caller may read: managers/commercial/
    // auditors see everyone, an executive sees themselves — which is exactly who
    // they may assign as owner.
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['executive', 'manager', 'commercial'])
      .order('full_name'),
  ])

  if (error) {
    return (
      <div>
        <div className="pagehead">
          <div className="grow">
            <h1>Companies</h1>
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <p style={{ color: 'var(--alert)', margin: 0 }}>Could not load companies: {error.message}</p>
        </div>
      </div>
    )
  }

  // Gap counting. Both facts and contacts come through the user client, so an
  // executive's counts and decision-makers are automatically limited to their
  // own markets — the same RLS that scopes the company list itself.
  const gapCounts = new Map<string, number>()
  const hasFacts = new Set<string>()
  for (const f of criterionFacts ?? []) {
    hasFacts.add(f.company_id)
    if (f.provenance !== 'verified') {
      gapCounts.set(f.company_id, (gapCounts.get(f.company_id) ?? 0) + 1)
    }
  }

  const decisionMakers = new Map<string, string>()
  for (const c of primaryContacts ?? []) decisionMakers.set(c.company_id, c.full_name)

  const rows: CompanyRow[] = (companies ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    market: c.market,
    company_type: c.company_type,
    stage: c.stage,
    fit_score: c.fit_score,
    ownerName: c.profiles?.full_name ?? null,
    decisionMaker: decisionMakers.get(c.id) ?? null,
    gapCount: gapCounts.get(c.id) ?? 0,
    hasQualificationFacts: hasFacts.has(c.id),
    disqualified_reason: c.disqualified_reason,
  }))

  return (
    <CompaniesScreen
      companies={rows}
      markets={(markets ?? []).map((m) => m.country)}
      products={products ?? []}
      owners={owners ?? []}
      defaultOwnerId={user.id}
    />
  )
}
