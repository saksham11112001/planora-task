import { Suspense }           from 'react'
import { getSessionUser } from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { redirect }           from 'next/navigation'
import { InvoicesFetcher }    from './InvoicesFetcher'
import { InvoicesSkeleton }   from './InvoicesSkeleton'
import type { Metadata }      from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Invoices' }

export default async function InvoicesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  return (
    <Suspense fallback={<InvoicesSkeleton />}>
      <InvoicesFetcher />
    </Suspense>
  )
}
