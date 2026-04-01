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
}> = {
  'Restaurant Consultancy': {
    icon: '🍽️', desc: 'Menu review, SOP setup, staff training, compliance audit',
    tasks: [
      { title: 'Initial site visit & assessment', priority: 'high' },
      { title: 'Menu engineering & costing', priority: 'high' },
      { title: 'SOP documentation', priority: 'medium' },
      { title: 'Staff training plan', priority: 'medium' },
      { title: 'FSSAI compliance audit', priority: 'high' },
      { title: 'Marketing & branding review', priority: 'low' },
      { title: 'Final recommendations report', priority: 'high' },
    ],
  },
  'Website Development': {
    icon: '🌐', desc: 'Discovery, design, build, QA, and launch',
    tasks: [
      { title: 'Requirements gathering & discovery', priority: 'high' },
      { title: 'Wireframes & UX design', priority: 'high' },
      { title: 'UI design (desktop + mobile)', priority: 'high' },
      { title: 'Frontend development', priority: 'medium' },
      { title: 'Backend / CMS setup', priority: 'medium' },
      { title: 'Content upload & SEO setup', priority: 'medium' },
      { title: 'QA testing & bug fixes', priority: 'high' },
      { title: 'Launch & handover', priority: 'high' },
    ],
  },
  'Audit Engagement': {
    icon: '📋', desc: 'Statutory audit planning through report issuance',
    tasks: [
      { title: 'Engagement letter & terms', priority: 'high' },
      { title: 'Preliminary assessment & risk analysis', priority: 'high' },
      { title: 'Audit plan preparation', priority: 'medium' },
      { title: 'Fieldwork — vouching & verification', priority: 'high' },
      { title: 'Internal control testing', priority: 'medium' },
      { title: 'Queries & management responses', priority: 'medium' },
      { title: 'Audit report drafting', priority: 'high' },
      { title: 'Partner review & sign-off', priority: 'high' },
    ],
  },
  'Marketing Campaign': {
    icon: '📣', desc: 'Strategy, content, execution, and reporting',
    tasks: [
      { title: 'Campaign brief & objectives', priority: 'high' },
      { title: 'Target audience research', priority: 'medium' },
      { title: 'Content calendar creation', priority: 'high' },
      { title: 'Creative assets (graphics, copy)', priority: 'high' },
      { title: 'Ad setup & targeting', priority: 'medium' },
      { title: 'Campaign launch', priority: 'high' },
      { title: 'Mid-campaign review & optimisation', priority: 'medium' },
      { title: 'Final report & learnings', priority: 'medium' },
    ],
  },
  'Event Management': {
    icon: '🎪', desc: 'Planning, logistics, execution, and post-event review',
    tasks: [
      { title: 'Event concept & brief', priority: 'high' },
      { title: 'Venue finalisation', priority: 'high' },
      { title: 'Vendor bookings (catering, AV, decor)', priority: 'high' },
      { title: 'Guest list & invitations', priority: 'medium' },
      { title: 'Run-of-show document', priority: 'medium' },
      { title: 'Day-of coordination', priority: 'high' },
      { title: 'Post-event feedback & report', priority: 'low' },
    ],
  },
  'Blank project': {
    icon: '⬜', desc: 'Start from scratch — no pre-built tasks',
    tasks: [],
  },
}


const COLORS = ['#0d9488','#7c3aed','#dc2626','#ca8a04','#16a34a','#0891b2','#db2777','#ea580c','#4f46e5','#374151']

