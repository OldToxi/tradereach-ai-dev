'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveWeights } from '@/lib/scoring-actions'
import { SCORING_CRITERIA, MAX_WEIGHT, type WeightMap } from '@/lib/scoring'

export function ScoringPane({ weights }: { weights: WeightMap }) {
  const router = useRouter()
  const [values, setValues] = useState<WeightMap>(weights)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const total = SCORING_CRITERIA.reduce((sum, c) => sum + values[c.key], 0)
  const balanced = total === 100

  function setWeight(key: keyof WeightMap, value: number) {
    setSaved(null)
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit() {
    setPending(true)
    setError(null)
    setSaved(null)
    const fd = new FormData()
    for (const c of SCORING_CRITERIA) fd.set(`weight_${c.key}`, String(values[c.key]))
    const res = await saveWeights(fd)
    setPending(false)
    if (res.ok) {
      setSaved(`Weights saved. ${res.recalculated ?? 0} score${res.recalculated === 1 ? '' : 's'} recalculated.`)
      router.refresh()
    } else {
      setError(res.error ?? 'Could not save weights.')
    }
  }

  return (
    <div className="split">
      <div className="card">
        <header>
          <h3>Fit scoring weights</h3>
          <div className="grow" />
          <span className={`tiny ${balanced ? 'muted' : 'alert'}`} style={{ marginRight: 10 }}>
            {balanced ? 'Totals 100' : `Totals ${total} — must equal 100`}
          </span>
          <button className="btn sm" onClick={onSubmit} disabled={pending || !balanced}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </header>
        <div className="body grid" style={{ gap: 13 }}>
          {SCORING_CRITERIA.map((c) => (
            <div key={c.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }} className="small">
                <span>{c.label}</span>
                <b className="num">{values[c.key]}%</b>
              </div>
              <input
                type="range"
                min={0}
                max={MAX_WEIGHT}
                value={values[c.key]}
                style={{ width: '100%' }}
                aria-label={c.label}
                onChange={(e) => setWeight(c.key, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
        <div className="body" style={{ borderTop: '1px solid var(--line-2)' }}>
          {saved ? (
            <p className="tiny" style={{ margin: 0, color: 'var(--ok)' }} role="status">
              {saved}
            </p>
          ) : null}
          {error ? (
            <p className="fm-err" role="alert" style={{ margin: '8px 0 0' }}>
              {error}
            </p>
          ) : null}
          <p className="tiny muted" style={{ margin: '8px 0 0' }}>
            Changing weights recalculates every qualified company and records the change.
            Historical scores are kept so a past decision can still be explained.
          </p>
        </div>
      </div>

      <div className="card">
        <header>
          <h3>Thresholds</h3>
        </header>
        <div className="body grid" style={{ gap: 11 }}>
          <div className="small">
            <b>80+</b> <span className="muted">Recommend for outreach</span>
          </div>
          <div className="small">
            <b>60–79</b> <span className="muted">Recommend with a named gap to close first</span>
          </div>
          <div className="small">
            <b>40–59</b> <span className="muted">Nurture — revisit next quarter</span>
          </div>
          <div className="small">
            <b>Below 40</b> <span className="muted">Recommend disqualification with a stated reason</span>
          </div>
          <hr className="sep" style={{ margin: '2px 0' }} />
          <p className="tiny muted" style={{ margin: 0 }}>
            Thresholds trigger a recommendation only. No company advances, and none is
            discarded, without a person acting.
          </p>
        </div>
      </div>
    </div>
  )
}
