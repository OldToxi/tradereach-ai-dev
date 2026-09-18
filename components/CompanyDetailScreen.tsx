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

export interface CompanyDetail {
  id: string
  name: string
  website: string | null
  market: string
  companyType: string | null
  stage: string
  fitScore: number | null
  disqualifiedReason: string | null
  ownerName: string | null
  productName: string | null
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
}: {
  company: CompanyDetail
  role: string
  canWrite: boolean
}) {
  const [tab, setTab] = useState('overview')

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
        <QualificationPane company={company} canWrite={canWrite} status={status} />
      ) : null}
      {tab === 'people' ? <PeoplePane company={company} /> : null}
      {tab === 'comms' ? <CommsPane /> : null}
      {tab === 'history' ? <HistoryPane company={company} /> : null}
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
      </div>
      <div className="grid" style={{ gap: 14, alignContent: 'start' }}>
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
}: {
  company: CompanyDetail
  canWrite: boolean
  status: { confirmed: number; total: number }
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
      <div className="card">
        <header>
          <h3>Suitability</h3>
          <div className="grow" />
          <span className="prov prov-a"><i />AI</span>
        </header>
        <div className="body">
          <p className="small muted" style={{ margin: 0 }}>
            AI suitability analysis arrives with the research pack (Phase 5).
          </p>
        </div>
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
