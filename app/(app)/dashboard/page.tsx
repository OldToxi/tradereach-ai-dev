import { currentUser } from '@/lib/session'
import { ROLE_LABELS } from '@/lib/nav'

export default async function DashboardPage() {
  const user = await currentUser()

  return (
    <div>
      <h1>Good {greeting()}, {user.fullName.split(' ')[0]}.</h1>
      <p style={{ color: 'var(--ink-2)' }}>
        You are signed in as <strong>{ROLE_LABELS[user.role]}</strong>
        {user.assignedMarkets.length ? (
          <> with markets: {user.assignedMarkets.join(', ')}</>
        ) : null}
        .
      </p>

      <div className="card" style={{ padding: 18, marginTop: 16 }}>
        <h3>Workspace is ready</h3>
        <p style={{ color: 'var(--ink-2)', margin: '6px 0 0' }}>
          Sign-in, session and role-aware navigation are live. The dashboard panels — pipeline,
          reply triage, meetings and the weekly read-out — arrive in later phases.
        </p>
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
