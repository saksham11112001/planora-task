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
    redirect(`/login?redirect=/msme&mode=signup${ref}`)
  }

  const mb = await getActiveOrgMembership(user.id)
  if (!mb) redirect('/onboarding')

  const org = (mb as any).organisations as any
  const orgName: string = org?.name ?? ''

  return <MsmeView userRole={mb.role} orgName={orgName} />
}
