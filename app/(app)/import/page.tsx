import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }      from 'next/navigation'
import { ImportView }    from './ImportView'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Bulk Import — Taska' }

export default async function ImportPage() {
  // Use cached fetchers — layout already called these, so no extra DB round trips
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const mb = await getOrgMembership(user.id)

  // Only managers and above can see this page
  if (!mb || !['owner', 'admin', 'manager'].includes(mb.role)) redirect('/dashboard')

  return <ImportView />
}
