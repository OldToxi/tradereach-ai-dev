/**
 * lib/guardrails.ts — the commercial control.
 *
 * The brief (§9) reserves pricing, payment, credit, exclusivity, distributor
 * appointment, samples, freight, MOQ, delivery time, warranty and technical
 * compliance to authorised Anwar Group personnel. This module is how that rule
 * reaches an outgoing message.
 *
 * Two layers, deliberately:
 *
 *   1. PREVENTION — reserved facts are never placed in an AI prompt's context.
 *      A model cannot quote a price it has never seen. See lib/ai/context.ts.
 *   2. DETECTION — a draft is still scanned before review, because a model can
 *      volunteer a commitment ("I can send a sample this month") without being
 *      given any data at all. That sentence is the common failure, not a leaked
 *      price.
 *
 * Detection runs in two passes. A cheap deterministic pass catches the obvious
 * cases with no API call and no latency. Anything it clears goes to a model pass
 * for meaning — "what would a container land at" is a price question containing
 * no price word. The cheap pass is authoritative for blocking; the model pass can
 * only add findings, never remove them.
 */

export type ReservedMatter =
  | 'price'
  | 'payment_terms'
  | 'credit'
  | 'moq'
  | 'freight'
  | 'delivery_date'
  | 'samples'
  | 'exclusivity'
  | 'distributor_appointment'
  | 'warranty'
  | 'technical_compliance'
  | 'discount'
  | 'contract_length'

export interface Finding {
  matter: ReservedMatter
  /** The sentence as it appears in the draft, so review can highlight it. */
  sentence: string
  /** Where the sentence starts, for the highlight span. */
  offset: number
  how: 'pattern' | 'model'
}

export interface GuardrailResult {
  /** True when the draft may proceed to normal review. */
  clear: boolean
  findings: Finding[]
  /** Set when blocked — the matter to name in the release request. */
  primaryMatter: ReservedMatter | null
}

export const RESERVED_LABELS: Record<ReservedMatter, string> = {
  price: 'Price',
  payment_terms: 'Payment terms',
  credit: 'Credit',
  moq: 'Minimum order quantity',
  freight: 'Freight',
  delivery_date: 'Delivery date',
  samples: 'Samples',
  exclusivity: 'Exclusivity',
  distributor_appointment: 'Distributor appointment',
  warranty: 'Warranty',
  technical_compliance: 'Technical compliance claims',
  discount: 'Discounts and rebates',
  contract_length: 'Contract length',
}

/** Canonical list of reserved matters — the single source of truth for the code. */
export const RESERVED_MATTERS = Object.keys(RESERVED_LABELS) as ReservedMatter[]

/**
 * Deterministic patterns. Tuned to over-catch: a false hold costs one click from
 * a Commercial Authority, a false clear costs a commitment Anwar Group did not make.
 */
const PATTERNS: Array<[ReservedMatter, RegExp]> = [
  [
    'price',
    /\b(price|pricing|priced|cost|costs|rate per|per tonne|per ton|per mt|per kg|per piece|per unit|quote|quotation|usd|eur|gbp|bdt|\$\s?\d|€\s?\d|£\s?\d|cif|fob|c&f|ex[- ]works|landed)\b/i,
  ],
  [
    'payment_terms',
    /\b(payment terms?|terms of payment|l\/?c\b|letter of credit|t\/?t\b|telegraphic transfer|advance payment|net\s?\d{2}|d\/?p\b|d\/?a\b|open account)\b/i,
  ],
  ['credit', /\b(credit (line|limit|period|facility|terms)|on credit|credit days)\b/i],
  [
    'moq',
    /\b(moq|minimum (order|quantity|volume)|min\.? order|smallest (order|quantity))\b/i,
  ],
  [
    'freight',
    /\b(freight|shipping cost|container rate|ocean freight|logistics cost|haulage|shipping charge)\b/i,
  ],
  [
    'delivery_date',
    /\b(deliver (by|on|within)|delivery (date|time|schedule)|lead time of|ship(ped)? (by|within)|dispatch (by|on)|ready by)\b/i,
  ],
  [
    'samples',
    /\b(sample|samples|sampling|swatch|send you a (piece|cutting)|trial (order|shipment|quantity))\b/i,
  ],
  [
    'exclusivity',
    /\b(exclusiv\w*|sole (agent|supplier|distributor)|territory rights|first refusal)\b/i,
  ],
  [
    'distributor_appointment',
    /\b(appoint\w* (you|your company)|distributor(ship)? agreement|become our (agent|distributor)|represent us)\b/i,
  ],
  ['warranty', /\b(warrant\w+|guarantee\w*|we guarantee|assured quality|replacement policy)\b/i],
  [
    'technical_compliance',
    /\b(compl(y|ies|iant) with|certif(y|ied) (to|that)|conforms? to|meets? (the )?(standard|regulation|directive)|reach\b|eudr\b|ce mark)\b/i,
  ],
  ['discount', /\b(discount|rebate|special (rate|offer)|introductory (price|offer)|off the)\b/i],
  [
    'contract_length',
    /\b(annual contract|contract (period|length|duration|term)|(\d+|one|two|three|four|five)[- ]year (deal|contract|agreement|arrangement)|long[- ]term agreement)\b/i,
  ],
]

