'use server'

import { createClient } from '@/supabase/server'

type AuthState = {
  success: boolean
  role?: string
  error?: string
} | null

// Helper to normalize input to a shadow email if username is provided
function getEmailFromInput(input: string): string {
  if (input.includes('@')) {
    return input.trim().toLowerCase()
  }
  // Convert standard RO username (e.g. ro001) to ro001@ro-tracking.com
  return `${input.trim().toLowerCase()}@ro-tracking.com`
}

export async function signIn(_prevState: AuthState, formData: FormData) {
  const loginInput = formData.get('loginInput') as string
  const password = formData.get('password') as string

  if (!loginInput || !password) {
    return { success: false, error: 'Please enter both login and password.' }
  }

  try {
    const supabase = await createClient()
    const email = getEmailFromInput(loginInput)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    const user = data.user
    const role = user?.user_metadata?.role || 'Recovery Officer'
    const active = user?.user_metadata?.active !== false

    if (!active) {
      // Sign the user back out if they are deactivated
      await supabase.auth.signOut()
      return { success: false, error: 'Your account is deactivated. Contact Admin.' }
    }

    return { success: true, role }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'An unexpected error occurred.' }
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}
