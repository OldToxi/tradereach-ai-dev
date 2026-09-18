import { currentUser } from '@/lib/session'
import { createServerClient } from '@/lib/supabase/server'
import { canManageCatalog, marketsForProduct, marketFitSummary } from '@/lib/catalog'
import type { MarketFitSummary } from '@/lib/catalog'
import { ProductsScreen } from '@/components/ProductsScreen'
import type { ProductView } from '@/components/ProductModal'

export default async function ProductsPage() {
  const user = await currentUser()
  const supabase = await createServerClient()

  const [
    { data: products, error: productsError },
    { data: markets },
    { data: companies },
    { data: researchRuns },
  ] = await Promise.all([
    supabase.from('product').select('*').order('name'),
    supabase.from('market').select('country, product_focus'),
    supabase.from('company').select('id, product_id, market, stage'),
    supabase.from('research_run').select('company_id, score'),
  ])

  if (productsError) {
    return (
      <div>
        <div className="pagehead">
          <div className="grow">
            <h1>Products</h1>
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <p style={{ color: 'var(--alert)', margin: 0 }}>
            Could not load products: {productsError.message}
          </p>
        </div>
      </div>
    )
  }

  const companyById = new Map((companies ?? []).map((c) => [c.id, c]))

  const list: ProductView[] = (products ?? []).map((p) => ({
    ...p,
    targetMarkets: marketsForProduct(p.name, markets ?? []),
    activeLeads: (companies ?? []).filter(
      (c) => c.product_id === p.id && c.stage !== 'disqualified',
    ).length,
  }))

  const marketFit: Record<string, MarketFitSummary> = {}
  const companyCounts: Record<string, number> = {}
  for (const p of products ?? []) {
    const mine = (companies ?? []).filter((c) => c.product_id === p.id)
    companyCounts[p.id] = mine.length
    const runs = (researchRuns ?? [])
      .filter((r) => mine.some((c) => c.id === r.company_id))
      .map((r) => ({ market: companyById.get(r.company_id)!.market, score: r.score }))
    marketFit[p.id] = marketFitSummary(runs)
  }

  return (
    <ProductsScreen
      products={list}
      canEdit={canManageCatalog(user.role)}
      marketFit={marketFit}
      companyCounts={companyCounts}
    />
  )
}
