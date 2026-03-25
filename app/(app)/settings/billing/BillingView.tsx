'use client'
import { useState } from 'react'
import { Check, Zap, Clock } from 'lucide-react'
import { toast } from '@/store/appStore'

const PLANS = [
  {
    key: 'free', name: 'Free', monthlyINR: 0, annualINR: 0,
    features: ['Up to 5 members','3 projects','Unlimited tasks','Basic reports','5 GB storage'],
    color: '#64748b',
  },
  {
    key: 'starter', name: 'Starter', monthlyINR: 999, annualINR: 799,
    features: ['Up to 15 members','15 projects','Time tracking','Recurring tasks','Approval workflow','20 GB storage','Priority support'],
    color: '#0d9488', popular: false,
  },
  {
    key: 'pro', name: 'Pro', monthlyINR: 2999, annualINR: 2399,
    features: ['Up to 50 members','Unlimited projects','Advanced reports','API access','CSV/PDF exports','File attachments (unlimited)','100 GB storage'],
    color: '#7c3aed', popular: true,
  },
  {
    key: 'business', name: 'Business', monthlyINR: 7999, annualINR: 6399,
    features: ['Unlimited members','All Pro features','White-label branding','SSO / SAML','Dedicated support','SLA guarantee','Unlimited storage'],
    color: '#0891b2',
  },
]

interface Props {
  orgName:        string
  currentPlan:    string
  status:         string
  subscriptionId: string | null
  trialEndsAt?:   string | null
}

