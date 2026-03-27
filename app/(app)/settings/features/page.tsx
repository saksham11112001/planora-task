export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import { FeaturesView } from './FeaturesView'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Features' }

export default async function FeaturesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: mb } = await supabase.from('org_members').select('org_id, role').eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb || !['owner','admin'].includes(mb.role)) redirect('/settings')

  const { data: rows } = await supabase.from('org_feature_settings').select('feature_key, is_enabled').eq('org_id', mb.org_id)
  const features: Record<string, boolean> = {}
  for (const row of rows ?? []) features[row.feature_key] = row.is_enabled

  return <FeaturesView features={features}/>
}
