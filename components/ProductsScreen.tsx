'use client'

import { useState } from 'react'
import { ProductModal, type ProductView } from './ProductModal'

export function ProductsScreen({
  products,
  canEdit,
}: {
  products: ProductView[]
  canEdit: boolean
}) {
  const [selectedId, setSelectedId] = useState<string | null>(products[0]?.id ?? null)
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; product?: ProductView } | null>(null)

  const selected = products.find((p) => p.id === selectedId) ?? products[0] ?? null

  return (
    <div>
      <div className="pagehead">
        <div className="grow">
          <h1>Products</h1>
          <p>
            What we are promoting, and the facts AI is allowed to use when it writes. A
            product&apos;s capability sheet is the only commercial information a draft may quote —
            anything beyond it has to come from a person.
          </p>
        </div>
        {canEdit ? (
          <button className="btn btn-pri" onClick={() => setModal({ mode: 'add' })}>
            Add product
          </button>
        ) : null}
      </div>

      <div className="card">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>HS code</th>
                <th>Certifications</th>
                <th>Capacity / month</th>
                <th>Target markets</th>
                <th>Active leads</th>
                {canEdit ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="muted" style={{ padding: 18 }}>
                    No products yet.{' '}
                    {canEdit ? 'Add your first product to start.' : 'Ask a manager to add the catalog.'}
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    className={`click ${p.id === selected?.id ? 'tr-sel' : ''}`}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <td>
                      <b>{p.name}</b>
                    </td>
                    <td className="mono small">{p.hs_code ?? '—'}</td>
                    <td className="small">
                      {p.certifications?.length ? p.certifications.join(', ') : '—'}
                    </td>
                    <td className="num">{p.monthly_capacity ?? '—'}</td>
                    <td className="small muted">
                      {p.targetMarkets.length ? p.targetMarkets.join(', ') : '—'}
                    </td>
                    <td className="num">{p.activeLeads}</td>
                    {canEdit ? (
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setModal({ mode: 'edit', product: p })
                          }}
                        >
                          Edit sheet
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? (
        <div className="split" style={{ marginTop: 14 }}>
          <div className="card">
            <header>
              <h3>{selected.name} — capability sheet</h3>
              <div className="grow" />
              <span className="prov prov-v">
                <i />
                Verified by Production
              </span>
            </header>
            <div className="body">
              <dl className="kv">
                <dt>HS code</dt>
                <dd className="num">{selected.hs_code ?? '—'}</dd>
                <dt>Certifications</dt>
                <dd>
                  {selected.certifications?.length ? (
                    selected.certifications.map((c) => (
                      <span key={c} className="tag tag-ok">
                        {c}
                      </span>
                    ))
                  ) : (
                    <span className="muted">—</span>
                  )}
                </dd>
                <dt>Monthly capacity</dt>
                <dd className="num">{selected.monthly_capacity ?? '—'}</dd>
                <dt>Lead time</dt>
                <dd>{selected.lead_time ?? '—'}</dd>
                <dt>Capability sheet</dt>
                <dd>{selected.capability_sheet ?? <span className="muted">Nothing entered yet.</span>}</dd>
                <dt>Sample policy</dt>
                <dd>
                  <span className="tag tag-alert">Requires Commercial Authority release</span>
                </dd>
              </dl>
              <hr className="sep" />
              <p className="small muted" style={{ margin: 0 }}>
                Fields marked for commercial release — price, MOQ, payment terms, freight,
                exclusivity — are deliberately not stored here. AI cannot quote what it cannot see.
              </p>
            </div>
          </div>

          <div className="aiblock">
            <div className="h">
              <span className="prov prov-a">
                <i />
                AI analysis
              </span>
              Market fit for {selected.name.toLowerCase()}
            </div>
            <p className="muted">
              Market-fit analysis lands with the research phase. No AI text is shown until a real
              run exists — AI output is never presented as fact.
            </p>
            <div className="foot">
              <span>Available after research (Phase 5)</span>
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <ProductModal
          mode={modal.mode}
          product={modal.product}
          onClose={() => setModal(null)}
        />
      ) : null}
    </div>
  )
}
