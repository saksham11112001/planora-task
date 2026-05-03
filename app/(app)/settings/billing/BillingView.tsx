'use client'
import { useState } from 'react'
import { Check, Zap, Clock, Server, Package } from 'lucide-react'
import { toast } from '@/store/appStore'

const PLANS = [
  {
    key: 'free', name: 'Free', monthly: 0, annual: 0,
    features: ['Up to 5 members','3 projects','Unlimited tasks','Basic reports','5 GB storage'],
    color: '#64748b',
  },
  {
    key: 'starter', name: 'Starter', monthly: 29, annual: 23,
    features: ['Up to 15 members','15 projects','Time tracking','Recurring tasks','Approval workflow','20 GB storage','Priority support'],
    color: '#0d9488', popular: false,
  },
  {
    key: 'pro', name: 'Pro', monthly: 79, annual: 63,
    features: ['Up to 50 members','Unlimited projects','Advanced reports','API access','CSV/PDF exports','File attachments (unlimited)','100 GB storage'],
    color: '#7c3aed', popular: true,
  },
  {
    key: 'business', name: 'Business', monthly: 149, annual: 119,
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
  setupFeePaid?:  boolean
}

export function BillingView({ orgName, currentPlan, status, subscriptionId, trialEndsAt, setupFeePaid = false }: Props) {
  const [loading,  setLoading]  = useState<string | null>(null)
  const [annual,    setAnnual]    = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponMsg,  setCouponMsg]  = useState<{ok:boolean;text:string}|null>(null)
  const [applyingCoupon, setApplyingCoupon] = useState(false)

  // Setup fee state
  const [setupPaid,       setSetupPaid]       = useState(setupFeePaid)
  const [setupLoading,    setSetupLoading]    = useState(false)

  // Self-hosted inquiry state
  const [showSHForm,      setShowSHForm]      = useState(false)
  const [shSubmitted,     setShSubmitted]     = useState(false)
  const [shSubmitting,    setShSubmitting]    = useState(false)
  const [shForm, setShForm] = useState({ contact_name: '', contact_email: '', company_size: '', infrastructure: '', notes: '' })

  // Trial countdown
  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
    : null
  const isTrialing = status === 'trialing' && trialDaysLeft !== null && trialDaysLeft > 0

  async function applyCoupon() {
    if (!couponCode.trim()) return
    setApplyingCoupon(true); setCouponMsg(null)
    try {
      const res = await fetch('/api/coupon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim() }),
      })
      const d = await res.json()
      if (res.ok) {
        if (d.type === 'free_plan') {
          setCouponMsg({ ok:true, text:`✓ ${(d.plan as string).charAt(0).toUpperCase()+(d.plan as string).slice(1)} plan activated for ${d.months} month${d.months>1?'s':''}! Refreshing…` })
          setCouponCode('')
          setTimeout(() => window.location.reload(), 2000)
        } else {
          // percent / fixed_inr — discount stored for checkout
          setCouponMsg({ ok:true, text:`✓ ${d.message ?? 'Discount code applied!'}` })
          setCouponCode('')
        }
      } else {
        setCouponMsg({ ok:false, text:d.error ?? 'Invalid coupon' })
      }
    } finally { setApplyingCoupon(false) }
  }

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
          name: 'Floatup', description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan — ${annual ? 'Annual' : 'Monthly'}`,
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

  async function handleSetupFee() {
    if (setupPaid) return
    setSetupLoading(true)
    try {
      const res  = await fetch('/api/settings/billing/setup-fee', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to initiate payment'); setSetupLoading(false); return }

      const { order_id, key_id } = data
      const script = document.createElement('script')
      script.src   = 'https://checkout.razorpay.com/v1/checkout.js'
      document.body.appendChild(script)
      script.onload = () => {
        const options = {
          key: key_id, order_id,
          name: 'Floatup', description: 'Professional Setup & Onboarding',
          image: '/favicon.svg', prefill: { name: orgName },
          theme: { color: '#f97316' },
          handler: async (response: any) => {
            const verifyRes = await fetch('/api/settings/billing/setup-fee/verify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            })
            if (verifyRes.ok) {
              toast.success('Setup fee paid! Our team will reach out within 24 hours.')
              setSetupPaid(true)
            } else {
              const d = await verifyRes.json()
              toast.error(d.error ?? 'Payment verification failed. Contact support.')
            }
            setSetupLoading(false)
          },
          modal: { ondismiss: () => setSetupLoading(false) },
        }
        const rzp = new (window as any).Razorpay(options)
        rzp.open()
      }
    } catch { toast.error('Network error'); setSetupLoading(false) }
  }

  async function handleSHSubmit() {
    if (!shForm.contact_name.trim() || !shForm.contact_email.trim()) {
      toast.error('Name and email are required'); return
    }
    setShSubmitting(true)
    try {
      const res = await fetch('/api/settings/self-hosted', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shForm),
      })
      const d = await res.json()
      if (res.ok) { setShSubmitted(true); setShowSHForm(false) }
      else toast.error(d.error ?? 'Submission failed')
    } finally { setShSubmitting(false) }
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
            const price     = annual && plan.annual > 0 ? plan.annual : plan.monthly
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
                          ${price}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/mo</span>
                        {annual && (
                          <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>
                            Billed ${price * 12}/yr · Save ${(plan.monthly - plan.annual) * 12}
                          </div>
                        )}
                        {!annual && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            or ${plan.annual}/mo billed annually
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
              <strong>Save 20%</strong> by switching to annual billing. Starter saves ${(29-23)*12} · Pro saves ${(79-63)*12} · Business saves ${(149-119)*12} per year.
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
          All payments processed securely · Cancel anytime · No hidden fees
        </p>
      </div>

      {/* Coupon / promo code */}
      <div style={{ marginTop:28, padding:'18px 20px', borderRadius:12,
        background:'var(--surface-subtle)', border:'1px solid var(--border)' }}>
        <p style={{ fontSize:13,fontWeight:600,color:'var(--text-primary)',marginBottom:4 }}>
          Have a promo code?
        </p>
        <p style={{ fontSize:12,color:'var(--text-muted)',marginBottom:12 }}>
          Enter a coupon or special access code to unlock a plan for free.
        </p>
        <div style={{ display:'flex',gap:8 }}>
          <input value={couponCode} onChange={e=>setCouponCode(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==='Enter'&&applyCoupon()}
            placeholder="ENTER CODE HERE"
            style={{ flex:1,padding:'9px 12px',borderRadius:8,border:'1.5px solid var(--border)',
              outline:'none',fontSize:13,background:'var(--surface)',color:'var(--text-primary)',
              fontFamily:'inherit',letterSpacing:'0.05em',fontWeight:500 }}
            onFocus={e=>e.target.style.borderColor='var(--brand)'}
            onBlur={e=>e.target.style.borderColor='var(--border)'}/>
          <button onClick={applyCoupon} disabled={applyingCoupon||!couponCode.trim()}
            style={{ padding:'9px 18px',borderRadius:8,border:'none',
              background:couponCode.trim()?'var(--brand)':'var(--border)',color:'#fff',
              fontSize:13,fontWeight:600,cursor:couponCode.trim()?'pointer':'not-allowed',
              fontFamily:'inherit',opacity:applyingCoupon?0.7:1 }}>
            {applyingCoupon?'Applying…':'Apply'}
          </button>
        </div>
        {couponMsg && (
          <p style={{ marginTop:8,fontSize:12,fontWeight:500,
            color:couponMsg.ok?'#16a34a':'#dc2626' }}>
            {couponMsg.text}
          </p>
        )}
      </div>

      {/* ── One-time Setup & Onboarding ── */}
      <div style={{
        marginTop: 24, padding: '20px 22px', borderRadius: 14,
        border: setupPaid ? '1.5px solid #bbf7d0' : '1px solid var(--border)',
        background: setupPaid ? '#f0fdf4' : 'var(--surface)',
        display: 'flex', alignItems: 'flex-start', gap: 16,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: setupPaid ? '#dcfce7' : '#fff7ed',
          border: `1px solid ${setupPaid ? '#bbf7d0' : '#fed7aa'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Package style={{ width: 20, height: 20, color: setupPaid ? '#16a34a' : '#f97316' }}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Professional Setup &amp; Onboarding
            </p>
            {setupPaid ? (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
                background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0',
              }}>Paid ✓</span>
            ) : (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
                background: '#fff7ed', color: '#f97316', border: '1px solid #fed7aa',
              }}>One-time · $499</span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65, margin: '0 0 10px' }}>
            {setupPaid
              ? 'Our onboarding team will contact you within 24 hours to schedule your data migration and training sessions.'
              : 'Get a dedicated expert to migrate your existing data, configure your workflows, and train your team — available for any plan.'}
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: setupPaid ? 0 : 14 }}>
            {['Existing data migration','Custom workflow config','Team training','Priority go-live support'].map(f => (
              <span key={f} style={{ fontSize: 11, color: setupPaid ? '#16a34a' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Check style={{ width: 11, height: 11, flexShrink: 0 }}/> {f}
              </span>
            ))}
          </div>
          {!setupPaid && (
            <button
              onClick={handleSetupFee}
              disabled={setupLoading}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none',
                background: '#f97316', color: '#fff',
                fontSize: 12, fontWeight: 700, cursor: setupLoading ? 'not-allowed' : 'pointer',
                opacity: setupLoading ? 0.7 : 1, fontFamily: 'inherit',
              }}>
              {setupLoading ? 'Opening checkout…' : 'Pay $499 →'}
            </button>
          )}
        </div>
      </div>

      {/* ── Private Cloud / Self-Hosted ── */}
      <div style={{
        marginTop: 16, padding: '20px 22px', borderRadius: 14,
        border: shSubmitted ? '1.5px solid rgba(13,148,136,0.4)' : '1px solid var(--border)',
        background: shSubmitted ? 'rgba(13,148,136,0.05)' : 'var(--surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: '#f0fdfa', border: '1px solid #5eead4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Server style={{ width: 20, height: 20, color: '#0d9488' }}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Private Cloud / Self-Hosted
              </p>
              {shSubmitted ? (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
                  background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
                }}>Inquiry sent ✓</span>
              ) : (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
                  background: '#f0fdfa', color: '#0d9488', border: '1px solid #5eead4',
                }}>Enterprise</span>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65, margin: '0 0 10px' }}>
              {shSubmitted
                ? "We've received your inquiry. Our enterprise team will reach out within 1–2 business days to discuss your infrastructure requirements and pricing."
                : 'For banks, legal firms, healthcare providers, and regulated industries that need all data to stay exclusively on their own servers. Full Floatup platform, zero cloud dependency.'}
            </p>
            {!shSubmitted && (
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
                {['Your servers & DB','No cloud dependency','DPDP-ready','Dedicated deployment'].map(f => (
                  <span key={f} style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check style={{ width: 11, height: 11, flexShrink: 0 }}/> {f}
                  </span>
                ))}
              </div>
            )}
            {!shSubmitted && (
              <button
                onClick={() => setShowSHForm(v => !v)}
                style={{
                  padding: '8px 18px', borderRadius: 8,
                  border: '1.5px solid #0d9488', background: 'transparent',
                  color: '#0d9488', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {showSHForm ? 'Cancel' : 'Express interest →'}
              </button>
            )}
          </div>
        </div>

        {/* Inquiry form */}
        {showSHForm && !shSubmitted && (
          <div style={{
            marginTop: 18, paddingTop: 18,
            borderTop: '1px solid var(--border)',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          }}>
            {([
              { key: 'contact_name',   label: 'Your name *',          placeholder: 'Rahul Mehta',          type: 'text', col: 1 },
              { key: 'contact_email',  label: 'Email address *',       placeholder: 'rahul@example.com',    type: 'email', col: 1 },
              { key: 'company_size',   label: 'Team size',             placeholder: 'e.g. 50–200 people',   type: 'text', col: 1 },
              { key: 'infrastructure', label: 'Preferred infra',       placeholder: 'AWS / Azure / On-prem / Docker', type: 'text', col: 1 },
            ] as const).map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                  {f.label}
                </label>
                <input
                  type={f.type}
                  value={shForm[f.key]}
                  onChange={e => setShForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8,
                    border: '1.5px solid var(--border)', outline: 'none',
                    fontSize: 12, background: 'var(--surface)',
                    color: 'var(--text-primary)', fontFamily: 'inherit',
                  }}
                  onFocus={e => (e.target.style.borderColor = '#0d9488')}
                  onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                Additional notes
              </label>
              <textarea
                value={shForm.notes}
                onChange={e => setShForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="E.g. reasons for self-hosting, compliance requirements, timeline…"
                rows={3}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  border: '1.5px solid var(--border)', outline: 'none', resize: 'vertical',
                  fontSize: 12, background: 'var(--surface)',
                  color: 'var(--text-primary)', fontFamily: 'inherit',
                }}
                onFocus={e => (e.target.style.borderColor = '#0d9488')}
                onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSHSubmit}
                disabled={shSubmitting}
                style={{
                  padding: '9px 22px', borderRadius: 8, border: 'none',
                  background: '#0d9488', color: '#fff',
                  fontSize: 13, fontWeight: 700, cursor: shSubmitting ? 'not-allowed' : 'pointer',
                  opacity: shSubmitting ? 0.7 : 1, fontFamily: 'inherit',
                }}>
                {shSubmitting ? 'Sending…' : 'Send inquiry →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
