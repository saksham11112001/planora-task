export const dynamic = 'force-dynamic'
import { getSessionUser }         from '@/lib/supabase/cached'
import { getActiveOrgMembership } from '@/lib/supabase/activeOrg'
import { redirect }                from 'next/navigation'
import { MsmeView }                from '@/app/(app)/msme/MsmeView'

export default async function MsmePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const user = await getSessionUser()
  if (!user) {
    const ref = params.ref ? `&ref=${encodeURIComponent(params.ref)}` : ''
    redirect(`/login?redirect=/msme${ref}`)
  }

  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  if (!['owner', 'admin', 'manager'].includes(mb.role)) {
    redirect('/dashboard')
  }

  return <MsmeView userRole={mb.role} />
}
