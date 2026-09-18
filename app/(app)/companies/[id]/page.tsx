import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { currentUser, canOverridePriority } from '@/lib/session'
import { computeRank, displayRank } from '@/lib/research'
import {
  CompanyDetailScreen,
  type CompanyDetail,
  type FactView,
  type SourceView,
  type ContactView,
  type AuditView,
  type ResearchView,
} from '@/components/CompanyDetailScreen'

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const user = await currentUser()

  const [
    { data: company },
    { data: facts },
    { data: sources },
    { data: contacts },
    { data: audit },
    { data: latestRun },
  ] = await Promise.all([
    supabase
      .from('company')
      .select(
        'id, name, website, market, company_type, stage, fit_score, disqualified_reason, owner_id, product_id, priority_override, priority_override_reason, profiles!company_owner_id_fkey(full_name), product(name)',
      )
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('fact')
      .select(
        'id, key, value, provenance, is_qualification_criterion, source_id, confirmed_by, confirmed_at, profiles!fact_confirmed_by_fkey(full_name)',
      )
      .eq('company_id', params.id)
      .order('created_at'),
    supabase
      .from('source')
      .select('id, title, url, source_type, supports, quality, retrieved_at')
      .eq('company_id', params.id)
      .order('retrieved_at', { ascending: false }),
    supabase
      .from('contact')
      .select('id, full_name, role_title, email, email_source, provenance, lawful_basis, is_primary')
      .eq('company_id', params.id)
      .order('is_primary', { ascending: false }),
    supabase
      .from('audit_event')
      .select('actor_label, event, detail, created_at')
      .eq('object_type', 'company')
      .eq('object_id', params.id)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('research_run')
      .select(
        'summary, opportunity_summary, gaps, score, breakdown, suitability, priority_reason, decision_maker, created_at',
      )
      .eq('company_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!company) notFound()

  // Ranking (T5.5): among companies promoting the same product, visible to this
  // user (RLS already scopes the query below to the user's markets).
  let rank: { rank: number; total: number; isOverride: boolean } | null = null
  if (company.product_id) {
    const { data: peers } = await supabase
      .from('company')
      .select('id, fit_score, stage')
      .eq('product_id', company.product_id)
    const computed = computeRank(
      (peers ?? []).map((p) => ({ id: p.id, fitScore: p.fit_score, stage: p.stage })),
      company.id,
    )
    rank = displayRank(computed, company.priority_override)
  }

  const research: ResearchView | null = latestRun
    ? {
        summary: latestRun.summary,
        opportunitySummary: latestRun.opportunity_summary,
        gaps: (latestRun.gaps ?? []) as ResearchView['gaps'],
        score: latestRun.score,
        breakdown: (latestRun.breakdown ?? []) as ResearchView['breakdown'],
        suitability: latestRun.suitability as ResearchView['suitability'],
        priorityReason: latestRun.priority_reason,
        decisionMaker: latestRun.decision_maker as ResearchView['decisionMaker'],
        createdAt: latestRun.created_at,
      }
    : null

  const detail: CompanyDetail = {
    id: company.id,
    name: company.name,
    website: company.website,
    market: company.market,
    companyType: company.company_type,
    stage: company.stage,
    fitScore: company.fit_score,
    disqualifiedReason: company.disqualified_reason,
    ownerId: company.owner_id,
    ownerName: company.profiles?.full_name ?? null,
    productName: company.product?.name ?? null,
    priorityOverrideReason: company.priority_override_reason,
    rank,
    research,
    facts: (facts ?? []).map(
      (f): FactView => ({
        id: f.id,
        key: f.key,
        value: f.value,
        provenance: f.provenance,
        isQualificationCriterion: f.is_qualification_criterion,
        sourceId: f.source_id,
        confirmedBy: f.confirmed_by,
        confirmedByName: f.profiles?.full_name ?? null,
      }),
    ),
    sources: (sources ?? []).map(
      (s): SourceView => ({
        id: s.id,
        title: s.title,
        url: s.url,
        sourceType: s.source_type,
        supports: s.supports,
        quality: s.quality,
        retrievedAt: s.retrieved_at,
      }),
    ),
    contacts: (contacts ?? []).map(
      (c): ContactView => ({
        id: c.id,
        fullName: c.full_name,
        roleTitle: c.role_title,
        email: c.email,
        emailSource: c.email_source,
        provenance: c.provenance,
        lawfulBasis: c.lawful_basis,
        isPrimary: c.is_primary,
      }),
    ),
    audit: (audit ?? []).map(
      (a): AuditView => ({
        actorLabel: a.actor_label,
        event: a.event,
        detail: a.detail,
        createdAt: a.created_at,
      }),
    ),
  }

  return (
    <CompanyDetailScreen
      company={detail}
      role={user.role}
      canWrite={user.role !== 'auditor'}
      canOverridePriority={canOverridePriority(user)}
    />
  )
}
