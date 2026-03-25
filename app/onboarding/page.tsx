'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Building2, Users, ChevronRight, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const INDUSTRIES = ['Technology','Finance','Healthcare','Education','E-commerce','Marketing','Consulting','Real Estate','Manufacturing','Legal','Non-profit','Other']
const TEAM_SIZES = ['Just me','2–5','6–15','16–50','51–200','200+']

export default function OnboardingPage() {
  const router  = useRouter()
  const [step,        setStep]        = useState(1)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [form,        setForm]        = useState({ org_name: '', industry: '', team_size: '' })
  const [inviteCheck, setInviteCheck] = useState<'checking'|'invited'|'none'>('checking')
  const [inviteOrg,   setInviteOrg]   = useState<{ name: string } | null>(null)

  useEffect(() => {
    // Check if this user has a pending invite in their metadata
    async function checkInvite() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setInviteCheck('none'); return }

      const invitedOrgId = user.user_metadata?.invited_to_org
      const invitedRole  = user.user_metadata?.invited_role ?? 'member'

      if (!invitedOrgId) { setInviteCheck('none'); return }

      // Auto-join the invited org
      try {
        const res = await fetch('/api/onboarding/join-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: invitedOrgId, role: invitedRole }),
        })
        if (res.ok) {
          // Get org name to show confirmation
          const data = await res.json()
          setInviteOrg({ name: data.org_name })
          setInviteCheck('invited')
          // Redirect to dashboard after short delay
          setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1800)
        } else {
          // Invite invalid/expired - show normal onboarding
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
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create organisation'); return }
      router.push('/dashboard'); router.refresh()
    } catch { setError('Network error — please try again') } finally { setSaving(false) }
  }

  // Show joining state while checking invite
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
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.7)',
                animation: 'dotPulse 1.2s ease-in-out infinite', animationDelay: `${i*0.18}s` }}/>
            ))}
          </div>
          <style>{`@keyframes dotPulse{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1.2);opacity:1}}`}</style>
        </div>
      </div>
    )
  }

  // Show auto-joined confirmation
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
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 20 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#0d9488',
                animation: 'dotPulse 1.2s ease-in-out infinite', animationDelay: `${i*0.18}s` }}/>
            ))}
          </div>
        </div>
        <style>{`@keyframes dotPulse{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1.2);opacity:1}}`}</style>
      </div>
    )
  }

  // Normal org creation flow
  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg,#134e4a 0%,#0f766e 50%,#0d9488 100%)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Zap className="h-6 w-6 text-white"/>
            </div>
            <span className="text-2xl font-bold text-white">Planora</span>
          </div>
          <p className="text-teal-200 text-sm">Set up your workspace in 2 steps</p>
        </div>
        <div className="flex items-center gap-2 mb-6">
          {[1,2].map(s => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${s <= step ? 'bg-white' : 'bg-white/30'}`}/>
          ))}
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          {step === 1 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center"><Building2 className="h-5 w-5 text-teal-600"/></div>
                <div><h2 className="text-lg font-bold text-gray-900">Your organisation</h2><p className="text-sm text-gray-500">What&apos;s the name of your company or team?</p></div>
              </div>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Organisation name *</label>
                  <input value={form.org_name} onChange={e => set('org_name', e.target.value)}
                    className="input" placeholder="e.g. Acme Corp" onKeyDown={e => e.key === 'Enter' && form.org_name.trim() && setStep(2)}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
                  <select value={form.industry} onChange={e => set('industry', e.target.value)} className="input">
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={() => { if (!form.org_name.trim()) { setError('Name required'); return } setError(''); setStep(2) }}
                className="w-full mt-6 btn btn-brand flex items-center justify-center gap-2">
                Continue <ChevronRight className="h-4 w-4"/>
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center"><Users className="h-5 w-5 text-teal-600"/></div>
                <div><h2 className="text-lg font-bold text-gray-900">Team size</h2><p className="text-sm text-gray-500">How many people are in your team?</p></div>
              </div>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {TEAM_SIZES.map(s => (
                  <button key={s} type="button" onClick={() => set('team_size', s)}
                    className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${form.team_size === s ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-700 hover:border-teal-200'}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn btn-outline flex-1">Back</button>
                <button onClick={handleSubmit} disabled={saving} className="btn btn-brand flex-1">
                  {saving ? 'Setting up...' : 'Launch Planora 🚀'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
