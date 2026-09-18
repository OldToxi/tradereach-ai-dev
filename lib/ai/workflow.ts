/**
 * lib/ai/workflow.ts — the ten-step AI workflow shown in Settings → AI workflow
 * (T11.4).
 *
 * The mock's ten steps are six capabilities of the single research call, the draft
 * call, the follow-up call, and the two capabilities of the triage call. This
 * module lays the ten steps over the four real prompt specs, so the table reads the
 * *actual* version, model, token budget and temperature — never a hardcoded copy
 * that could drift from lib/ai/prompts.
 *
 * No Supabase, no React, no SDK. Imported server-side by the settings page.
 */
import { researchPrompt } from './prompts/research'
import { draftPrompt } from './prompts/draft'
import { followupPrompt } from './prompts/followup'
import { triagePrompt } from './prompts/triage'
import { MODEL, type ModelTier } from './models'

export interface WorkflowStep {
  step: string
  does: string
  inputs: string
  treatedAs: string
  checkedBy: string
  /** The prompt that performs this step — links to a real lib/ai/prompts spec. */
  promptName: string
  version: string
  tier: ModelTier
  model: string
  maxTokens: number
  temperature: number
}

const SPECS = {
  research: researchPrompt,
  draft: draftPrompt,
  followup: followupPrompt,
  triage: triagePrompt,
} as const

interface StepDraft {
  step: string
  does: string
  inputs: string
  treatedAs: string
  checkedBy: string
  prompt: keyof typeof SPECS
}

const STEPS: StepDraft[] = [
  {
    step: 'Research summary',
    does: 'Reads site, registry and trade sources; writes a neutral profile',
    inputs: 'Crawled pages, registry record',
    treatedAs: 'AI',
    checkedBy: 'Owner accepts per field',
    prompt: 'research',
  },
  {
    step: 'Gap detection',
    does: 'Names the facts missing for qualification',
    inputs: 'Company record + criteria',
    treatedAs: 'AI',
    checkedBy: 'Becomes a task',
    prompt: 'research',
  },
  {
    step: 'Suitability call',
    does: 'Recommends proceed, research more, nurture or disqualify',
    inputs: 'Verified fields only',
    treatedAs: 'AI',
    checkedBy: 'Export Manager',
    prompt: 'research',
  },
  {
    step: 'Prioritisation',
    does: 'Ranks qualified companies for the week',
    inputs: 'Scores, market priority, season',
    treatedAs: 'AI',
    checkedBy: 'Manager may override with a reason',
    prompt: 'research',
  },
  {
    step: 'Decision-maker pick',
    does: 'Chooses the right person and a fallback',
    inputs: 'Contacts, roles, org signals',
    treatedAs: 'AI',
    checkedBy: 'Owner selects primary',
    prompt: 'research',
  },
  {
    step: 'Opportunity summary',
    does: 'Three lines on why this buyer, for this product',
    inputs: 'Verified fields, thread',
    treatedAs: 'AI',
    checkedBy: 'Shown in review',
    prompt: 'research',
  },
  {
    step: 'Outreach draft',
    does: 'Writes a personalised first message',
    inputs: 'Verified facts + product sheet',
    treatedAs: 'AI',
    checkedBy: 'Approver',
    prompt: 'draft',
  },
  {
    step: 'Follow-up draft',
    does: 'Writes touch 2 and 3 without repeating touch 1',
    inputs: 'Thread history',
    treatedAs: 'AI',
    checkedBy: 'Approver',
    prompt: 'followup',
  },
  {
    step: 'Reply classification',
    does: 'Sorts incoming mail into eight categories',
    inputs: 'Reply text',
    treatedAs: 'AI',
    checkedBy: 'Correctable in one click',
    prompt: 'triage',
  },
  {
    step: 'Next-action call',
    does: 'Proposes the next move and who must do it',
    inputs: 'Classification + stage',
    treatedAs: 'AI',
    checkedBy: 'Owner decides',
    prompt: 'triage',
  },
]

export const WORKFLOW_STEPS: WorkflowStep[] = STEPS.map((s) => {
  const spec = SPECS[s.prompt]
  return {
    step: s.step,
    does: s.does,
    inputs: s.inputs,
    treatedAs: s.treatedAs,
    checkedBy: s.checkedBy,
    promptName: spec.name,
    version: spec.version,
    tier: spec.tier,
    model: MODEL[spec.tier],
    maxTokens: spec.maxTokens ?? 2000,
    temperature: spec.temperature ?? 0.4,
  }
})
