'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveProduct } from '@/lib/product-actions'

export interface ProductView {
  id: string
  name: string
  hs_code: string | null
  certifications: string[] | null
  monthly_capacity: string | null
  lead_time: string | null
  capability_sheet: string | null
  targetMarkets: string[]
  activeLeads: number
}

export function ProductModal({
  mode,
  product,
  onClose,
}: {
  mode: 'add' | 'edit'
  product?: ProductView
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
    const res = await saveProduct(new FormData(e.currentTarget))
    setPending(false)
    if (res.ok) {
      router.refresh()
      onClose()
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
      <div className="sheet" role="dialog" aria-modal="true" aria-label={mode === 'add' ? 'Add a product' : 'Edit product'}>
        <header>
          <h3>{mode === 'add' ? 'Add a product' : 'Edit product'}</h3>
          <div className="grow" />
          <button className="btn btn-sm" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="body">
            {product ? <input type="hidden" name="id" value={product.id} /> : null}
            <div className="frow">
              <div>
                <label className="f" htmlFor="prod-name">
                  Product name
                </label>
                <input
                  className="f"
                  id="prod-name"
                  name="name"
                  ref={nameRef}
                  placeholder="Woven jute bags"
                  defaultValue={product?.name}
                  required
                />
              </div>
              <div>
                <label className="f" htmlFor="prod-hs">
                  HS code
                </label>
                <input
                  className="f"
                  id="prod-hs"
                  name="hs_code"
                  placeholder="6305.10"
                  defaultValue={product?.hs_code ?? ''}
                />
              </div>
            </div>
            <label className="f" htmlFor="prod-certs">
              Certifications
            </label>
            <input
              className="f"
              id="prod-certs"
              name="certifications"
              placeholder="OEKO-TEX, ISO 9001"
              defaultValue={product?.certifications?.join(', ') ?? ''}
            />
            <div className="frow">
              <div>
                <label className="f" htmlFor="prod-cap">
                  Monthly capacity
                </label>
                <input
                  className="f"
                  id="prod-cap"
                  name="monthly_capacity"
                  placeholder="920 MT"
                  defaultValue={product?.monthly_capacity ?? ''}
                />
              </div>
              <div>
                <label className="f" htmlFor="prod-lead">
                  Lead time
                </label>
                <input
                  className="f"
                  id="prod-lead"
                  name="lead_time"
                  placeholder="28–35 days ex-Chittagong"
                  defaultValue={product?.lead_time ?? ''}
                />
              </div>
            </div>
            <label className="f" htmlFor="prod-sheet">
              What AI may say about this product
            </label>
            <textarea
              className="f"
              id="prod-sheet"
              name="capability_sheet"
              placeholder="Only facts entered here can appear in a draft. Leave price, MOQ and terms out."
              defaultValue={product?.capability_sheet ?? ''}
            />
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
              {pending ? 'Saving…' : mode === 'add' ? 'Save product' : 'Save changes'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
