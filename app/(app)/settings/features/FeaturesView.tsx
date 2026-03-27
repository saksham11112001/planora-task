'use client'
import { useState } from 'react'
import { ArrowLeft, FileCheck, BarChart2, Clock } from 'lucide-react'
import Link from 'next/link'
import { toast } from '@/store/appStore'
import { clearOrgSettingsCache } from '@/lib/hooks/useOrgSettings'

const FEATURES = [
  {
    key:   'ca_compliance_mode',
    icon:  FileCheck,
    color: '#0d9488',
    title: 'CA Compliance Mode',
    desc:  "Adds a 'CA Compliance' dropdown to the task bar. Pick from 69 pre-defined CA tasks (GSTR, ITR, TDS, ROC etc.) with document names auto-filled as subtasks. Built from Sachit's compliance template.",
    badge: 'For CA firms',
  },
  {
    key:   'time_tracking',
    icon:  Clock,
    color: '#0891b2',
    title: 'Time Tracking',
    desc:  'Enable time logging for tasks and projects. Members can log billable and non-billable hours.',
    badge: null,
  },
  {
    key:   'advanced_reports',
    icon:  BarChart2,
    color: '#7c3aed',
    title: 'Advanced Reports',
    desc:  'Enable 30/60/90 day performance reports with per-employee breakdowns.',
    badge: null,
  },
]

export function FeaturesView({ features: initial }: { features: Record<string, boolean> }) {
  const [features, setFeatures] = useState(initial)
  const [saving,   setSaving]   = useState<string | null>(null)

  async function toggle(key: string) {
    const newVal = !features[key]
    setSaving(key)
    try {
      const res = await fetch('/api/settings/features', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature_key: key, is_enabled: newVal }),
      })
      if (res.ok) {
        setFeatures(p => ({ ...p, [key]: newVal }))
        clearOrgSettingsCache()
        toast.success(newVal ? 'Feature enabled' : 'Feature disabled')
      } else { toast.error('Failed to update') }
    } finally { setSaving(null) }
  }

  return (
    <div className="page-container" style={{ maxWidth: 640 }}>
      <Link href="/settings" style={{ display:'inline-flex', alignItems:'center', gap:6,
        fontSize:12, color:'var(--text-muted)', textDecoration:'none', marginBottom:20 }}>
        <ArrowLeft style={{ width:13, height:13 }}/> Settings
      </Link>
      <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>Features</h1>
      <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:28 }}>
        Enable or disable features for your organisation. Only admins can change these.
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {FEATURES.map(f => {
          const Icon    = f.icon
          const enabled = !!features[f.key]
          const isSaving = saving === f.key
          return (
            <div key={f.key} style={{ padding:'18px 20px', borderRadius:14,
              border: `1px solid ${enabled ? 'rgba(13,148,136,0.3)' : 'var(--border)'}`,
              background: enabled ? 'rgba(13,148,136,0.04)' : 'var(--surface)',
              display:'flex', alignItems:'flex-start', gap:14, transition:'all 0.15s' }}>
              <div style={{ width:38, height:38, borderRadius:10, flexShrink:0,
                background: enabled ? f.color : 'var(--surface-subtle)',
                display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.15s' }}>
                <Icon style={{ width:18, height:18, color: enabled ? '#fff' : 'var(--text-muted)' }}/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>{f.title}</span>
                  {f.badge && (
                    <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
                      background:'rgba(13,148,136,0.12)', color:'var(--brand)' }}>{f.badge}</span>
                  )}
                </div>
                <p style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.6, margin:0 }}>{f.desc}</p>
              </div>
              <button onClick={() => toggle(f.key)} disabled={isSaving}
                style={{ flexShrink:0, width:44, height:24, borderRadius:99, border:'none',
                  background: enabled ? f.color : 'var(--border)', cursor: isSaving ? 'not-allowed' : 'pointer',
                  position:'relative', transition:'background 0.2s', opacity: isSaving ? 0.6 : 1 }}>
                <span style={{ position:'absolute', top:3, borderRadius:'50%',
                  width:18, height:18, background:'#fff', transition:'left 0.2s',
                  left: enabled ? 23 : 3 }}/>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