export function NewProjectForm({ clients, members }: {
  clients: { id: string; name: string; color: string }[]
  members: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [saving,     setSaving]     = useState(false)
  const [name,       setName]       = useState('')
  const [description,setDescription]= useState('')
  const [color,      setColor]      = useState('#0d9488')
  const searchParams = useSearchParams()
  const [clientId,   setClientId]   = useState(searchParams.get('client') ?? '')
  const [ownerId,    setOwnerId]    = useState('')
  const [dueDate,    setDueDate]    = useState('')
  const [budget,     setBudget]     = useState('')
  const [hoursBudget,setHoursBudget]= useState('')
  const [error,      setError]      = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [templateTasksPreview, setTemplateTasksPreview] = useState<{ title: string; priority: string }[]>([])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Project name is required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description || null, color, client_id: clientId || null, owner_id: ownerId || null, due_date: dueDate || null, budget: budget ? parseFloat(budget) : null, hours_budget: hoursBudget ? parseFloat(hoursBudget) : null, template_tasks: templateTasksPreview.length > 0 ? templateTasksPreview : undefined }),
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

      {/* Template picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Start from a template</label>
        {/* Group by industry */}
        {Array.from(new Set(Object.values(PROJECT_TEMPLATES).map((t: any) => t.industry))).map(industry => (
          <div key={industry} style={{ marginBottom:12 }}>
            <p style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{industry}</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(155px, 1fr))', gap:8 }}>
              {Object.entries(PROJECT_TEMPLATES).filter(([,td]: any) => td.industry === industry).map(([tName, tData]: any) => (
                <button
                  key={tName}
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(tName)
                    setTemplateTasksPreview(tData.tasks as any)
                    if (!name) setName(tName === 'Blank project' ? '' : tName)
                  }}
                  style={{
                    padding:'12px', borderRadius:10,
                    border: selectedTemplate === tName ? `2px solid ${tData.color}` : '1px solid #e5e7eb',
                    background: selectedTemplate === tName ? `${tData.color}12` : '#fafafa',
                    cursor:'pointer', textAlign:'left', transition:'all 0.15s', fontFamily:'inherit',
                  }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>{tData.icon}</div>
                  <div style={{ fontSize:11, fontWeight:700, color: selectedTemplate === tName ? tData.color : '#374151', marginBottom:2 }}>{tName}</div>
                  <div style={{ fontSize:10, color:'#9ca3af', lineHeight:1.4 }}>{tData.desc}</div>
                  {tData.tasks.length > 0 && (
                    <div style={{ marginTop:6, fontSize:10, color: selectedTemplate === tName ? tData.color : '#94a3b8', fontWeight:600 }}>
                      {tData.tasks.length} tasks · {tData.tasks.reduce((n: number, t: any) => n + (t.subtasks?.length ?? 0), 0)} subtasks
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
        {templateTasksPreview.length > 0 && (
          <div style={{ marginTop:4, padding:'12px 14px', borderRadius:10, background:'#f0fdfa', border:'1px solid #99f6e4' }}>
            <p style={{ fontSize:11, fontWeight:700, color:'#0d9488', marginBottom:8 }}>
              Will create {templateTasksPreview.length} tasks with {(templateTasksPreview as any[]).reduce((n: number, t: any) => n + (t.subtasks?.length ?? 0), 0)} subtasks automatically
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {(templateTasksPreview as any[]).slice(0, 5).map((t: any, i: number) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:11, color:'#374151', fontWeight:500 }}>• {t.title}</span>
                  {t.subtasks?.length > 0 && (
                    <span style={{ fontSize:10, color:'#0d9488' }}>({t.subtasks.length} subtasks)</span>
                  )}
                </div>
              ))}
              {templateTasksPreview.length > 5 && (
                <span style={{ fontSize:10, color:'#0d9488', fontWeight:600 }}>+{templateTasksPreview.length - 5} more tasks</span>
              )}
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
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="input resize-none" placeholder="What is this project about?"/>
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
          <select value={clientId} onChange={e => setClientId(e.target.value)} className="input">
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Project owner</label>
          <select value={ownerId} onChange={e => setOwnerId(e.target.value)} className="input">
            <option value="">Select owner</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Due date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Budget (₹)</label>
          <input type="number" value={budget} onChange={e => setBudget(e.target.value)} className="input" placeholder="0"/>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Hours budget</label>
          <input type="number" value={hoursBudget} onChange={e => setHoursBudget(e.target.value)} className="input" placeholder="0"/>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={saving} className="btn btn-brand flex-1">
          {saving ? 'Creating...' : 'Create project'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn btn-outline">Cancel</button>
      </div>
    </form>
  )
}
