import { createClient }       from '@/lib/supabase/server'
import { createAdminClient }  from '@/lib/supabase/admin'
import { redirect }           from 'next/navigation'
import { CouponsView }        from './CouponsView'
import type { Metadata }      from 'next'

export const metadata: Metadata = { title: 'Coupon Management' }
export const revalidate = 0

export default async function CouponsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase
    .from('org_members').select('org_id, role')
    .eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb || !['owner', 'admin'].includes(mb.role)) redirect('/settings')

  const admin = createAdminClient()
  const { data: coupons } = await admin
    .from('coupons')
    .select('*, coupon_redemptions(count)')
    .order('created_at', { ascending: false })

  return <CouponsView initialCoupons={coupons ?? []} />
}
