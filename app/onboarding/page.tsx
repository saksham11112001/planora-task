'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Building2, Users, ChevronRight } from 'lucide-react'

const INDUSTRIES = ['Technology','Finance','Healthcare','Education','E-commerce','Marketing','Consulting','Real Estate','Manufacturing','Legal','Non-profit','Other']
const TEAM_SIZES = ['Just me','2–5','6–15','16–50','51–200','200+']

export default function OnboardingPage() {
  const router  = useRouter()
  const [step,  setStep]  = useState(1)
  const [saving,setSaving]= useState(false)
  const [error, setError] = useState('')
  const [form,  setForm]  = useState({ org_name: '', industry: '', team_size: '' })

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
          <p className="text-teal-200 text-sm">Set up your workspace in 2 steps</p>
        </div>

        {/* Progress */}
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
