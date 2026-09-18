/**
 * The guardrail is the single most load-bearing control in this product. These
 * tests run offline and must stay green. If you loosen a pattern, add the case
 * that made you loosen it.
 */
import { describe, it, expect } from 'vitest'
import { scanPatterns, checkDraft, standardRefusal } from '../lib/guardrails'

const CLEAN = `Dear Ms Brauer,

Your team lists hessian liners for the agri-packaging range, and NordFiber imported roughly
2,900 MT of jute goods last year.

Anwar Group spins jute yarn in Chittagong from 4 lb to 20 lb, OEKO-TEX certified, with 920 MT
of monthly capacity held for export. We test every bale against the declared count before it
leaves the mill.

May I ask one question: are you specifying liners by count, or by finished bag weight?

Kind regards,
Rifat Hasan`

describe('pattern pass', () => {
  it('clears an email that states capability without promising anything', () => {
    expect(scanPatterns(CLEAN)).toHaveLength(0)
  })

  const blocked: Array<[string, string]> = [
    ['price', 'Our price is USD 940 per tonne CIF Hamburg.'],
    ['price', 'I can share a quotation for 60 MT.'],
    ['payment_terms', 'We normally work on an irrevocable L/C at sight.'],
    ['credit', 'We could offer a 60 day credit period for a first order.'],
    ['moq', 'Our MOQ is one container.'],
    ['moq', 'The minimum order quantity would be 20 MT.'],
    ['freight', 'Ocean freight to Hamburg is around USD 1,200.'],
    ['delivery_date', 'We can deliver by the end of November.'],
    ['samples', 'I can arrange a sample of the 8 lb count for your lab this month.'],
    ['exclusivity', 'We would consider exclusivity for the Benelux territory.'],
    ['distributor_appointment', 'We would be glad to appoint your company as our distributor.'],
    ['warranty', 'We guarantee the count will not vary by more than two percent.'],
    ['technical_compliance', 'Our yarn complies with the EU Deforestation Regulation.'],
    ['discount', 'There is an introductory price for the first shipment.'],
    ['contract_length', 'We would want a two-year agreement to hold the rate.'],
  ]

  it.each(blocked)('catches %s', (matter, sentence) => {
    const found = scanPatterns(`${CLEAN}\n\n${sentence}`)
    expect(found.map((f) => f.matter)).toContain(matter)
  })

  it('reports the offending sentence so review can highlight it', () => {
    const body = `${CLEAN}\n\nI can arrange a sample for your lab.`
    const [finding] = scanPatterns(body)
    expect(finding.sentence).toContain('sample')
    expect(body.slice(finding.offset, finding.offset + finding.sentence.length)).toBe(
      finding.sentence,
    )
  })

  it('does not flag a question about the buyer’s own requirements', () => {
    const body = 'What volumes do you typically work with, and in which counts?'
    expect(scanPatterns(body)).toHaveLength(0)
  })
})

describe('model pass', () => {
  const model = (findings: unknown) => async () => JSON.stringify(findings)

  it('catches meaning the patterns miss', async () => {
    const body = 'Out of interest, what would a full container land at for you these days?'
    // No price word in that sentence — the model pass is what saves it.
    const result = await checkDraft(
      body,
      model({ findings: [{ matter: 'price', sentence: body }] }),
    )
    expect(result.clear).toBe(false)
    expect(result.primaryMatter).toBe('price')
    expect(result.findings[0].how).toBe('model')
  })

  it('does not run the model pass when the patterns already blocked', async () => {
    let called = false
    await checkDraft('Our price is USD 940 per tonne.', async () => {
      called = true
      return '{"findings":[]}'
    })
    expect(called).toBe(false)
  })

  it('holds the draft when the check itself fails', async () => {
    const result = await checkDraft(CLEAN, async () => {
      throw new Error('API down')
    })
    // A failed check must never read as a pass.
    expect(result.clear).toBe(false)
  })

  it('clears a clean draft when the model agrees', async () => {
    const result = await checkDraft(CLEAN, model({ findings: [] }))
    expect(result.clear).toBe(true)
    expect(result.primaryMatter).toBeNull()
  })
})

describe('standard refusal', () => {
  it('names the authority and the market, and promises nothing', () => {
    const text = standardRefusal('price', 'Mahbub Rahman', 'Türkiye')
    expect(text).toContain('Mahbub Rahman')
    expect(text).toContain('Türkiye')
    expect(scanPatterns(text.replace(/Price/g, 'X'))).toHaveLength(0)
  })
})
