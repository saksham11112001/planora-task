import { redirect }           from 'next/navigation'
import { AppShell }           from './AppShell'
import { getSessionUser, getOrgMembership, getUserProfile } from '@/lib/supabase/cached'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  // Run membership + profile fetches in parallel — not sequential
  const [membership, profile] = await Promise.all([
    getOrgMembership(user.id),
    getUserProfile(user.id),
  ])

  if (!membership) redirect('/onboarding')

  const org = membership.organisations as unknown as {
    id: string; name: string; slug: string; plan_tier: string; logo_color: string
  } | null
  if (!org) redirect('/onboarding')

  return (
    <AppShell
      user={{
        id:         user.id,
        name:       profile?.name ?? user.email?.split('@')[0] ?? 'User',
        email:      user.email ?? '',
        avatar_url: profile?.avatar_url ?? null,
      }}
      org={{
        id:         org.id,
        name:       org.name,
        slug:       org.slug,
        plan_tier:  org.plan_tier as any,
        logo_color: org.logo_color ?? '#0d9488',
      }}
      role={membership.role}
      workspaceId={null}
    >
      {children}
    </AppShell>
  )
}
