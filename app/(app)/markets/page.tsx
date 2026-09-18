import { currentUser } from '@/lib/session'
import { createServerClient } from '@/lib/supabase/server'
import { canManageCatalog, marketNoteOrderIndex } from '@/lib/catalog'
import { MarketsScreen } from '@/components/MarketsScreen'
import type { MarketView } from '@/components/MarketModal'

export default async function MarketsPage() {
  const user = await currentUser()
  const supabase = await createServerClient()

  const [
    { data: markets, error: marketsError },
    { data: notes },
    { data: companies },
    { data: products },
  ] = await Promise.all([
    supabase.from('market').select('*').order('country'),
    supabase.from('market_note').select('id, market_id, key, value, provenance, source_label'),
    supabase.from('company').select('market'),
    supabase.from('product').select('name').order('name'),
  ])

  if (marketsError) {
    return (
      <div>
        <div className="pagehead">
          <div className="grow">
            <h1>Target markets</h1>
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <p style={{ color: 'var(--alert)', margin: 0 }}>
            Could not load markets: {marketsError.message}
          </p>
        </div>
      </div>
    )
  }

  // Company counts come through the user client, so they respect market scoping:
  // an executive sees counts only for their own markets, everyone else sees all.
  const companyCount: Record<string, number> = {}
  for (const c of companies ?? []) companyCount[c.market] = (companyCount[c.market] ?? 0) + 1

  const sortedNotes = (notes ?? []).slice().sort(
    (a, b) => marketNoteOrderIndex(a.key) - marketNoteOrderIndex(b.key),
  )

  const list: MarketView[] = (markets ?? []).map((m) => ({
    ...m,
    priority: m.priority ?? 'medium',
    status: m.status ?? 'active',
    companyCount: companyCount[m.country] ?? 0,
    notes: sortedNotes.filter((n) => n.market_id === m.id),
  }))

  return (
    <MarketsScreen
      markets={list}
      canEdit={canManageCatalog(user.role)}
      productNames={(products ?? []).map((p) => p.name)}
    />
  )
}
