'use client'

import { useEffect, useRef, useState } from 'react'
import { addTask } from '@/lib/meeting-actions'
import type { MeetingCompanyOption } from './MeetingModal'

export interface AssigneeOption {
  id: string
  full_name: string
}

export function TaskModal({
  assignees,
  companies,
  onClose,
  onSaved,
}: {
  assignees: AssigneeOption[]
  companies: MeetingCompanyOption[]
  onClose: () => void
  onSaved: (note: string) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
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
    const res = await addTask(new FormData(e.currentTarget))
    setPending(false)
    if (res.ok) {
      onSaved(res.note ?? 'Task created.')
      onClose()
    } else {
      setError(res.error ?? 'Something went wrong.')
    }
  }

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Add a task">
        <header>
          <h3>Add a task</h3>
          <div className="grow" />
          <button className="btn btn-sm" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <div className="body">
            <label className="f" htmlFor="tk-title">
              What needs doing
            </label>
            <input
              className="f"
              id="tk-title"
              name="title"
              ref={titleRef}
              placeholder="Confirm importer licence number"
              required
            />

            <div className="frow">
              <div>
                <label className="f" htmlFor="tk-assignee">
                  Assign to
                </label>
                <select className="f" id="tk-assignee" name="assigneeId" defaultValue="">
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="f" htmlFor="tk-due">
                  Due
                </label>
                <input className="f" id="tk-due" name="dueOn" type="date" />
              </div>
            </div>

            <label className="f" htmlFor="tk-company">
              Related company (optional)
            </label>
            <select className="f" id="tk-company" name="companyId" defaultValue="">
              <option value="">No company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <label className="f" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" name="blocksStage" /> This blocks the company from advancing a
              stage
            </label>
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
              {pending ? 'Saving…' : 'Save task'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
