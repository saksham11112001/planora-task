'use client'
import { useState } from 'react'
import { ArrowLeft, FileCheck, BarChart2, Clock, ListTodo, RefreshCw,
         FolderOpen, Users2, Calendar, Upload, Users, Shield } from 'lucide-react'
import Link from 'next/link'
import { toast } from '@/store/appStore'
import { refreshOrgSettings } from '@/lib/hooks/useOrgSettings'

// These features control sidebar visibility + functionality
export const ALL_FEATURES = [
  {
    key:      'ca_compliance_mode',
    icon:     FileCheck,
    color:    '#0d9488',
    title:    'CA Compliance Mode',
    desc:     "Adds a 'CA Compliance' dropdown to the task bar with 69 pre-defined CA tasks (GSTR, ITR, TDS, ROC etc.) with document names auto-filled as subtasks.",
    badge:    'For CA firms',
    section:  'tools',
  },
  {
    key:      'one_time_tasks',
    icon:     ListTodo,
    color:    '#0891b2',
    title:    'Quick tasks',
    desc:     'Show the Quick tasks page in the sidebar. Disable if your team only uses repeat tasks or projects.',
    badge:    null,
    section:  'navigation',
    default:  true,
  },
  {
    key:      'recurring_tasks',
    icon:     RefreshCw,
    color:    '#ea580c',
    title:    'Repeat tasks',
    desc:     'Show the Repeat tasks page in the sidebar.',
    badge:    null,
    section:  'navigation',
    default:  true,
  },
  {
    key:      'projects',
    icon:     FolderOpen,
    color:    '#7c3aed',
    title:    'Projects',
    desc:     'Show the Projects section in the sidebar.',
    badge:    null,
    section:  'navigation',
    default:  true,
  },
  {
    key:      'clients',
    icon:     Users2,
    color:    '#0891b2',
    title:    'Clients',
    desc:     'Show the Clients section in the sidebar.',
    badge:    null,
    section:  'navigation',
    default:  true,
  },
  {
    key:      'time_tracking',
    icon:     Clock,
    color:    '#ca8a04',
    title:    'Time tracking',
    desc:     'Show Time tracking in the sidebar. Members can log billable and non-billable hours.',
    badge:    null,
    section:  'navigation',
    default:  true,
  },
  {
    key:      'reports',
    icon:     BarChart2,
    color:    '#16a34a',
    title:    'Reports',
    desc:     'Show the Reports page in the sidebar with performance charts.',
    badge:    null,
    section:  'navigation',
    default:  true,
  },
  {
    key:      'calendar',
    icon:     Calendar,
    color:    '#0d9488',
    title:    'Calendar',
    desc:     'Show the Calendar view in the sidebar.',
    badge:    null,
    section:  'navigation',
    default:  true,
  },
  {
    key:      'import_data',
    icon:     Upload,
    color:    '#7c3aed',
    title:    'Import data',
    desc:     'Show the Import data tool in the sidebar.',
    badge:    null,
    section:  'tools',
    default:  true,
  },
  {
    key:      'team',
    icon:     Users,
    color:    '#0891b2',
    title:    'Team management',
    desc:     'Show the Team page in the sidebar.',
    badge:    null,
    section:  'navigation',
    default:  true,
  },
  {
    key:      'permissions',
    icon:     Shield,
    color:    '#7c3aed',
    title:    'Role permissions',
    desc:     'Show the Permissions shortcut in the sidebar for managers.',
    badge:    null,
    section:  'tools',
    default:  false,
  },
]

const SECTION_LABELS: Record<string, string> = {
  navigation: 'Sidebar navigation',
  tools:      'Tools & features',
}

