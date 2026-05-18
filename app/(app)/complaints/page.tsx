import { redirect }      from 'next/navigation'
import { getSessionUser } from '@/lib/supabase/cached'
import ComplaintsView    from './ComplaintsView'

const ADMIN_EMAIL = 'saksham.gpt2001@gmail.com'

export default async function ComplaintsPage() {
  const user = await getSessionUser()
  if (!user || user.email !== ADMIN_EMAIL) redirect('/dashboard')

  return <ComplaintsView />
}
