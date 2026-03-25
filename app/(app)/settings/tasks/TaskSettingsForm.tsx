'use client'
import { useState } from 'react'
import { toast } from '@/store/appStore'

const FIELDS = [
  { key: 'assignee',    label: 'Assignee',    desc: 'Who the task is assigned to' },
  { key: 'due_date',    label: 'Due date',    desc: 'When the task is due' },
  { key: 'priority',    label: 'Priority',    desc: 'Urgency level (low / medium / high)' },
  { key: 'client',      label: 'Client',      desc: 'Which client this task belongs to' },
  { key: 'attachment',  label: 'Attachments', desc: 'File uploads on the task' },
  { key: 'approver',    label: 'Approver',    desc: 'Person who must approve before completion' },
  { key: 'description', label: 'Description', desc: 'Longer notes or context for the task' },
  { key: 'estimated_hours', label: 'Est. hours', desc: 'Time estimate for planning' },
]

interface FieldConfig { visible: boolean; mandatory: boolean }
type Settings = Record<string, FieldConfig>

const DEFAULT: Settings = Object.fromEntries(
  FIELDS.map(f => [f.key, { visible: true, mandatory: false }])
)

export function TaskSettingsForm({ orgId, initial }: { orgId: string; initial: Settings | null }) {
  const [settings, setSettings] = useState<Settings>(initial ?? DEFAULT)
  const [saving, setSaving] = useState(false)

  function toggle(key: string, prop: 'visible' | 'mandatory') {
    setSettings(prev => {
      const cur = prev[key] ?? { visible: true, mandatory: false }
      // If hiding, also un-mandate
      if (prop === 'visible' && cur.visible) {
        return { ...prev, [key]: { visible: false, mandatory: false } }
      }
      // Can't mandate a hidden field
      if (prop === 'mandatory' && !cur.visible) return prev
      return { ...prev, [key]: { ...cur, [prop]: !cur[prop] } }
    })
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, task_fields: settings }),
      })
      if (res.ok) toast.success('Task settings saved ✓')
      else toast.error('Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px',
        padding: '8px 16px', marginBottom: 4,
        fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        <div>Field</div>
        <div style={{ textAlign: 'center' }}>Visible</div>
        <div style={{ textAlign: 'center' }}>Mandatory</div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {FIELDS.map((field, i) => {
          const cfg = settings[field.key] ?? { visible: true, mandatory: false }
          return (
            <div key={field.key} style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 90px',
              alignItems: 'center', padding: '14px 16px',
              borderBottom: i < FIELDS.length - 1 ? '1px solid var(--border-light)' : 'none',
              background: cfg.visible ? 'var(--surface)' : 'var(--surface-subtle)',
              transition: 'background 0.15s',
            }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: cfg.visible ? 'var(--text-primary)' : 'var(--text-muted)' }}>{field.label}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{field.desc}</p>
              </div>
              {/* Visible toggle */}
              <div style={{ textAlign: 'center' }}>
                <button onClick={() => toggle(field.key, 'visible')}
                  style={{
                    width: 38, height: 20, borderRadius: 99, border: 'none', cursor: 'pointer',
                    background: cfg.visible ? 'var(--brand)' : '#cbd5e1',
                    position: 'relative', transition: 'background 0.2s',
                  }}>
                  <span style={{
                    position: 'absolute', top: 2, left: cfg.visible ? 20 : 2,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}/>
                </button>
              </div>
              {/* Mandatory toggle */}
              <div style={{ textAlign: 'center' }}>
                <button onClick={() => toggle(field.key, 'mandatory')}
                  disabled={!cfg.visible}
                  style={{
                    width: 38, height: 20, borderRadius: 99, border: 'none',
                    cursor: cfg.visible ? 'pointer' : 'not-allowed',
                    background: cfg.mandatory ? '#dc2626' : '#cbd5e1',
                    opacity: cfg.visible ? 1 : 0.35,
                    position: 'relative', transition: 'background 0.2s',
                  }}>
                  <span style={{
                    position: 'absolute', top: 2, left: cfg.mandatory ? 20 : 2,
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}/>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 8,
        background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12, color: '#92400e' }}>
        <strong>Note:</strong> Mandatory fields will block task creation unless filled. Hiding a field also removes the mandatory requirement.
      </div>

      <button onClick={save} disabled={saving}
        style={{ marginTop: 20, padding: '10px 24px', borderRadius: 8,
          background: 'var(--brand)', color: '#fff', border: 'none',
          fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}>
        {saving ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  )
}
