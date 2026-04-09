'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/store/appStore'

// ── Rich industry project templates ────────────────────────────────────────
interface TemplateTask {
  title: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  subtasks?: string[]
}
interface ProjectTemplate {
  icon: string
  industry: string
  desc: string
  color: string
  tasks: TemplateTask[]
}

const PROJECT_TEMPLATES: Record<string, ProjectTemplate> = {
  'GST / Tax Filing': {
    icon: '🏛️', industry: 'CA & Accounting', desc: 'Complete GST, TDS & income tax filing workflow', color: '#ea580c',
    tasks: [
      { title: 'Collect client documents & bank statements', priority: 'high', subtasks: ['Bank statements', 'Purchase invoices', 'Sales invoices', 'Expense receipts'] },
      { title: 'GSTR-1 — outward supplies return', priority: 'high', subtasks: ['Computation', 'Client approval', 'File on GST portal', 'Download acknowledgement'] },
      { title: 'GSTR-3B — monthly summary return', priority: 'high', subtasks: ['Computation', 'Tax payment', 'File on GST portal', 'Download acknowledgement'] },
      { title: 'TDS return filing (26Q/24Q)', priority: 'high', subtasks: ['Collect TDS certificates', 'Computation', 'File on TRACES', 'Download Form 16'] },
      { title: 'Advance tax computation & payment', priority: 'medium', subtasks: ['Computation', 'Challan payment', 'Save acknowledgement'] },
      { title: 'Income tax return filing', priority: 'high', subtasks: ['Computation', 'Client review & sign-off', 'File on IT portal', 'Download ITR-V'] },
      { title: 'Reconciliation & final review', priority: 'medium', subtasks: ['Books vs GST reconciliation', 'TDS reconciliation', 'Partner sign-off'] },
    ],
  },
  'Statutory Audit': {
    icon: '📋', industry: 'CA & Accounting', desc: 'Full statutory audit from planning to report', color: '#7c3aed',
    tasks: [
      { title: 'Engagement setup & terms', priority: 'high', subtasks: ['Engagement letter drafted', 'Client signed', 'Independence confirmation'] },
      { title: 'Audit planning & risk assessment', priority: 'high', subtasks: ['Preliminary assessment', 'Materiality determination', 'Audit plan prepared'] },
      { title: 'Internal control testing', priority: 'high', subtasks: ['Walkthrough testing', 'Control effectiveness', 'Findings documented'] },
      { title: 'Fieldwork — vouching & verification', priority: 'high', subtasks: ['Revenue verification', 'Expense vouching', 'Fixed assets verification', 'Debtors confirmation', 'Creditors confirmation'] },
      { title: 'Management queries & responses', priority: 'medium', subtasks: ['Queries raised', 'Management responses received', 'Resolved & documented'] },
      { title: 'Audit report drafting', priority: 'high', subtasks: ['Draft prepared', 'Partner review', 'Client review'] },
      { title: 'Final sign-off & filing', priority: 'urgent', subtasks: ['Partner signature', 'UDIN generated', 'Report filed'] },
    ],
  },
  'Company Incorporation': {
    icon: '🏢', industry: 'Legal & Consulting', desc: 'End-to-end company registration & compliance setup', color: '#0891b2',
    tasks: [
      { title: 'Name approval (MCA RUN form)', priority: 'high', subtasks: ['3 name options prepared', 'MCA application filed', 'Approval received'] },
      { title: 'DIN & DSC for directors', priority: 'high', subtasks: ['DSC obtained for all directors', 'DIN application filed', 'DIN allotted'] },
      { title: 'MOA & AOA drafting', priority: 'high', subtasks: ['MOA drafted', 'AOA drafted', 'Director review & approval'] },
      { title: 'SPICe+ form filing', priority: 'urgent', subtasks: ['SPICe+ filled', 'All attachments uploaded', 'Filed on MCA', 'CIN received'] },
      { title: 'PAN & TAN application', priority: 'high', subtasks: ['PAN applied', 'TAN applied', 'Cards received'] },
      { title: 'Bank account opening', priority: 'medium', subtasks: ['Documents prepared', 'Bank visit', 'Account activated'] },
      { title: 'GST registration', priority: 'high', subtasks: ['Application filed', 'Verification done', 'GSTIN received'] },
      { title: 'Statutory registers setup', priority: 'medium', subtasks: ['Registers set up', 'Share certificates issued', 'First board meeting minutes'] },
    ],
  },
  'Restaurant Consultancy': {
    icon: '🍽️', industry: 'Food & Beverage', desc: 'Full restaurant setup & operations consulting', color: '#dc2626',
    tasks: [
      { title: 'Site visit & initial assessment', priority: 'high', subtasks: ['Location analysis', 'Footfall study', 'Infrastructure check', 'Report prepared'] },
      { title: 'Concept & menu engineering', priority: 'high', subtasks: ['Cuisine concept', 'Menu design', 'Costing & margins', 'Pricing finalised'] },
      { title: 'FSSAI license & food safety compliance', priority: 'urgent', subtasks: ['Application filed', 'Inspection scheduled', 'License received', 'Display board put up'] },
      { title: 'Kitchen SOP documentation', priority: 'medium', subtasks: ['Recipe cards', 'Portion standards', 'Hygiene protocols', 'Staff manual'] },
      { title: 'Staff hiring & training plan', priority: 'medium', subtasks: ['JDs prepared', 'Interviews done', 'Training schedule', 'Trial run'] },
      { title: 'Vendor & supplier finalisation', priority: 'medium', subtasks: ['Vendor list', 'Rate negotiation', 'Agreements signed'] },
      { title: 'Soft launch & feedback loop', priority: 'high', subtasks: ['Soft launch event', 'Guest feedback collected', 'Adjustments made'] },
      { title: 'Marketing & digital launch', priority: 'medium', subtasks: ['Social media setup', 'Launch campaign', 'Zomato/Swiggy listing'] },
    ],
  },
  'Website Development': {
    icon: '🌐', industry: 'Technology', desc: 'Discovery to launch web project workflow', color: '#0d9488',
    tasks: [
      { title: 'Discovery & requirements gathering', priority: 'high', subtasks: ['Stakeholder interviews', 'Requirements doc', 'Signed off by client'] },
      { title: 'Wireframes & UX design', priority: 'high', subtasks: ['Site map', 'Low-fi wireframes', 'Client feedback', 'Approved wireframes'] },
      { title: 'UI design (desktop + mobile)', priority: 'high', subtasks: ['Style guide', 'Desktop designs', 'Mobile designs', 'Client sign-off'] },
      { title: 'Frontend development', priority: 'high', subtasks: ['Component build', 'Responsive implementation', 'Internal review'] },
      { title: 'Backend & CMS setup', priority: 'high', subtasks: ['Server setup', 'Database schema', 'API development', 'CMS configured'] },
      { title: 'Content migration & SEO setup', priority: 'medium', subtasks: ['Content uploaded', 'Meta tags', 'Sitemap submitted'] },
      { title: 'QA testing & bug fixes', priority: 'urgent', subtasks: ['Cross-browser testing', 'Mobile testing', 'Performance check', 'Bug list resolved'] },
      { title: 'Launch & handover', priority: 'urgent', subtasks: ['DNS cutover', 'SSL active', 'Handover document', 'Training done'] },
    ],
  },
  'Marketing Campaign': {
    icon: '📣', industry: 'Marketing', desc: 'Strategy to results campaign workflow', color: '#db2777',
    tasks: [
      { title: 'Campaign brief & objectives', priority: 'high', subtasks: ['Goals defined', 'KPIs set', 'Budget approved', 'Brief signed off'] },
      { title: 'Target audience research', priority: 'high', subtasks: ['Persona development', 'Competitor analysis', 'Channel selection'] },
      { title: 'Content calendar creation', priority: 'high', subtasks: ['Monthly calendar', 'Topic clusters', 'Client approval'] },
      { title: 'Creative assets production', priority: 'high', subtasks: ['Copy written', 'Visuals designed', 'Videos produced', 'Client review'] },
      { title: 'Campaign setup & targeting', priority: 'high', subtasks: ['Ad accounts configured', 'Audiences set', 'Ads uploaded', 'Tracking verified'] },
      { title: 'Campaign launch', priority: 'urgent', subtasks: ['Go-live checklist', 'Launch confirmed', 'First-day monitoring'] },
      { title: 'Mid-campaign optimisation', priority: 'medium', subtasks: ['Performance review', 'A/B test analysis', 'Budget reallocation', 'Client update'] },
      { title: 'Final report & learnings', priority: 'medium', subtasks: ['Results compiled', 'Report prepared', 'Presented to client'] },
    ],
  },
  'Event Management': {
    icon: '🎪', industry: 'Events', desc: 'Corporate or social event planning to execution', color: '#ca8a04',
    tasks: [
      { title: 'Event brief & objectives', priority: 'high', subtasks: ['Event concept', 'Guest count', 'Budget approved', 'Date confirmed'] },
      { title: 'Venue scouting & finalisation', priority: 'high', subtasks: ['3 venue options', 'Site visits', 'Agreement signed', 'Advance paid'] },
      { title: 'Vendor bookings', priority: 'high', subtasks: ['Catering finalised', 'AV & lighting', 'Decor', 'Photography/video', 'All contracts signed'] },
      { title: 'Guest list & invitations', priority: 'medium', subtasks: ['Guest list finalised', 'Invitations sent', 'RSVPs tracked'] },
      { title: 'Run-of-show document', priority: 'high', subtasks: ['Detailed timeline', 'Responsibilities assigned', 'Rehearsal done'] },
      { title: 'Day-of coordination', priority: 'urgent', subtasks: ['Setup inspection', 'Vendor check-in', 'Event execution', 'Breakdown supervised'] },
      { title: 'Post-event review', priority: 'low', subtasks: ['Guest feedback', 'Budget reconciliation', 'Final report'] },
    ],
  },
  'HR & Recruitment': {
    icon: '👥', industry: 'Human Resources', desc: 'End-to-end hiring and onboarding workflow', color: '#16a34a',
    tasks: [
      { title: 'Job description & approval', priority: 'high', subtasks: ['JD drafted', 'Hiring manager approval', 'Budget sanctioned'] },
      { title: 'Job posting & sourcing', priority: 'high', subtasks: ['Posted on portals', 'LinkedIn outreach', 'Referrals activated'] },
      { title: 'Resume screening', priority: 'high', subtasks: ['Shortlist prepared', 'Rejection emails sent'] },
      { title: 'Interview rounds', priority: 'high', subtasks: ['HR screening', 'Technical round', 'Manager round', 'Culture fit'] },
      { title: 'Offer negotiation & rollout', priority: 'urgent', subtasks: ['Offer letter prepared', 'Negotiation done', 'Signed offer received'] },
      { title: 'Background verification', priority: 'high', subtasks: ['BGV initiated', 'Documents collected', 'BGV cleared'] },
      { title: 'Onboarding', priority: 'high', subtasks: ['IT setup', 'Access provided', 'Buddy assigned', 'Day-1 induction', '30-day check-in'] },
    ],
  },
  'Real Estate Deal': {
    icon: '🏗️', industry: 'Real Estate', desc: 'Property acquisition or sale transaction workflow', color: '#4f46e5',
    tasks: [
      { title: 'Property identification & shortlisting', priority: 'high', subtasks: ['Requirements gathered', '3+ options shortlisted', 'Site visits done'] },
      { title: 'Due diligence & legal check', priority: 'urgent', subtasks: ['Title search', 'Encumbrance certificate', 'Approvals verified', 'Legal report'] },
      { title: 'Valuation & pricing', priority: 'high', subtasks: ['Market comparison', 'Valuation report', 'Negotiation mandate'] },
      { title: 'Negotiation & term sheet', priority: 'high', subtasks: ['Offer made', 'Counter-offer', 'Term sheet signed'] },
      { title: 'Sale agreement drafting', priority: 'urgent', subtasks: ['Draft agreement', 'Lawyer review', 'Both parties signed', 'Token payment'] },
      { title: 'Home loan coordination', priority: 'medium', subtasks: ['Loan applied', 'Documents submitted', 'Sanction received', 'Disbursement'] },
      { title: 'Registration & stamp duty', priority: 'urgent', subtasks: ['Stamp duty paid', 'Registration appointment', 'Deed registered', 'Original documents'] },
      { title: 'Possession & handover', priority: 'high', subtasks: ['Snagging list', 'Repairs done', 'Key handover', 'Society membership'] },
    ],
  },
  'Product Launch': {
    icon: '🚀', industry: 'Startups & Tech', desc: 'New product go-to-market launch workflow', color: '#f97316',
    tasks: [
      { title: 'Launch strategy & positioning', priority: 'high', subtasks: ['Target audience defined', 'Positioning statement', 'Competitive analysis', 'GTM plan'] },
      { title: 'Product readiness review', priority: 'urgent', subtasks: ['Feature freeze', 'QA complete', 'Performance tested', 'Security reviewed'] },
      { title: 'Pricing & packaging', priority: 'high', subtasks: ['Pricing model', 'Plan tiers defined', 'Payment integration tested'] },
      { title: 'Marketing assets creation', priority: 'high', subtasks: ['Landing page live', 'Demo video', 'Product screenshots', 'Email sequences'] },
      { title: 'Beta & early access', priority: 'high', subtasks: ['Beta users onboarded', 'Feedback collected', 'Critical bugs fixed'] },
      { title: 'PR & press outreach', priority: 'medium', subtasks: ['Press release drafted', 'Journalists contacted', 'Coverage tracked'] },
      { title: 'Launch day execution', priority: 'urgent', subtasks: ['Product Hunt submission', 'Social blast', 'Team on standby', 'Monitoring live'] },
      { title: 'Post-launch review (week 1)', priority: 'high', subtasks: ['Metrics reviewed', 'Customer feedback', 'Hotfixes shipped', 'Week-1 report'] },
    ],
  },
  'Blank project': {
    icon: '⬜', industry: 'General', desc: 'Start from scratch — no pre-built tasks', color: '#64748b',
    tasks: [],
  },
}

