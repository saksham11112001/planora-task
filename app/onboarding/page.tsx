'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Building2, Users, Phone, ChevronRight, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const INDUSTRIES = ['Technology','Finance','Healthcare','Education','E-commerce','Marketing','Consulting','Real Estate','Manufacturing','Legal','Non-profit','Other']
const TEAM_SIZES = ['Just me','2–5','6–15','16–50','51–200','200+']

export default function OnboardingPage() {
  const router  = useRouter()
  const [step,        setStep]        = useState(1)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [form,        setForm]        = useState({
    org_name: '', industry: '', team_size: '', phone: '',
  })
  const [inviteCheck, setInviteCheck] = useState<'checking'|'invited'|'none'>('checking')
  const [inviteOrg,   setInviteOrg]   = useState<{ name: string } | null>(null)

  useEffect(() => {
    async function checkInvite() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setInviteCheck('none'); return }

      const invitedOrgId = user.user_metadata?.invited_to_org
      const invitedRole  = user.user_metadata?.invited_role ?? 'member'

      if (!invitedOrgId) { setInviteCheck('none'); return }

      try {
        const res = await fetch('/api/onboarding/join-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: invitedOrgId, role: invitedRole }),
        })
        if (res.ok) {
          const data = await res.json()
          setInviteOrg({ name: data.org_name })
          setInviteCheck('invited')
          setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1800)
        } else {
          setInviteCheck('none')
        }
      } catch { setInviteCheck('none') }
    }
    checkInvite()
  }, [router])

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit() {
    if (!form.org_name.trim()) { setError('Organisation name is required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          org_name:  form.org_name,
          industry:  form.industry,
          team_size: form.team_size,
          phone:     form.phone || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create organisation'); return }
      router.push('/dashboard'); router.refresh()
    } catch { setError('Network error — please try again') } finally { setSaving(false) }
  }

  /* ── Loading / invite states ─────────────────────────────────── */
  if (inviteCheck === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg,#134e4a 0%,#0f766e 50%,#0d9488 100%)' }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Zap style={{ width: 22, height: 22, color: '#fff' }}/>
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Setting up your workspace…</p>
          <Dots/>
        </div>
      </div>
    )
  }

  if (inviteCheck === 'invited') {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg,#134e4a 0%,#0f766e 50%,#0d9488 100%)' }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', textAlign: 'center', maxWidth: 380 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0fdf4',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle style={{ width: 28, height: 28, color: '#16a34a' }}/>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>You&apos;re in!</h2>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
            You&apos;ve joined <strong>{inviteOrg?.name}</strong>.<br/>Taking you to your dashboard…
          </p>
          <Dots color="#0d9488" style={{ marginTop: 20 }}/>
        </div>
      </div>
    )
  }

  /* ── Main onboarding ─────────────────────────────────────────── */
  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg,#134e4a 0%,#0f766e 50%,#0d9488 100%)' }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Zap className="h-6 w-6 text-white"/>
            </div>
            <span className="text-2xl font-bold text-white">Planora</span>
          </div>
          <p className="text-teal-200 text-sm">Set up your workspace in 3 quick steps</p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-6">
          {[1,2,3].map(s => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${s <= step ? 'bg-white' : 'bg-white/30'}`}/>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">

          {/* Step 1 — Organisation */}
          {step === 1 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-teal-600"/>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Your organisation</h2>
                  <p className="text-sm text-gray-500">What&apos;s the name of your company or team?</p>
                </div>
              </div>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Organisation name *</label>
                  <input
                    value={form.org_name}
                    onChange={e => set('org_name', e.target.value)}
                    className="input" placeholder="e.g. Acme Corp"
                    onKeyDown={e => e.key === 'Enter' && form.org_name.trim() && (setError(''), setStep(2))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
                  <select value={form.industry} onChange={e => set('industry', e.target.value)} className="input">
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>
              <button
                onClick={() => { if (!form.org_name.trim()) { setError('Name required'); return } setError(''); setStep(2) }}
                className="w-full mt-6 btn btn-brand flex items-center justify-center gap-2"
              >
                Continue <ChevronRight className="h-4 w-4"/>
              </button>
            </>
          )}

          {/* Step 2 — Team size */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
                  <Users className="h-5 w-5 text-teal-600"/>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Team size</h2>
                  <p className="text-sm text-gray-500">How many people are in your team?</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {TEAM_SIZES.map(s => (
                  <button key={s} type="button" onClick={() => set('team_size', s)}
                    className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                      form.team_size === s
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-gray-200 text-gray-700 hover:border-teal-200'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn btn-outline flex-1">Back</button>
                <button onClick={() => setStep(3)} className="btn btn-brand flex-1 flex items-center justify-center gap-2">
                  Continue <ChevronRight className="h-4 w-4"/>
                </button>
              </div>
            </>
          )}

          {/* Step 3 — Phone number */}
          {step === 3 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-teal-600"/>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Your phone number</h2>
                  <p className="text-sm text-gray-500">For WhatsApp task alerts (optional)</p>
                </div>
              </div>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Phone number
                    <span className="ml-2 text-xs text-gray-400 font-normal">optional</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    className="input"
                    placeholder="+91 98765 43210"
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  />
                  <p className="mt-1.5 text-xs text-gray-400">
                    Include country code. Used only for WhatsApp task notifications — you can change this anytime in Profile.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(2)} className="btn btn-outline flex-1">Back</button>
                <button onClick={handleSubmit} disabled={saving} className="btn btn-brand flex-1">
                  {saving ? 'Setting up…' : 'Launch Planora 🚀'}
                </button>
              </div>
              {!form.phone && (
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="w-full mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Skip for now →
                </button>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}

function Dots({ color = 'rgba(255,255,255,0.7)', style: extraStyle }: { color?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', gap: 5, justifyContent: 'center', ...extraStyle }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%', background: color,
          animation: 'dotPulse 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.18}s`,
        }}/>
      ))}
      <style>{`@keyframes dotPulse{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1.2);opacity:1}}`}</style>
    </div>
  )
}
