'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  stageLabel,
  fitBarClass,
  companyNextAction,
  dataCell,
  STAGE_OPTIONS,
  type CompanyRow,
} from '@/lib/companies'
import { CompanyModal, type ProductOption, type OwnerOption } from './CompanyModal'

const FIT_OPTIONS = [
  { value: '', label: 'Any fit score' },
  { value: '80', label: '80 and above' },
  { value: '60', label: '60 and above' },
  { value: '0', label: 'Below 60' },
] as const

export function CompaniesScreen({
  companies,
  markets,
  products,
  owners,
  defaultOwnerId,
}: {
  companies: CompanyRow[]
  markets: string[]
  products: ProductOption[]
  owners: OwnerOption[]
  defaultOwnerId?: string
}) {
  const [stage, setStage] = useState('')
  const [market, setMarket] = useState('')
  const [fit, setFit] = useState('')
  const [gapsOnly, setGapsOnly] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const rows = useMemo(() => {
    return companies.filter((c) => {
      const score = c.fit_score ?? 0
      const fitOk = fit === '' || (fit === '0' ? score < 60 : score >= Number(fit))
      return (
        (!stage || c.stage === stage) &&
        (!market || c.market === market) &&
        fitOk &&
        (!gapsOnly || c.gapCount > 0)
      )
    })
  }, [companies, stage, market, fit, gapsOnly])

  return (
    <div>
      <div className="pagehead">
        <div className="grow">
          <h1>Companies</h1>
          <p>
            Every potential buyer, importer and distributor we have looked at — qualified or not,
            and clear about why.
          </p>
        </div>
        <button className="btn btn-pri" onClick={() => setShowAdd(true)}>
          Add company
        </button>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div
          className="body"
          style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center', padding: '11px 13px' }}
        >
          <select className="btn btn-sm" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All stages</option>
            {STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {stageLabel(s)}
              </option>
            ))}
          </select>
          <select className="btn btn-sm" value={market} onChange={(e) => setMarket(e.target.value)}>
            <option value="">All markets</option>
            {markets.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select className="btn btn-sm" value={fit} onChange={(e) => setFit(e.target.value)}>
            {FIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={gapsOnly}
              onChange={(e) => setGapsOnly(e.target.checked)}
            />{' '}
            Only companies with missing data
          </label>
          <div className="grow" style={{ flex: 1 }} />
          <span className="tiny muted">
            {rows.length} of {companies.length} companies shown
          </span>
        </div>
      </div>

      <div className="card">
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Market</th>
                <th>Type</th>
                <th>AI fit score</th>
                <th>Data</th>
                <th>Stage</th>
                <th>Decision-maker</th>
                <th>Owner</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted" style={{ padding: 18 }}>
                    No companies match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((c) => {
                  const data = dataCell(c)
                  const dm =
                    c.decisionMaker ??
                    (c.stage === 'disqualified' || c.stage === 'no_contact' || c.stage === 'closed'
                      ? '—'
                      : '— not yet found')
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/companies/${c.id}`} className="rowlink">
                          <b>{c.name}</b>
                        </Link>
                      </td>
                      <td>{c.market}</td>
                      <td>{c.company_type ?? '—'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="score">{c.fit_score ?? '—'}</span>
                          <div className={`bar ${fitBarClass(c.fit_score)}`}>
                            <span style={{ width: `${Math.round(((c.fit_score ?? 0) / 100) * 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={data.className}>{data.text}</span>
                      </td>
                      <td>{stageLabel(c.stage)}</td>
                      <td className={c.decisionMaker ? undefined : 'muted'}>{dm}</td>
                      <td>{c.ownerName ?? '—'}</td>
                      <td className="small muted">{companyNextAction(c)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="tiny muted" style={{ marginTop: 10 }}>
        Fit score is an AI recommendation, never an approval. A company only moves forward when a
        person accepts it.
      </p>

      {showAdd ? (
        <CompanyModal
          markets={markets}
          products={products}
          owners={owners}
          defaultOwnerId={defaultOwnerId}
          onClose={() => setShowAdd(false)}
        />
      ) : null}
    </div>
  )
}
