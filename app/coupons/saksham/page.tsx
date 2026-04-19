import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CouponsView }       from '@/app/(app)/settings/coupons/CouponsView'
import type { Metadata }     from 'next'

export const metadata: Metadata = { title: 'Coupon Admin' }
export const dynamic = 'force-dynamic'

export default async function SuperAdminCouponsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const superEmail = process.env.SUPER_ADMIN_EMAIL
  const isSuper    = !!user && !!superEmail && user.email?.toLowerCase() === superEmail.toLowerCase()

  if (!isSuper) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg,#0f172a 0%,#134e4a 100%)',
        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '40px 36px', maxWidth: 380, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Access restricted</h2>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, marginBottom: 20 }}>
            {user ? 'Your account does not have access to this page.' : 'Please sign in to continue.'}
          </p>
          <a href={user ? '/' : '/login'} style={{
            display: 'block', padding: '11px 0', background: '#0d9488', color: '#fff',
            borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>
            {user ? 'Go to dashboard' : 'Sign in'}
          </a>
        </div>
      </div>
    )
  }

  const admin = createAdminClient()
  const { data: coupons } = await admin
    .from('coupons')
    .select('*, coupon_redemptions(count)')
    .order('created_at', { ascending: false })

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#0f172a 0%,#134e4a 60%,#0d9488 100%)',
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>🏷️</div>
        <div>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: 0 }}>Coupon Admin</p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, margin: 0 }}>
            Signed in as {user.email}
          </p>
        </div>
        <div style={{ flex: 1 }}/>
        <a href="/dashboard" style={{
          color: 'rgba(255,255,255,0.7)', fontSize: 12, textDecoration: 'none',
          padding: '6px 14px', borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.2)',
        }}>
          ← Dashboard
        </a>
      </div>

      {/* Main content — white card */}
      <div style={{ padding: '32px 32px 48px' }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          background: '#fff', borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}>
          <CouponsView initialCoupons={coupons ?? []} />
        </div>
      </div>
    </div>
  )
}
