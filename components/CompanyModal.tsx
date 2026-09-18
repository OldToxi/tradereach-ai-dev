'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addCompany } from '@/lib/company-actions'

const COMPANY_TYPES = [
  'Importer',
  'Distributor',
  'Converter / manufacturer',
  'Retail buyer',
  'Trading house',
] as const

export interface ProductOption {
  id: string
  name: string
}

export interface OwnerOption {
  id: string
  full_name: string
}

export function CompanyModal({
  markets,
  products,
  owners,
  defaultOwnerId,
  onClose,
}: {
  markets: string[]
  products: ProductOption[]
  owners: OwnerOption[]
  defaultOwnerId?: string
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const res = await addCompany(new FormData(e.currentTarget))
    setPending(false)
    if (res.ok) {
      router.refresh()
      if (res.companyId) router.push(`/companies/${res.companyId}`)
      else onClose()
    } else {
      setError(res.error ?? 'Something went wrong.')
    }
  }

  return (
    <div
      className="modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Add a company">
        <header>
          <h3>Add a company</h3>
          <div className="grow" />
          <button className="btn btn-sm" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="body">
            <div className="frow">
              <div>
                <label className="f" htmlFor="co-name">
                  Company name
                </label>
                <input
                  className="f"
                  id="co-name"
                  name="name"
                  ref={nameRef}
                  placeholder="Yıldız Tekstil A.Ş."
                  required
                />
              </div>
              <div>
                <label className="f" htmlFor="co-website">
                  Website
                </label>
                <input className="f" id="co-website" name="website" placeholder="yildiztekstil.test" />
              </div>
            </div>
            <div className="frow">
              <div>
                <label className="f" htmlFor="co-market">
                  Market
                </label>
                <select className="f" id="co-market" name="market" required defaultValue="">
                  <option value="" disabled>
                    Choose a market
                  </option>
                  {markets.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="f" htmlFor="co-type">
                  Type
                </label>
                <select className="f" id="co-type" name="company_type" defaultValue="Importer">
                  {COMPANY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="frow">
              <div>
                <label className="f" htmlFor="co-product">
                  Product to promote
                </label>
                <select className="f" id="co-product" name="product_id" defaultValue="">
                  <option value="">Not assigned</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="f" htmlFor="co-owner">
                  Owner
                </label>
                <select
                  className="f"
                  id="co-owner"
                  name="owner_id"
                  defaultValue={defaultOwnerId ?? ''}
                >
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="f" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" disabled /> Run AI research as soon as it is saved
            </label>
            <p className="tiny muted" style={{ marginTop: 10 }}>
              Everything entered here is stored as unverified until a source backs it.
            </p>
            {error ? (
              <p className="fm-err" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <footer>
            <button className="btn" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-pri" type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save company'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
