export function Placeholder({
  title,
  phase,
}: {
  title: string
  phase: string
}) {
  return (
    <div>
      <h1>{title}</h1>
      <div className="card" style={{ padding: 18, marginTop: 16 }}>
        <p style={{ color: 'var(--ink-2)', margin: 0 }}>
          This screen is not built yet. It is scheduled for {phase}.
        </p>
      </div>
    </div>
  )
}
