import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { ProfileForm }   from './ProfileForm'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'My profile' }

export const revalidate = 20

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('users')
    .select('id, name, email, avatar_url, phone_number, timezone, whatsapp_opted_in')
    .eq('id', user.id).single()
  return <ProfileForm profile={profile ?? { id: user.id, name: '', email: user.email ?? '', avatar_url: null, phone_number: null, timezone: 'Asia/Kolkata', whatsapp_opted_in: false }}/>
}