export function BillingView({ orgName, currentPlan, status, subscriptionId, trialEndsAt }: Props) {
  const [loading,  setLoading]  = useState<string | null>(null)
  const [annual,   setAnnual]   = useState(false)

  // Trial countdown
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : null
  const isTrialing = status === 'trialing' && trialDaysLeft !== null && trialDaysLeft > 0

  async function handleUpgrade(plan: string) {
    if (plan === 'free' || plan === currentPlan) return
    setLoading(plan)
    try {
      const res  = await fetch('/api/settings/billing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_tier: plan, billing_cycle: annual ? 'annual' : 'monthly' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to initiate payment'); setLoading(null); return }

      const { subscription_id, key_id } = data
      const script = document.createElement('script')
      script.src   = 'https://checkout.razorpay.com/v1/checkout.js'
      document.body.appendChild(script)
      script.onload = () => {
        const options = {
          key: key_id, subscription_id,
          name: 'Planora', description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan — ${annual ? 'Annual' : 'Monthly'}`,
          image: '/favicon.svg', prefill: { name: orgName },
          theme: { color: '#0d9488' },
          handler: () => { toast.success('Payment successful! Plan upgraded.'); setTimeout(() => window.location.reload(), 1500) },
          modal: { ondismiss: () => setLoading(null) },
        }
        const rzp = new (window as any).Razorpay(options)
        rzp.open()
        setLoading(null)
      }
    } catch { toast.error('Network error'); setLoading(null) }
  }

  return (
    <div className="page-container">
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Trial banner */}
        {isTrialing && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
            marginBottom: 24,
          }}>
            <Clock style={{ width: 20, height: 20, color: '#ca8a04', flexShrink: 0 }}/>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>
                {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left in your free Pro trial
              </p>
              <p style={{ fontSize: 12, color: '#a16207', marginTop: 2 }}>
                You have full access to all Pro features until your trial ends. Upgrade any time to continue uninterrupted.
              </p>
            </div>
            {/* Progress bar */}
            <div style={{ width: 120, flexShrink: 0 }}>
              <div style={{ height: 6, background: '#fde68a', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: '#ca8a04', borderRadius: 99,
                  width: `${((14 - trialDaysLeft!) / 14) * 100}%`,
                  transition: 'width 0.5s ease',
                }}/>
              </div>
              <p style={{ fontSize: 10, color: '#a16207', marginTop: 3, textAlign: 'right' }}>
                Day {14 - trialDaysLeft!} of 14
              </p>
            </div>
          </div>
        )}

        {/* Current plan card */}
        <div className="card-elevated p-5 mb-6 flex items-center gap-4">
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'var(--brand-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap style={{ width: 24, height: 24, color: 'var(--brand)' }}/>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Current plan</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
              {currentPlan}
              {isTrialing && (
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500,
                  background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 99 }}>
                  Trial — {trialDaysLeft}d left
                </span>
              )}
            </p>
          </div>
          {subscriptionId && (
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 99,
              background: status === 'active' || status === 'trialing' ? '#f0fdf4' : '#fff1f2',
              color: status === 'active' || status === 'trialing' ? '#16a34a' : '#dc2626',
            }}>
              {status === 'trialing' ? 'Trial active' : status}
            </span>
          )}
        </div>

        {/* Billing toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 28 }}>
          <span style={{ fontSize: 14, color: annual ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: annual ? 400 : 600 }}>
            Monthly
          </span>
          <button
            onClick={() => setAnnual(a => !a)}
            style={{
              width: 48, height: 26, borderRadius: 99, border: 'none', cursor: 'pointer',
              background: annual ? 'var(--brand)' : '#cbd5e1',
              position: 'relative', transition: 'background 0.2s',
            }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              position: 'absolute', top: 3, transition: 'left 0.2s',
              left: annual ? 25 : 3,
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}/>
          </button>
          <span style={{ fontSize: 14, color: annual ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: annual ? 600 : 400 }}>
            Annual
          </span>
          {annual && (
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
              background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
            }}>
              Save 20%
            </span>
          )}
        </div>

        {/* Plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {PLANS.map(plan => {
            const isCurrent = plan.key === currentPlan
            const price     = annual && plan.annualINR > 0 ? plan.annualINR : plan.monthlyINR
            const isLoading = loading === plan.key

            return (
              <div key={plan.key} style={{
                borderRadius: 14, border: `2px solid ${isCurrent ? plan.color : 'var(--border)'}`,
                background: 'var(--surface)', overflow: 'hidden', position: 'relative',
                boxShadow: plan.popular ? '0 4px 24px rgba(124,58,237,0.12)' : '0 1px 4px rgba(0,0,0,0.05)',
                display: 'flex', flexDirection: 'column',
              }}>
                {plan.popular && (
                  <div style={{
                    background: plan.color, color: '#fff', fontSize: 10, fontWeight: 700,
                    textAlign: 'center', padding: '4px 0', letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    Most popular
                  </div>
                )}
                {isCurrent && !plan.popular && (
                  <div style={{
                    background: plan.color, color: '#fff', fontSize: 10, fontWeight: 700,
                    textAlign: 'center', padding: '4px 0', letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    Current plan
                  </div>
                )}

                <div style={{ padding: '20px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: plan.color, marginBottom: 4 }}>{plan.name}</p>

                  <div style={{ marginBottom: 16 }}>
                    {price === 0 ? (
                      <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>Free</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>
                          ₹{price.toLocaleString('en-IN')}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/mo</span>
                        {annual && (
                          <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>
                            Billed ₹{(price * 12).toLocaleString('en-IN')}/yr · Save ₹{((plan.monthlyINR - plan.annualINR) * 12).toLocaleString('en-IN')}
                          </div>
                        )}
                        {!annual && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            or ₹{plan.annualINR.toLocaleString('en-IN')}/mo billed annually
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {plan.features.map(f => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                        <Check style={{ width: 13, height: 13, color: plan.color, flexShrink: 0, marginTop: 2 }}/>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(plan.key)}
                    disabled={isCurrent || plan.key === 'free' || !!loading}
                    style={{
                      marginTop: 18, width: '100%', padding: '9px 0',
                      borderRadius: 8, border: 'none', cursor: isCurrent || plan.key === 'free' ? 'default' : 'pointer',
                      fontSize: 13, fontWeight: 600,
                      background: isCurrent ? 'var(--border-light)' : plan.key === 'free' ? 'var(--border-light)' : plan.color,
                      color: isCurrent || plan.key === 'free' ? 'var(--text-muted)' : '#fff',
                      opacity: (!!loading && !isLoading) ? 0.5 : 1,
                      transition: 'opacity 0.15s, transform 0.1s',
                    }}>
                    {isLoading ? 'Opening checkout…' :
                     isCurrent ? 'Current plan' :
                     plan.key === 'free' ? 'Downgrade' :
                     `Upgrade to ${plan.name}`}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Annual savings callout */}
        {!annual && (
          <div style={{
            marginTop: 20, padding: '14px 20px', borderRadius: 12,
            background: 'var(--brand-light)', border: '1px solid var(--brand-border)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 20 }}>💡</span>
            <p style={{ fontSize: 13, color: 'var(--brand-dark)' }}>
              <strong>Save 20%</strong> by switching to annual billing. Starter saves ₹{(999-799)*12} · Pro saves ₹{(2999-2399)*12} · Business saves ₹{(7999-6399)*12} per year.
            </p>
            <button onClick={() => setAnnual(true)} style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: 8, border: 'none',
              background: 'var(--brand)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              Switch to annual
            </button>
          </div>
        )}

        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>
          All payments processed securely via Razorpay · Cancel anytime · No hidden fees
        </p>
      </div>
    </div>
  )
}
