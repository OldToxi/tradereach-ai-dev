'use server'

import { redirect } from 'next/navigation'
import { createServerClient } from './supabase/server'
import { writeAudit, AUDIT } from './audit'

export interface SignInResult {
  error?: string
}

export async function signIn(formData: FormData): Promise<SignInResult> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Enter your work email and password.' }
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  if (data.user) {
    await writeAudit({
      actorId: data.user.id,
      actorLabel: data.user.email ?? 'unknown',
      event: AUDIT.SIGNED_IN,
      objectType: 'session',
    })
  }

  return {}
}

export async function signOut(): Promise<void> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
