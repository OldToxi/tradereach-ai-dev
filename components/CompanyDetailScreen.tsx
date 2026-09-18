'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { stageLabel, STAGE_LABELS } from '@/lib/companies'
import {
  factLabel,
  isAnalystNoteKey,
  qualificationStatus,
  nextStage,
  isPastQualification,
  gateReason,
  provenanceClass,
  provenanceLabel,
} from '@/lib/company-facts'
import { addSource, addAnalystNote, promoteFactToVerified, changeStage } from '@/lib/company-actions'
import { runResearch, createTask, overridePriority, disqualifyCompany } from '@/lib/research-actions'
import {
  breakdownBarClass,
  RECOMMENDATION_LABELS,
  RESEARCH_DEPTHS,
  DISQUALIFY_REASONS,
  type ResearchDepth,
} from '@/lib/research'

export interface FactView {
  id: string
  key: string
  value: string
  provenance: string
  isQualificationCriterion: boolean
  sourceId: string | null
  confirmedBy: string | null
  confirmedByName: string | null
}

export interface SourceView {
  id: string
  title: string
  url: string | null
  sourceType: string | null
  supports: string | null
  quality: string | null
  retrievedAt: string
}

export interface ContactView {
  id: string
  fullName: string
  roleTitle: string | null
  email: string | null
  emailSource: string | null
  provenance: string
  lawfulBasis: string | null
  isPrimary: boolean
}

export interface AuditView {
  actorLabel: string
  event: string
  detail: string | null
  createdAt: string
}

export interface ResearchView {
  summary: string
  opportunitySummary: string
  gaps: Array<{ field: string; whyItMatters: string; blocksQualification: boolean; howToFind: string }>
  score: number
  breakdown: Array<{ criterion: string; max: number; awarded: number; reason: string }>
  suitability: {
    recommendation: 'proceed' | 'research_more' | 'nurture' | 'disqualify'
    reasoning: string
    confidence: 'low' | 'medium' | 'high'
    wouldChangeIf: string
  }
  priorityReason: string | null
  createdAt: string
}

export interface CompanyDetail {
  id: string
  name: string
  website: string | null
  market: string
  companyType: string | null
  stage: string
  fitScore: number | null
  disqualifiedReason: string | null
  ownerId: string | null
  ownerName: string | null
  productName: string | null
  priorityOverrideReason: string | null
  rank: { rank: number; total: number; isOverride: boolean } | null
  research: ResearchView | null
  facts: FactView[]
  sources: SourceView[]
  contacts: ContactView[]
  audit: AuditView[]
}

