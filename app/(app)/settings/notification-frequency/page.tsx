import { createClient }          from '@/lib/supabase/server'
import { redirect }               from 'next/navigation'
import { NotifFrequencyView }     from './NotifFrequencyView'
import type { Metadata }          from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Notification Frequency · Settings' }

export default async function NotifFrequencyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase
    .from('org_members').select('org_id, role')
    .eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb) redirect('/onboarding')

  const { data: setting } = await supabase
    .from('org_feature_settings')
    .select('config')
    .eq('org_id', mb.org_id)
    .eq('feature_key', 'notification_frequency')
    .maybeSingle()

  const currentMode: 'immediate' | 'digest' =
    (setting?.config as any)?.mode === 'digest' ? 'digest' : 'immediate'

  const isAdmin = ['owner', 'admin'].includes(mb.role)

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 24 }}>
        <a href="/settings" style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
          ← Settings
        </a>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Notification frequency
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Control how often email notifications are sent across your organisation.
        </p>
      </div>
      <NotifFrequencyView currentMode={currentMode} isAdmin={isAdmin}/>
    </div>
  )
}
