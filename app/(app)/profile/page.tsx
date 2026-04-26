import { createClient }  from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/supabase/cached'
import { redirect }      from 'next/navigation'
import { ProfileForm }   from './ProfileForm'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'My profile' }


export default async function ProfilePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const { data: profile } = await supabase.from('users')
    .select('id, name, email, avatar_url, phone_number, timezone, whatsapp_opted_in')
    .eq('id', user.id).single()
  return <ProfileForm profile={profile ?? { id: user.id, name: '', email: user.email ?? '', avatar_url: null, phone_number: null, timezone: 'Asia/Kolkata', whatsapp_opted_in: false }}/>
}
