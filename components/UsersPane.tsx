'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { relativeTime } from '@/lib/contacts'
import {
  ROLES,
  ROLE_LABELS,
  canApproveFor,
  canReleaseFor,
  marketsLabel,
  type Role,
  type TeamMemberView,
} from '@/lib/users'
import { inviteUser, updateUserRole } from '@/lib/user-actions'

export function UsersPane({
  team,
  marketOptions,
  currentUserId,
}: {
  team: TeamMemberView[]
  marketOptions: string[]
  currentUserId: string
}) {
  const [modal, setModal] = useState<'invite' | 'edit' | null>(null)
  const [editing, setEditing] = useState<TeamMemberView | null>(null)

  return (
    <div className="split">
      <div className="card">
        <header>
          <h3>Team</h3>
          <div className="grow" />
          <button className="btn sm" onClick={() => { setEditing(null); setModal('invite') }}>
            Invite user
          </button>
        </header>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Markets</th>
                <th>Can approve</th>
                <th>Can release terms</th>
                <th>Last seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id}>
                  <td>
                    <b>{m.fullName}</b>
                    <div className="tiny muted">{m.email}</div>
                  </td>
                  <td>{ROLE_LABELS[m.role]}</td>
                  <td>{marketsLabel(m.role, m.markets)}</td>
                  <td>{canApproveFor(m.role) ? <span className="tag ok">Yes</span> : <span className="tag">No</span>}</td>
                  <td>{canReleaseFor(m.role) ? <span className="tag ok">Yes</span> : <span className="tag">No</span>}</td>
                  <td className="muted">{m.lastSeen ? relativeTime(m.lastSeen) : '—'}</td>
                  <td>
                    <button
                      className="btn sm"
                      onClick={() => { setEditing(m); setModal('edit') }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="body" style={{ borderTop: '1px solid var(--line-2)' }}>
          <p className="tiny muted" style={{ margin: 0 }}>
            Role and market changes take effect on the user&apos;s next sign-in. A role
            change is written to the audit trail.
          </p>
        </div>
      </div>

      <div className="card">
        <header>
          <h3>What each role can do</h3>
        </header>
        <div className="body grid" style={{ gap: 11 }}>
          <div className="small">
            <b>Export Executive</b>
            <div className="muted">
              Add companies, run research, request AI drafts, submit for approval. Cannot
              approve or send.
            </div>
          </div>
          <div className="small">
            <b>Export Manager</b>
            <div className="muted">
              Everything above, plus approve outreach, move pipeline stages, disqualify,
              reassign owners.
            </div>
          </div>
          <div className="small">
            <b>Commercial Authority</b>
            <div className="muted">
              Releases anything touching price, payment, credit, MOQ, freight, samples,
              delivery, exclusivity, distributor appointment, warranty or compliance.
            </div>
          </div>
          <div className="small">
            <b>Read-only Auditor</b>
            <div className="muted">Reads and exports records and the audit trail. Writes nothing.</div>
          </div>
          <hr className="sep" style={{ margin: '2px 0' }} />
          <div className="small">
            <b>Data boundaries</b>
            <div className="muted">
              Executives see only their assigned markets. Every access attempt outside
              scope is logged and refused.
            </div>
          </div>
        </div>
      </div>

      {modal ? (
        <UserModal
          mode={modal}
          member={editing}
          marketOptions={marketOptions}
          self={editing?.id === currentUserId}
          onClose={() => setModal(null)}
        />
      ) : null}
    </div>
  )
}

function UserModal({
  mode,
  member,
  marketOptions,
  self,
  onClose,
}: {
  mode: 'invite' | 'edit'
  member: TeamMemberView | null
  marketOptions: string[]
  self: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<Role>(member?.role ?? 'executive')
  const nameRef = useRef<HTMLInputElement>(null)

  const marketsRelevant = role === 'executive' || role === 'manager'

  useEffect(() => {
    nameRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    const res = mode === 'invite' ? await inviteUser(fd) : await updateUserRole(fd)
    setPending(false)
    if (res.ok) {
      router.refresh()
      onClose()
    } else {
      setError(res.error ?? 'Something went wrong.')
    }
  }

  return (
    <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={mode === 'invite' ? 'Invite a user' : 'Edit user'}>
        <header>
          <h3>{mode === 'invite' ? 'Invite a user' : `Edit ${member?.fullName}`}</h3>
          <div className="grow" />
          <button className="btn btn-sm" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="body">
            {member ? (
              <input type="hidden" name="id" value={member.id} />
            ) : null}
            {member ? <input type="hidden" name="prev_role" value={member.role} /> : null}

            {mode === 'invite' ? (
              <div className="frow">
                <div>
                  <label className="f" htmlFor="u-name">Full name</label>
                  <input className="f" id="u-name" name="full_name" ref={nameRef} placeholder="Ayesha Rahman" required />
                </div>
                <div>
                  <label className="f" htmlFor="u-email">Work email</label>
                  <input className="f" id="u-email" name="email" type="email" placeholder="ayesha.rahman@anwargroup.test" required />
                </div>
              </div>
            ) : null}

            <div>
              <label className="f" htmlFor="u-role">Role</label>
              <select
                className="f"
                id="u-role"
                name="role"
                value={role}
                disabled={self}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              {self ? (
                <p className="tiny muted" style={{ margin: '6px 0 0' }}>
                  You cannot change your own role.
                </p>
              ) : null}
            </div>

            {marketsRelevant ? (
              <div>
                <label className="f">Markets</label>
                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {marketOptions.map((m) => (
                    <label key={m} className="check" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <input
                        type="checkbox"
                        name="markets"
                        value={m}
                        defaultChecked={member?.markets.includes(m) ?? false}
                      />
                      <span className="small">{m}</span>
                    </label>
                  ))}
                </div>
                {marketOptions.length === 0 ? (
                  <p className="tiny muted" style={{ margin: '6px 0 0' }}>
                    No markets exist yet — add one from the Markets screen first.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="small muted" style={{ margin: '10px 0 0' }}>
                {role === 'commercial' ? 'Commercial Authority' : 'Read-only Auditor'} sees all markets.
              </p>
            )}

            {mode === 'invite' ? (
              <p className="tiny muted" style={{ margin: '10px 0 0' }}>
                The new team member signs in with the shared demo password (no email is
                sent in this environment).
              </p>
            ) : null}

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
            <button className="btn btn-pri" type="submit" disabled={pending || (self && mode === 'edit')}>
              {pending ? 'Saving…' : mode === 'invite' ? 'Send invitation' : 'Save changes'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
