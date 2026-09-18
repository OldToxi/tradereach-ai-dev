'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addReservedMatter, removeReservedMatter, saveRefusalTemplate } from '@/lib/guardrails-actions'
import { refusalFromTemplate } from '@/lib/guardrails'

export interface ReservedMatterView {
  key: string
  label: string
  isBuiltin: boolean
}

export function GuardrailsPane({
  matters,
  refusalTemplate,
}: {
  matters: ReservedMatterView[]
  refusalTemplate: string
}) {
  const router = useRouter()
  const [label, setLabel] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function onAdd() {
    setPending(true)
    setError(null)
    setSaved(null)
    const fd = new FormData()
    fd.set('label', label)
    const res = await addReservedMatter(fd)
    setPending(false)
    if (res.ok) {
      setLabel('')
      router.refresh()
    } else {
      setError(res.error ?? 'Could not add the matter.')
    }
  }

  async function onRemove(key: string) {
    setPending(true)
    setError(null)
    setSaved(null)
    const fd = new FormData()
    fd.set('key', key)
    const res = await removeReservedMatter(fd)
    setPending(false)
    if (res.ok) {
      router.refresh()
    } else {
      setError(res.error ?? 'Could not remove the matter.')
    }
  }

  return (
    <div className="split">
      <div className="card">
        <header>
          <h3>Reserved commercial matters</h3>
          <div className="grow" />
          <span className="tag tag-alert">Blocks outreach</span>
        </header>
        <div className="body">
          <p className="small">
            A draft containing any of these is held until a Commercial Authority
            releases it. Detection runs on meaning, not keywords, so “what would a
            container land at” is caught as pricing.
          </p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {matters.map((m) =>
              m.isBuiltin ? (
                <span key={m.key} className="tag tag-alert" title="Always blocked">
                  {m.label}
                </span>
              ) : (
                <span key={m.key} className="tag tag-alert">
                  {m.label}
                  <button
                    className="link"
                    style={{ marginLeft: 5, padding: 0 }}
                    aria-label={`Remove ${m.label}`}
                    onClick={() => onRemove(m.key)}
                    disabled={pending}
                  >
                    ×
                  </button>
                </span>
              ),
            )}
          </div>

          <hr className="sep" />

          <label className="f" htmlFor="new-matter">
            Add a reserved matter
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="new-matter"
              className="f"
              placeholder="e.g. packaging redesign"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onAdd()
                }
              }}
            />
            <button className="btn" onClick={onAdd} disabled={pending || !label.trim()}>
              Add
            </button>
          </div>

          {error ? (
            <p className="fm-err" role="alert" style={{ margin: '10px 0 0' }}>
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="card">
        <header>
          <h3>Standard refusal language</h3>
        </header>
        <div className="body">
          <p className="small muted">
            Used whenever a buyer asks for something reserved, so the answer is
            consistent and nobody improvises.
          </p>
          <RefusalPreview template={refusalTemplate} />
          <RefusalEditor template={refusalTemplate} />
        </div>
      </div>
    </div>
  )
}

function RefusalPreview({ template }: { template: string }) {
  const body = refusalFromTemplate(template, {
    authority: 'Mahbub Rahman',
    market: 'Türkiye',
  })
  return (
    <div className="mail">
      <div className="bd" style={{ fontSize: 13 }}>
        {body}
      </div>
    </div>
  )
}

function RefusalEditor({ template }: { template: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(template)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSave() {
    setPending(true)
    setError(null)
    const fd = new FormData()
    fd.set('template', value)
    const res = await saveRefusalTemplate(fd)
    setPending(false)
    if (res.ok) {
      setEditing(false)
      router.refresh()
    } else {
      setError(res.error ?? 'Could not save the template.')
    }
  }

  if (!editing) {
    return (
      <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setEditing(true)}>
        Edit template
      </button>
    )
  }

  return (
    <div style={{ marginTop: 10 }}>
      <textarea
        className="f"
        rows={4}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Refusal template"
      />
      <p className="tiny muted" style={{ margin: '8px 0 0' }}>
        Keep the <code>{'{authority}'}</code> and <code>{'{market}'}</code> placeholders. The
        wording must not name a reserved term — a refusal that says “pricing” would be held
        by the same guardrail it is meant to serve.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn sm" onClick={onSave} disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          className="btn sm"
          onClick={() => {
            setValue(template)
            setEditing(false)
            setError(null)
          }}
          disabled={pending}
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p className="fm-err" role="alert" style={{ margin: '10px 0 0' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
