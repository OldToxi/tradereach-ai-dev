import { test, expect } from '@playwright/test'

/**
 * T12.3 — the twelve-step demonstration journey from the brief (§6), end to end.
 *
 * The demo opens mid-journey (per scripts/seed.ts): NordFiber has a first-touch draft
 * in the review queue that trips the samples guardrail, and Yıldız has an untriaged
 * reply that splits technical (send a spec) from commercial (price, payment terms).
 * This test walks the whole connected journey without firing a live AI call or a send,
 * so it is deterministic and safe to run repeatedly against a seeded dev project.
 *
 * Signing in as the Export Manager (rifat) — the role the demo journey is narrated from.
 */

const MANAGER = {
  email: 'rifat.hasan@anwargroup.test',
  password: 'demo-password-2026',
}

test('twelve-step demonstration journey', async ({ page }) => {
  // ── 1 · Sign in ────────────────────────────────────────────────────────────
  await test.step('1 · Sign in as the Export Manager', async () => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await page.getByLabel('Work email').fill(MANAGER.email)
    await page.getByLabel('Password').fill(MANAGER.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.waitForURL('**/dashboard')
  })

  // ── 2 · Dashboard ──────────────────────────────────────────────────────────
  await test.step('2 · Land on the dashboard with the workspace KPIs', async () => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Rifat')
    await expect(page.getByText('Companies researched')).toBeVisible()
    await expect(page.getByText('Drafts awaiting approval')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Needs you today' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pipeline by stage' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Data health' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Connector status' })).toBeVisible()
  })

  // ── 3 · Review queue ───────────────────────────────────────────────────────
  await test.step('3 · Open the review queue from the nav', async () => {
    await page.getByRole('link', { name: 'Review queue', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Review queue' })).toBeVisible()
    await expect(page.getByText('Nothing reaches a buyer until someone here approves it.')).toBeVisible()
  })

  // ── 4 · NordFiber draft is waiting ─────────────────────────────────────────
  await test.step('4 · See the NordFiber draft waiting for approval', async () => {
    await expect(page.getByText('First-touch — NordFiber Handels GmbH')).toBeVisible()
  })

  // ── 5 · Guardrail fires on the sample offer ────────────────────────────────
  await test.step('5 · The samples guardrail highlights the reserved language', async () => {
    await expect(page.locator('mark.risk').first()).toContainText(/sample/i)
    await expect(page.getByText('commercial language that needs authority')).toBeVisible()
  })

  // ── 6 · Pre-send checks block approval ─────────────────────────────────────
  await test.step('6 · Approval is blocked until the reserved matter is released', async () => {
    await expect(page.getByRole('heading', { name: 'Pre-send checks' })).toBeVisible()
    await expect(page.getByText('No reserved commercial matter')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled()
  })

  // ── 7 · Replies ────────────────────────────────────────────────────────────
  await test.step('7 · Open replies from the nav', async () => {
    await page.getByRole('link', { name: 'Replies', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Replies' })).toBeVisible()
  })

  // ── 8 · Yıldız split reply ─────────────────────────────────────────────────
  await test.step('8 · Inspect the Yıldız reply — the split case', async () => {
    await expect(page.getByRole('heading', { name: /Yıldız Tekstil A\.Ş\. — Selin Aydın/ })).toBeVisible()
    await expect(page.getByText(/technical specification/)).toBeVisible()
    await expect(page.getByText(/price per tonne/)).toBeVisible()
    await expect(page.getByText(/payment terms/)).toBeVisible()
  })

  // ── 9 · Untriaged, awaiting AI classification ──────────────────────────────
  await test.step('9 · See it is untriaged and awaiting a next action', async () => {
    await expect(page.getByText(/Not classified yet/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recommended next action' })).toBeVisible()
    await expect(page.getByText('Classify this reply to get a recommendation.')).toBeVisible()
  })

  // ── 10 · Companies ─────────────────────────────────────────────────────────
  await test.step('10 · Browse the companies under research', async () => {
    await page.getByRole('link', { name: 'Companies', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Companies' })).toBeVisible()
    await expect(page.getByText('Yıldız Tekstil A.Ş.')).toBeVisible()
    await expect(page.getByText('NordFiber Handels GmbH')).toBeVisible()
  })

  // ── 11 · Pipeline ──────────────────────────────────────────────────────────
  await test.step('11 · See the opportunity pipeline board', async () => {
    await page.getByRole('link', { name: 'Opportunity pipeline', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Opportunity pipeline' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Stage rules' })).toBeVisible()
  })

  // ── 12 · Audit trail ───────────────────────────────────────────────────────
  await test.step('12 · Confirm every action is on the audit trail', async () => {
    await page.getByRole('link', { name: 'Audit trail', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible()
    await expect(page.getByText('append-only')).toBeVisible()
  })
})
