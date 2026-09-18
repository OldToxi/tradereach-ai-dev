/**
 * lib/ai/client.ts — the only place the Anthropic API is called.
 *
 * Every call: structured JSON out, zod-validated, one retry on a parse failure,
 * and an ai_run row written before the result is returned. If it did not write an
 * ai_run row, it did not happen — that row is what the audit trail and the cost
 * cap read.
 *
 * Do not call the SDK anywhere else. Four prompts exist (research, draft,
 * followup, triage) and they all go through runPrompt().
 */
import Anthropic from '@anthropic-ai/sdk'
import type { z } from 'zod'
import { admin } from '../supabase/admin'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export type ModelTier = 'drafting' | 'classify'

const MODEL: Record<ModelTier, string> = {
  drafting: process.env.AI_MODEL_DRAFTING ?? 'claude-sonnet-4-6',
  classify: process.env.AI_MODEL_CLASSIFY ?? 'claude-haiku-4-5-20251001',
}

// Published per-million-token rates. Only used for the spend display and cap —
// billing is whatever the console says. Update if the rates change.
const RATES: Record<string, { in: number; out: number }> = {
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
}

export class AIError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'AIError'
  }
}

export interface PromptSpec<T> {
  /** research | draft | followup | triage */
  name: string
  /** Bump when the text below changes. Stored on every run, so a past output can be explained. */
  version: string
  tier: ModelTier
  system: string
  schema: z.ZodType<T>
  maxTokens?: number
  temperature?: number
}

export interface RunOptions {
  companyId?: string | null
  /** Blocks the call if the month's spend is already over the cap. */
  enforceCap?: boolean
}

export interface RunResult<T> {
  data: T
  aiRunId: string
  costUsd: number
}

function estimateCost(model: string, inTok: number, outTok: number) {
  const r = RATES[model] ?? { in: 3, out: 15 }
  return (inTok * r.in + outTok * r.out) / 1_000_000
}

/** Models sometimes wrap JSON in prose or fences despite instructions. Be forgiving. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first >= 0 && last > first) return text.slice(first, last + 1)
  return text.trim()
}

async function monthSpend(): Promise<number> {
  const since = new Date()
  since.setDate(1)
  since.setHours(0, 0, 0, 0)
  const { data } = await admin
    .from('ai_run')
    .select('cost_usd')
    .gte('created_at', since.toISOString())
  return (data ?? []).reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0)
}

export async function runPrompt<T>(
  spec: PromptSpec<T>,
  userContent: string,
  opts: RunOptions = {},
): Promise<RunResult<T>> {
  const model = MODEL[spec.tier]

  if (opts.enforceCap !== false) {
    const cap = Number(process.env.AI_MONTHLY_CAP_USD ?? 120)
    const spent = await monthSpend()
    if (spent >= cap) {
      throw new AIError(
        `Monthly AI spend cap reached (${spent.toFixed(2)} of ${cap} USD). Raise it in Settings or wait for the next month.`,
      )
    }
  }

  let lastError: unknown
  let inTok = 0
  let outTok = 0

  // Two attempts. The second adds the parse error to the prompt, which fixes
  // nearly every malformed-JSON case. A third attempt has never been worth it.
  for (let attempt = 0; attempt < 2; attempt++) {
    const content =
      attempt === 0
        ? userContent
        : `${userContent}\n\nYour previous reply could not be parsed: ${String(lastError)}\nReturn valid JSON matching the schema, and nothing else.`

    try {
      const res = await client.messages.create({
        model,
        max_tokens: spec.maxTokens ?? 2000,
        temperature: spec.temperature ?? 0.4,
        system: spec.system,
        messages: [{ role: 'user', content }],
      })

      inTok = res.usage.input_tokens
      outTok = res.usage.output_tokens

      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')

      const parsed = spec.schema.parse(JSON.parse(extractJson(text)))
      const costUsd = estimateCost(model, inTok, outTok)

      const { data: run, error } = await admin
        .from('ai_run')
        .insert({
          company_id: opts.companyId ?? null,
          prompt_name: spec.name,
          prompt_version: spec.version,
          model,
          input_tokens: inTok,
          output_tokens: outTok,
          cost_usd: costUsd,
        })
        .select('id')
        .single()

      if (error) throw new AIError('AI succeeded but the run could not be recorded', error)

      return { data: parsed, aiRunId: run.id, costUsd }
    } catch (err) {
      lastError = err
    }
  }

  // Record the failure too — a silent failed run is invisible in the audit trail.
  await admin.from('ai_run').insert({
    company_id: opts.companyId ?? null,
    prompt_name: spec.name,
    prompt_version: `${spec.version}+failed`,
    model,
    input_tokens: inTok,
    output_tokens: outTok,
    cost_usd: estimateCost(model, inTok, outTok),
  })

  throw new AIError(`${spec.name} failed after 2 attempts`, lastError)
}

/** Raw text call, used only by the guardrail model pass. Still records the run. */
export async function runRaw(system: string, user: string, tier: ModelTier = 'classify') {
  const model = MODEL[tier]
  const res = await client.messages.create({
    model,
    max_tokens: 800,
    temperature: 0,
    system,
    messages: [{ role: 'user', content: user }],
  })
  await admin.from('ai_run').insert({
    prompt_name: 'guardrail',
    prompt_version: 'v1',
    model,
    input_tokens: res.usage.input_tokens,
    output_tokens: res.usage.output_tokens,
    cost_usd: estimateCost(model, res.usage.input_tokens, res.usage.output_tokens),
  })
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}
