'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveMarket } from '@/lib/market-actions'

export interface MarketNoteView {
  id: string
  key: string
  value: string
  provenance: 'verified' | 'unverified' | 'ai' | 'human_approved'
  source_label: string | null
}

export interface MarketView {
  id: string
  country: string
  product_focus: string | null
  import_demand: string | null
  tariff_note: string | null
  priority: string
  weekly_outreach_cap: number
  send_window: string | null
  required_before_sending: string | null
  legal_note: string | null
  status: string
  companyCount: number
  notes: MarketNoteView[]
}

export function MarketModal({
  mode,
  market,
  productNames,
  onClose,
}: {
  mode: 'add' | 'edit'
  market?: MarketView
  productNames: string[]
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const countryRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    countryRef.current?.focus()
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
    const res = await saveMarket(new FormData(e.currentTarget))
    setPending(false)
    if (res.ok) {
      router.refresh()
      onClose()
    } else {
      setError(res.error ?? 'Something went wrong.')
    }
  }

  const focus = market?.product_focus ?? ''
  const focusOptions = productNames.includes(focus) || !focus ? productNames : [focus, ...productNames]

  return (
    <div
      className="modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={mode === 'add' ? 'Add a target market' : 'Edit target market'}>
        <header>
          <h3>{mode === 'add' ? 'Add a target market' : 'Edit target market'}</h3>
          <div className="grow" />
          <button className="btn btn-sm" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="body">
            {market ? <input type="hidden" name="id" value={market.id} /> : null}
            <div className="frow">
              <div>
                <label className="f" htmlFor="mkt-country">
                  Country
                </label>
                <input
                  className="f"
                  id="mkt-country"
                  name="country"
                  ref={countryRef}
                  placeholder="Poland"
                  defaultValue={market?.country}
                  required
                />
              </div>
              <div>
                <label className="f" htmlFor="mkt-focus">
                  Product focus
                </label>
                <select className="f" id="mkt-focus" name="product_focus" defaultValue={focus}>
                  <option value="">—</option>
                  {focusOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="frow">
              <div>
                <label className="f" htmlFor="mkt-priority">
                  Priority
                </label>
                <select className="f" id="mkt-priority" name="priority" defaultValue={market?.priority ?? 'medium'}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="watch">Watch</option>
                </select>
              </div>
              <div>
                <label className="f" htmlFor="mkt-cap">
                  Weekly outreach cap
                </label>
                <input
                  className="f"
                  id="mkt-cap"
                  name="weekly_outreach_cap"
                  type="number"
                  min="0"
                  defaultValue={market?.weekly_outreach_cap ?? 12}
                />
              </div>
            </div>
            <div className="frow">
              <div>
                <label className="f" htmlFor="mkt-window">
                  Send window
                </label>
                <input
                  className="f"
                  id="mkt-window"
                  name="send_window"
                  placeholder="08:00–17:00 Europe/Berlin, Mon–Fri"
                  defaultValue={market?.send_window ?? ''}
                />
              </div>
            </div>
            <div>
              <label className="f" htmlFor="mkt-required">
                Required before sending
              </label>
              <textarea
                className="f"
                id="mkt-required"
                name="required_before_sending"
                rows={2}
                placeholder="Named decision-maker · one verified trade source · product fit stated in the first two lines"
                defaultValue={market?.required_before_sending ?? ''}
              />
            </div>
            <div>
              <label className="f" htmlFor="mkt-legal">
                Legal note
              </label>
              <textarea
                className="f"
                id="mkt-legal"
                name="legal_note"
                rows={2}
                placeholder="GDPR applies. Contact must have a lawful-interest basis recorded; unsubscribe honoured permanently."
                defaultValue={market?.legal_note ?? ''}
              />
            </div>
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
              {pending ? 'Saving…' : mode === 'add' ? 'Save market' : 'Save changes'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