export function FeaturesView({ features: initial, plan = 'free' }: { features: Record<string, boolean>; plan?: string }) {
  const PLAN_ORDER = ['free', 'starter', 'pro', 'business']
  const FEATURE_MIN_PLAN: Record<string, string> = {
    ca_compliance_mode: 'pro', time_tracking: 'starter', reports: 'starter',
    import_export: 'pro', custom_fields: 'starter', approvals: 'starter',
  }
  function isPlanSufficient(featureKey: string): boolean {
    const required = FEATURE_MIN_PLAN[featureKey]
    if (!required) return true
    return PLAN_ORDER.indexOf(plan) >= PLAN_ORDER.indexOf(required)
  }
  const PLAN_LABELS: Record<string, string> = { starter: 'Starter', pro: 'Pro', business: 'Business' }
  // Apply defaults for features not yet in DB
  const withDefaults: Record<string, boolean> = {}
  ALL_FEATURES.forEach(f => {
    withDefaults[f.key] = f.key in initial ? initial[f.key] : (f.default ?? false)
  })

  const [features, setFeatures] = useState(withDefaults)
  const [saving,   setSaving]   = useState<string | null>(null)

  async function toggle(key: string) {
    if (!isPlanSufficient(key)) {
      toast.error(`This feature requires the ${PLAN_LABELS[FEATURE_MIN_PLAN[key] ?? ''] ?? 'higher'} plan. Upgrade at Settings → Billing.`)
      return
    }
    const newVal = !features[key]
    setSaving(key)
    try {
      const res = await fetch('/api/settings/features', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature_key: key, is_enabled: newVal }),
      })
      if (res.ok) {
        setFeatures(p => ({ ...p, [key]: newVal }))
        await refreshOrgSettings()   // instantly updates sidebar + any other hook instances
        toast.success(newVal ? 'Enabled' : 'Disabled')
      } else { toast.error('Failed to update') }
    } finally { setSaving(null) }
  }

  const sections = ['navigation', 'tools']

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <Link href="/settings" style={{ display:'inline-flex', alignItems:'center', gap:6,
        fontSize:12, color:'var(--text-muted)', textDecoration:'none', marginBottom:20 }}>
        <ArrowLeft style={{ width:13, height:13 }}/> Settings
      </Link>
      <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>Features & navigation</h1>
      <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:28 }}>
        Choose what appears in the sidebar and which features are active for your organisation.
      </p>

      {sections.map(section => (
        <div key={section} style={{ marginBottom:28 }}>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase',
            letterSpacing:'0.07em', marginBottom:10 }}>{SECTION_LABELS[section]}</p>
          <div style={{ display:'flex', flexDirection:'column', gap:8, border:'1px solid var(--border)',
            borderRadius:14, overflow:'hidden' }}>
            {ALL_FEATURES.filter(f => f.section === section).map((f, idx, arr) => {
              const Icon     = f.icon
              const enabled  = !!features[f.key]
              const isSaving = saving === f.key
              const locked   = !isPlanSufficient(f.key)
              const reqPlan  = FEATURE_MIN_PLAN[f.key]
              return (
                <div key={f.key} style={{ padding:'14px 16px', display:'flex', alignItems:'center',
                  gap:12, background: locked ? 'var(--surface-subtle)' : 'var(--surface)', opacity: locked ? 0.85 : 1,
                  borderBottom: idx < arr.length-1 ? '1px solid var(--border-light)' : 'none',
                  opacity: isSaving ? 0.7 : 1, transition:'opacity 0.15s' }}>
                  <div style={{ width:32, height:32, borderRadius:8, flexShrink:0,
                    background: enabled ? f.color : 'var(--surface-subtle)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'background 0.15s' }}>
                    <Icon style={{ width:15, height:15, color: enabled ? '#fff' : 'var(--text-muted)' }}/>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{f.title}</span>
                      {f.badge && (
                        <span style={{ fontSize:9, fontWeight:700, padding:'2px 7px', borderRadius:99,
                          background:'rgba(13,148,136,0.12)', color:'var(--brand)' }}>{f.badge}</span>
                      )}
                    </div>
                    <p style={{ fontSize:11, color:'var(--text-muted)', margin:0, lineHeight:1.5 }}>{f.desc}</p>
                  </div>
                  {locked && reqPlan && (
                    <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:99,
                      background:'rgba(202,138,4,0.15)', color:'#ca8a04', border:'1px solid rgba(202,138,4,0.3)',
                      flexShrink:0, marginRight:8 }}>
                      🔒 {PLAN_LABELS[reqPlan]} plan
                    </span>
                  )}
                  <button onClick={() => toggle(f.key)} disabled={isSaving || locked}
                    style={{ flexShrink:0, width:40, height:22, borderRadius:99, border:'none',
                      background: enabled ? f.color : 'var(--border)',
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      position:'relative', transition:'background 0.2s' }}>
                    <span style={{ position:'absolute', top:2, borderRadius:'50%',
                      width:18, height:18, background:'#fff', transition:'left 0.2s',
                      left: enabled ? 20 : 2, boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}