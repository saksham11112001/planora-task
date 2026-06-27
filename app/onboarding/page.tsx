'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Building2, Users, ChevronRight, CheckCircle, UserCircle2, KeyRound, PlusCircle, Megaphone, Phone, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const COUNTRIES = [
  'India','United States','United Kingdom','Canada','Australia','Singapore','UAE','South Africa','Other',
]
const PRACTICE_TYPES = [
  'Sole Practitioner (Proprietorship)',
  'Partnership Firm',
  'LLP (Limited Liability Partnership)',
  'Private Limited Company',
  'Other',
]
const YEARS_OPTIONS = ['Less than 1 year','1–3 years','3–5 years','5–10 years','10–20 years','20+ years']
const INDUSTRIES = ['Accounting & Finance','Technology','Healthcare','E-commerce','Marketing & Advertising','Consulting','Real Estate','Education','Manufacturing','Legal','Retail','Non-profit','Other']
const TEAM_SIZES = ['Just me','2–5','6–15','16–50','51–200','200+']
const HOW_DID_YOU_HEAR = ['Google Search','LinkedIn','Friend / Colleague','WhatsApp / Referral','Social Media (Instagram / Facebook)','YouTube / Podcast','CA Association / ICAI','Product Hunt','Other']
const ROLE_OPTIONS = ['Business Owner / Founder','CA / Chartered Accountant','CPA / Tax Professional','Manager / Team Lead','Freelancer / Consultant','Finance & Accounts','Operations','Team Member / Employee','Other']
const CURRENT_TOOLS = ['Excel / Google Sheets','Tally','Zoho','QuickBooks','Paper / Manual','Nothing yet','Other']
const PAIN_POINTS = [
  'Missing deadlines and follow-ups',
  'Tracking what work is pending',
  'Managing my team\'s workload',
  'Client communication and follow-ups',
  'Staying on top of recurring tasks',
  'Billing and invoicing',
  'All of the above',
]

type Phase = 'checking' | 'entry' | 'join-code' | 'form' | 'otp' | 'joining' | 'joined'

interface InviteData { orgId: string; role: string }