function ProvBadge({ provenance }: { provenance: string }) {
  return (
    <span className={`prov ${provenanceClass(provenance)}`}>
      <i />
      {provenanceLabel(provenance)}
    </span>
  )
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

const SUPPORTS_OPTIONS = [
  'Company is an importer',
  'Product range',
  'Volume or capacity',
  'Certification',
  'Contact details',
  'Ownership or registration',
] as const

const QUALITY_OPTIONS = [
  { value: 'primary', label: 'Primary — registry, customs, the company itself' },
  { value: 'secondary', label: 'Secondary — trade press, directory' },
  { value: 'weak', label: 'Weak — aggregator, unattributed' },
] as const

export function CompanyDetailScreen({
  company,
  role,
  canWrite,
  canOverridePriority,
}: {
  company: CompanyDetail
  role: string
  canWrite: boolean
  canOverridePriority: boolean
}) {
  const [tab, setTab] = useState('overview')
  const [researchOpen, setResearchOpen] = useState(false)
  const [disqualifyOpen, setDisqualifyOpen] = useState(false)

  const criterionFacts = company.facts.filter((f) => f.isQualificationCriterion)
  const unverifiedCriteria = criterionFacts.filter((f) => f.provenance !== 'verified').length
  const status = qualificationStatus(criterionFacts)
  const target = nextStage(company.stage)
  const blocked = target !== null && isPastQualification(target) && unverifiedCriteria > 0

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'research', label: 'Research & sources' },
    { id: 'qualification', label: 'Qualification' },
    { id: 'people', label: 'Decision-makers' },
    { id: 'comms', label: 'Communication' },
    { id: 'history', label: 'History' },
  ]

  return (
    <div>
      <div className="pagehead">
        <div className="grow">
          <Link href="/companies" className="btn btn-sm">
            ← All companies
          </Link>
          <h1 style={{ marginTop: 9 }}>{company.name}</h1>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            {[company.companyType, company.market, company.website].filter(Boolean).join(' · ')}
          </p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 8 }}>
            <span className="tag">{stageLabel(company.stage)}</span>
            <span className="tag">{company.market}</span>
            {unverifiedCriteria > 0 ? (
              <span className="tag tag-due">
                {unverifiedCriteria} data gap{unverifiedCriteria > 1 ? 's' : ''}
              </span>
            ) : criterionFacts.length > 0 ? (
              <span className="tag tag-ok">No gaps</span>
            ) : null}
            {company.productName ? <span className="tag">{company.productName}</span> : null}
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8, justifyItems: 'end', alignContent: 'start' }}>
          {canWrite && company.stage !== 'disqualified' ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className="btn btn-sm" onClick={() => setResearchOpen(true)}>
                {company.research ? 'Re-run research' : 'Run AI research'}
              </button>
              <NurtureButton company={company} />
              <button className="btn btn-sm btn-warn" onClick={() => setDisqualifyOpen(true)}>
                Disqualify
              </button>
            </div>
          ) : null}
          <div className="tiny muted">
            Owner: {company.ownerName ?? '—'}
          </div>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'on' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {researchOpen ? <ResearchModal company={company} onClose={() => setResearchOpen(false)} /> : null}
      {disqualifyOpen ? <DisqualifyModal company={company} onClose={() => setDisqualifyOpen(false)} /> : null}

      {tab === 'overview' ? (
        <OverviewPane
          company={company}
          canWrite={canWrite}
          criterionFacts={criterionFacts}
          unverifiedCriteria={unverifiedCriteria}
          status={status}
          target={target}
          blocked={blocked}
        />
      ) : null}
      {tab === 'research' ? <ResearchPane company={company} canWrite={canWrite} /> : null}
      {tab === 'qualification' ? (
        <QualificationPane
          company={company}
          canWrite={canWrite}
          status={status}
          canOverridePriority={canOverridePriority}
        />
      ) : null}
      {tab === 'people' ? <PeoplePane company={company} /> : null}
      {tab === 'comms' ? <CommsPane /> : null}
      {tab === 'history' ? <HistoryPane company={company} /> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Header actions — run research, nurture, disqualify (T5.3, T5.6)     */
/* ------------------------------------------------------------------ */

function NurtureButton({ company }: { company: CompanyDetail }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function runNurture(formData: FormData) {
    setPending(true)
    const res = await changeStage(formData)
    setPending(false)
    if (res.ok) router.refresh()
  }

  if (company.stage === 'nurture') return null

  return (
    <form action={runNurture} style={{ display: 'inline-flex' }}>
      <input type="hidden" name="companyId" value={company.id} />
      <input type="hidden" name="stage" value="nurture" />
      <button className="btn btn-sm" type="submit" disabled={pending}>
        {pending ? '…' : 'Nurture'}
      </button>
    </form>
  )
}

function ResearchModal({ company, onClose }: { company: CompanyDetail; onClose: () => void }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ score: number; costUsd: number } | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const res = await runResearch(new FormData(e.currentTarget))
    setPending(false)
    if (res.ok) {
      router.refresh()
      setResult({ score: res.score!, costUsd: res.costUsd! })
    } else {
      setError(res.error ?? 'Research failed.')
    }
  }

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Run AI research">
        <header>
          <h3>Run AI research</h3>
          <div className="grow" />
          <button className="btn btn-sm" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        {result ? (
          <div className="body">
            <p className="small">
              Research complete — fit score <b>{result.score}</b>/100. Run cost{' '}
              {result.costUsd.toFixed(4)} USD, recorded in the audit trail.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="body">
              <input type="hidden" name="companyId" value={company.id} />
              <p className="small">
                The run reads the company&apos;s recorded facts and sources, then writes a
                profile, lists what is missing, and proposes a fit score. Nothing it writes is
                treated as verified.
              </p>
              <label className="f" htmlFor="research-depth">
                Depth
              </label>
              <select className="f" id="research-depth" name="depth" defaultValue="standard">
                {(Object.entries(RESEARCH_DEPTHS) as Array<[ResearchDepth, string]>).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="tiny muted" style={{ marginTop: 12 }}>
                Model, prompt version and cost are written to the audit trail.
              </p>
              {error ? (
                <p className="fm-err" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            <footer>
              <button className="btn" type="button" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-pri" type="submit" disabled={pending}>
                {pending ? 'Running…' : 'Start research'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  )
}

function DisqualifyModal({ company, onClose }: { company: CompanyDetail; onClose: () => void }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const res = await disqualifyCompany(new FormData(e.currentTarget))
    setPending(false)
    if (res.ok) {
      router.refresh()
      onClose()
    } else {
      setError(res.error ?? 'Could not disqualify.')
    }
  }

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Disqualify this company">
        <header>
          <h3>Disqualify this company</h3>
          <div className="grow" />
          <button className="btn btn-sm" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="body">
            <input type="hidden" name="companyId" value={company.id} />
            <label className="f" htmlFor="disq-reason">
              Reason
            </label>
            <select className="f" id="disq-reason" name="reason" defaultValue={DISQUALIFY_REASONS[0]}>
              {DISQUALIFY_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <label className="f" htmlFor="disq-note">
              Note for the record
            </label>
            <textarea
              className="f"
              id="disq-note"
              name="note"
              placeholder="One line explaining the call, so the next person does not repeat the research."
            />
            <label className="f" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" name="suppress" value="true" disabled={!company.website} />
              Also suppress this domain permanently — no further contact
              {!company.website ? <span className="tiny muted"> (no website on record)</span> : null}
            </label>
            {error ? (
              <p className="fm-err" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <footer>
            <button className="btn" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-warn" type="submit" disabled={pending}>
              {pending ? 'Disqualifying…' : 'Disqualify'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Verify control — promote an unverified/AI fact to verified (T4.4)   */
/* ------------------------------------------------------------------ */

function VerifyControl({ company, fact }: { company: CompanyDetail; fact: FactView }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  if (company.sources.length === 0) {
    return (
      <span className="small muted">
        needs a source — add one in Research &amp; sources
      </span>
    )
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const res = await promoteFactToVerified(new FormData(e.currentTarget))
    setPending(false)
    if (res.ok) {
      router.refresh()
      setOpen(false)
    } else {
      setError(res.error ?? 'Could not verify.')
    }
  }

  if (!open) {
    return (
      <button className="btn btn-sm" onClick={() => setOpen(true)}>
        Verify
      </button>
    )
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="hidden" name="companyId" value={company.id} />
      <input type="hidden" name="factId" value={fact.id} />
      <select className="btn btn-sm" name="sourceId" defaultValue={company.sources[0].id}>
        {company.sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title.slice(0, 40)}
          </option>
        ))}
      </select>
      <button className="btn btn-sm" type="submit" disabled={pending}>
        {pending ? '…' : 'Confirm'}
      </button>
      <button className="btn btn-sm" type="button" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error ? (
        <span className="small" style={{ color: 'var(--alert)' }}>
          {error}
        </span>
      ) : null}
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Overview (T4.4)                                                     */
/* ------------------------------------------------------------------ */

function OverviewPane({
  company,
  canWrite,
  criterionFacts,
  unverifiedCriteria,
  status,
  target,
  blocked,
}: {
  company: CompanyDetail
  canWrite: boolean
  criterionFacts: FactView[]
  unverifiedCriteria: number
  status: { confirmed: number; total: number }
  target: string | null
  blocked: boolean
}) {
  const recordFacts = company.facts.filter((f) => !isAnalystNoteKey(f.key))

  return (
    <div className="split">
      <div className="grid" style={{ gap: 14 }}>
        <div className="card">
          <header>
            <h3>Company record</h3>
            <div className="grow" />
            <span className="legendrow">
              <span className="prov prov-v"><i />Verified</span>
              <span className="prov prov-u"><i />Unverified</span>
              <span className="prov prov-a"><i />AI</span>
            </span>
          </header>
          <div className="body">
            {recordFacts.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>
                No facts recorded yet. Run AI research, or add a source and verify a fact by hand.
              </p>
            ) : (
              <dl className="kv">
                {recordFacts.map((f) => (
                  <div key={f.id} style={{ display: 'contents' }}>
                    <dt>{factLabel(f.key)}</dt>
                    <dd>
                      <span>{f.value}</span>
                      <ProvBadge provenance={f.provenance} />
                      {canWrite && (f.provenance === 'unverified' || f.provenance === 'ai') ? (
                        <VerifyControl company={company} fact={f} />
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
        {company.research ? (
          <div className="aiblock">
            <div className="h">
              <span className="prov prov-a"><i />AI analysis</span> Opportunity summary
            </div>
            <p>{company.research.opportunitySummary}</p>
            <div className="foot">
              <span>Ran {fmtDateTime(company.research.createdAt)}</span>
            </div>
          </div>
        ) : null}
        {company.research ? (
          <RecommendationCard company={company} canWrite={canWrite} target={target} blocked={blocked} />
        ) : null}
      </div>
      <div className="grid" style={{ gap: 14, alignContent: 'start' }}>
        {company.fitScore != null ? <FitScoreCard company={company} /> : null}
        {company.research && company.research.gaps.length > 0 ? (
          <MissingInformationCard company={company} canWrite={canWrite} />
        ) : null}
        <div className="card">
          <header>
            <h3>Pipeline stage</h3>
            <div className="grow" />
            <span className="tag">{stageLabel(company.stage)}</span>
          </header>
          <div className="body">
            <StageControl
              company={company}
              canWrite={canWrite}
              target={target}
              blocked={blocked}
              unverifiedCriteria={unverifiedCriteria}
            />
          </div>
        </div>
        <div className="card">
          <header>
            <h3>Qualification</h3>
            <div className="grow" />
            <span className={status.confirmed === status.total && status.total > 0 ? 'tag tag-ok' : 'tag tag-due'}>
              {status.confirmed} of {status.total} confirmed
            </span>
          </header>
          <div className="body">
            <p className="small muted" style={{ margin: 0 }}>
              {criterionFacts.length === 0
                ? 'No qualification criteria researched yet.'
                : unverifiedCriteria > 0
                  ? `${unverifiedCriteria} criterion${unverifiedCriteria > 1 ? 's' : ''} still need a source or a person to confirm them.`
                  : 'Every qualification criterion is verified — you may advance past Qualification.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Recommendation, fit score, missing information (T5.4)               */
/* ------------------------------------------------------------------ */

const RECOMMENDATION_TAG_CLASS: Record<string, string> = {
  proceed: 'tag tag-ok',
  research_more: 'tag tag-due',
  nurture: 'tag',
  disqualify: 'tag tag-due',
}

function RecommendationCard({
  company,
  canWrite,
  target,
  blocked,
}: {
  company: CompanyDetail
  canWrite: boolean
  target: string | null
  blocked: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [disqualifyOpen, setDisqualifyOpen] = useState(false)
  const research = company.research!

  async function runStage(formData: FormData) {
    setPending(true)
    const res = await changeStage(formData)
    setPending(false)
    if (res.ok) router.refresh()
  }

  async function runResearchTask(formData: FormData) {
    setPending(true)
    const res = await createTask(formData)
    setPending(false)
    if (res.ok) router.refresh()
  }

  return (
    <div className="card">
      <header>
        <h3>Recommendation</h3>
        <div className="grow" />
        <span className="prov prov-a"><i />AI, not a decision</span>
      </header>
      <div className="body">
        <p className="small" style={{ marginBottom: 4 }}>
          <span className={RECOMMENDATION_TAG_CLASS[research.suitability.recommendation]}>
            {RECOMMENDATION_LABELS[research.suitability.recommendation]}
          </span>{' '}
          — confidence: {research.suitability.confidence}
        </p>
        <p className="small" style={{ marginBottom: 12 }}>
          {research.suitability.reasoning}
        </p>
        {canWrite ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {target ? (
              <form action={runStage} style={{ display: 'inline-flex' }}>
                <input type="hidden" name="companyId" value={company.id} />
                <input type="hidden" name="stage" value={target} />
                <button className="btn btn-go" type="submit" disabled={pending || blocked}>
                  Accept and advance
                </button>
              </form>
            ) : null}
            <form action={runResearchTask} style={{ display: 'inline-flex' }}>
              <input type="hidden" name="companyId" value={company.id} />
              <input
                type="hidden"
                name="title"
                value={`More research needed — ${company.name}`}
              />
              <input type="hidden" name="blocksStage" value="false" />
              {company.ownerId ? <input type="hidden" name="assigneeId" value={company.ownerId} /> : null}
              <button className="btn btn-sm" type="submit" disabled={pending}>
                Needs more research
              </button>
            </form>
            {company.stage !== 'nurture' ? (
              <form action={runStage} style={{ display: 'inline-flex' }}>
                <input type="hidden" name="companyId" value={company.id} />
                <input type="hidden" name="stage" value="nurture" />
                <button className="btn btn-sm" type="submit" disabled={pending}>
                  Nurture instead
                </button>
              </form>
            ) : null}
            {company.stage !== 'disqualified' ? (
              <button className="btn btn-sm btn-warn" onClick={() => setDisqualifyOpen(true)}>
                Disqualify
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {disqualifyOpen ? <DisqualifyModal company={company} onClose={() => setDisqualifyOpen(false)} /> : null}
    </div>
  )
}

function FitScoreCard({ company }: { company: CompanyDetail }) {
  return (
    <div className="card">
      <header>
        <h3>Fit score</h3>
        <div className="grow" />
        <b className="score">{company.fitScore ?? '—'}</b>
      </header>
      <div className="body grid" style={{ gap: 10 }}>
        {company.research && company.research.breakdown.length > 0 ? (
          company.research.breakdown.map((b, i) => (
            <div key={i}>
              <div className="small" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{b.criterion}</span>
                <b className="num">
                  {b.awarded}/{b.max}
                </b>
              </div>
              <div className={`bar ${breakdownBarClass(b.awarded, b.max)}`}>
                <span style={{ width: `${b.max > 0 ? Math.round((b.awarded / b.max) * 100) : 0}%` }} />
              </div>
              <p className="tiny muted" style={{ margin: '3px 0 0' }}>
                {b.reason}
              </p>
            </div>
          ))
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            Run AI research for a scored breakdown.
          </p>
        )}
      </div>
      <div className="body" style={{ borderTop: '1px solid var(--line-2)' }}>
        <p className="tiny muted" style={{ margin: 0 }}>
          Scores recalculate when new research lands, and every change is written to the audit
          trail.
        </p>
      </div>
    </div>
  )
}

function MissingInformationCard({ company, canWrite }: { company: CompanyDetail; canWrite: boolean }) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState<string | null>(null)

  async function makeTask(gap: ResearchView['gaps'][number]) {
    setPending(gap.field)
    const fd = new FormData()
    fd.set('companyId', company.id)
    fd.set('title', `${gap.field} — ${gap.whyItMatters}`)
    fd.set('blocksStage', String(gap.blocksQualification))
    if (company.ownerId) fd.set('assigneeId', company.ownerId)
    const res = await createTask(fd)
    setPending(null)
    if (res.ok) router.refresh()
  }

  const gaps = company.research!.gaps.filter((g) => !dismissed.has(g.field))

  return (
    <div className="card">
      <header>
        <h3>Missing information</h3>
        <div className="grow" />
        <span className="prov prov-a"><i />AI detected</span>
      </header>
      <div className="body grid" style={{ gap: 9 }}>
        {gaps.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            Nothing missing. Every qualification field has a source.
          </p>
        ) : (
          gaps.map((g) => (
            <div key={g.field} className="small">
              <b>{g.field}</b>
              <div className="muted">{g.whyItMatters}</div>
              <div className="tiny muted">{g.howToFind}</div>
              {canWrite ? (
                <div style={{ marginTop: 5, display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => makeTask(g)} disabled={pending === g.field}>
                    {pending === g.field ? '…' : 'Make a task'}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => setDismissed((s) => new Set(s).add(g.field))}
                  >
                    Not needed
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Stage control (T4.7)                                                */
/* ------------------------------------------------------------------ */

function StageControl({
  company,
  canWrite,
  target,
  blocked,
  unverifiedCriteria,
}: {
  company: CompanyDetail
  canWrite: boolean
  target: string | null
  blocked: boolean
  unverifiedCriteria: number
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSelect, setShowSelect] = useState(false)

  async function runStage(formData: FormData) {
    setPending(true)
    setError(null)
    const res = await changeStage(formData)
    setPending(false)
    if (res.ok) {
      router.refresh()
    } else {
      setError(res.error ?? 'Could not change stage.')
    }
  }

  if (!canWrite) {
    return (
      <p className="small muted" style={{ margin: 0 }}>
        Auditors cannot move companies between stages.
      </p>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {blocked ? (
        <p className="small" style={{ color: 'var(--ochre)', margin: 0 }}>
          {gateReason(unverifiedCriteria)}
        </p>
      ) : null}
      {error ? (
        <p className="small" style={{ color: 'var(--alert)', margin: 0 }}>
          {error}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {target ? (
          <form action={runStage} style={{ display: 'inline-flex' }}>
            <input type="hidden" name="companyId" value={company.id} />
            <input type="hidden" name="stage" value={target} />
            <button className="btn btn-pri" type="submit" disabled={pending || blocked}>
              {pending ? '…' : `Advance to ${stageLabel(target)}`}
            </button>
          </form>
        ) : (
          <span className="small muted">End of the pipeline.</span>
        )}
        {!showSelect ? (
          <button className="btn btn-sm" onClick={() => setShowSelect(true)}>
            Move to a specific stage
          </button>
        ) : (
          <form action={runStage} style={{ display: 'flex', gap: 6 }}>
            <input type="hidden" name="companyId" value={company.id} />
            <select className="btn btn-sm" name="stage" defaultValue={company.stage}>
              {Object.entries(STAGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button className="btn btn-sm" type="submit" disabled={pending}>
              Move
            </button>
          </form>
        )}
      </div>
      <p className="tiny muted" style={{ margin: 0 }}>
        Advancing past Qualification is blocked while a qualification fact is still unverified.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Research & sources (T4.5)                                           */
/* ------------------------------------------------------------------ */

function ResearchPane({ company, canWrite }: { company: CompanyDetail; canWrite: boolean }) {
  const notes = company.facts.filter((f) => isAnalystNoteKey(f.key))

  return (
    <div className="split">
      <div className="grid" style={{ gap: 14 }}>
        <div className="card">
          <header>
            <h3>Sources</h3>
            <div className="grow" />
            {canWrite ? <SourceModalButton companyId={company.id} /> : null}
          </header>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Type</th>
                  <th>What it supports</th>
                  <th>Retrieved</th>
                  <th>Quality</th>
                </tr>
              </thead>
              <tbody>
                {company.sources.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted" style={{ padding: 16 }}>
                      No sources yet. A fact can only be verified against a source.
                    </td>
                  </tr>
                ) : (
                  company.sources.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noreferrer">
                            <b>{s.title}</b>
                          </a>
                        ) : (
                          <b>{s.title}</b>
                        )}
                      </td>
                      <td>{s.sourceType ?? '—'}</td>
                      <td className="small">{s.supports ?? '—'}</td>
                      <td className="small muted">{fmtDate(s.retrievedAt)}</td>
                      <td>
                        <span className={`tag ${s.quality === 'primary' ? 'tag-ok' : s.quality === 'weak' ? 'tag-due' : ''}`}>
                          {s.quality ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <header>
            <h3>Analyst notes</h3>
            <div className="grow" />
            <span className="prov prov-h"><i />Human</span>
          </header>
          <div className="body">
            {notes.length === 0 ? (
              <p className="small muted" style={{ margin: '0 0 10px' }}>
                No notes yet.
              </p>
            ) : (
              notes.map((n) => (
                <p className="small" key={n.id}>
                  {n.value}
                  {n.confirmedByName ? (
                    <>
                      {' '}— <b>{n.confirmedByName}</b>
                    </>
                  ) : null}
                </p>
              ))
            )}
            {canWrite ? <NoteForm companyId={company.id} /> : null}
          </div>
        </div>
      </div>
      <div className="grid" style={{ gap: 14, alignContent: 'start' }}>
        <div className="card">
          <header>
            <h3>How to read this page</h3>
          </header>
          <div className="body grid" style={{ gap: 10 }}>
            <div>
              <span className="prov prov-v"><i />Verified</span>
              <div className="small muted" style={{ marginTop: 4 }}>
                Confirmed against a named source or by a colleague. Usable in outreach.
              </div>
            </div>
            <div>
              <span className="prov prov-u"><i />Unverified</span>
              <div className="small muted" style={{ marginTop: 4 }}>
                Claimed or scraped, no source confirmed. Blocks qualification; never appears in an email.
              </div>
            </div>
            <div>
              <span className="prov prov-a"><i />AI-generated</span>
              <div className="small muted" style={{ marginTop: 4 }}>
                Written or inferred by a model. Treated as opinion until a person accepts it.
              </div>
            </div>
            <div>
              <span className="prov prov-h"><i />Human-approved</span>
              <div className="small muted" style={{ marginTop: 4 }}>
                Signed off by a named person, with time and version recorded.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SourceModalButton({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)}>
        Add source
      </button>
      {open ? <SourceModal companyId={companyId} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function SourceModal({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const res = await addSource(new FormData(e.currentTarget))
    setPending(false)
    if (res.ok) {
      router.refresh()
      onClose()
    } else {
      setError(res.error ?? 'Something went wrong.')
    }
  }

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Add a source">
        <header>
          <h3>Add a source</h3>
          <div className="grow" />
          <button className="btn btn-sm" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="body">
            <input type="hidden" name="companyId" value={companyId} />
            <label className="f" htmlFor="src-doc">
              URL or document
            </label>
            <input className="f" id="src-doc" name="doc" placeholder="https://…  or upload a PDF" required />
            <label className="f" htmlFor="src-supports">
              What it supports
            </label>
            <select className="f" id="src-supports" name="supports" defaultValue={SUPPORTS_OPTIONS[0]}>
              {SUPPORTS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <label className="f" htmlFor="src-quality">
              Quality
            </label>
            <select className="f" id="src-quality" name="quality" defaultValue="secondary">
              {QUALITY_OPTIONS.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
            {error ? (
              <p className="fm-err" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <footer>
            <button className="btn" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-pri" type="submit" disabled={pending}>
              {pending ? 'Adding…' : 'Add source'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

function NoteForm({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const res = await addAnalystNote(new FormData(e.currentTarget))
    setPending(false)
    if (res.ok) {
      router.refresh()
      ;(e.target as HTMLFormElement).reset()
    } else {
      setError(res.error ?? 'Something went wrong.')
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="companyId" value={companyId} />
      <textarea
        className="f"
        name="note"
        placeholder="Add a note. Notes are stored as human-verified and never rewritten by AI."
        required
      />
      {error ? (
        <p className="fm-err" role="alert">
          {error}
        </p>
      ) : null}
      <div style={{ marginTop: 8 }}>
        <button className="btn btn-sm" type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/* Qualification (T4.6)                                                */
/* ------------------------------------------------------------------ */

function QualificationPane({
  company,
  canWrite,
  status,
  canOverridePriority,
}: {
  company: CompanyDetail
  canWrite: boolean
  status: { confirmed: number; total: number }
  canOverridePriority: boolean
}) {
  const criteria = company.facts.filter((f) => f.isQualificationCriterion)

  return (
    <div className="split">
      <div className="card">
        <header>
          <h3>Qualification checklist</h3>
          <div className="grow" />
          <span className={status.confirmed === status.total && status.total > 0 ? 'tag tag-ok' : 'tag tag-due'}>
            {status.confirmed} of {status.total} confirmed
          </span>
        </header>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Criterion</th>
                <th>Finding</th>
                <th>Provenance</th>
                <th>Confirm</th>
              </tr>
            </thead>
            <tbody>
              {criteria.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted" style={{ padding: 16 }}>
                    No qualification criteria researched yet. Run AI research to populate them.
                  </td>
                </tr>
              ) : (
                criteria.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <b>{factLabel(f.key)}</b>
                    </td>
                    <td className="small">{f.value}</td>
                    <td>
                      <ProvBadge provenance={f.provenance} />
                    </td>
                    <td>
                      {f.provenance === 'verified' ? (
                        <span className="tag tag-ok">Confirmed</span>
                      ) : canWrite ? (
                        <VerifyControl company={company} fact={f} />
                      ) : (
                        <span className="small muted">Not confirmed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="body" style={{ borderTop: '1px solid var(--line-2)' }}>
          <p className="tiny muted" style={{ margin: 0 }}>
            A criterion can be confirmed only against a source or by a person. Confirming writes your
            name, the time and the evidence to the audit trail.
          </p>
        </div>
      </div>
      <div className="grid" style={{ gap: 14, alignContent: 'start' }}>
        {company.research ? (
          <div className="aiblock">
            <div className="h">
              <span className="prov prov-a"><i />AI analysis</span> Suitability
            </div>
            <p>{company.research.suitability.reasoning}</p>
            <div className="foot">
              <span>
                Confidence: {company.research.suitability.confidence} — would change if:{' '}
                {company.research.suitability.wouldChangeIf}
              </span>
            </div>
          </div>
        ) : (
          <div className="card">
            <header>
              <h3>Suitability</h3>
              <div className="grow" />
              <span className="prov prov-a"><i />AI</span>
            </header>
            <div className="body">
              <p className="small muted" style={{ margin: 0 }}>
                Run AI research to get a suitability call for this company.
              </p>
            </div>
          </div>
        )}
        {company.fitScore != null ? (
          <PriorityCard company={company} canOverridePriority={canOverridePriority} />
        ) : null}
      </div>
    </div>
  )
}

function PriorityCard({
  company,
  canOverridePriority,
}: {
  company: CompanyDetail
  canOverridePriority: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const res = await overridePriority(new FormData(e.currentTarget))
    setPending(false)
    if (res.ok) {
      router.refresh()
      setOpen(false)
    } else {
      setError(res.error ?? 'Could not override priority.')
    }
  }

  return (
    <div className="card">
      <header>
        <h3>Priority</h3>
      </header>
      <div className="body">
        {company.rank ? (
          <p className="small">
            Ranked <b>#{company.rank.rank}</b> of {company.rank.total} qualified compan
            {company.rank.total === 1 ? 'y' : 'ies'}
            {company.productName ? ` for ${company.productName}` : ''}.
            {company.rank.isOverride ? ' (manually overridden)' : ''}
          </p>
        ) : (
          <p className="small muted">Not yet rankable — this company has no product assigned.</p>
        )}
        {company.priorityOverrideReason ? (
          <p className="tiny muted">Override reason: {company.priorityOverrideReason}</p>
        ) : null}
        {company.research?.priorityReason ? (
          <p className="tiny muted">AI note: {company.research.priorityReason}</p>
        ) : null}
        {canOverridePriority ? (
          !open ? (
            <button className="btn btn-sm" onClick={() => setOpen(true)}>
              Override priority
            </button>
          ) : (
            <form onSubmit={onSubmit} style={{ marginTop: 8, display: 'grid', gap: 8 }}>
              <input type="hidden" name="companyId" value={company.id} />
              <label className="f" htmlFor="pri-rank">
                New rank
              </label>
              <input className="f" id="pri-rank" name="rank" type="number" min={1} required />
              <label className="f" htmlFor="pri-reason">
                Reason (required — written to the audit trail)
              </label>
              <textarea className="f" id="pri-reason" name="reason" required />
              {error ? (
                <p className="fm-err" role="alert">
                  {error}
                </p>
              ) : null}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" type="submit" disabled={pending}>
                  {pending ? 'Saving…' : 'Save override'}
                </button>
                <button className="btn btn-sm" type="button" onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Decision-makers (read-only here; full add-contact is T6.2)          */
/* ------------------------------------------------------------------ */

function PeoplePane({ company }: { company: CompanyDetail }) {
  return (
    <div className="card">
      <header>
        <h3>People found</h3>
        <div className="grow" />
      </header>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Email</th>
              <th>Source</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {company.contacts.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted" style={{ padding: 16 }}>
                  No decision-makers found yet. Contact discovery arrives in Phase 6.
                </td>
              </tr>
            ) : (
              company.contacts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.fullName}</b>
                    {c.isPrimary ? <span className="tag tag-ok" style={{ marginLeft: 6 }}>Primary</span> : null}
                  </td>
                  <td>{c.roleTitle ?? '—'}</td>
                  <td className="small mono">{c.email ?? '—'}</td>
                  <td className="small muted">{c.emailSource ?? '—'}</td>
                  <td>
                    <ProvBadge provenance={c.provenance} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Communication / History                                             */
/* ------------------------------------------------------------------ */

function CommsPane() {
  return (
    <div className="card">
      <div className="body">
        <p className="small muted" style={{ margin: 0 }}>
          The communication thread and AI reply classification arrive with the outreach phases
          (Phase 7–9).
        </p>
      </div>
    </div>
  )
}

function HistoryPane({ company }: { company: CompanyDetail }) {
  return (
    <div className="card">
      <header>
        <h3>Everything that happened to this record</h3>
        <div className="grow" />
      </header>
      <div className="body">
        {company.audit.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            Nothing recorded yet.
          </p>
        ) : (
          <ul className="tl">
            {company.audit.map((a, i) => (
              <li key={i} className={a.event.startsWith('AI') ? 'ai' : a.actorLabel === 'System' ? 'sys' : 'human'}>
                <span className="when">{fmtDateTime(a.createdAt)}</span>
                <span className="dot" />
                <span className="what">
                  <b>{a.actorLabel}</b> {a.event}
                  {a.detail ? <span className="small muted"> — {a.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
