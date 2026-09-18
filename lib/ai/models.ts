/**
 * lib/ai/models.ts — the model names and published rates.
 *
 * Split out of client.ts so Settings → AI workflow can show the configured model
 * names without importing the Anthropic SDK. client.ts re-imports these, so the
 * single source of truth for "which model runs which tier" stays in one file.
 */
export type ModelTier = 'drafting' | 'classify'

export const MODEL: Record<ModelTier, string> = {
  drafting: process.env.AI_MODEL_DRAFTING ?? 'deepseek-v4-pro',
  classify: process.env.AI_MODEL_CLASSIFY ?? 'deepseek-flash',
}

// Published per-million-token rates. Only used for the spend display and cap —
// billing is whatever the console says. Update if the rates change.
export const RATES: Record<string, { in: number; out: number }> = {
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
  // DeepSeek estimates — confirm against the DeepSeek pricing page.
  'deepseek-v4-pro': { in: 1.5, out: 3 },
  'deepseek-flash': { in: 0.3, out: 1.1 },
}

export function estimateCost(model: string, inTok: number, outTok: number) {
  const r = RATES[model] ?? { in: 3, out: 15 }
  return (inTok * r.in + outTok * r.out) / 1_000_000
}
