'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/store/appStore'

const EVENT_TYPES = [
  { key: 'task_assigned',   label: 'Task assigned to me' },
  { key: 'task_due_soon',   label: 'Task due in 24 hours' },
  { key: 'task_overdue',    label: 'Task is overdue' },
  { key: 'task_commented',  label: 'Comment on my task' },
  { key: 'task_approved',   label: 'Task approved or rejected' },
  { key: 'project_updated', label: 'Project status changed' },
  { key: 'member_invited',  label: 'New team member joined' },
]

interface Pref { via_email: boolean; via_whatsapp: boolean }

export function NotifView({
  prefMap,
  orgId,
}: {
  prefMap: Record<string, Pref>
  orgId:   string
}) {
  const router  = useRouter()
  const [prefs, setPrefs]   = useState<Record<string, Pref>>(() => {
    const defaults: Record<string, Pref> = {}
    EVENT_TYPES.forEach(e => {
      defaults[e.key] = prefMap[e.key] ?? { via_email: true, via_whatsapp: false }
    })
    return defaults
  })
  const [saving, setSaving] = useState(false)

  function toggle(event: string, channel: 'via_email' | 'via_whatsapp') {
    setPrefs(p => ({
      ...p,
      [event]: { ...p[event], [channel]: !p[event][channel] },
    }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/notifications', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ preferences: prefs, org_id: orgId }),
      })
      if (res.ok) { toast.success('Preferences saved!'); router.refresh() }
      else        { const d = await res.json(); toast.error(d.error ?? 'Failed') }
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="card overflow-hidden mb-6">
        {/* Header row */}
        <div className="flex items-center gap-3 px-5 py-3 border-b text-xs font-semibold text-gray-400 uppercase tracking-wide"
          style={{ background: 'var(--surface-subtle)', borderColor: 'var(--border)' }}>
          <div className="flex-1">Event</div>
          <div className="w-20 text-center">Email</div>
          <div className="w-20 text-center">WhatsApp</div>
        </div>

        {EVENT_TYPES.map(evt => (
          <div key={evt.key}
            className="flex items-center gap-3 px-5 py-3.5 border-b last:border-0"
            style={{ borderColor: 'var(--border)' }}>
            <div className="flex-1 text-sm text-gray-700">{evt.label}</div>

            {/* Email toggle */}
            <div className="w-20 flex justify-center items-center">
              <button
                type="button"
                onClick={() => toggle(evt.key, 'via_email')}
                style={{ flexShrink: 0, width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', background: prefs[evt.key]?.via_email ? '#0d9488' : '#d1d5db', padding: 0 }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: prefs[evt.key]?.via_email ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* WhatsApp toggle */}
            <div className="w-20 flex justify-center items-center">
              <button
                type="button"
                onClick={() => toggle(evt.key, 'via_whatsapp')}
                style={{ flexShrink: 0, width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', background: prefs[evt.key]?.via_whatsapp ? '#16a34a' : '#d1d5db', padding: 0 }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: prefs[evt.key]?.via_whatsapp ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleSave} disabled={saving} className="btn btn-brand w-full">
        {saving ? 'Saving...' : 'Save preferences'}
      </button>
    </div>
  )
}
