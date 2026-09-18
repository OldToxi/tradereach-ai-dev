'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  simulateReply,
  classifyReply,
  reclassifyReply,
  draftResponse,
  escalateCommercial,
  bookCall,
  nurtureReply,
  noFurtherContact,
} from '@/lib/reply-actions'
import {
  categoryLabel,
  intentLabel,
  urgencyLabel,
  confidenceLabel,
  nextActionLabel,
  CATEGORY_LABELS,
  type ReservedPoint,
} from '@/lib/replies'

export interface ReplyListItem {
  id: string
  companyName: string
  contactName: string | null
  category: string
  isNew: boolean
  isSimulated: boolean
  when: string
}

export interface ReplyDetail {
  id: string
  companyId: string
  companyName: string
  market: string
  contactName: string | null
  contactEmail: string | null
  subject: string
  body: string
  receivedAt: string
  isSimulated: boolean
  category: string | null
  intent: string | null
  intentNote: string | null
  urgency: string | null
  confidence: number | null
  reasoning: string | null
  answerable: string[]
  reserved: ReservedPoint[]
  nextAction: string | null
  nextActionReasoning: string | null
  nextActionOwner: string | null
  suggestedStage: string | null
  correctedCategory: string | null
}

export interface ThreadOption {
  contactId: string
  label: string
}

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  const hhmm = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (days <= 0) return `Today ${hhmm}`
  if (days === 1) return `Yesterday ${hhmm}`
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function RepliesScreen({
  list,
  selectedId,
  detail,
  threads,
  canWrite,
}: {
  list: ReplyListItem[]
  selectedId: string | null
  detail: ReplyDetail | null
  threads: ThreadOption[]
  canWrite: boolean
}) {
  const router = useRouter()
  const [showSim, setShowSim] = useState(false)
  const newCount = list.filter((r) => r.isNew).length

  return (
    <div>
      <div className="pagehead">
        <div className="grow">
          <h1>Replies</h1>
          <p>Incoming mail, read and sorted by AI, waiting for your call.</p>
        </div>
        {canWrite ? (
          <button className="btn" onClick={() => setShowSim(true)}>
            Simulate an incoming reply
          </button>
        ) : null}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '320px 1fr', gap: 14, alignItems: 'start' }}>
        <div className="card">
          <header>
            <h3>Inbox</h3>
            <div className="grow" />
            {newCount > 0 ? <span className="tag tag-due">{newCount} new</span> : null}
          </header>
          <div>
            {list.length === 0 ? (
              <p className="small muted" style={{ padding: 13 }}>
                No replies yet. Simulate one, or wait for a buyer to write back.
              </p>
            ) : (
              list.map((r) => (
                <div
                  key={r.id}
                  onClick={() => router.push(`/replies?id=${r.id}`)}
                  style={{
                    padding: '11px 13px',
                    borderBottom: '1px solid var(--line-2)',
                    cursor: 'pointer',
                    background: r.id === selectedId ? 'var(--surface-2)' : undefined,
                    borderLeft: r.id === selectedId ? '3px solid var(--ochre)' : '3px solid transparent',
                  }}
                >
                  <b className="small">{r.companyName}</b>
                  <div className="tiny muted">
                    {r.contactName ?? 'unknown sender'} · {r.when}
                  </div>
                  <div style={{ marginTop: 5, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    <span className="tag">{r.category}</span>
                    {r.isSimulated ? <span className="tag">Simulated</span> : null}
                    {r.isNew ? <span className="tag tag-due">New</span> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {detail ? (
          <ReplyDetailPane key={detail.id} detail={detail} canWrite={canWrite} />
        ) : (
          <div className="card">
            <div className="body">
              <p className="small muted" style={{ margin: 0 }}>
                Select a reply to see its classification and next action.
              </p>
            </div>
          </div>
        )}
      </div>

      {showSim ? <SimulateReplyModal threads={threads} onClose={() => setShowSim(false)} /> : null}
    </div>
  )
}

function ReplyDetailPane({ detail, canWrite }: { detail: ReplyDetail; canWrite: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [cat, setCat] = useState(detail.correctedCategory ?? detail.category ?? '')

  async function run(name: string, fn: () => Promise<{ ok: boolean; error?: string; note?: string }>, go?: string) {
    setPending(name)
    setError(null)
    setNote(null)
    const res = await fn()
    setPending(null)
    if (res.ok) {
      if (res.note) setNote(res.note)
      if (go) router.push(go)
      router.refresh()
    } else {
      setError(res.error ?? 'Something went wrong.')
    }
  }

  function classify() {
    const fd = new FormData()
    fd.set('replyId', detail.id)
    return run('classify', () => classifyReply(fd))
  }

  function reclassify() {
    if (!cat) return
    const fd = new FormData()
    fd.set('replyId', detail.id)
    fd.set('category', cat)
    return run('reclassify', () => reclassifyReply(fd))
  }

  function draft() {
    const fd = new FormData()
    fd.set('replyId', detail.id)
    return run('draft', () => draftResponse(fd), '/review')
  }

  function escalate() {
    const fd = new FormData()
    fd.set('replyId', detail.id)
    return run('escalate', () => escalateCommercial(fd))
  }

  function call() {
    const fd = new FormData()
    fd.set('replyId', detail.id)
    return run('call', () => bookCall(fd))
  }

  function nurture() {
    const fd = new FormData()
    fd.set('replyId', detail.id)
    return run('nurture', () => nurtureReply(fd))
  }

  function noContact() {
    const fd = new FormData()
    fd.set('replyId', detail.id)
    return run('noContact', () => noFurtherContact(fd))
  }

  const unclassified = !detail.category

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <header>
          <h3>
            {detail.companyName} — {detail.contactName ?? 'unknown sender'}
          </h3>
          <div className="grow" />
          {detail.isSimulated ? <span className="tag">Simulated</span> : null}
          <span className="tag">{fmtWhen(detail.receivedAt)}</span>
        </header>
        <div className="body">
          <div className="mail">
            <div className="hd">
              <div className="row">
                <span>From</span>
                <b>
                  {detail.contactName ?? '—'} {detail.contactEmail ? `<${detail.contactEmail}>` : ''}
                </b>
              </div>
              <div className="row">
                <span>Subject</span>
                <b>{detail.subject}</b>
              </div>
            </div>
            <div className="bd">{detail.body}</div>
          </div>
        </div>
      </div>

      <div className="split">
        <div className="aiblock">
          <div className="h">
            <span className="prov prov-a">
              <i />
              AI analysis
            </span>{' '}
            Classification
          </div>
          {unclassified ? (
            <p className="small" style={{ marginBottom: 9 }}>
              Not classified yet. Run the AI triage to sort this reply and get a next action.
            </p>
          ) : (
            <div className="grid" style={{ gap: 8, marginBottom: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Category</span>
                <b>{categoryLabel(detail.correctedCategory ?? detail.category)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Intent</span>
                <b>{detail.intentNote ?? intentLabel(detail.intent)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Urgency</span>
                <b>{urgencyLabel(detail.urgency)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Confidence</span>
                <b>{confidenceLabel(detail.confidence)}</b>
              </div>
            </div>
          )}
          {detail.reasoning ? <p className="small">{detail.reasoning}</p> : null}

          {detail.answerable.length > 0 ? (
            <div className="small" style={{ marginBottom: 8 }}>
              <b>We can answer now:</b>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {detail.answerable.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {detail.reserved.length > 0 ? (
            <div className="small" style={{ marginBottom: 8, color: 'var(--alert)' }}>
              <b>Reserved — Commercial Authority only:</b>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {detail.reserved.map((r, i) => (
                  <li key={i}>
                    {r.matter} — “{r.theirWords}”
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {canWrite ? (
            <div className="foot" style={{ paddingTop: 8 }}>
              <span>Wrong call?</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select className="f" style={{ margin: 0 }} value={cat} onChange={(e) => setCat(e.target.value)}>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button className="btn btn-sm" onClick={reclassify} disabled={pending !== null || !cat}>
                  Change category
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="card">
          <header>
            <h3>Recommended next action</h3>
            <div className="grow" />
            <span className="prov prov-a">
              <i />
              AI
            </span>
          </header>
          <div className="body">
            {detail.nextAction ? (
              <>
                <p className="small">
                  <b>{nextActionLabel(detail.nextAction)}</b>
                  {detail.nextActionReasoning ? ` — ${detail.nextActionReasoning}` : ''}
                </p>
                {detail.suggestedStage ? (
                  <p className="tiny muted" style={{ marginTop: 2 }}>
                    Suggested stage: {detail.suggestedStage.replace('_', ' ')}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="small muted">Classify this reply to get a recommendation.</p>
            )}

            {canWrite ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <button
                  className="btn btn-pri"
                  onClick={draft}
                  disabled={pending !== null || unclassified}
                  title={unclassified ? 'Classify first' : undefined}
                >
                  {pending === 'draft' ? 'Drafting…' : 'Draft the response'}
                </button>
                <button className="btn" onClick={escalate} disabled={pending !== null || unclassified}>
                  Escalate for pricing
                </button>
                <button className="btn" onClick={call} disabled={pending !== null}>
                  Book a call
                </button>
                <button className="btn" onClick={nurture} disabled={pending !== null}>
                  Nurture
                </button>
                <button className="btn btn-warn" onClick={noContact} disabled={pending !== null}>
                  No further contact
                </button>
              </div>
            ) : (
              <p className="small muted" style={{ marginTop: 10 }}>
                Auditors can read replies but cannot act on them.
              </p>
            )}

            {error ? (
              <p className="fm-err" role="alert" style={{ marginTop: 8 }}>
                {error}
              </p>
            ) : null}
            {note ? (
              <p className="small" style={{ marginTop: 8, color: 'var(--verified)' }}>
                {note}
              </p>
            ) : null}

            <hr className="sep" />
            <p className="tiny muted" style={{ margin: 0 }}>
              {detail.reserved.length > 0
                ? 'This reply asks for a reserved matter. TradeReach will not answer it — the draft it prepares acknowledges the request and hands the commercial part to an authorised person.'
                : 'Drafting prepares a reply for the review queue. Nothing is sent without a named approver.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SimulateReplyModal({ threads, onClose }: { threads: ThreadOption[]; onClose: () => void }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    setNote(null)
    const res = await simulateReply(new FormData(e.currentTarget))
    setPending(false)
    if (res.ok) {
      if (res.note) setNote(res.note)
      router.refresh()
    } else {
      setError(res.error ?? 'Could not deliver the simulated reply.')
    }
  }

  return (
    <div
      className="modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Simulate an incoming reply">
        <header>
          <h3>Simulate an incoming reply</h3>
          <div className="grow" />
          <button className="btn btn-sm" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="body">
            <p className="small">
              For testing the classification and next-action steps without contacting anyone. Simulated replies are
              tagged as test data everywhere they appear.
            </p>
            <label className="f" htmlFor="sim-contact">
              Thread
            </label>
            <select className="f" id="sim-contact" name="contactId" required defaultValue="">
              <option value="" disabled>
                Choose a thread
              </option>
              {threads.map((t) => (
                <option key={t.contactId} value={t.contactId}>
                  {t.label}
                </option>
              ))}
            </select>
            <label className="f" htmlFor="sim-body">
              Reply text
            </label>
            <textarea
              className="f"
              id="sim-body"
              name="body"
              style={{ minHeight: 110 }}
              required
              placeholder="Thanks for reaching out. We are reviewing alternatives this quarter. Could you send the technical spec for the 8 lb count, and let us know your price per tonne CIF?"
            />
            {error ? (
              <p className="fm-err" role="alert">
                {error}
              </p>
            ) : null}
            {note ? (
              <p className="small" style={{ color: 'var(--verified)' }}>
                {note}
              </p>
            ) : null}
          </div>
          <footer>
            <button className="btn" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-pri" type="submit" disabled={pending}>
              {pending ? 'Delivering…' : 'Deliver reply'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
