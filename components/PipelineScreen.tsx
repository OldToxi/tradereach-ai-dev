'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { changeStage } from '@/lib/company-actions'
import {
  PIPELINE_STAGES,
  moveBlockReason,
  leadTone,
  holdingLanesWithCounts,
  type StageMoveContext,
} from '@/lib/pipeline'
import { stageLabel } from '@/lib/companies'

export interface PipelineCard {
  id: string
  name: string
  market: string
  company_type: string | null
  stage: string
  fit_score: number | null
  decisionMaker: string | null
  gapCount: number
  hasNamedContact: boolean
  openBlockingTasks: number
}

export interface HoldingLaneCounts {
  needs_research: number
  nurturing: number
  awaiting_approval: number
  awaiting_commercial: number
  disqualified: number
  no_contact: number
  closed: number
}

export function PipelineScreen({
  companies,
  lanes,
  canWrite,
}: {
  companies: PipelineCard[]
  lanes: HoldingLaneCounts
  canWrite: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const byStage = useMemo(() => {
    const map = new Map<string, PipelineCard[]>()
    for (const c of companies) {
      const list = map.get(c.stage) ?? []
      list.push(c)
      map.set(c.stage, list)
    }
    return map
  }, [companies])

  const contextOf = (c: PipelineCard): StageMoveContext => ({
    gapCount: c.gapCount,
    hasNamedContact: c.hasNamedContact,
    openBlockingTasks: c.openBlockingTasks,
  })

  async function move(company: PipelineCard, to: string) {
    if (!canWrite) return
    setError(null)

    const reason = moveBlockReason(company.stage, to, contextOf(company))
    if (reason) {
      setError(`Cannot move ${company.name}: ${reason}.`)
      return
    }
    if (to === company.stage) return

    setPending(company.id)
    const fd = new FormData()
    fd.set('companyId', company.id)
    fd.set('stage', to)
    const res = await changeStage(fd)
    setPending(null)
    if (!res.ok) {
      setError(res.error ?? 'Move failed.')
    } else {
      router.refresh()
    }
  }

  const laneRows = holdingLanesWithCounts({
    needs_research: lanes.needs_research,
    nurturing: lanes.nurturing,
    awaiting_approval: lanes.awaiting_approval,
    awaiting_commercial: lanes.awaiting_commercial,
    disqualified: lanes.disqualified,
    no_contact: lanes.no_contact,
    closed: lanes.closed,
  })

  return (
    <div>
      <div className="pagehead">
        <div className="grow">
          <h1>Opportunity pipeline</h1>
          <p>
            The full journey, left to right. A lead can also sit in a holding lane below when it is
            waiting on research, approval, or simply on time to pass.
          </p>
        </div>
      </div>

      {error ? (
        <p className="small" style={{ color: 'var(--alert)', margin: '0 0 12px' }} role="alert">
          {error}
        </p>
      ) : null}

      <div className="board">
        {PIPELINE_STAGES.map((stage) => {
          const cards = byStage.get(stage) ?? []
          return (
            <div
              key={stage}
              className={`col ${dragOver === stage ? 'droptarget' : ''}`}
              onDragOver={(e) => {
                if (!canWrite) return
                e.preventDefault()
                if (dragOver !== stage) setDragOver(stage)
              }}
              onDragLeave={() => {
                if (dragOver === stage) setDragOver(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(null)
                if (!canWrite) return
                const id = e.dataTransfer.getData('text/company-id')
                const company = companies.find((c) => c.id === id)
                if (company) move(company, stage)
              }}
            >
              <h4>
                {stageLabel(stage)} <span className="num">{cards.length}</span>
              </h4>
              <div className="stack">
                {cards.length === 0 ? (
                  <p className="tiny muted" style={{ margin: 0 }}>
                    Nothing here.
                  </p>
                ) : (
                  cards.map((c) => (
                    <div
                      key={c.id}
                      className={`lead ${leadTone(c.stage, c.gapCount)}`}
                      draggable={canWrite}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/company-id', c.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      title={canWrite ? 'Drag to move between stages' : undefined}
                      style={pending === c.id ? { opacity: 0.5 } : undefined}
                    >
                      <b>{c.name}</b>
                      <div className="tiny muted">
                        {c.market}
                        {c.fit_score != null ? ` · score ${c.fit_score}` : ''}
                      </div>
                      <div className="meta">
                        {c.gapCount > 0 ? (
                          <span className="tag tag-due">{c.gapCount} missing</span>
                        ) : c.decisionMaker ? null : (
                          <span className="tag">no contact yet</span>
                        )}
                        {c.openBlockingTasks > 0 ? (
                          <span className="tag tag-alert">{c.openBlockingTasks} blocking</span>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      <h3 style={{ margin: '18px 0 10px' }}>Holding lanes</h3>
      <div className="lanes">
        {laneRows.map((lane) => (
          <div key={lane.key} className="lane">
            <b>{lane.label}</b>
            <div className="n num">{lane.count}</div>
            <div className="tiny muted">{lane.hint}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <header>
          <h3>Stage rules</h3>
          <div className="grow" />
          <span className="tiny muted">Enforced by the app, not by memory</span>
        </header>
        <div className="body small">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
            <div>
              <b>Qualification → Contact</b>
              <div className="muted">Blocked while any qualification field is still unverified.</div>
            </div>
            <div>
              <b>Contact → Outreach</b>
              <div className="muted">Blocked without a named decision-maker and a source for the email address.</div>
            </div>
            <div>
              <b>Blocking tasks</b>
              <div className="muted">An open task flagged &ldquo;blocks stage&rdquo; stops any forward move until it is done.</div>
            </div>
            <div>
              <b>Commercial discussion</b>
              <div className="muted">Any message touching price, credit, MOQ or exclusivity routes to Commercial Authority first.</div>
            </div>
          </div>
        </div>
      </div>

      <p className="tiny muted" style={{ marginTop: 10 }}>
        {canWrite
          ? 'Drag a card to advance or move it between stages. Moves that would break a rule are refused here and in the database.'
          : 'Your role is read-only — cards cannot be moved.'}
      </p>
    </div>
  )
}
