'use client'

import { useEffect, useRef, useState } from 'react'
import { scheduleMeeting } from '@/lib/meeting-actions'
import { MEETING_PURPOSES } from '@/lib/meetings'

export interface MeetingCompanyOption {
  id: string
  name: string
}

export function MeetingModal({
  companies,
  onClose,
  onSaved,
}: {
  companies: MeetingCompanyOption[]
  onClose: () => void
  onSaved: (note: string) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLSelectElement>(null)

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
    const res = await scheduleMeeting(new FormData(e.currentTarget))
    setPending(false)
    if (res.ok) {
      onSaved(res.note ?? 'Meeting scheduled.')
      onClose()
    } else {
      setError(res.error ?? 'Something went wrong.')
    }
  }

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Schedule a meeting">
        <header>
          <h3>Schedule a meeting</h3>
          <div className="grow" />
          <button className="btn btn-sm" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="body">
            <label className="f" htmlFor="mt-company">
              Company
            </label>
            <select className="f" id="mt-company" name="companyId" ref={nameRef} required defaultValue="">
              <option value="" disabled>
                Choose a company
              </option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="frow">
              <div>
                <label className="f" htmlFor="mt-date">
                  Date
                </label>
                <input className="f" id="mt-date" name="date" type="date" required />
              </div>
              <div>
                <label className="f" htmlFor="mt-time">
                  Time (their timezone)
                </label>
                <input className="f" id="mt-time" name="time" type="time" required />
              </div>
            </div>

            <label className="f" htmlFor="mt-purpose">
              Purpose
            </label>
            <select className="f" id="mt-purpose" name="purpose" required defaultValue="">
              <option value="" disabled>
                Choose a purpose
              </option>
              {MEETING_PURPOSES.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>

            <label className="f" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" name="prepareBrief" defaultChecked /> Ask AI to prepare a meeting
              brief from verified facts and the thread
            </label>
            <p className="tiny muted" style={{ marginTop: 10 }}>
              A commercial discussion requires the Commercial Authority to attend. Times are saved
              in the buyer&apos;s timezone (GMT+6).
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
              {pending ? 'Scheduling…' : 'Create invite'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
