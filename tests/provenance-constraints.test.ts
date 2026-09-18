/**
 * T12.1 — the four product rules (AGENTS.md §4) are enforced by DATABASE CHECK
 * constraints, not app discipline. These tests read the migrations as text and assert
 * the constraints exist and are formulated exactly as the rules require — the same
 * source-of-truth technique tests/audit.test.ts uses for append-only. The pure-logic
 * half of T12.1 (scoring maths, guardrail detection, cadence dates) is already covered
 * by tests/scoring.test.ts, tests/guardrails.test.ts, tests/guardrails-config.test.ts
 * and tests/messages.test.ts; this file is the missing "provenance constraint
 * violations" half.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

function sql(file: string): string {
  // Collapse whitespace and drop whitespace adjacent to parens so a constraint that
  // spans several source lines reads as one clean expression to match against.
  return readFileSync(`supabase/migrations/${file}`, 'utf8')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
}

describe('provenance enum (rule 1) is exactly the four values', () => {
  it('defines verified, unverified, ai, human_approved — no more, no less', () => {
    const src = sql('0001_schema.sql')
    expect(src).toMatch(
      /create type provenance as enum \('verified','unverified','ai','human_approved'\);/,
    )
  })
})

describe('rule 1 — verified needs evidence', () => {
  const src = sql('0001_schema.sql')

  it('fact: a verified fact must carry a source or a named person', () => {
    expect(src).toMatch(
      /constraint verified_needs_evidence check \(provenance <> 'verified' or \(source_id is not null or confirmed_by is not null\)\)/,
    )
  })

  it('contact: a verified address must record where it came from', () => {
    expect(src).toMatch(
      /constraint verified_contact_needs_source check \(provenance <> 'verified' or email_source is not null\)/,
    )
  })

  it('market note: a verified note needs a cited source or a named person', () => {
    const notes = sql('0004_market_note.sql')
    expect(notes).toMatch(
      /constraint market_note_verified_needs_evidence check \(provenance <> 'verified' or \(source_label is not null or confirmed_by is not null\)\)/,
    )
  })
})

describe('rule 2 — AI output is never a fact', () => {
  it('an AI fact may never carry a confirmer', () => {
    const src = sql('0001_schema.sql')
    expect(src).toMatch(
      /constraint ai_cannot_be_confirmed check \(provenance <> 'ai' or confirmed_by is null\)/,
    )
  })

  it('the market-note form of the rule exists too', () => {
    const notes = sql('0004_market_note.sql')
    expect(notes).toMatch(
      /constraint market_note_ai_cannot_be_confirmed check \(provenance <> 'ai' or confirmed_by is null\)/,
    )
  })
})

describe('rule 3 — nothing is approved without a named approver and the exact text', () => {
  it('approved/sent requires both approved_by and approved_hash', () => {
    const src = sql('0001_schema.sql')
    expect(src).toMatch(
      /constraint approved_needs_approver check \(status not in \('approved','sent'\) or \(approved_by is not null and approved_hash is not null\)\)/,
    )
  })
})

describe('rule 4 — a held draft cannot be approved until released', () => {
  it('approved requires reserved_matter null or released_by set', () => {
    const src = sql('0001_schema.sql')
    expect(src).toMatch(
      /constraint held_needs_release check \(status <> 'approved' or reserved_matter is null or released_by is not null\)/,
    )
  })
})

describe('rule 5 — Gmail is compose-only', () => {
  it('a token carrying gmail.send scope cannot be stored', () => {
    const src = sql('0001_schema.sql')
    expect(src).toMatch(/constraint compose_only check \(scope not like '%gmail\.send%'\)/)
  })
})
