import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function PartnersRootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/partners/login')
  }

  // Check if this user has a standalone partner profile
  const admin = createAdminClient()
  const { data: partner } = await admin
    .from('standalone_partners')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (partner) {
    redirect('/partners/dashboard')
  } else {
    redirect('/partners/join')
  }
}
