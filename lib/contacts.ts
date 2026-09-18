/**
 * lib/contacts.ts — pure helpers for Decision-makers (T6.1-T6.4).
 *
 * No Supabase, no cookies, no React: plain functions so the rules they encode
 * (contactable state, the T6.4 stage gate mirror, relative time) can be unit-tested
 * without a request or a database.
 */

export const EMAIL_SOURCE_OPTIONS = [
  'Company website',
  'Trade fair card',
  'Introduced by a colleague',
  'Directory listing',
  'Guessed pattern — unverified',
] as const

export const LAWFUL_BASIS_OPTIONS = [
  'Legitimate interest — B2B, relevant product',
  'Consent given at trade fair',
  'Existing business relationship',
] as const

export interface ContactLike {
  provenance: string
  email: string | null
  emailSource: string | null
}

/**
 * "Contactable" column (T6.1). A guessed/unverified address is blocked from outreach
 * even though the row exists — matches the mock's "Blocked — unverified" state and
 * the same verified-only rule lib/ai/context.ts already applies to drafting context.
 */
export function contactableStatus(
  contact: ContactLike,
  opts: { companyStage: string; suppressed: boolean },
): { text: string; className: string } {
  if (opts.suppressed) return { text: 'Blocked — suppressed', className: 'tag tag-alert' }
  if (opts.companyStage === 'nurture') return { text: 'Nurture only', className: 'tag' }
  if (contact.provenance === 'verified' || contact.provenance === 'human_approved') {
    return { text: 'Yes', className: 'tag tag-ok' }
  }
  return { text: 'Blocked — unverified', className: 'tag tag-alert' }
}

/* ------------------------------------------------------------------ */
/* T6.4 — mirrors the enforce_stage_gate contact requirement           */
/* ------------------------------------------------------------------ */

export const PAST_CONTACT_IDENTIFICATION = [
  'outreach',
  'follow_up',
  'reply',
  'meeting',
  'commercial_discussion',
] as const

export function isPastContactIdentification(stage: string): boolean {
  return (PAST_CONTACT_IDENTIFICATION as readonly string[]).includes(stage)
}

/** A "named contact" per the DB trigger: an email with a recorded source. */
export function hasNamedContact(contacts: ContactLike[]): boolean {
  return contacts.some((c) => c.email && c.emailSource)
}

export function contactGateBlocks(targetStage: string | null, contacts: ContactLike[]): boolean {
  return targetStage !== null && isPastContactIdentification(targetStage) && !hasNamedContact(contacts)
}

export function contactGateReason(): string {
  return 'Cannot advance: no named contact with a recorded email source yet. Add one in Decision-makers first.'
}

/* ------------------------------------------------------------------ */
/* T6.3 — matching the AI decision-maker pick to an actual contact row */
/* ------------------------------------------------------------------ */

export function findContactByName<T extends { fullName: string }>(
  contacts: T[],
  name: string | null,
): T | null {
  if (!name) return null
  const needle = name.trim().toLowerCase()
  return contacts.find((c) => c.fullName.trim().toLowerCase() === needle) ?? null
}

/* ------------------------------------------------------------------ */
/* Suppression matching (feeds contactableStatus's `suppressed` flag)  */
/* ------------------------------------------------------------------ */

export function domainOf(website: string | null): string | null {
  if (!website) return null
  const stripped = website.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  const host = stripped.split('/')[0].trim().toLowerCase()
  return host || null
}

/** `suppression.email_or_domain` holds either an exact address or a bare domain. */
export function isSuppressed(email: string | null, companyWebsite: string | null, suppressed: Set<string>): boolean {
  if (email) {
    if (suppressed.has(email.toLowerCase())) return true
    const emailDomain = email.split('@')[1]?.toLowerCase()
    if (emailDomain && suppressed.has(emailDomain)) return true
  }
  const domain = domainOf(companyWebsite)
  return domain != null && suppressed.has(domain)
}

/* ------------------------------------------------------------------ */
/* Relative time for "last touch"                                      */
/* ------------------------------------------------------------------ */

export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime()
  const diffMs = now.getTime() - then
  if (diffMs < 0) return 'just now'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
