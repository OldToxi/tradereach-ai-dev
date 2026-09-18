'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { disconnectGmail } from '@/lib/gmail-actions'

export interface GmailStatus {
  connected: boolean
  scope: string | null
  updatedAt: string | null
}

const TAB_LABELS: Record<string, string> = {
  users: 'Users & roles',
  score: 'Scoring',
  ai: 'AI workflow',
  connectors: 'Connectors',
  guardrails: 'Commercial guardrails',
}

export function SettingsScreen({
  role,
  gmailStatus,
  initialTab,
  gmailNotice,
  gmailMessage,
}: {
  role: string
  gmailStatus: GmailStatus
  initialTab: string
  gmailNotice: string | null
  gmailMessage: string | null
}) {
  const [tab, setTab] = useState(initialTab)
  const isManager = role === 'manager'

  const tabIds = isManager ? ['users', 'score', 'ai', 'connectors', 'guardrails'] : ['connectors']

  return (
    <div>
      <div className="pagehead">
        <div className="grow">
          <h1>Settings &amp; access</h1>
          <p>
            Who can do what, how the scoring is weighted, and how the system connects
            to the outside world.
          </p>
        </div>
      </div>

      {gmailNotice ? <GmailBanner notice={gmailNotice} message={gmailMessage} /> : null}

      {tabIds.length > 1 ? (
        <div className="tabs">
          {tabIds.map((id) => (
            <button key={id} className={tab === id ? 'on' : undefined} onClick={() => setTab(id)}>
              {TAB_LABELS[id]}
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'connectors' ? (
        <ConnectorsPane gmailStatus={gmailStatus} />
      ) : (
        <div className="card">
          <div className="body">
            <p className="small muted" style={{ margin: 0 }}>
              {TAB_LABELS[tab]} arrives in Phase 11.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function GmailBanner({ notice, message }: { notice: string; message: string | null }) {
  const copy: Record<string, { text: string; cls: string }> = {
    connected: { text: 'Gmail connected.', cls: 'tag-ok' },
    denied: { text: 'Gmail connection cancelled — consent was not granted.', cls: 'tag-due' },
    error: { text: message ?? 'Could not connect Gmail.', cls: 'tag-alert' },
  }
  const c = copy[notice] ?? copy.error
  return (
    <div className="card" style={{ padding: 12, marginBottom: 14 }}>
      <span className={`tag ${c.cls}`}>{c.text}</span>
    </div>
  )
}

function ConnectorsPane({ gmailStatus }: { gmailStatus: GmailStatus }) {
  return (
    <div className="split">
      <div className="card">
        <header>
          <h3>Connected services</h3>
        </header>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Scope</th>
                <th>Auth</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <b>Gmail</b>
                </td>
                <td>
                  <code>gmail.compose</code> — create drafts only
                </td>
                <td>OAuth 2.0, per user</td>
                <td>
                  {gmailStatus.connected ? (
                    <span className="tag tag-ok">Connected</span>
                  ) : (
                    <span className="tag">Not connected</span>
                  )}
                </td>
                <td>
                  <GmailControls connected={gmailStatus.connected} />
                </td>
              </tr>
              <tr>
                <td>
                  <b>Outbound sending</b>
                </td>
                <td>Disabled for the assignment</td>
                <td>—</td>
                <td>
                  <span className="tag tag-alert">Off</span>
                </td>
                <td>
                  <button className="btn btn-sm" disabled style={{ opacity: 0.5 }}>
                    Locked
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {gmailStatus.connected && gmailStatus.updatedAt ? (
          <div className="body" style={{ borderTop: '1px solid var(--line-2)' }}>
            <p className="tiny muted" style={{ margin: 0 }}>
              Connected {new Date(gmailStatus.updatedAt).toLocaleString()}. Scope on record:{' '}
              <code>{gmailStatus.scope}</code>
            </p>
          </div>
        ) : null}
      </div>
      <div className="card">
        <header>
          <h3>Safety rails on the mail connector</h3>
        </header>
        <div className="body grid" style={{ gap: 10 }}>
          <div className="small">
            <b>Draft-only scope.</b>
            <div className="muted">
              The OAuth grant does not include send. Even a bug cannot mail a real buyer.
            </div>
          </div>
          <div className="small">
            <b>Test-domain allowlist.</b>
            <div className="muted">
              Recipients must end in <code>.test</code>. Anything else is refused and logged.
            </div>
          </div>
          <div className="small">
            <b>Per-user tokens.</b>
            <div className="muted">
              Drafts appear in the approver&apos;s own mailbox, so ownership is obvious.
            </div>
          </div>
          <div className="small">
            <b>Retry, never a silent drop.</b>
            <div className="muted">
              A connector failure surfaces as a visible error with a retry, not a
              disappearing draft.
            </div>
          </div>
          <div className="small">
            <b>Unsubscribe is permanent.</b>
            <div className="muted">
              A suppressed address cannot be re-added by import or by AI.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function GmailControls({ connected }: { connected: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function disconnect() {
    setPending(true)
    setError(null)
    const res = await disconnectGmail()
    setPending(false)
    if (res.ok) {
      router.refresh()
    } else {
      setError(res.error ?? 'Could not disconnect.')
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <a className="btn btn-sm" href="/api/auth/gmail/connect">
        {connected ? 'Reauthorise' : 'Connect'}
      </a>
      {connected ? (
        <button className="btn btn-sm" onClick={disconnect} disabled={pending}>
          {pending ? '…' : 'Disconnect'}
        </button>
      ) : null}
      {error ? <span className="tiny" style={{ color: 'var(--alert)' }}>{error}</span> : null}
    </div>
  )
}