const COLORS = ['#0d9488','#7c3aed','#dc2626','#ca8a04','#16a34a','#0891b2','#db2777','#ea580c','#4f46e5','#374151']

export function NewProjectForm({ clients: initialClients, members, orgTemplates = [] }: {
  clients: { id: string; name: string; color: string }[]
  members: { id: string; name: string }[]
  orgTemplates?: { id: string; name: string; template_tasks: any[] }[]
}) {
  const router = useRouter()
  const [saving,      setSaving]      = useState(false)
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [color,       setColor]       = useState('#0d9488')
  const searchParams  = useSearchParams()
  const [clients,     setClients]     = useState(initialClients)
  const [clientId,    setClientId]    = useState(searchParams.get('client') ?? '')
  const [ownerId,     setOwnerId]     = useState('')
  const [dueDate,     setDueDate]     = useState('')
  const [budget,      setBudget]      = useState('')
  const [hoursBudget, setHoursBudget] = useState('')
  const [error,       setError]       = useState('')
  const [memberIds,    setMemberIds]    = useState<string[]>([])
  const [selectedTemplate,     setSelectedTemplate]     = useState<string | null>(null)
  const [templateTasksPreview, setTemplateTasksPreview] = useState<TemplateTask[]>([])
  const [saveAsTemplate,       setSaveAsTemplate]       = useState(false)
  const [loadingOrgTemplate,   setLoadingOrgTemplate]   = useState<string | null>(null)
  const [addingClient,         setAddingClient]         = useState(false)
  const [newClientName,        setNewClientName]        = useState('')
  const [addingClientLoading,  setAddingClientLoading]  = useState(false)

  async function handleOrgTemplateClick(tmpl: { id: string; name: string; template_tasks: any[] }) {
    const key = `org_${tmpl.id}`
    if (selectedTemplate === key) {
      setSelectedTemplate(null)
      setTemplateTasksPreview([])
      return
    }
    setSelectedTemplate(key)
    setLoadingOrgTemplate(tmpl.id)
    try {
      const res = await fetch(`/api/tasks?project_id=${tmpl.id}&limit=500`)
      if (res.ok) {
        const json = await res.json()
        const allTasks: any[] = json.data ?? json ?? []
        const parents = allTasks.filter((t: any) => !t.parent_task_id)
        const children = allTasks.filter((t: any) => !!t.parent_task_id)
        const tasks: TemplateTask[] = parents.map((p: any) => ({
          title: p.title,
          priority: p.priority ?? 'medium',
          subtasks: children.filter((c: any) => c.parent_task_id === p.id).map((c: any) => c.title),
        }))
        // Fall back to stored template_tasks if live fetch returns nothing
        setTemplateTasksPreview(tasks.length > 0 ? tasks : (tmpl.template_tasks ?? []))
      } else {
        setTemplateTasksPreview(tmpl.template_tasks ?? [])
      }
    } catch {
      setTemplateTasksPreview(tmpl.template_tasks ?? [])
    } finally {
      setLoadingOrgTemplate(null)
    }
    if (!name) setName(tmpl.name)
  }

  async function handleAddClient() {
    if (!newClientName.trim()) return
    setAddingClientLoading(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClientName.trim(), status: 'active' }),
      })
      const data = await res.json()
      if (res.ok && data.data?.id) {
        const newClient = { id: data.data.id, name: data.data.name, color: data.data.color ?? '#94a3b8' }
        setClients(prev => [...prev, newClient])
        setClientId(newClient.id)
        setAddingClient(false)
        setNewClientName('')
        toast.success('Client added!')
      }
    } catch {} finally { setAddingClientLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Project name is required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), description: description || null, color,
          client_id: clientId || null, owner_id: ownerId || null,
          due_date: dueDate || null,
          budget: budget ? parseFloat(budget) : null,
          hours_budget: hoursBudget ? parseFloat(hoursBudget) : null,
          template_tasks: templateTasksPreview.length > 0 ? templateTasksPreview : undefined,
          member_ids: memberIds.length > 0 ? memberIds : null,
          is_template: saveAsTemplate,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      toast.success('Project created!')
      router.push(`/projects/${data.data.id}`)
    } catch { setError('Network error') } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* ── Template picker — single horizontal scrollable row ── */}
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Start from a template</label>
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <div style={{ display: 'flex', gap: 10, minWidth: 'max-content' }}>
            {Object.entries(PROJECT_TEMPLATES).map(([tName, tData]) => (
              <button
                key={tName}
                type="button"
                onClick={() => {
                  const same = selectedTemplate === tName
                  setSelectedTemplate(same ? null : tName)
                  setTemplateTasksPreview(same ? [] : tData.tasks)
                  if (!name && !same && tName !== 'Blank project') setName(tName)
                }}
                style={{
                  width: 154, flexShrink: 0, padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                  border: selectedTemplate === tName ? `2px solid ${tData.color}` : '1.5px solid var(--border)',
                  background: selectedTemplate === tName ? `${tData.color}18` : 'var(--surface-subtle)',
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  boxShadow: selectedTemplate === tName ? `0 4px 14px ${tData.color}25` : 'none',
                }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: tData.color, marginBottom: 6, flexShrink: 0 }}/>
                <div style={{ fontSize: 11, fontWeight: 700, color: selectedTemplate === tName ? tData.color : 'var(--text-primary)', marginBottom: 3, lineHeight: 1.3 }}>{tName}</div>
                {tData.tasks.length > 0
                  ? <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{tData.tasks.length} tasks · {tData.tasks.reduce((n, t) => n + (t.subtasks?.length ?? 0), 0)} subtasks</div>
                  : <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Start blank</div>
                }
              </button>
            ))}
            {orgTemplates.length > 0 && (
              <>
                <div style={{ width: 1, background: 'var(--border)', flexShrink: 0, alignSelf: 'stretch', margin: '0 4px' }} />
                {orgTemplates.map(tmpl => {
                  const isSelected = selectedTemplate === `org_${tmpl.id}`
                  const isLoading = loadingOrgTemplate === tmpl.id
                  return (
                    <button key={tmpl.id} type="button"
                      onClick={() => handleOrgTemplateClick(tmpl)}
                      disabled={isLoading}
                      style={{
                        width: 154, flexShrink: 0, padding: '12px 14px', borderRadius: 12, textAlign: 'left',
                        border: isSelected ? '2px solid #0d9488' : '1.5px solid var(--border)',
                        background: isSelected ? 'rgba(13,148,136,0.12)' : 'var(--surface-subtle)',
                        cursor: isLoading ? 'wait' : 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                        opacity: isLoading ? 0.7 : 1,
                      }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: isSelected ? '#0d9488' : 'var(--text-muted)', marginBottom: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isLoading && <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>…</span>}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', marginBottom: 2 }}>ORG TEMPLATE</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? '#0d9488' : 'var(--text-primary)', marginBottom: 3, lineHeight: 1.3 }}>{tmpl.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {isLoading ? 'Loading…' : isSelected ? `${templateTasksPreview.length} tasks` : 'Click to load tasks'}
                      </div>
                    </button>
                  )
                })}
              </>
            )}
          </div>
        </div>
        {selectedTemplate && selectedTemplate !== 'Blank project' && templateTasksPreview.length > 0 && (
          <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', marginBottom: 6 }}>
              Will auto-create {templateTasksPreview.length} tasks · {templateTasksPreview.reduce((n, t) => n + (t.subtasks?.length ?? 0), 0)} subtasks
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {templateTasksPreview.slice(0, 6).map((t, i) => (
                <span key={i} style={{ fontSize: 10, background: 'var(--surface)', color: 'var(--text-primary)', padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(13,148,136,0.2)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  {t.title}{t.subtasks?.length ? <span style={{ color: '#0d9488', fontWeight: 700 }}>+{t.subtasks.length}</span> : null}
                </span>
              ))}
              {templateTasksPreview.length > 6 && <span style={{ fontSize: 10, color: '#0d9488', fontWeight: 600 }}>+{templateTasksPreview.length - 6} more</span>}
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Project name *</label>
        <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="e.g. Website redesign"/>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="input resize-none" placeholder="What is this project about?"/>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Project colour</label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className="h-7 w-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
              style={{ background: c }}>
              {color === c && <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3"><path d="M13 4L6.5 11 3 7.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Client</label>
          {!addingClient ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className="input" style={{ flex: 1 }}>
                <option value="">No client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button type="button" onClick={() => setAddingClient(true)}
                style={{ padding: '0 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fafafa', cursor: 'pointer', fontSize: 13, color: '#0d9488', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                + New
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <input autoFocus value={newClientName} onChange={e => setNewClientName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddClient() } if (e.key === 'Escape') { setAddingClient(false); setNewClientName('') } }}
                className="input" style={{ flex: 1 }} placeholder="New client name" />
              <button type="button" onClick={handleAddClient} disabled={addingClientLoading}
                style={{ padding: '0 12px', borderRadius: 8, border: 'none', background: '#0d9488', cursor: 'pointer', fontSize: 13, color: '#fff', fontWeight: 600, fontFamily: 'inherit' }}>
                {addingClientLoading ? '…' : 'Add'}
              </button>
              <button type="button" onClick={() => { setAddingClient(false); setNewClientName('') }}
                style={{ padding: '0 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fafafa', cursor: 'pointer', fontSize: 13, color: '#6b7280', fontFamily: 'inherit' }}>
                ✕
              </button>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Project owner</label>
          <select value={ownerId} onChange={e => setOwnerId(e.target.value)} className="input">
            <option value="">Select owner</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {/* Team members — who can see this project */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Visible to members
          <span className="ml-1.5 text-xs font-normal text-gray-400">(leave empty = whole org)</span>
        </label>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fafafa', minHeight:44 }}>
          {members.map(m => {
            const selected = memberIds.includes(m.id)
            return (
              <button key={m.id} type="button"
                onClick={() => setMemberIds(p => selected ? p.filter(id => id !== m.id) : [...p, m.id])}
                style={{
                  display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20,
                  border: selected ? '1.5px solid #0d9488' : '1.5px solid #e5e7eb',
                  background: selected ? 'rgba(13,148,136,0.1)' : '#fff',
                  cursor:'pointer', fontSize:12, fontWeight: selected ? 600 : 400,
                  color: selected ? '#0d9488' : '#6b7280', transition:'all 0.12s', fontFamily:'inherit',
                }}>
                <div style={{ width:18, height:18, borderRadius:'50%', background:selected?'#0d9488':'#e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', color:selected?'#fff':'#6b7280', fontSize:9, fontWeight:700, flexShrink:0 }}>
                  {m.name[0]?.toUpperCase()}
                </div>
                {m.name}
                {selected && <span style={{ fontSize:10 }}>✓</span>}
              </button>
            )
          })}
          {members.length === 0 && <span style={{ fontSize:12, color:'#9ca3af' }}>No team members yet</span>}
        </div>
        {memberIds.length > 0 && (
          <p style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>
            {memberIds.length} member{memberIds.length > 1 ? 's' : ''} selected — only they (and admins/owners) will see this project
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Due date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Budget (₹)</label>
          <input type="number" value={budget} onChange={e => setBudget(e.target.value)} className="input" placeholder="0"/>
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
        <input type="checkbox" checked={saveAsTemplate} onChange={e => setSaveAsTemplate(e.target.checked)}
          style={{ width: 15, height: 15, accentColor: '#0d9488' }} />
        Save this project as a reusable template for your organisation
      </label>

      <button type="submit" disabled={saving}
        className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-60">
        {saving ? 'Creating…' : selectedTemplate && selectedTemplate !== 'Blank project' ? `Create project with ${templateTasksPreview.length} tasks →` : 'Create project'}
      </button>
    </form>
  )
}