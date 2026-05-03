'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Building2, Users, Phone, ChevronRight, CheckCircle, UserCircle2, KeyRound, PlusCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const INDUSTRIES = ['Technology','Finance','Healthcare','Education','E-commerce','Marketing','Consulting','Real Estate','Manufacturing','Legal','Non-profit','Other']
const TEAM_SIZES = ['Just me','2–5','6–15','16–50','51–200','200+']

type Phase = 'checking' | 'entry' | 'join-code' | 'form' | 'joining' | 'joined'

interface InviteData { orgId: string; role: string }

export default function OnboardingPage() {
  const router = useRouter()

  const [phase,      setPhase]      = useState<Phase>('checking')
  const [step,       setStep]       = useState(0)   // 0 = profile, 1 = org, 2 = team, 3 = summary
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [joinedOrg,  setJoinedOrg]  = useState('')
  const [joinCode,   setJoinCode]   = useState('')

  const [form, setForm] = useState({
    name:          '',
    email:         '',
    phone:         '',
    org_name:      '',
    industry:      '',
    team_size:     '',
    referral_code: '',
  })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  // ── On mount: load user data + detect invite ─────────────────────────────
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setPhase('form'); return }

      // Pre-fill name from OAuth metadata
      const metaName =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        (user.user_metadata?.given_name && user.user_metadata?.family_name
          ? `${user.user_metadata.given_name} ${user.user_metadata.family_name}`
          : null) ??
        user.user_metadata?.given_name ??
        ''

      setForm(f => ({
        ...f,
        name:  metaName,
        email: user.email ?? '',
      }))

      const invitedOrgId = user.user_metadata?.invited_to_org
      const invitedRole  = user.user_metadata?.invited_role ?? 'member'

      if (invitedOrgId) {
        setInviteData({ orgId: invitedOrgId, role: invitedRole })
      }

      // No invite — show entry choice (create org or join via code)
      if (!invitedOrgId) {
        setPhase('entry')
      } else {
        setPhase('form')
      }
    }
    init()
  }, [])

  // ── Step 0 submit ────────────────────────────────────────────────────────
  async function handleProfileNext() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setError('')

    if (inviteData) {
      // Invited user — save profile + join org
      setSaving(true)
      try {
        const res = await fetch('/api/onboarding/join-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_id: inviteData.orgId,
            role:   inviteData.role,
            name:   form.name.trim(),
            phone:  form.phone.trim() || null,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setJoinedOrg(data.org_name ?? '')
          setPhase('joined')
          setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1800)
        } else {
          const data = await res.json()
          setError(data.error ?? 'Failed to join organisation')
        }
      } catch { setError('Network error — please try again') }
      finally { setSaving(false) }
    } else {
      // Fresh signup — advance to org setup
      setStep(1)
    }
  }

  // ── Join via code submit ─────────────────────────────────────────────────
  async function handleJoinCode() {
    if (!joinCode.trim()) { setError('Please enter a join code'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/org/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Invalid join code'); return }
      setJoinedOrg(data.org_name ?? '')
      setPhase('joined')
      setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1800)
    } catch { setError('Network error — please try again') } finally { setSaving(false) }
  }

  // ── Final submit (fresh signup, after step 3) ────────────────────────────
  async function handleSubmit() {
    if (!form.org_name.trim()) { setError('Organisation name is required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:          form.name.trim(),
          org_name:      form.org_name,
          industry:      form.industry,
          team_size:     form.team_size,
          phone:         form.phone || null,
          referral_code: form.referral_code.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create organisation'); return }
      router.push('/dashboard'); router.refresh()
    } catch { setError('Network error — please try again') } finally { setSaving(false) }
  }

  /* ── Checking / spinner ─────────────────────────────────────────── */
  if (phase === 'checking') {
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

  /* ── Joining / saving invited profile ───────────────────────────── */
  if (phase === 'joining') {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg,#134e4a 0%,#0f766e 50%,#0d9488 100%)' }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <Dots/>
        </div>
      </div>
    )
  }

  /* ── Joined screen ──────────────────────────────────────────────── */
  if (phase === 'joined') {
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
            You&apos;ve joined <strong>{joinedOrg}</strong>.<br/>Taking you to your dashboard…
          </p>
          <Dots color="#0d9488" style={{ marginTop: 20 }}/>
        </div>
      </div>
    )
  }

  /* ── Entry: create org or join via code ─────────────────────────── */
  if (phase === 'entry') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'linear-gradient(135deg,#134e4a 0%,#0f766e 50%,#0d9488 100%)' }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2.5 mb-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Zap className="h-6 w-6 text-white"/>
              </div>
              <span className="text-2xl font-bold text-white">Floatup</span>
            </div>
            <p className="text-teal-200 text-sm">Welcome! How would you like to get started?</p>
          </div>
          <div className="bg-white rounded-2xl p-8 shadow-2xl space-y-4">
            <button onClick={() => setPhase('form')}
              className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-teal-500 bg-teal-50 hover:bg-teal-100 transition-colors text-left group">
              <div className="h-11 w-11 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-200 transition-colors">
                <PlusCircle className="h-6 w-6 text-teal-600"/>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Create a new organisation</p>
                <p className="text-xs text-gray-500 mt-0.5">Set up your workspace from scratch with a 14-day free trial</p>
              </div>
              <ChevronRight className="h-5 w-5 text-teal-500 ml-auto flex-shrink-0"/>
            </button>
            <button onClick={() => { setError(''); setPhase('join-code') }}
              className="w-full flex items-center gap-4 p-5 rounded-xl border-2 border-gray-200 hover:border-teal-300 hover:bg-gray-50 transition-colors text-left group">
              <div className="h-11 w-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-50 transition-colors">
                <KeyRound className="h-6 w-6 text-gray-500 group-hover:text-teal-600 transition-colors"/>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Join an existing organisation</p>
                <p className="text-xs text-gray-500 mt-0.5">Enter the join code shared by your team admin</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 ml-auto flex-shrink-0 group-hover:text-teal-500 transition-colors"/>
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Join via code ───────────────────────────────────────────────── */
  if (phase === 'join-code') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'linear-gradient(135deg,#134e4a 0%,#0f766e 50%,#0d9488 100%)' }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2.5 mb-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Zap className="h-6 w-6 text-white"/>
              </div>
              <span className="text-2xl font-bold text-white">Floatup</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <KeyRound className="h-5 w-5 text-teal-600"/>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Join organisation</h2>
                <p className="text-sm text-gray-500">Enter the 8-character join code</p>
              </div>
            </div>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Join code</label>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  className="input font-mono tracking-widest text-center text-lg"
                  placeholder="XXXX-XXXX"
                  maxLength={9}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleJoinCode()}
                />
                <p className="mt-1.5 text-xs text-gray-400">Ask your team admin for the join code from Settings → Members.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setError(''); setPhase('entry') }} className="btn btn-outline flex-1">Back</button>
              <button onClick={handleJoinCode} disabled={saving}
                className="btn btn-brand flex-1 flex items-center justify-center gap-2">
                {saving ? 'Joining…' : 'Join'} {!saving && <ChevronRight className="h-4 w-4"/>}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Main onboarding form ───────────────────────────────────────── */
  // Invited users only see step 0; fresh signup sees steps 0–3
  const totalSteps = inviteData ? 1 : 4
  const progressStep = inviteData ? 1 : step + 1

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
            <span className="text-2xl font-bold text-white">Floatup</span>
          </div>
          <p className="text-teal-200 text-sm">
            {inviteData ? 'Complete your profile to get started' : 'Set up your workspace in a few quick steps'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i < progressStep ? 'bg-white' : 'bg-white/30'}`}/>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">

          {/* ── Step 0: Profile ── */}
          {step === 0 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
                  <UserCircle2 className="h-5 w-5 text-teal-600"/>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Your profile</h2>
                  <p className="text-sm text-gray-500">Let us know who you are</p>
                </div>
              </div>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name *</label>
                  <input
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    className="input"
                    placeholder="Your full name"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleProfileNext()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    value={form.email}
                    readOnly
                    className="input bg-gray-50 text-gray-500 cursor-default select-none"
                    tabIndex={-1}
                  />
                </div>
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
                    onKeyDown={e => e.key === 'Enter' && handleProfileNext()}
                  />
                  <p className="mt-1.5 text-xs text-gray-400">
                    Include country code. Used only for WhatsApp task notifications.
                  </p>
                </div>
              </div>
              <button
                onClick={handleProfileNext}
                disabled={saving}
                className="w-full mt-6 btn btn-brand flex items-center justify-center gap-2"
              >
                {saving ? 'Saving…' : inviteData ? 'Join workspace' : 'Continue'}
                {!saving && <ChevronRight className="h-4 w-4"/>}
              </button>
            </>
          )}

          {/* ── Step 1: Organisation ── */}
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
                    autoFocus
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Referral code
                    <span className="ml-2 text-xs text-gray-400 font-normal">optional — extends your referrer's trial</span>
                  </label>
                  <input
                    value={form.referral_code}
                    onChange={e => set('referral_code', e.target.value.toUpperCase())}
                    className="input font-mono tracking-widest"
                    placeholder="XXXX-XXXX"
                    maxLength={9}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => { setError(''); setStep(0) }} className="btn btn-outline flex-1">Back</button>
                <button
                  onClick={() => { if (!form.org_name.trim()) { setError('Name required'); return } setError(''); setStep(2) }}
                  className="btn btn-brand flex-1 flex items-center justify-center gap-2"
                >
                  Continue <ChevronRight className="h-4 w-4"/>
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Team size ── */}
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

          {/* ── Step 3: Phone (fresh signup only — org phone preference) ── */}
          {step === 3 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-teal-600"/>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Almost done!</h2>
                  <p className="text-sm text-gray-500">Confirm your details before we launch</p>
                </div>
              </div>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              {/* Summary of collected profile */}
              <div className="mb-5 p-3 bg-gray-50 rounded-xl space-y-1.5 text-sm">
                <div className="flex gap-2"><span className="text-gray-400 w-12 shrink-0">Name</span><span className="font-medium text-gray-800 truncate">{form.name}</span></div>
                <div className="flex gap-2"><span className="text-gray-400 w-12 shrink-0">Email</span><span className="text-gray-600 truncate">{form.email}</span></div>
                {form.phone && <div className="flex gap-2"><span className="text-gray-400 w-12 shrink-0">Phone</span><span className="text-gray-600">{form.phone}</span></div>}
              </div>
              <div className="flex gap-3 mt-2">
                <button onClick={() => setStep(2)} className="btn btn-outline flex-1">Back</button>
                <button onClick={handleSubmit} disabled={saving} className="btn btn-brand flex-1">
                  {saving ? 'Setting up…' : 'Launch Floatup 🚀'}
                </button>
              </div>
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
