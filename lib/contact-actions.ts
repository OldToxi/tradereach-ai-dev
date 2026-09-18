'use server'

/**
 * lib/contact-actions.ts — server actions for Decision-makers (T6.2, T6.3).
 *
 * Same shape as lib/company-actions.ts: re-check the role, let RLS (contact_write)
 * do the real enforcement, translate its refusals into readable messages.
 */
import { revalidatePath } from 'next/cache'
import { createServerClient } from './supabase/server'
import { requirePermission, canWrite } from './session'
import { writeAudit, AUDIT } from './audit'

export type ContactActionState = { ok: boolean; error?: string; companyId?: string }

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

/* ------------------------------------------------------------------ */
/* T6.2 — add a decision-maker                                         */
/* ------------------------------------------------------------------ */

export async function addContact(formData: FormData): Promise<ContactActionState> {
  let actor
  try {
    actor = await requirePermission(canWrite, 'add decision-makers')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const companyId = (formData.get('companyId') as string)?.trim()
  const fullName = (formData.get('fullName') as string)?.trim()
  const roleTitle = (formData.get('roleTitle') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const emailSource = (formData.get('emailSource') as string)?.trim() || null
  const lawfulBasis = (formData.get('lawfulBasis') as string)?.trim() || null

  if (!companyId || !isUuid(companyId)) return { ok: false, error: 'Missing company.' }
  if (!fullName) return { ok: false, error: 'Name is required.' }

  // A guessed address is stored, but as unverified — mirrors the mock's "Contact added
  // as unverified until the address is checked". Only a source-backed one is verified.
  const provenance = email && emailSource && emailSource !== 'Guessed pattern — unverified' ? 'verified' : 'unverified'

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('contact')
    .insert({
      company_id: companyId,
      full_name: fullName,
      role_title: roleTitle,
      email,
      email_source: emailSource,
      lawful_basis: lawfulBasis,
      provenance,
      is_primary: false,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.CONTACT_ADDED,
    objectType: 'company',
    objectId: companyId,
    detail: `Added decision-maker "${fullName}"${roleTitle ? `, ${roleTitle}` : ''}`,
  })

  revalidatePath(`/companies/${companyId}`)
  revalidatePath('/contacts')
  return { ok: true, companyId }
}

/* ------------------------------------------------------------------ */
/* T6.2/T6.3 — set a contact as the company's primary decision-maker   */
/* ------------------------------------------------------------------ */

export async function setPrimaryContact(formData: FormData): Promise<ContactActionState> {
  let actor
  try {
    actor = await requirePermission(canWrite, 'set the primary decision-maker')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const companyId = (formData.get('companyId') as string)?.trim()
  const contactId = (formData.get('contactId') as string)?.trim()

  if (!companyId || !isUuid(companyId) || !contactId || !isUuid(contactId)) {
    return { ok: false, error: 'Missing contact.' }
  }

  const supabase = await createServerClient()
  const { data: contact, error: fetchError } = await supabase
    .from('contact')
    .select('full_name')
    .eq('id', contactId)
    .single()
  if (fetchError || !contact) return { ok: false, error: 'Contact not found.' }

  // No multi-row transaction available here — unset every other contact on this
  // company first, then set the target, so at most a brief window (not a stored
  // state) ever has more than one primary.
  const { error: clearError } = await supabase
    .from('contact')
    .update({ is_primary: false })
    .eq('company_id', companyId)
    .neq('id', contactId)
  if (clearError) return { ok: false, error: clearError.message }

  const { error: setError } = await supabase.from('contact').update({ is_primary: true }).eq('id', contactId)
  if (setError) return { ok: false, error: setError.message }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: AUDIT.PRIMARY_CONTACT_SET,
    objectType: 'company',
    objectId: companyId,
    detail: `Primary decision-maker set to "${contact.full_name}"`,
  })

  revalidatePath(`/companies/${companyId}`)
  return { ok: true, companyId }
}
