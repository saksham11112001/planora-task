import { redirect }    from 'next/navigation'
import { getSessionUser, getUserProfile } from '@/lib/supabase/cached'
import { WalkthroughPageClient } from './WalkthroughPageClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Onboarding Tour' }

export default async function WalkthroughPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const profile = await getUserProfile(user.id)

  return (
    <WalkthroughPageClient
      userId={user.id}
      userCreatedAt={user.created_at}
      tourCompletedAt={(profile as any)?.tour_completed_at ?? null}
    />
  )
}
