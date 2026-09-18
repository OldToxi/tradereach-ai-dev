'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  editMessage,
  approveMessage,
  rejectMessage,
  requestChanges,
  releaseMessage,
  retryGmailDraft,
} from '@/lib/message-actions'
import type { PreSendCheck, HighlightSegment } from '@/lib/messages'

export interface ReviewListItem {
  id: string
  title: string
  companyId: string
  contactName: string | null
  age: string
  blocked: boolean
  kind: string
  touchNumber: number
}

export interface ReviewDetail {
  id: string
  companyId: string
  companyName: string
  market: string
  contactName: string | null
  contactEmail: string | null
  subject: string
  body: string
  segments: HighlightSegment[]
  why: string[]
  status: string
  reservedMatter: string | null
  reservedMatterLabel: string | null
  released: boolean
  age: string
  checks: PreSendCheck[]
}

export interface NeedsGmailDraftItem {
  id: string
  companyName: string
  subject: string
  approvedByName: string
  isMine: boolean
  lastError: string | null
}

function fmtAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) return 'Waiting <1h'
  if (hours < 48) return `Waiting ${hours}h`
  return `Waiting ${Math.floor(hours / 24)}d`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function ReviewScreen({
  list,
  selectedId,
  detail,
  role,
  canApprove,
  canReleaseCommercial,
  needsGmailDraft,
}: {
  list: ReviewListItem[]
  selectedId: string | null
  detail: ReviewDetail | null
  role: string
  canApprove: boolean
  canReleaseCommercial: boolean
  needsGmailDraft: NeedsGmailDraftItem[]
}) {
  const router = useRouter()

  return (
    <div>
      <div className="pagehead">
        <div className="grow">
          <h1>Review queue</h1>
          <p>
            Nothing reaches a buyer until someone here approves it.{' '}
            {list.length} draft{list.length === 1 ? '' : 's'} waiting.
          </p>
        </div>
      </div>

      {canApprove && needsGmailDraft.length > 0 ? (
        <NeedsGmailDraftCard items={needsGmailDraft} />
      ) : null}

      <div className="grid" style={{ gridTemplateColumns: '300px 1fr', gap: 14, alignItems: 'start' }}>
        <div className="card">
          <header>
            <h3>Waiting</h3>
            <div className="grow" />
            <span
              className="count"
              style={{
                fontSize: 11,
                background: 'var(--ochre-soft)',
                color: 'var(--ochre)',
                padding: '1px 7px',
                borderRadius: 9,
              }}
            >
              {list.length}
            </span>
          </header>
          <div>
            {list.length === 0 ? (
              <p className="small muted" style={{ padding: 13 }}>
                Nothing waiting. Draft outreach from a company&apos;s Overview tab.
              </p>
            ) : (
              list.map((d) => (
                <div
                  key={d.id}
                  onClick={() => router.push(`/review?id=${d.id}`)}
                  style={{
                    padding: '11px 13px',
                    borderBottom: '1px solid var(--line-2)',
                    cursor: 'pointer',
                    background: d.id === selectedId ? 'var(--surface-2)' : undefined,
                    borderLeft: d.id === selectedId ? '3px solid var(--ochre)' : '3px solid transparent',
                  }}
                >
                  <b className="small">{d.title}</b>
                  <div className="tiny muted">{d.contactName ?? 'no contact yet'}</div>
                  <div style={{ marginTop: 5, display: 'flex', gap: 5 }}>
                    <span className="tag">{d.kind === 'first_touch' ? 'First-touch' : 'Follow-up'}</span>
                    {d.blocked ? (
                      <span className="tag tag-alert">Blocked</span>
                    ) : (
                      <span className="tag tag-due">{fmtAge(d.age)}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {detail ? (
          <ReviewDetailPane
            key={detail.id}
            detail={detail}
            canApprove={canApprove}
            canReleaseCommercial={canReleaseCommercial}
            canWrite={role !== 'auditor'}
          />
        ) : (
          <div className="card">
            <div className="body">
              <p className="small muted" style={{ margin: 0 }}>
                Select a draft to review.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NeedsGmailDraftCard({ items }: { items: NeedsGmailDraftItem[] }) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function retry(id: string) {
    setPendingId(id)
    setErrors((e) => ({ ...e, [id]: '' }))
    const fd = new FormData()
    fd.set('messageId', id)
    const res = await retryGmailDraft(fd)
    setPendingId(null)
    if (res.ok) {
      router.refresh()
    } else {
      setErrors((e) => ({ ...e, [id]: res.error ?? 'Could not create the Gmail draft.' }))
    }
  }

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <header>
        <h3>Approved, awaiting a Gmail draft</h3>
        <div className="grow" />
        <span className="tag tag-alert">{items.length}</span>
      </header>
      <div className="body grid" style={{ gap: 9 }}>
        {items.map((it) => (
          <div key={it.id} className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <b>{it.subject}</b> — {it.companyName}
              <div className="tiny muted">
                Approved by {it.approvedByName}
                {it.lastError ? ` · last error: ${it.lastError}` : ''}
              </div>
              {errors[it.id] ? (
                <div className="tiny" style={{ color: 'var(--alert)' }}>
                  {errors[it.id]}
                </div>
              ) : null}
            </div>
            {it.isMine ? (
              <button className="btn btn-sm" onClick={() => retry(it.id)} disabled={pendingId === it.id}>
                {pendingId === it.id ? '…' : 'Retry'}
              </button>
            ) : (
              <span className="tiny muted">Only {it.approvedByName} can retry — it goes into their mailbox.</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ReviewDetailPane({
  detail,
  canApprove,
  canReleaseCommercial,
  canWrite,
}: {
  detail: ReviewDetail
  canApprove: boolean
  canReleaseCommercial: boolean
  canWrite: boolean
}) {
  const router = useRouter()
  const [editValue, setEditValue] = useState(detail.body)
  const [note, setNote] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [gmailNotice, setGmailNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const dirty = editValue !== detail.body
  const blockingChecks = detail.checks.filter((c) => c.status === 'block')

  async function run(name: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(name)
    setError(null)
    const res = await fn()
    setPending(null)
    if (res.ok) {
      router.refresh()
    } else {
      setError(res.error ?? 'Something went wrong.')
    }
  }

  function saveEdit() {
    const fd = new FormData()
    fd.set('messageId', detail.id)
    fd.set('body', editValue)
    return run('save', () => editMessage(fd))
  }

  async function approve() {
    setPending('approve')
    setError(null)
    setGmailNotice(null)
    const fd = new FormData()
    fd.set('messageId', detail.id)
    const res = await approveMessage(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error ?? 'Something went wrong.')
      return
    }
    if (res.gmailWarning) {
      setGmailNotice({ ok: false, text: `Approved, but the Gmail draft failed: ${res.gmailWarning} You can retry from the top of this page.` })
    } else if (res.gmailDraftId) {
      setGmailNotice({ ok: true, text: `Approved. Gmail draft ${res.gmailDraftId} created in your mailbox.` })
    }
    router.refresh()
  }

  function reject() {
    if (!note.trim()) {
      setError('Add a reason before rejecting.')
      return
    }
    const fd = new FormData()
    fd.set('messageId', detail.id)
    fd.set('reason', note)
    return run('reject', () => rejectMessage(fd))
  }

  function change() {
    if (!note.trim()) {
      setError('Add a note explaining what to change.')
      return
    }
    const fd = new FormData()
    fd.set('messageId', detail.id)
    fd.set('note', note)
    return run('changes', () => requestChanges(fd))
  }

  function release() {
    const fd = new FormData()
    fd.set('messageId', detail.id)
    return run('release', () => releaseMessage(fd))
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <header>
          <h3>
            {detail.companyName} · {detail.market}
          </h3>
          <div className="grow" />
          <span className="prov prov-a">
            <i />
            AI draft
          </span>
          {detail.status === 'held_commercial' ? (
            <span className="tag tag-alert">{detail.released ? 'Released — awaiting approval' : 'Held'}</span>
          ) : (
            <span className="tag tag-due">{fmtDate(detail.age)}</span>
          )}
        </header>
        <div className="body">
          <div className="mail">
            <div className="hd">
              <div className="row">
                <span>To</span>
                <b>
                  {detail.contactName ?? '—'} {detail.contactEmail ? `<${detail.contactEmail}>` : ''}
                </b>{' '}
                <span className="tag">Test recipient</span>
              </div>
              <div className="row">
                <span>Subject</span>
                <b>{detail.subject}</b>
              </div>
            </div>
            <div className="bd">
              {detail.segments.map((s, i) =>
                s.kind === 'plain' ? (
                  <span key={i}>{s.text}</span>
                ) : (
                  <mark key={i} className={s.kind}>
                    {s.text}
                  </mark>
                ),
              )}
            </div>
          </div>
          <div className="legendrow" style={{ marginTop: 10 }}>
            <span>
              <mark className="why">Highlighted</mark> = a claim traced to a verified source
            </span>
            <span>
              <mark className="risk">Highlighted</mark> = commercial language that needs authority
            </span>
          </div>
        </div>
      </div>

      <div className="split">
        <div className="grid" style={{ gap: 14 }}>
          {detail.why.length > 0 ? (
            <div className="aiblock">
              <div className="h">
                <span className="prov prov-a">
                  <i />
                  AI analysis
                </span>{' '}
                Why this message, for this company
              </div>
              <ul className="small" style={{ margin: '0 0 8px', paddingLeft: 18 }}>
                {detail.why.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {canWrite ? (
            <div className="card">
              <header>
                <h3>Your edits</h3>
                <div className="grow" />
                <span className="prov prov-h">
                  <i />
                  Recorded against your name
                </span>
              </header>
              <div className="body">
                <textarea
                  className="f"
                  style={{ minHeight: 160 }}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                />
                {dirty ? (
                  <div style={{ marginTop: 8 }}>
                    <button className="btn btn-sm" onClick={saveEdit} disabled={pending !== null}>
                      {pending === 'save' ? 'Saving…' : 'Save edit'}
                    </button>
                    <span className="tiny muted" style={{ marginLeft: 8 }}>
                      Save before approving, rejecting or requesting changes.
                    </span>
                  </div>
                ) : null}
                <textarea
                  className="f"
                  style={{ marginTop: 10 }}
                  placeholder="Reason for reject / note for request changes"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {canApprove ? (
                    <button
                      className="btn btn-go"
                      onClick={approve}
                      disabled={pending !== null || dirty || blockingChecks.length > 0}
                      title={
                        dirty
                          ? 'Save your edit first'
                          : blockingChecks.length > 0
                            ? `${blockingChecks.length} check(s) still blocking`
                            : undefined
                      }
                    >
                      {pending === 'approve' ? 'Approving…' : 'Approve'}
                    </button>
                  ) : null}
                  <button className="btn" onClick={change} disabled={pending !== null || dirty}>
                    {pending === 'changes' ? '…' : 'Request changes'}
                  </button>
                  <button className="btn btn-warn" onClick={reject} disabled={pending !== null || dirty}>
                    {pending === 'reject' ? '…' : 'Reject'}
                  </button>
                </div>
                {error ? (
                  <p className="fm-err" role="alert" style={{ marginTop: 8 }}>
                    {error}
                  </p>
                ) : null}
                {gmailNotice ? (
                  <p
                    className="small"
                    style={{ marginTop: 8, color: gmailNotice.ok ? 'var(--verified)' : 'var(--ochre)' }}
                  >
                    {gmailNotice.text}
                  </p>
                ) : null}
                <p className="tiny muted" style={{ margin: '10px 0 0' }}>
                  Approving records your name, the exact text approved (as a hash) and the model
                  version, then creates a Gmail draft in your own mailbox. Nothing is ever sent —
                  the connector&apos;s OAuth scope is compose-only.
                </p>
              </div>
            </div>
          ) : (
            <p className="small muted">Auditors can read the queue but cannot act on it.</p>
          )}
        </div>

        <div className="grid" style={{ gap: 14, alignContent: 'start' }}>
          <div className="card">
            <header>
              <h3>Pre-send checks</h3>
              <div className="grow" />
              {blockingChecks.length > 0 ? (
                <span className="tag tag-alert">{blockingChecks.length} blocking</span>
              ) : (
                <span className="tag tag-ok">All clear</span>
              )}
            </header>
            <div className="body grid" style={{ gap: 8 }}>
              {detail.checks.map((c) => (
                <div key={c.label} className="small" style={{ display: 'flex', justifyContent: 'space-between', gap: 9 }}>
                  <span>{c.label}</span>
                  {c.status === 'ok' ? <span className="tag tag-ok">Pass</span> : <span className="tag tag-alert">Hold</span>}
                </div>
              ))}
            </div>
          </div>

          {detail.status === 'held_commercial' ? (
            <div className="card">
              <header>
                <h3>Commercial guardrail</h3>
              </header>
              <div className="body">
                <p className="small">
                  The draft touches <b>{detail.reservedMatterLabel ?? detail.reservedMatter}</b>. Price,
                  MOQ, credit, freight, delivery dates, samples, exclusivity, distributor
                  appointment, warranty and compliance claims are reserved to authorised staff.
                </p>
                {detail.released ? (
                  <p className="small" style={{ color: 'var(--verified)' }}>
                    Released — an approver may now approve this draft.
                  </p>
                ) : canReleaseCommercial ? (
                  <button className="btn btn-sm" onClick={release} disabled={pending !== null}>
                    {pending === 'release' ? 'Releasing…' : 'Release for approval'}
                  </button>
                ) : (
                  <p className="small muted">Waiting on a Commercial Authority to release this draft.</p>
                )}
              </div>
            </div>
          ) : null}

          <div className="card">
            <header>
              <h3>Send plan</h3>
            </header>
            <div className="body small grid" style={{ gap: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Follow-up 1</span>
                <b>+4 working days</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Follow-up 2</span>
                <b>+11 working days</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Then</span>
                <b>Nurture, quarterly</b>
              </div>
              <p className="tiny muted" style={{ margin: '3px 0 0' }}>
                Both counted from the first touch. Follow-ups stop the moment a reply arrives.
                Maximum three touches, then the lead rests.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
