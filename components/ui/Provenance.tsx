export type Provenance = 'verified' | 'unverified' | 'ai' | 'human_approved'

const LABELS: Record<Provenance, string> = {
  verified: 'Verified',
  unverified: 'Unverified',
  ai: 'AI',
  human_approved: 'Human approved',
}

const CLASSES: Record<Provenance, string> = {
  verified: 'prov-v',
  unverified: 'prov-u',
  ai: 'prov-a',
  human_approved: 'prov-h',
}

export function Provenance({
  value,
  title,
}: {
  value: Provenance
  title?: string
}) {
  return (
    <span className={`prov ${CLASSES[value]}`} title={title ?? LABELS[value]}>
      <i />
      {LABELS[value]}
    </span>
  )
}
