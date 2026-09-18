'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveSpendConfig } from '@/lib/ai-config-actions'
import type { WorkflowStep } from '@/lib/ai/workflow'

export function AiWorkflowPane({
  steps,
  spendCap,
  alertThreshold,
}: {
  steps: WorkflowStep[]
  spendCap: number
  alertThreshold: number
}) {
  const drafting = steps.find((s) => s.promptName === 'draft') ?? steps[0]
  const classify = steps.find((s) => s.promptName === 'triage') ?? steps[0]

  return (
    <div>
      <div className="card" style={{ marginBottom: 14 }}>
        <header>
          <h3>How AI is used, step by step</h3>
          <div className="grow" />
          <span className="tiny muted">Each step names its model, its inputs and who checks the output</span>
        </header>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Step</th>
                <th>What it does</th>
                <th>Inputs</th>
                <th>Output treated as</th>
                <th>Checked by</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s) => (
                <tr key={s.step}>
                  <td>
                    <b>{s.step}</b>
                    <div className="tiny muted">
                      {s.promptName} · {s.version} · {s.model}
                    </div>
                  </td>
                  <td>{s.does}</td>
                  <td className="small muted">{s.inputs}</td>
                  <td>
                    <span className="prov prov-a">
                      <i />
                      {s.treatedAs}
                    </span>
                  </td>
                  <td className="small">{s.checkedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="split">
        <ModelSettings
          draftingModel={drafting.model}
          classifyModel={classify.model}
          draftingTemperature={drafting.temperature}
          spendCap={spendCap}
          alertThreshold={alertThreshold}
        />
        <div className="card">
          <header>
            <h3>Refusals and limits</h3>
          </header>
          <div className="body grid" style={{ gap: 10 }}>
            <Limit title="AI may not fill a verified field." body="It can propose a value; a person promotes it." />
            <Limit title="AI may not send." body="The send path requires an approval record that only a human can create." />
            <Limit title="AI may not quote commercial terms." body="Reserved terms are stripped from the prompt context entirely." />
            <Limit title="Low confidence surfaces." body="Below 0.6, the output is labelled uncertain and routed to a person." />
            <Limit title="Nothing is invented." body="A claim without a source is dropped from the draft and listed as a gap." />
          </div>
        </div>
      </div>
    </div>
  )
}

function Limit({ title, body }: { title: string; body: string }) {
  return (
    <div className="small">
      <b>{title}</b>
      <div className="muted">{body}</div>
    </div>
  )
}

function ModelSettings({
  draftingModel,
  classifyModel,
  draftingTemperature,
  spendCap,
  alertThreshold,
}: {
  draftingModel: string
  classifyModel: string
  draftingTemperature: number
  spendCap: number
  alertThreshold: number
}) {
  const router = useRouter()
  const [cap, setCap] = useState(String(spendCap))
  const [alert, setAlert] = useState(String(alertThreshold))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function onSubmit() {
    setPending(true)
    setError(null)
    setSaved(null)
    const fd = new FormData()
    fd.set('ai_monthly_cap_usd', cap)
    fd.set('ai_alert_threshold_pct', alert)
    const res = await saveSpendConfig(fd)
    setPending(false)
    if (res.ok) {
      setSaved('Spend cap saved. Enforced on the next AI run.')
      router.refresh()
    } else {
      setError(res.error ?? 'Could not save the spend cap.')
    }
  }

  return (
    <div className="card">
      <header>
        <h3>Model settings</h3>
      </header>
      <div className="body">
        <div className="small" style={{ marginBottom: 10 }}>
          <div className="muted">Drafting model</div>
          <b>{draftingModel}</b>
        </div>
        <div className="small" style={{ marginBottom: 10 }}>
          <div className="muted">Classification model</div>
          <b>{classifyModel}</b>
        </div>
        <div className="small" style={{ marginBottom: 14 }}>
          <div className="muted">Temperature (drafting)</div>
          <b>{draftingTemperature.toFixed(1)}</b>
        </div>

        <hr className="sep" />

        <label className="f" htmlFor="cap">
          Monthly AI spend cap (USD)
        </label>
        <input
          id="cap"
          className="f"
          inputMode="numeric"
          value={cap}
          onChange={(e) => setCap(e.target.value)}
        />
        <label className="f" htmlFor="alert">
          Alert at (% of cap)
        </label>
        <input
          id="alert"
          className="f"
          inputMode="numeric"
          value={alert}
          onChange={(e) => setAlert(e.target.value)}
        />
        <button className="btn" style={{ marginTop: 10 }} onClick={onSubmit} disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>

        {saved ? (
          <p className="tiny" style={{ margin: '10px 0 0', color: 'var(--ok)' }} role="status">
            {saved}
          </p>
        ) : null}
        {error ? (
          <p className="fm-err" role="alert" style={{ margin: '10px 0 0' }}>
            {error}
          </p>
        ) : null}

        <p className="tiny muted" style={{ margin: '12px 0 0' }}>
          Model names and keys are read from server environment variables. They are never
          sent to the browser, never written to the repository, and rotate on a 90-day
          reminder.
        </p>
      </div>
    </div>
  )
}
