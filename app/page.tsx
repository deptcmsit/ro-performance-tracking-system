import { redirect } from 'next/navigation'
import { createClient } from '@/supabase/server'

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = user.user_metadata?.role

  if (role === 'Admin') {
    redirect('/admin/dashboard')
  } else if (role === 'Sub Admin') {
    redirect('/sub-admin/dashboard')
  } else {
    redirect('/dashboard')
  }
}
