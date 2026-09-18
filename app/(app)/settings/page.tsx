import { currentUser } from '@/lib/session'
import { getConnectionStatus } from '@/lib/gmail'
import { SettingsScreen } from '@/components/SettingsScreen'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string; gmail?: string; message?: string }
}) {
  const user = await currentUser()

  if (user.role !== 'manager' && user.role !== 'commercial') {
    return (
      <div>
        <div className="pagehead">
          <div className="grow">
            <h1>Settings &amp; access</h1>
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <p className="small muted" style={{ margin: 0 }}>
            Settings are available to managers and the Commercial Authority.
          </p>
        </div>
      </div>
    )
  }

  const gmailStatus = await getConnectionStatus(user.id)

  return (
    <SettingsScreen
      role={user.role}
      gmailStatus={gmailStatus}
      initialTab={searchParams.tab === 'connectors' ? 'connectors' : user.role === 'commercial' ? 'connectors' : 'users'}
      gmailNotice={searchParams.gmail ?? null}
      gmailMessage={searchParams.message ?? null}
    />
  )
}
