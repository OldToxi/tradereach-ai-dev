/**
 * lib/ai/context.ts — what a model is allowed to see.
 *
 * This file is the prevention half of the commercial control. A model cannot quote
 * a price it was never given, so reserved commercial data is excluded here rather
 * than caught later. Everything a prompt reads is assembled by these functions.
 *
 * Two rules, both tested:
 *   1. Only `verified` and `human_approved` facts reach a drafting prompt. An AI
 *      inference must never become the evidence for the next AI output.
 *   2. Product context comes from the capability sheet only. Reserved fields are
 *      not stored on the product at all, and this is the second line of defence.
 */
import { admin } from '../supabase/admin'
import { RESERVED_MATTERS } from '../guardrails'

/**
 * Substring fragments that mark a key as reserved. Deliberately over-catching
 * (mirrors the guardrail patterns): dropping a benign fact costs a little context,
 * leaking a price costs a commitment Anwar Group did not make.
 *
 * `lead_time`, `capacity`, `certifications` and `capability` are NOT here — they
 * are the allowed product facts, and stripping them would neuter the drafts.
 */
const RESERVED_KEY_FRAGMENTS = [
  'price',
  'pricing',
  'quote',
  'quotation',
  'unit_price',
  'cost',
  'rate',
  'payment',
  'letter_of_credit',
  'advance_payment',
  'credit',
  'moq',
  'minimum_order',
  'min_order',
  'minimum_quantity',
  'freight',
  'delivery',
  'delivery_date',
  'ship_date',
  'sample',
  'sampling',
  'swatch',
  'trial_order',
  'exclusiv',
  'sole_agent',
  'sole_distributor',
  'distributor',
  'appoint',
  'agency_agreement',
  'warranty',
  'guarantee',
  'compliance',
  'certified_to',
  'conforms',
  'reach',
  'eudr',
  'ce_mark',
  'discount',
  'rebate',
  'introductory_price',
  'special_rate',
  'contract',
  'annual_contract',
]

/** Is this fact key (or column name) a reserved commercial matter? */
export function isReservedKey(key: string): boolean {
  const k = key.toLowerCase()
  return RESERVED_KEY_FRAGMENTS.some((r) => k.includes(r))
}

export function stripReserved<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (isReservedKey(k)) continue
    out[k] = v
  }
  return out as Partial<T>
}

export interface CompanyContext {
  name: string
  market: string
  companyType: string | null
  /** Verified and human-approved facts only. */
  facts: Array<{ key: string; value: string; source: string | null }>
  contacts: Array<{ name: string; role: string | null; verified: boolean }>
  sources: Array<{ title: string; type: string | null; supports: string | null }>
  analystNotes: string[]
}

export async function buildCompanyContext(
  companyId: string,
  opts: { includeUnverified?: boolean } = {},
): Promise<CompanyContext> {
  const { data: company, error } = await admin
    .from('company')
    .select('name, market, company_type')
    .eq('id', companyId)
    .single()
  if (error || !company) throw new Error(`Company ${companyId} not found`)

  // Research may look at unverified facts (that is how it spots gaps).
  // Drafting may not — default is verified only.
  const allowed: Array<'verified' | 'human_approved' | 'unverified'> = opts.includeUnverified
    ? ['verified', 'human_approved', 'unverified']
    : ['verified', 'human_approved']

  const { data: facts } = await admin
    .from('fact')
    .select('key, value, provenance, source:source_id(title)')
    .eq('company_id', companyId)
    .in('provenance', allowed)

  const { data: contacts } = await admin
    .from('contact')
    .select('full_name, role_title, provenance')
    .eq('company_id', companyId)

  const { data: sources } = await admin
    .from('source')
    .select('title, source_type, url')
    .eq('company_id', companyId)

  const kept = (facts ?? []).filter((f) => !isReservedKey(f.key))

  return {
    name: company.name,
    market: company.market,
    companyType: company.company_type,
    facts: kept.map((f) => ({
      key: f.key,
      value: f.value,
      source: f.source?.title ?? null,
    })),
    contacts: (contacts ?? []).map((c) => ({
      name: c.full_name,
      role: c.role_title,
      verified: c.provenance === 'verified',
    })),
    sources: (sources ?? []).map((s) => ({
      title: s.title,
      type: s.source_type,
      supports: null,
    })),
    analystNotes: kept.filter((f) => f.key === 'analyst_note').map((f) => f.value),
  }
}

export interface ProductContext {
  name: string
  hsCode: string | null
  certifications: string[]
  monthlyCapacity: string | null
  leadTime: string | null
  capabilitySheet: string | null
}

/**
 * The product allowlist — the only columns a prompt may read about our own
 * product. Kept as a named list so a test can assert it stays free of reserved
 * columns. Anything commercial (price, MOQ, payment, samples, …) is not a
 * product column at all.
 */
export const PRODUCT_CONTEXT_COLUMNS = [
  'name',
  'hs_code',
  'certifications',
  'monthly_capacity',
  'lead_time',
  'capability_sheet',
] as const

export async function buildProductContext(productId: string): Promise<ProductContext> {
  const { data, error } = await admin
    .from('product')
    .select(PRODUCT_CONTEXT_COLUMNS.join(','))
    .eq('id', productId)
    .single()
  if (error || !data) throw new Error(`Product ${productId} not found`)

  // `.select()` was passed a computed string, so the row type is generic here.
  const row = data as unknown as {
    name: string
    hs_code: string | null
    certifications: string[] | null
    monthly_capacity: string | null
    lead_time: string | null
    capability_sheet: string | null
  }

  return {
    name: row.name,
    hsCode: row.hs_code,
    certifications: row.certifications ?? [],
    monthlyCapacity: row.monthly_capacity,
    leadTime: row.lead_time,
    capabilitySheet: row.capability_sheet,
  }
}

/** Compact, readable serialisation. Models handle this better than raw JSON dumps. */
export function renderContext(c: CompanyContext, p?: ProductContext): string {
  const lines = [
    `COMPANY: ${c.name}`,
    `MARKET: ${c.market}`,
    c.companyType ? `TYPE: ${c.companyType}` : null,
    '',
    'VERIFIED FACTS (the only facts you may state as true):',
    ...c.facts.map((f) => `- ${f.key}: ${f.value}${f.source ? ` [source: ${f.source}]` : ''}`),
  ]

  if (c.analystNotes.length) {
    lines.push('', 'ANALYST NOTES (written by a colleague, treat as reliable):')
    lines.push(...c.analystNotes.map((n) => `- ${n}`))
  }

  if (c.contacts.length) {
    lines.push('', 'PEOPLE:')
    lines.push(
      ...c.contacts.map(
        (x) => `- ${x.name}${x.role ? `, ${x.role}` : ''} (${x.verified ? 'verified' : 'unverified'})`,
      ),
    )
  }

  if (p) {
    lines.push(
      '',
      'OUR PRODUCT (the only product information you may state):',
      `- name: ${p.name}`,
      p.hsCode ? `- hs code: ${p.hsCode}` : null,
      p.certifications.length ? `- certifications: ${p.certifications.join(', ')}` : null,
      p.monthlyCapacity ? `- monthly capacity: ${p.monthlyCapacity}` : null,
      p.leadTime ? `- lead time: ${p.leadTime}` : null,
      p.capabilitySheet ? `- capability notes: ${p.capabilitySheet}` : null,
    )
  }

  return lines.filter(Boolean).join('\n')
}
