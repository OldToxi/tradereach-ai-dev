'use server'

/**
 * lib/product-actions.ts — server actions for the catalog (products).
 *
 * Only managers may add or edit a product. The `requirePermission` check mirrors
 * the `product_write` RLS policy; RLS is the real enforcement, this just turns a
 * policy refusal into a readable message and an audit row.
 */
import { revalidatePath } from 'next/cache'
import { createServerClient } from './supabase/server'
import { requirePermission } from './session'
import { canManageCatalog } from './catalog'
import { writeAudit, AUDIT } from './audit'

export type ProductActionState = { ok: boolean; error?: string }

export async function saveProduct(formData: FormData): Promise<ProductActionState> {
  let actor
  try {
    actor = await requirePermission((u) => canManageCatalog(u.role), 'manage products')
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not allowed' }
  }

  const id = (formData.get('id') as string)?.trim() || null
  const name = (formData.get('name') as string)?.trim()
  const hs_code = (formData.get('hs_code') as string)?.trim() || null
  const certRaw = (formData.get('certifications') as string)?.trim() || ''
  const monthly_capacity = (formData.get('monthly_capacity') as string)?.trim() || null
  const lead_time = (formData.get('lead_time') as string)?.trim() || null
  const capability_sheet = (formData.get('capability_sheet') as string)?.trim() || null

  if (!name) return { ok: false, error: 'Product name is required.' }

  const certifications = certRaw
    ? certRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const row = { name, hs_code, certifications, monthly_capacity, lead_time, capability_sheet }

  const supabase = await createServerClient()
  const { error } = id
    ? await supabase.from('product').update(row).eq('id', id)
    : await supabase.from('product').insert(row)

  if (error) return { ok: false, error: error.message }

  await writeAudit({
    actorId: actor.id,
    actorLabel: actor.fullName,
    event: id ? AUDIT.PRODUCT_EDITED : AUDIT.PRODUCT_ADDED,
    objectType: 'product',
    objectId: id ?? undefined,
    detail: id ? `Edited product "${name}"` : `Added product "${name}"`,
  })

  revalidatePath('/products')
  return { ok: true }
}