/** Split on sentence ends, keeping the offset of each sentence in the original. */
function sentences(text: string): Array<{ text: string; offset: number }> {
  const out: Array<{ text: string; offset: number }> = []
  const re = /[^.!?\n]+[.!?]*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const t = m[0].trim()
    if (t) out.push({ text: t, offset: m.index })
  }
  return out
}

/** Fast, offline, zero-cost. Always runs. Authoritative for blocking. */
export function scanPatterns(body: string): Finding[] {
  const findings: Finding[] = []
  for (const s of sentences(body)) {
    for (const [matter, re] of PATTERNS) {
      if (re.test(s.text)) {
        findings.push({ matter, sentence: s.text, offset: s.offset, how: 'pattern' })
      }
    }
  }
  return findings
}

const MODEL_PASS_PROMPT = `You check outbound B2B export emails for commercial commitments.

Anwar Group reserves these matters to authorised staff. An email from the export desk must
not state, imply, promise or invite negotiation on any of them:

price · payment_terms · credit · moq · freight · delivery_date · samples · exclusivity ·
distributor_appointment · warranty · technical_compliance · discount · contract_length

Judge meaning, not vocabulary. "What would a container land at?" is price. "I can get
something into your lab this month" is samples. "We always ship in four weeks" is
delivery_date. Asking the buyer a question about their own requirements is NOT a commitment:
"what volumes do you work with?" is fine, "we can do 20 MT minimum" is not.

Stating a published capability is fine — capacity, counts offered, certifications we hold,
which port we ship from. Turning one into a promise to this buyer is not.

Return JSON only:
{"findings":[{"matter":"<one of the list>","sentence":"<exact sentence from the email>"}]}
Empty findings array if the email is clear.`

/**
 * Full check. Pattern pass always; model pass only when the patterns are clear,
 * since a blocked draft is already blocked and the call would change nothing.
 *
 * callModel is injected so unit tests run offline — see guardrails.test.ts.
 */
export async function checkDraft(
  body: string,
  callModel?: (system: string, user: string) => Promise<string>,
): Promise<GuardrailResult> {
  const findings = scanPatterns(body)

  if (findings.length === 0 && callModel) {
    try {
      const raw = await callModel(MODEL_PASS_PROMPT, body)
      const parsed = JSON.parse(raw) as { findings?: Array<{ matter: string; sentence: string }> }
      for (const f of parsed.findings ?? []) {
        if (!(f.matter in RESERVED_LABELS)) continue
        const offset = body.indexOf(f.sentence)
        findings.push({
          matter: f.matter as ReservedMatter,
          sentence: f.sentence,
          offset: offset >= 0 ? offset : 0,
          how: 'model',
        })
      }
    } catch {
      // A failed check must never read as a pass. Hold the draft and let a human
      // look at it — the cost is one review, the alternative is an unchecked send.
      return {
        clear: false,
        findings: [
          {
            matter: 'price',
            sentence: 'Automatic check could not complete. Held for manual review.',
            offset: 0,
            how: 'model',
          },
        ],
        primaryMatter: 'price',
      }
    }
  }

  return {
    clear: findings.length === 0,
    findings,
    primaryMatter: findings[0]?.matter ?? null,
  }
}

/** Highlight spans for the review queue — mirrors mark.risk in the mock. */
export function riskSpans(findings: Finding[]): Array<[number, number]> {
  return findings
    .filter((f) => f.offset >= 0)
    .map((f) => [f.offset, f.offset + f.sentence.length] as [number, number])
}

/**
 * Used when a buyer asks for something reserved. Consistent wording means nobody
 * improvises a commitment. Mirrors the template in the mock's guardrail settings.
 */
export function standardRefusal(matter: ReservedMatter, authorityName: string, market: string) {
  return `Thank you for asking. ${RESERVED_LABELS[matter]} for this product is set by our export desk rather than by me, so I have passed your question to ${authorityName}, who looks after commercial terms for ${market}. They will write to you directly this week.`
}
