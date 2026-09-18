'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { rankNeeds, funnelBarClass, type Kpis, type FunnelRow, type MarketBar, type NeedItem } from '@/lib/dashboard'
import { generateReadout, markReadoutReviewed } from '@/lib/readout-actions'

export interface DataHealth {
  verified: number
  unverified: number
  ai: number
  humanApproved: number
}

export interface FollowUpItem {
  id: string
  name: string
  detail: string
}

export interface ReadoutView {
  id: string
  body: string
  generated_at: string
  reviewedBy: string | null
}

export function DashboardScreen({
  firstName,
  kpis,
  draftsAwaiting,
  draftsOlder48h,
  contactedAwaiting,
  followUpsDue,
  newReplies,
  buyingInterest,
  meetings,
  nextMeeting,
  needs,
  funnel,
  replyRatePct,
  marketBars,
  dataHealth,
  readout,
  canGenerateReadout,
  followUpList,
}: {
  firstName: string
  kpis: Kpis
  draftsAwaiting: number
  draftsOlder48h: number
  contactedAwaiting: number
  followUpsDue: number
  newReplies: number
  buyingInterest: number
  meetings: number
  nextMeeting: string | null
  needs: NeedItem[]
  funnel: FunnelRow[]
  replyRatePct: number
  marketBars: MarketBar[]
  dataHealth: DataHealth
  readout: ReadoutView | null
  canGenerateReadout: boolean
  followUpList: FollowUpItem[]
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const ranked = rankNeeds(needs).slice(0, 8)
  const funnelMax = funnel.length ? Math.max(...funnel.map((f) => f.count), 1) : 1
  const marketMax = marketBars.length ? Math.max(...marketBars.map((m) => m.count), 1) : 1

  async function onGenerate() {
    setPending(true)
    setNote(null)
    const res = await generateReadout()
    setPending(false)
    if (res.ok) setNote(res.note ?? null)
    router.refresh()
  }

  async function onMarkReviewed(id: string) {
    setPending(true)
    setNote(null)
    const fd = new FormData()
    fd.set('id', id)
    const res = await markReadoutReviewed(fd)
    setPending(false)
    if (res.ok) setNote(res.note ?? null)
    router.refresh()
  }

  return (
    <div>
      <div className="pagehead">
        <div className="grow">
          <h1>Good {greeting()}, {firstName}</h1>
          <p>
            {draftsAwaiting > 0 ? `${draftsAwaiting} draft${draftsAwaiting === 1 ? ' is' : 's are'} waiting on you` : 'No drafts are waiting'},
            {newReplies > 0 ? `, ${newReplies} new repl${newReplies === 1 ? 'y' : 'ies'} to triage` : ''}
            {followUpsDue > 0 ? `, and ${followUpsDue} follow-up${followUpsDue === 1 ? '' : 's'} fall due today` : ''}.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn" href="/review">
            Open review queue
          </Link>
        </div>
      </div>

      {note ? (
        <p className="small" style={{ color: 'var(--verified)', margin: '0 0 12px' }}>
          {note}
        </p>
      ) : null}

      <div className="stats" style={{ marginBottom: 16 }}>
        <div className="stat">
          <b className="num">{kpis.researched}</b>
          <span>Companies researched</span>
          <br />
          <em>+{kpis.newThisWeek} this week</em>
        </div>
        <div className="stat">
          <b className="num">{kpis.qualified}</b>
          <span>Qualified for outreach</span>
          <br />
          <em className="muted" style={{ color: 'var(--ink-3)' }}>
            {kpis.qualifiedPct}% of researched
          </em>
        </div>
        <div className="stat">
          <b className="num">{draftsAwaiting}</b>
          <span>Drafts awaiting approval</span>
          <br />
          <em style={{ color: 'var(--ochre)' }}>
            {draftsOlder48h} older than 48h
          </em>
        </div>
        <div className="stat">
          <b className="num">{contactedAwaiting}</b>
          <span>Contacted, awaiting reply</span>
          <br />
          <em className="muted" style={{ color: 'var(--ink-3)' }}>
            {followUpsDue} follow-ups due today
          </em>
        </div>
        <div className="stat">
          <b className="num">{newReplies}</b>
          <span>New replies to triage</span>
          <br />
          <em>{buyingInterest} classified as buying interest</em>
        </div>
        <div className="stat">
          <b className="num">{meetings}</b>
          <span>Meetings scheduled</span>
          <br />
          <em className="muted" style={{ color: 'var(--ink-3)' }}>
            {nextMeeting ? `Next: ${nextMeeting}` : 'None upcoming'}
          </em>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.45fr .9fr' }}>
        <div className="grid" style={{ gap: 14 }}>
          <div className="card">
            <header>
              <h3>Needs you today</h3>
              <div className="grow" />
              <span className="tiny muted">Ranked by deal value, recency and risk of going cold</span>
            </header>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Market</th>
                    <th>What&apos;s waiting</th>
                    <th>Age</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted" style={{ padding: 18 }}>
                        Nothing needs you right now.
                      </td>
                    </tr>
                  ) : (
                    ranked.map((n) => (
                      <tr key={n.companyId + n.what}>
                        <td>
                          <Link className="rowlink" href={n.route}>
                            <b>{n.company}</b>
                          </Link>
                        </td>
                        <td>{n.market}</td>
                        <td>
                          <span className={`tag ${toneClass(n.tone)}`}>{n.what}</span>
                        </td>
                        <td className="num">{n.ageLabel}</td>
                        <td>
                          <Link className="btn btn-sm" href={n.route}>
                            {n.routeLabel}
                          </Link>
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
              <h3>Pipeline by stage</h3>
              <div className="grow" />
              <Link className="btn btn-sm" href="/pipeline">
                Open board
              </Link>
            </header>
            <div className="body">
              <div className="grid" style={{ gap: 7 }}>
                {funnel.map((f) => (
                  <div key={f.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }} className="small">
                      <span>{f.label}</span>
                      <b className="num">{f.count}</b>
                    </div>
                    <div className={`bar ${funnelBarClass(f.count, funnelMax)}`}>
                      <span style={{ width: `${Math.round((f.count / funnelMax) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <hr className="sep" />
              <div className="legendrow">
                <span>
                  <b style={{ color: 'var(--verified)' }}>{replyRatePct}%</b> reply rate on approved,
                  researched outreach
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <header>
              <h3>Where our effort is going</h3>
              <div className="grow" />
              <span className="tiny muted">Active leads by market</span>
            </header>
            <div className="body">
              <div className="grid" style={{ gap: 9 }}>
                {marketBars.map((m) => (
                  <div key={m.market}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }} className="small">
                      <span>{m.market}</span>
                      <b className="num">{m.count}</b>
                    </div>
                    <div className="bar mid">
                      <span style={{ width: `${Math.round((m.count / marketMax) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid" style={{ gap: 14, alignContent: 'start' }}>
          <div className="aiblock">
            <div className="h">
              <span className="prov prov-a">
                <i></i>AI analysis
              </span>{' '}
              Weekly read-out
            </div>
            {readout ? (
              <>
                <p style={{ whiteSpace: 'pre-wrap' }}>{readout.body}</p>
                <div className="foot">
                  <span>
                    Generated {formatStamp(readout.generated_at)} · reviewed by{' '}
                    {readout.reviewedBy ?? 'no one yet'}
                  </span>
                  <button
                    className="btn btn-sm"
                    disabled={pending || readout.reviewedBy !== null}
                    onClick={() => onMarkReviewed(readout.id)}
                  >
                    Mark reviewed
                  </button>
                </div>
              </>
            ) : (
              <p>No read-out yet. Generate one to see the workspace&apos;s week at a glance.</p>
            )}
            <div className="foot">
              {canGenerateReadout ? (
                <button className="btn btn-sm" disabled={pending} onClick={onGenerate}>
                  {pending ? 'Generating…' : 'Generate read-out'}
                </button>
              ) : (
                <span>Read-out is workspace-wide — your role sees your own markets only.</span>
              )}
            </div>
          </div>

          <div className="card">
            <header>
              <h3>Follow-ups due</h3>
              <div className="grow" />
              <span className="tag tag-due">{followUpsDue} today</span>
            </header>
            <div className="body grid" style={{ gap: 10 }}>
              {followUpList.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  No follow-ups due.
                </p>
              ) : (
                followUpList.map((f) => (
                  <div key={f.id}>
                    <b>{f.name}</b>
                    <div className="small muted">{f.detail}</div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                      <Link className="btn btn-sm" href="/review">
                        Open AI draft
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <header>
              <h3>Data health</h3>
            </header>
            <div className="body grid" style={{ gap: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="prov prov-v">
                  <i></i>Verified fields
                </span>
                <b className="num">{dataHealth.verified}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="prov prov-u">
                  <i></i>Unverified fields
                </span>
                <b className="num">{dataHealth.unverified}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="prov prov-a">
                  <i></i>AI-generated fields
                </span>
                <b className="num">{dataHealth.ai}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="prov prov-h">
                  <i></i>Human-approved messages
                </span>
                <b className="num">{dataHealth.humanApproved}</b>
              </div>
              <hr className="sep" style={{ margin: '2px 0' }} />
              <p className="tiny muted" style={{ margin: 0 }}>
                Nothing AI writes is treated as fact. Unverified fields block a company from moving
                past Qualification.
              </p>
            </div>
          </div>

          <div className="card">
            <header>
              <h3>Connector status</h3>
            </header>
            <div className="body grid" style={{ gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Gmail (draft-only scope)</span>
                <span className="tag tag-ok">Connected</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Google Calendar</span>
                <span className="tag tag-ok">Connected</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Company registry lookup</span>
                <span className="tag tag-ok">Connected</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Outbound sending</span>
                <span className="tag tag-alert">Disabled in demo</span>
              </div>
              <p className="tiny muted" style={{ margin: '4px 0 0' }}>
                Demo mode: recipients are forced to <code>*.test</code> addresses and mail is written
                to Drafts, never sent.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

function toneClass(tone: NeedItem['tone']): string {
  switch (tone) {
    case 'alert':
      return 'tag-alert'
    case 'due':
      return 'tag-due'
    case 'ok':
      return 'tag-ok'
    default:
      return ''
  }
}

function formatStamp(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}
