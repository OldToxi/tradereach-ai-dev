import { currentUser } from '@/lib/session'
import { getConnectionStatus } from '@/lib/gmail'
import { createServerClient } from '@/lib/supabase/server'
import { admin } from '@/lib/supabase/admin'
import { SettingsScreen } from '@/components/SettingsScreen'
import type { ReservedMatterView } from '@/components/GuardrailsPane'
import { roleIsValid, type TeamMemberView } from '@/lib/users'
import { weightsFromRows } from '@/lib/scoring'
import { WORKFLOW_STEPS } from '@/lib/ai/workflow'
import { configFromRows, spendCapUsd, alertThresholdPct } from '@/lib/system-config'

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

  let team: TeamMemberView[] = []
  let marketOptions: string[] = []

  if (user.role === 'manager') {
    const supabase = await createServerClient()
    const [{ data: profiles }, { data: markets }] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name, role, assigned_markets').order('created_at'),
      supabase.from('market').select('country').order('country'),
    ])

    const lastSeen = await lastSeenMap()

    team = (profiles ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      role: roleIsValid(p.role) ? p.role : 'executive',
      markets: p.assigned_markets ?? [],
      lastSeen: lastSeen.get(p.id) ?? null,
      isSelf: p.id === user.id,
    }))
    marketOptions = (markets ?? []).map((m) => m.country)
  }

  const supabase = await createServerClient()
  const { data: weightRows } = await supabase
    .from('score_weight')
    .select('criterion_key, weight')
    .order('sort_order')
  const weights = weightsFromRows(weightRows ?? [])

  const [{ data: configRows }, { data: matterRows }] = await Promise.all([
    supabase.from('system_config').select('key, value'),
    supabase.from('reserved_matter').select('key, label, is_builtin').order('sort_order'),
  ])
  const config = configFromRows(configRows ?? [])
  const reservedMatters: ReservedMatterView[] = (matterRows ?? []).map((m) => ({
    key: m.key,
    label: m.label,
    isBuiltin: m.is_builtin,
  }))

  return (
    <SettingsScreen
      role={user.role}
      gmailStatus={gmailStatus}
      initialTab={searchParams.tab === 'connectors' ? 'connectors' : user.role === 'commercial' ? 'connectors' : 'users'}
      gmailNotice={searchParams.gmail ?? null}
      gmailMessage={searchParams.message ?? null}
      team={team}
      marketOptions={marketOptions}
      currentUserId={user.id}
      weights={weights}
      aiSteps={WORKFLOW_STEPS}
      spendCap={spendCapUsd(config)}
      alertThreshold={alertThresholdPct(config)}
      reservedMatters={reservedMatters}
      refusalTemplate={config.refusal_template}
    />
  )
}

/** Best-effort last-sign-in from the Auth admin API; never blocks the team table. */
async function lastSeenMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const { data } = await admin.auth.admin.listUsers()
    const users = data?.users ?? []
    for (const u of users) {
      if (u.id && u.last_sign_in_at) map.set(u.id, u.last_sign_in_at)
    }
  } catch (err) {
    console.error('[settings] last-sign-in lookup failed:', err)
  }
  return map
}
