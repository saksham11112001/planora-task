import { redirect }      from 'next/navigation'
import { getSessionUser } from '@/lib/supabase/cached'
import { isSuperAdminEmail } from '@/lib/utils/superAdmin'
import ComplaintsView    from './ComplaintsView'

export default async function ComplaintsPage() {
  const user = await getSessionUser()
  if (!user || !isSuperAdminEmail(user.email)) redirect('/dashboard')

  return <ComplaintsView />
}
