'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/auth-actions'

const DEMO_ROLES = [
  { email: 'rifat.hasan@anwargroup.test', role: 'Export Manager' },
  { email: 'nusrat.jahan@anwargroup.test', role: 'Export Executive' },
  { email: 'mahbub.rahman@anwargroup.test', role: 'Commercial Authority' },
  { email: 'audit@anwargroup.test', role: 'Read-only Auditor' },
]

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const result = await signIn(new FormData(e.currentTarget))
    if (result.error) {
      setError(result.error)
      setPending(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="lgbox">
      <h2>Sign in</h2>
      <p className="note" style={{ marginTop: 6, marginBottom: 4 }}>
        Demo workspace — sign in as one of the seeded roles to see how access changes.
      </p>

      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue="rifat.hasan@anwargroup.test"
            autoComplete="username"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            defaultValue="demo-password-2026"
            autoComplete="current-password"
            required
          />
        </div>

        {error ? <div className="error">{error}</div> : null}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button className="btn btn-pri" type="submit" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            className="btn"
            type="button"
            disabled
            title="Google Workspace SSO is wired up with the Gmail connector (later phase)"
          >
            Continue with Google Workspace
          </button>
        </div>
      </form>

      <div className="note" style={{ marginTop: 16 }}>
        <strong>Demo roles</strong>
        <ul style={{ paddingLeft: 16, margin: '6px 0 0' }}>
          {DEMO_ROLES.map((r) => (
            <li key={r.email}>
              {r.email} — {r.role}
            </li>
          ))}
        </ul>
        <p style={{ marginTop: 8 }}>
          Your role is assigned by your account, not chosen at sign-in. All passwords are{' '}
          <code>demo-password-2026</code>.
        </p>
      </div>

      <p className="note">
        Sessions expire after 30 minutes idle. Gmail access uses OAuth — TradeReach never stores
        a password, and API keys live in server-side environment variables only.
      </p>
    </div>
  )
}
