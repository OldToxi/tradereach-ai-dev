import { currentUser } from '@/lib/session'
import { createServerClient } from '@/lib/supabase/server'
import { canManageCatalog, marketsForProduct } from '@/lib/catalog'
import { ProductsScreen } from '@/components/ProductsScreen'
import type { ProductView } from '@/components/ProductModal'

export default async function ProductsPage() {
  const user = await currentUser()
  const supabase = await createServerClient()

  const [
    { data: products, error: productsError },
    { data: markets },
    { data: companies },
  ] = await Promise.all([
    supabase.from('product').select('*').order('name'),
    supabase.from('market').select('country, product_focus'),
    supabase.from('company').select('product_id, stage'),
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

  const list: ProductView[] = (products ?? []).map((p) => ({
    ...p,
    targetMarkets: marketsForProduct(p.name, markets ?? []),
    activeLeads: (companies ?? []).filter(
      (c) => c.product_id === p.id && c.stage !== 'disqualified',
    ).length,
  }))

  return <ProductsScreen products={list} canEdit={canManageCatalog(user.role)} />
}
