'use client'
import Link from 'next/link'

interface Props {
  feature:     string   // e.g. 'Reports' or 'Time Tracking'
  description: string   // what the feature does
  requiredPlan: string  // e.g. 'Starter'
  icon:        string   // emoji
}

export function UpgradeWall({ feature, description, requiredPlan, icon }: Props) {
  return (
    <div style={{
      minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', background: 'var(--surface)',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>{icon}</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>
          {feature} is a paid feature
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 28 }}>
          {description}
        </p>
        <div style={{
          background: 'var(--surface-subtle)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '16px 20px', marginBottom: 28, textAlign: 'left',
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Available on:
          </p>
          {['Starter', 'Pro', 'Business'].map(plan => (
            <div key={plan} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ color: '#16a34a', fontSize: 14 }}>✓</span>
              <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: plan === requiredPlan ? 700 : 400 }}>
                {plan} {plan === requiredPlan && <span style={{ fontSize: 11, background: '#f97316', color: '#fff', padding: '1px 6px', borderRadius: 4, marginLeft: 4 }}>Recommended</span>}
              </span>
            </div>
          ))}
        </div>
        <Link href="/settings/billing" style={{
          display: 'inline-block', padding: '12px 32px', background: '#0d9488',
          color: '#fff', borderRadius: 10, fontSize: 15, fontWeight: 700,
          textDecoration: 'none',
        }}>
          Upgrade to {requiredPlan} →
        </Link>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
          Have a coupon code?{' '}
          <Link href="/settings/billing" style={{ color: '#0d9488' }}>
            Redeem it at Settings → Billing
          </Link>
        </p>
      </div>
    </div>
  )
}
