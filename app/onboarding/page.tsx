'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Building2, Users, Mail, Plus, X, ChevronRight, Send } from 'lucide-react'

const INDUSTRIES = ['Technology','Finance','Healthcare','Education','E-commerce','Marketing','Consulting','Real Estate','Manufacturing','Legal','Non-profit','Other']
const TEAM_SIZES = ['Just me','2–5','6–15','16–50','51–200','200+']

export default function OnboardingPage() {
  const router  = useRouter()
  const [step,  setStep]  = useState(1)
  const [saving,setSaving]= useState(false)
  const [error, setError] = useState('')
  const [orgId, setOrgId] = useState('')
  const [form,  setForm]  = useState({ org_name: '', industry: '', team_size: '' })

  // Step 3 — invite state
  const [inviteEmails, setInviteEmails] = useState<string[]>([''])
  const [inviteRole,   setInviteRole]   = useState('member')
  const [inviting,     setInviting]     = useState(false)
  const [inviteResults, setInviteResults] = useState<{ email: string; ok: boolean; msg: string }[]>([])

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit() {
    if (!form.org_name.trim()) { setError('Organisation name is required'); return }
    setSaving(true); setError('')
    try {
      const res  = await fetch('/api/onboarding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create organisation'); return }
      setOrgId(data.org_id)
      setStep(3)
    } catch { setError('Network error — please try again') } finally { setSaving(false) }
  }

  function addEmailRow() { setInviteEmails(e => [...e, '']) }
  function removeEmailRow(i: number) { setInviteEmails(e => e.filter((_, idx) => idx !== i)) }
  function setEmail(i: number, v: string) { setInviteEmails(e => e.map((x, idx) => idx === i ? v : x)) }

  async function handleInvites() {
    const valid = inviteEmails.map(e => e.trim()).filter(e => e && e.includes('@'))
    if (valid.length === 0) { finish(); return }
    setInviting(true)
    const results = await Promise.all(valid.map(async (email) => {
      try {
        const res  = await fetch('/api/team', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, role: inviteRole }),
        })
        const data = await res.json()
        return { email, ok: res.ok, msg: data.message ?? data.error ?? '' }
      } catch { return { email, ok: false, msg: 'Network error' } }
    }))
    setInviteResults(results)
    setInviting(false)
    setTimeout(finish, 1800)
  }

  function finish() { router.push('/dashboard'); router.refresh() }

  const totalSteps = 3

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
          <p className="text-teal-200 text-sm">Set up your workspace in {totalSteps} steps</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {[1,2,3].map(s => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${s <= step ? 'bg-white' : 'bg-white/30'}`}/>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">

          {/* ── Step 1: Org name ── */}
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

          {/* ── Step 2: Team size ── */}
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
                  {saving ? 'Setting up...' : 'Continue →'}
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Invite teammates ── */}
          {step === 3 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center"><Mail className="h-5 w-5 text-teal-600"/></div>
                <div><h2 className="text-lg font-bold text-gray-900">Invite your team</h2><p className="text-sm text-gray-500">Add teammates now — or skip and invite later.</p></div>
              </div>

              {/* Results after sending */}
              {inviteResults.length > 0 && (
                <div className="mb-4 space-y-1.5">
                  {inviteResults.map(r => (
                    <div key={r.email} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${r.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      <span className="font-medium">{r.email}</span>
                      <span className="text-xs opacity-70">— {r.ok ? 'invite sent ✓' : r.msg}</span>
                    </div>
                  ))}
                </div>
              )}

              {inviteResults.length === 0 && (
                <>
                  <div className="space-y-2 mb-4">
                    {inviteEmails.map((email, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(i, e.target.value)}
                          placeholder="colleague@company.com"
                          className="input flex-1"
                        />
                        {inviteEmails.length > 1 && (
                          <button onClick={() => removeEmailRow(i)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                            <X className="h-4 w-4"/>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button onClick={addEmailRow}
                    className="flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700 mb-4 font-medium">
                    <Plus className="h-3.5 w-3.5"/> Add another
                  </button>

                  <div className="mb-5">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Invite as</label>
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="input">
                      <option value="admin">Admin — can manage team & settings</option>
                      <option value="manager">Manager — can manage projects & tasks</option>
                      <option value="member">Member — standard access</option>
                      <option value="viewer">Viewer — read only</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex gap-3">
                <button onClick={finish} className="btn btn-outline flex-1 text-sm">
                  Skip for now
                </button>
                <button onClick={handleInvites} disabled={inviting}
                  className="btn btn-brand flex-1 flex items-center justify-center gap-2 text-sm">
                  {inviting ? 'Sending...' : <><Send className="h-3.5 w-3.5"/> Send invites</>}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
