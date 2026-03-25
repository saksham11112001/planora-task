'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/store/appStore'

const INDUSTRIES = ['Technology','Finance','Healthcare','Education','E-commerce','Marketing','Consulting','Real Estate','Manufacturing','Legal','Non-profit','Other']
const TEAM_SIZES = ['Just me','2–5','6–15','16–50','51–200','200+']
const COLORS     = ['#0d9488','#7c3aed','#dc2626','#ca8a04','#16a34a','#0891b2','#db2777','#4f46e5','#ea580c','#374151']

export function OrgForm({ org }: { org: { name: string; industry?: string; team_size?: string; logo_color?: string; slug: string; plan_tier: string } }) {
  const router  = useRouter()
  const [saving, setSaving] = useState(false)
  const [name,   setName]   = useState(org.name)
  const [industry, setIndustry] = useState(org.industry ?? '')
  const [teamSize, setTeamSize] = useState(org.team_size ?? '')
  const [color,  setColor]  = useState(org.logo_color ?? '#0d9488')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    const res = await fetch('/api/settings/organisation', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), industry: industry || null, team_size: teamSize || null, logo_color: color }),
    })
    setSaving(false)
    if (res.ok) { toast.success('Saved!'); router.refresh() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  return (
    <form onSubmit={handleSave} className="card p-6 space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white text-xl font-bold" style={{ background: color }}>{name[0]?.toUpperCase()}</div>
        <div><p className="font-semibold text-gray-900">{name || 'Your organisation'}</p>
          <p className="text-xs text-gray-400">/{org.slug} · <span className="capitalize">{org.plan_tier}</span> plan</p></div>
      </div>

      <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Organisation name *</label>
        <input value={name} onChange={e => setName(e.target.value)} className="input" required/></div>

      <div><label className="block text-sm font-medium text-gray-700 mb-2">Brand colour</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className="h-7 w-7 rounded-full hover:scale-110 transition-transform flex items-center justify-center" style={{ background: c }}>
              {color === c && <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3"><path d="M13 4L6.5 11 3 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
          <select value={industry} onChange={e => setIndustry(e.target.value)} className="input">
            <option value="">Select</option>{INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Team size</label>
          <select value={teamSize} onChange={e => setTeamSize(e.target.value)} className="input">
            <option value="">Select</option>{TEAM_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select></div>
      </div>

      <button type="submit" disabled={saving} className="btn btn-brand w-full">{saving ? 'Saving...' : 'Save changes'}</button>
    </form>
  )
}
