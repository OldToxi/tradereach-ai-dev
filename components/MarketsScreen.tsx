'use client'

import { useState } from 'react'
import {
  marketNoteLabel,
  marketGuardrails,
  MARKET_PRIORITY_LABELS,
  MARKET_PRIORITY_CLASS,
  MARKET_STATUS_LABELS,
  MARKET_STATUS_CLASS,
} from '@/lib/catalog'
import { MarketModal, type MarketView } from './MarketModal'

const PROV_CLASS = {
  verified: 'prov-v',
  unverified: 'prov-u',
  ai: 'prov-a',
  human_approved: 'prov-h',
} as const

const PROV_LABEL = {
  verified: 'Verified',
  unverified: 'Unverified',
  ai: 'AI',
  human_approved: 'Human approved',
} as const

export function MarketsScreen({
  markets,
  canEdit,
  productNames,
}: {
  markets: MarketView[]
  canEdit: boolean
  productNames: string[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(markets[0]?.id ?? null)
  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; market?: MarketView } | null>(null)

  const selected = markets.find((m) => m.id === selectedId) ?? markets[0] ?? null

  return (
    <div>
      <div className="pagehead">
        <div className="grow">
          <h1>Target markets</h1>
          <p>
            Countries under active development, with the trade evidence behind each choice and
            the rules that shape how we write to buyers there.
          </p>
        </div>
        {canEdit ? (
          <button className="btn btn-pri" onClick={() => setModal({ mode: 'add' })}>
            Add market
          </button>
        ) : null}
      </div>

      <div className="card">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Market</th>
                <th>Product focus</th>
                <th>Import demand</th>
                <th>Tariff / access</th>
                <th>Priority</th>
                <th>Companies</th>
                <th>Status</th>
                {canEdit ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {markets.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="muted" style={{ padding: 18 }}>
                    No markets yet.{' '}
                    {canEdit ? 'Add your first target market to start.' : 'Ask a manager to add the catalog.'}
                  </td>
                </tr>
              ) : (
                markets.map((m) => (
                  <tr
                    key={m.id}
                    className={`click ${m.id === selected?.id ? 'tr-sel' : ''}`}
                    onClick={() => setSelectedId(m.id)}
                  >
                    <td>
                      <b>{m.country}</b>
                    </td>
                    <td className="small">{m.product_focus ?? '—'}</td>
                    <td className="num">{m.import_demand ?? '—'}</td>
                    <td className="small">{m.tariff_note ?? '—'}</td>
                    <td>
                      <span className={`tag ${MARKET_PRIORITY_CLASS[m.priority] ?? ''}`}>
                        {MARKET_PRIORITY_LABELS[m.priority] ?? m.priority}
                      </span>
                    </td>
                    <td className="num">{m.companyCount}</td>
                    <td>
                      <span className={`tag ${MARKET_STATUS_CLASS[m.status] ?? ''}`}>
                        {MARKET_STATUS_LABELS[m.status] ?? m.status}
                      </span>
                    </td>
                    {canEdit ? (
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setModal({ mode: 'edit', market: m })
                          }}
                        >
                          Edit
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
              <h3>{selected.country} — market note</h3>
              <div className="grow" />
              {selected.notes.some((n) => n.provenance === 'ai') ? (
                <span className="prov prov-a">
                  <i />
                  Partly AI
                </span>
              ) : null}
            </header>
            <div className="body">
              <dl className="kv">
                {selected.notes.map((n) => (
                  <div key={n.id} className="kv-row">
                    <dt>{marketNoteLabel(n.key)}</dt>
                    <dd className={n.key === 'import_volume' ? 'num' : undefined}>
                      {n.value}
                      {n.source_label || n.provenance !== 'human_approved' ? (
                        <span className={`prov ${PROV_CLASS[n.provenance]}`} style={{ marginLeft: 6 }}>
                          <i />
                          {n.source_label ?? PROV_LABEL[n.provenance]}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ))}
                {selected.notes.length === 0 ? (
                  <dd className="muted">No notes entered for this market yet.</dd>
                ) : null}
              </dl>
            </div>
          </div>

          <div className="card">
            <header>
              <h3>Outreach guardrails for this market</h3>
            </header>
            <div className="body grid" style={{ gap: 9 }}>
              {(() => {
                const g = marketGuardrails(selected)
                return (
                  <>
                    <div className="small">
                      <b>Send window</b>
                      <div className="muted">{g.send_window}</div>
                    </div>
                    <div className="small">
                      <b>Volume cap</b>
                      <div className="muted">
                        Maximum {g.weekly_outreach_cap} first-touch emails per week, per market.
                        Quality over volume is enforced, not advised.
                      </div>
                    </div>
                    <div className="small">
                      <b>Required before sending</b>
                      <div className="muted">{g.required_before_sending}</div>
                    </div>
                    <div className="small">
                      <b>Legal note</b>
                      <div className="muted">{g.legal_note}</div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <MarketModal
          mode={modal.mode}
          market={modal.market}
          productNames={productNames}
          onClose={() => setModal(null)}
        />
      ) : null}
    </div>
  )
}
