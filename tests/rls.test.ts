/**
 * RLS is the real boundary (T12.2). These read the migration SQL and pin the three
 * rules the plan calls out, the same way `tests/audit.test.ts` pins the append-only
 * audit: if a policy is edited to loosen a rule, the test fails without a database.
 *
 *   1. An executive can read only their assigned markets.
 *   2. An executive can never approve — approval is a manager/commercial act.
 *   3. `gmail_token` has RLS on and zero policies, so the user client cannot touch it.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

function rls(): string {
  return readFileSync('supabase/migrations/0002_rls.sql', 'utf8').replace(/\s+/g, ' ')
}

function allMigrations(): string {
  return readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8'))
    .join('\n')
}

describe('market scoping — executive cannot read another market', () => {
  it('scopes company reads through can_see_market(market), not a blanket signed-in check', () => {
    const src = rls()
    expect(src).toMatch(
      /create policy company_read\s+on company\s+for select\s+using\s+\(can_see_market\(market\)\)/,
    )
    expect(src).not.toMatch(/create policy company_read\s+on company\s+for select\s+using\s+\(auth\.uid\(\) is not null\)/)
  })

  it('defines can_see_market as sees_all_markets() OR membership in jwt_markets()', () => {
    expect(rls()).toMatch(
      /select\s+sees_all_markets\(\)\s+or\s+m\s+=\s+any\s*\(\s*jwt_markets\(\)\s*\)/,
    )
  })

  it('sees_all_markets() excludes executives — manager/commercial/auditor only', () => {
    const src = rls()
    const body = src.match(/create or replace function sees_all_markets\(\)[\s\S]*?\$\$;/)?.[0] ?? ''
    expect(body).toContain("jwt_role() in ('manager','commercial','auditor')")
    expect(body).not.toContain("'executive'")
  })

  it('jwt_markets() reads the assigned markets from the JWT app_metadata', () => {
    expect(rls()).toMatch(/auth\.jwt\(\)\s*->\s*'app_metadata'\s*->\s*'markets'/)
  })
})

describe('approval — executive cannot approve', () => {
  it('can_approve() is manager/commercial only, never executive', () => {
    const src = rls()
    const body = src.match(/create or replace function can_approve\(\)[\s\S]*?\$\$;/)?.[0] ?? ''
    expect(body).toContain("jwt_role() in ('manager','commercial')")
    expect(body).not.toContain("'executive'")
  })

  it('the message_update policy gates status=approved on can_approve()', () => {
    expect(rls()).toMatch(
      /or\s*\(\s*status\s*=\s*'approved'\s*and\s*can_approve\(\)\s*and\s*approved_by\s*=\s*auth\.uid\(\)\s*\)/,
    )
  })

  it('message_insert forbids a pre-approved row from ever being created', () => {
    expect(rls()).toMatch(/status\s+in\s*\('draft','awaiting_approval'\)\s+and\s+approved_by\s+is\s+null/)
  })
})

describe('gmail_token — unreadable by the user client', () => {
  it('enables RLS on gmail_token', () => {
    expect(rls()).toMatch(/alter table gmail_token\s+enable row level security/)
  })

  it('grants no policy on gmail_token in any migration', () => {
    expect(allMigrations().match(/create policy\s+\w+\s+on\s+gmail_token/g)).toBeNull()
  })
})
