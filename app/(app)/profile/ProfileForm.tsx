'use client'
import { useState }  from 'react'
import { useRouter } from 'next/navigation'
import Link          from 'next/link'
import { ArrowLeft, User, Phone, Bell, Globe } from 'lucide-react'
import { toast }     from '@/store/appStore'

const TIMEZONES = [
  'Asia/Kolkata','Asia/Dubai','Asia/Singapore','Asia/Tokyo',
  'Europe/London','Europe/Paris','America/New_York','America/Los_Angeles',
  'Australia/Sydney','Pacific/Auckland',
]

export function ProfileForm({ profile }: { profile: any }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name:              profile.name              ?? '',
    phone_number:      profile.phone_number      ?? '',
    timezone:          profile.timezone          ?? 'Asia/Kolkata',
    whatsapp_opted_in: profile.whatsapp_opted_in ?? false,
  })
  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) toast.success('Profile updated!')
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  const initials = form.name ? form.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : profile.email[0].toUpperCase()

  return (
    <div className="page-container">
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors mb-6">
          <ArrowLeft className="h-3.5 w-3.5"/> Back
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">My profile</h1>

        {/* Avatar */}
        <div className="card-elevated p-6 mb-4">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
              {initials}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-lg">{form.name || 'Your name'}</p>
              <p className="text-sm text-gray-400">{profile.email}</p>
            </div>
          </div>

          <form onSubmit={save} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-gray-400"/> Full name *
              </label>
              <input value={form.name} onChange={e => set('name', e.target.value)} required
                className="input" placeholder="Saksham Gupta"/>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-gray-400"/> Phone number
              </label>
              <input value={form.phone_number} onChange={e => set('phone_number', e.target.value)}
                className="input" placeholder="+91 98765 43210" type="tel"/>
              <p className="text-xs text-gray-400 mt-1">Used for WhatsApp task reminders</p>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-gray-400"/> Timezone
              </label>
              <select value={form.timezone} onChange={e => set('timezone', e.target.value)} className="input">
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>

            {/* WhatsApp opt-in */}
            <div className="flex items-start gap-3 p-4 rounded-xl border"
              style={{ borderColor: form.whatsapp_opted_in ? 'var(--brand-border)' : 'var(--border)',
                background: form.whatsapp_opted_in ? 'var(--brand-light)' : '#fff' }}>
              <input type="checkbox" id="wa-optin" checked={form.whatsapp_opted_in}
                onChange={e => set('whatsapp_opted_in', e.target.checked)}
                style={{ accentColor: 'var(--brand)', width: 16, height: 16, marginTop: 1, flexShrink: 0 }}/>
              <div>
                <label htmlFor="wa-optin" className="text-sm font-semibold text-gray-900 flex items-center gap-2 cursor-pointer">
                  <Bell className="h-3.5 w-3.5 text-green-600"/> Receive WhatsApp reminders
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Get notified on WhatsApp for overdue tasks, approvals, and due-soon reminders. Requires a valid phone number above.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn btn-brand flex-1">
                {saving ? 'Saving…' : 'Save profile'}
              </button>
              <Link href="/dashboard" className="btn btn-outline">Cancel</Link>
            </div>
          </form>
        </div>

        {/* Email note */}
        <div className="card p-4">
          <p className="text-xs text-gray-500">
            <strong>Email address</strong> ({profile.email}) is managed through your Google account and cannot be changed here.
          </p>
        </div>
      </div>
    </div>
  )
}