export default function OnboardingPage() {
  const router = useRouter()

  const [phase,      setPhase]      = useState<Phase>('checking')
  const [step,       setStep]       = useState(0)   // 0 = profile, 1 = org, 2 = team, 3 = summary
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [inviteData,   setInviteData]   = useState<InviteData | null>(null)
  const [joinedOrg,    setJoinedOrg]    = useState('')
  const [joinCode,     setJoinCode]     = useState('')
  const [needsOtp,     setNeedsOtp]     = useState(false)
  const [otpCode,      setOtpCode]      = useState('')
  const [otpSending,   setOtpSending]   = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [otpSent,      setOtpSent]      = useState(false)

  const [form, setForm] = useState({
    name:              '',
    email:             '',
    phone:             '',
    country:           'India',
    org_name:          '',
    practice_type:     '',
    industry:          '',
    team_size:         '',
    years_in_practice: '',
    referral_code:     '',
    how_did_you_hear:  '',
    role_title:        '',
    current_tool:      '',
    pain_point:        '',
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

      // Pre-fill referral code from sessionStorage (set by login page when ?ref= is in URL)
      const storedRef = sessionStorage.getItem('upfloat_ref_code') ?? ''
      if (storedRef) sessionStorage.removeItem('upfloat_ref_code')

      setForm(f => ({
        ...f,
        name:          metaName,
        email:         user.email ?? '',
        referral_code: storedRef || f.referral_code,
      }))

      const invitedOrgId = user.user_metadata?.invited_to_org
      const invitedRole  = user.user_metadata?.invited_role ?? 'member'

      if (invitedOrgId) {
        setInviteData({ orgId: invitedOrgId, role: invitedRole })
      }

      // Check if email OTP verification will be needed for org creation.
      // OAuth and magic-link users already have email_confirmed_at set — skip OTP.
      const isEmailConfirmed = !!user.email_confirmed_at
      const isOtpVerified    = user.user_metadata?.email_otp_verified === true
      setNeedsOtp(!isEmailConfirmed && !isOtpVerified && !invitedOrgId)

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
    // Phone is required for org creators (identity anchor for anti-abuse)
    if (!inviteData) {
      if (!form.phone.trim()) { setError('Phone number is required to create an organisation'); return }
      if (!/^\+?[\d\s\-().]{7,15}$/.test(form.phone.trim())) { setError('Please enter a valid phone number with country code (e.g. +91 98765 43210)'); return }
    }
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
          // Set the active org cookie before redirecting so layout.tsx finds the membership
          if (data.org_id) {
            await fetch('/api/org/switch', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ org_id: data.org_id }),
            })
          }
          setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1800)
        } else {
          const data = await res.json()
          setError(data.error ?? 'Failed to join organisation')
        }
      } catch { setError('Network error — please try again') }
      finally { setSaving(false) }
    } else {
      // Fresh signup — verify email first if needed, then advance to org setup
      if (needsOtp) {
        setPhase('otp')
        sendOtp()
      } else {
        setStep(1)
      }
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
      // Set the active org cookie before redirecting so layout.tsx finds the membership
      if (data.org_id) {
        await fetch('/api/org/switch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: data.org_id }),
        })
      }
      setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1800)
    } catch { setError('Network error — please try again') } finally { setSaving(false) }
  }

  // ── Email OTP: send ─────────────────────────────────────────────────────
  async function sendOtp() {
    setOtpSending(true); setOtpSent(false); setError('')
    try {
      const res  = await fetch('/api/auth/email-otp/send', { method: 'POST' })
      const data = await res.json()
      if (data.already_verified) {
        setNeedsOtp(false); setPhase('form'); setStep(1); return
      }
      if (!res.ok) { setError(data.error ?? 'Failed to send verification code'); return }
      setOtpSent(true)
    } catch { setError('Network error — please try again') }
    finally   { setOtpSending(false) }
  }

  // ── Email OTP: verify ────────────────────────────────────────────────────
  async function handleVerifyOtp() {
    if (otpCode.length !== 6) { setError('Enter the 6-digit code from your email'); return }
    setOtpVerifying(true); setError('')
    try {
      const res  = await fetch('/api/auth/email-otp/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ otp: otpCode }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Verification failed'); return }
      setNeedsOtp(false); setOtpCode(''); setPhase('form'); setStep(1)
    } catch { setError('Network error — please try again') }
    finally   { setOtpVerifying(false) }
  }

  // ── Final submit (fresh signup, after step 3) ────────────────────────────
  async function handleSubmit() {
    if (!form.org_name.trim()) { setError('Organisation name is required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:              form.name.trim(),
          org_name:          form.org_name,
          industry:          form.industry,
          team_size:         form.team_size,
          phone:             form.phone || null,
          referral_code:     form.referral_code.trim() || null,
          how_did_you_hear:  form.how_did_you_hear || null,
          role_title:        form.role_title || null,
          country:           form.country || null,
          practice_type:     form.practice_type || null,
          years_in_practice: form.years_in_practice || null,
          current_tool:      form.current_tool || null,
          pain_point:        form.pain_point || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create organisation'); return }
      // Set the new org as active before redirecting so the cookie points to it
      if (data.org_id) {
        await fetch('/api/org/switch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_id: data.org_id }),
        })
      }
      const postOnboard = sessionStorage.getItem('upfloat_post_onboard') ?? ''
      if (postOnboard) sessionStorage.removeItem('upfloat_post_onboard')
      const urlNext = new URLSearchParams(window.location.search).get('next') ?? ''
      const dest = postOnboard || urlNext || '/dashboard'
      router.push(dest); router.refresh()
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

  /* ── Email OTP verification ─────────────────────────────────────── */
  if (phase === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'linear-gradient(135deg,#134e4a 0%,#0f766e 50%,#0d9488 100%)' }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2.5 mb-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Zap className="h-6 w-6 text-white"/>
              </div>
              <span className="text-2xl font-bold text-white">upFloat</span>
            </div>
            <p className="text-teal-200 text-sm">One quick step to secure your account</p>
          </div>
          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
                <Mail className="h-5 w-5 text-teal-600"/>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Verify your email</h2>
                <p className="text-sm text-gray-500">We sent a 6-digit code to <strong>{form.email}</strong></p>
              </div>
            </div>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
            {otpSending && !error && (
              <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-700">Sending code…</div>
            )}
            {otpSent && !otpSending && !error && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                Code sent — check your inbox (and spam folder).
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Verification code</label>
                <input
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input font-mono tracking-widest text-center text-2xl"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                  inputMode="numeric"
                  onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                />
              </div>
            </div>
            <button onClick={handleVerifyOtp} disabled={otpVerifying || otpCode.length !== 6}
              className="w-full mt-6 btn btn-brand flex items-center justify-center gap-2">
              {otpVerifying ? 'Verifying…' : 'Verify email'}
              {!otpVerifying && <ChevronRight className="h-4 w-4"/>}
            </button>
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <button onClick={() => { setError(''); setOtpCode(''); sendOtp() }} disabled={otpSending}
                className="text-teal-600 hover:text-teal-700 font-medium disabled:opacity-50">
                {otpSending ? 'Sending…' : 'Resend code'}
              </button>
              <span className="text-gray-300">·</span>
              <button onClick={() => { setError(''); setOtpCode(''); setOtpSent(false); setPhase('form'); setStep(0) }}
                className="text-gray-500 hover:text-gray-700">
                Back
              </button>
            </div>
          </div>
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
              <span className="text-2xl font-bold text-white">upFloat</span>
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
              <span className="text-2xl font-bold text-white">upFloat</span>
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
  // Invited users only see step 0; fresh signup sees steps 0–4
  const totalSteps   = inviteData ? 1 : 5
  const progressStep = inviteData ? 1 : step + 1
  const stepLabels   = ['You', 'Your Business', 'Team', 'Your Situation', 'Done']

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
            <span className="text-2xl font-bold text-white">upFloat</span>
          </div>
          <p className="text-teal-200 text-sm">
            {inviteData ? 'Complete your profile to get started' : 'Set up your workspace in a few quick steps'}
          </p>
        </div>

        {/* Step indicator */}
        {!inviteData && (
          <div className="flex items-center gap-1 mb-6">
            {stepLabels.map((label, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < step ? 'bg-white text-teal-700' : i === step ? 'bg-teal-400 text-white ring-2 ring-white ring-offset-2 ring-offset-transparent' : 'bg-white/20 text-white/50'
                  }`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium transition-all ${i <= step ? 'text-white' : 'text-white/40'}`}>{label}</span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div className={`h-0.5 flex-1 mb-4 transition-all ${i < step ? 'bg-white' : 'bg-white/20'}`}/>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-2xl p-8 shadow-2xl">

          {/* ── Step 0: Profile ── */}
          {step === 0 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
                  <UserCircle2 className="h-5 w-5 text-teal-600"/>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Tell us about yourself</h2>
                  <p className="text-sm text-gray-500">Just the basics to set up your workspace</p>
                </div>
              </div>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)}
                    className="input" placeholder="e.g. Rajesh Sharma" autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleProfileNext()}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input value={form.email} readOnly className="input bg-gray-50 text-gray-500 cursor-default select-none" tabIndex={-1}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Country *</label>
                  <select value={form.country} onChange={e => set('country', e.target.value)} className="input">
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Phone number
                    {inviteData
                      ? <span className="ml-2 text-xs text-gray-400 font-normal">optional</span>
                      : <span className="ml-2 text-xs text-red-400 font-normal">required</span>}
                  </label>
                  <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                    className="input" placeholder="+91 98765 43210" required={!inviteData}
                    onKeyDown={e => e.key === 'Enter' && handleProfileNext()}/>
                  <p className="mt-1.5 text-xs text-gray-400">
                    Include country code.{!inviteData && ' Required to activate your trial — one trial per phone number.'}
                  </p>
                </div>
              </div>
              <button onClick={handleProfileNext} disabled={saving}
                className="w-full mt-6 btn btn-brand flex items-center justify-center gap-2">
                {saving ? 'Saving…' : inviteData ? 'Join workspace' : 'Continue'}
                {!saving && <ChevronRight className="h-4 w-4"/>}
              </button>
            </>
          )}

          {/* ── Step 1: Firm details ── */}
          {step === 1 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-teal-600"/>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">About your organisation</h2>
                  <p className="text-sm text-gray-500">Help us personalise upFloat for your team</p>
                </div>
              </div>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Business / Organisation name *</label>
                  <input value={form.org_name} onChange={e => set('org_name', e.target.value)}
                    className="input" placeholder="e.g. Sharma & Associates" autoFocus
                    onKeyDown={e => e.key === 'Enter' && form.org_name.trim() && (setError(''), setStep(2))}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type of organisation</label>
                  <select value={form.practice_type} onChange={e => set('practice_type', e.target.value)} className="input">
                    <option value="">Select type</option>
                    {PRACTICE_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry / Sector</label>
                  <select value={form.industry} onChange={e => set('industry', e.target.value)} className="input">
                    <option value="">Select industry</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Years in business</label>
                  <select value={form.years_in_practice} onChange={e => set('years_in_practice', e.target.value)} className="input">
                    <option value="">Select experience</option>
                    {YEARS_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Referral code
                    <span className="ml-2 text-xs text-gray-400 font-normal">optional</span>
                  </label>
                  <input value={form.referral_code} onChange={e => set('referral_code', e.target.value.toUpperCase())}
                    className="input font-mono tracking-widest" placeholder="XXXX-XXXX" maxLength={9}/>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => { setError(''); setStep(0) }} className="btn btn-outline flex-1">Back</button>
                <button onClick={() => { if (!form.org_name.trim()) { setError('Business name is required'); return } setError(''); setStep(2) }}
                  className="btn btn-brand flex-1 flex items-center justify-center gap-2">
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

          {/* ── Step 3: Your situation ── */}
          {step === 3 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
                  <Megaphone className="h-5 w-5 text-teal-600"/>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Your current situation</h2>
                  <p className="text-sm text-gray-500">Helps us set up the right features for you</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">What best describes your role?</label>
                  <select value={form.role_title} onChange={e => set('role_title', e.target.value)} className="input">
                    <option value="">Select your role</option>
                    {ROLE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">How did you hear about upFloat?</label>
                  <select value={form.how_did_you_hear} onChange={e => set('how_did_you_hear', e.target.value)} className="input">
                    <option value="">Select an option</option>
                    {HOW_DID_YOU_HEAR.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(2)} className="btn btn-outline flex-1">Back</button>
                <button onClick={() => setStep(4)} className="btn btn-brand flex-1 flex items-center justify-center gap-2">
                  Almost done <ChevronRight className="h-4 w-4"/>
                </button>
              </div>
            </>
          )}

          {/* ── Step 4: Summary / confirm ── */}
          {step === 4 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-teal-600"/>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">All set!</h2>
                  <p className="text-sm text-gray-500">Confirm your details before we launch</p>
                </div>
              </div>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              <div className="mb-5 p-3 bg-gray-50 rounded-xl space-y-1.5 text-sm">
                <div className="flex gap-2"><span className="text-gray-400 w-12 shrink-0">Name</span><span className="font-medium text-gray-800 truncate">{form.name}</span></div>
                <div className="flex gap-2"><span className="text-gray-400 w-12 shrink-0">Email</span><span className="text-gray-600 truncate">{form.email}</span></div>
                {form.phone && <div className="flex gap-2"><span className="text-gray-400 w-12 shrink-0">Phone</span><span className="text-gray-600">{form.phone}</span></div>}
              </div>
              <div className="flex gap-3 mt-2">
                <button onClick={() => setStep(3)} className="btn btn-outline flex-1">Back</button>
                <button onClick={handleSubmit} disabled={saving} className="btn btn-brand flex-1">
                  {saving ? 'Setting up…' : 'Launch upFloat 🚀'}
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
