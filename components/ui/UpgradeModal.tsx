'use client'
import { useEffect } from 'react'
import Link from 'next/link'

interface Props {
  feature:      string   // e.g. 'Reports' or 'Time Tracking'
  description:  string   // what the feature does
  requiredPlan: string   // e.g. 'Starter'
  icon:         string   // emoji
  onClose:      () => void
}

/**
 * A slick modal-style upgrade prompt.
 * Pair with a useState(false) showUpgrade gate and render conditionally.
 *
 * Usage:
 *   {showUpgrade && (
 *     <UpgradeModal feature="Reports" description="..." requiredPlan="Starter" icon="📊" onClose={() => setShowUpgrade(false)} />
 *   )}
 */
export function UpgradeModal({ feature, description, requiredPlan, icon, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const planOrder = ['Starter', 'Pro', 'Business']
  const reqIndex  = planOrder.indexOf(requiredPlan)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15,23,42,0.62)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes upgradePopIn {
          from { transform: scale(0.86) translateY(16px); opacity: 0 }
          to   { transform: scale(1) translateY(0);       opacity: 1 }
        }
        @keyframes upgradeFadeIn { from{opacity:0} to{opacity:1} }
      `}</style>

      <div
        style={{
          background: '#fff',
          borderRadius: 22,
          width: '100%', maxWidth: 420,
          padding: '36px 32px 28px',
          textAlign: 'center',
          position: 'relative',
          boxShadow: '0 40px 100px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06)',
          animation: 'upgradePopIn 0.24s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close × */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 14, right: 16,
            background: '#f1f5f9', border: 'none',
            width: 28, height: 28, borderRadius: 8,
            cursor: 'pointer', fontSize: 16, color: '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}
        >×</button>

        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 22,
          background: 'linear-gradient(135deg,#f0fdfa,#e0f2fe)',
          border: '2px solid #ccfbf1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, margin: '0 auto 18px',
          boxShadow: '0 4px 20px rgba(13,148,136,0.15)',
        }}>
          {icon}
        </div>

        {/* Badge */}
        <div style={{
          display: 'inline-block', fontSize: 10, fontWeight: 800, letterSpacing: '0.8px',
          background: 'linear-gradient(135deg,#f97316,#ef4444)',
          color: '#fff', padding: '3px 12px', borderRadius: 99, marginBottom: 14,
        }}>
          {requiredPlan.toUpperCase()} PLAN REQUIRED
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginBottom: 8, letterSpacing: '-0.5px' }}>
          Unlock {feature}
        </h2>
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, marginBottom: 22 }}>
          {description}
        </p>

        {/* Plan ladder */}
        <div style={{
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 14, padding: '14px 18px', marginBottom: 22, textAlign: 'left',
        }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Available on
          </p>
          {planOrder.map((plan, idx) => {
            const isRec = plan === requiredPlan
            const isAvail = idx >= reqIndex
            return (
              <div key={plan} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                  background: isAvail ? '#dcfce7' : '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800,
                  color: isAvail ? '#16a34a' : '#cbd5e1',
                }}>
                  {isAvail ? '✓' : '–'}
                </div>
                <span style={{ fontSize: 14, color: '#0f172a', fontWeight: isRec ? 700 : 400, flex: 1 }}>
                  {plan}
                </span>
                {isRec && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, background: '#fff7ed',
                    color: '#f97316', border: '1px solid #fed7aa',
                    padding: '2px 8px', borderRadius: 99,
                  }}>
                    Recommended
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <Link
          href="/settings/billing"
          style={{
            display: 'block', width: '100%', padding: '13px 0',
            background: 'linear-gradient(135deg,#0d9488,#0891b2)',
            color: '#fff', borderRadius: 12, fontSize: 15, fontWeight: 800,
            textDecoration: 'none', textAlign: 'center',
            boxShadow: '0 6px 28px rgba(13,148,136,0.38)',
            letterSpacing: '-0.2px',
          }}
        >
          Upgrade to {requiredPlan} →
        </Link>
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 12, lineHeight: 1.6 }}>
          Have a coupon?{' '}
          <Link href="/settings/billing" style={{ color: '#0d9488', fontWeight: 600 }}>
            Redeem at Settings → Billing
          </Link>
        </p>
      </div>
    </div>
  )
}
