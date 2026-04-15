import { createClient } from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { ImportView }    from './ImportView'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Bulk Import — Taska' }

export default async function ImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase
    .from('org_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  // Only managers and above can see this page
  if (!mb || !['owner', 'admin', 'manager'].includes(mb.role)) redirect('/dashboard')

  return <ImportView />
}
