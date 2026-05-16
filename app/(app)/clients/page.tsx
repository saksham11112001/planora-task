import { Suspense }        from 'react'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { redirect }        from 'next/navigation'
import { ClientsFetcher }  from './ClientsFetcher'
import { ClientsSkeleton } from './ClientsSkeleton'
import type { Metadata }   from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Clients' }

export default async function ClientsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  return (
    <Suspense fallback={<ClientsSkeleton />}>
      <ClientsFetcher />
    </Suspense>
  )
}
