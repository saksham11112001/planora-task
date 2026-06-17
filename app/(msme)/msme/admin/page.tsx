export const dynamic = 'force-dynamic'
import { redirect }       from 'next/navigation'
import { getSessionUser } from '@/lib/supabase/cached'
import MsmeAdminView      from './MsmeAdminView'

const ADMIN_EMAIL = 'saksham.gpt2001@gmail.com'

export default async function MsmeAdminPage() {
  const user = await getSessionUser()
  if (!user || user.email !== ADMIN_EMAIL) redirect('/msme')
  return <MsmeAdminView />
}
