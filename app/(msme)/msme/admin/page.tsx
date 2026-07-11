export const dynamic = 'force-dynamic'
import { redirect }       from 'next/navigation'
import { getSessionUser } from '@/lib/supabase/cached'
import { isSuperAdminEmail } from '@/lib/utils/superAdmin'
import MsmeAdminView      from './MsmeAdminView'

export default async function MsmeAdminPage() {
  const user = await getSessionUser()
  if (!user || !isSuperAdminEmail(user.email)) redirect('/msme')
  return <MsmeAdminView />
}
