'use client'
import { useState } from 'react'
import { Plus, X, GripVertical, Hash, Calendar, AlignLeft, List } from 'lucide-react'
import { toast } from '@/store/appStore'

type FieldType = 'text' | 'date' | 'number' | 'textarea' | 'select'
interface FieldDef { key: string; label: string; type: FieldType; placeholder?: string; options?: string }

const TYPE_OPTIONS: { v: FieldType; label: string; icon: any; desc: string }[] = [
  { v:'text',     label:'Short text',  icon:Hash,       desc:'Single line text' },
  { v:'date',     label:'Date',        icon:Calendar,   desc:'Date picker' },
  { v:'number',   label:'Number',      desc:'Numeric value', icon:Hash },
  { v:'textarea', label:'Long text',   icon:AlignLeft,  desc:'Multi-line text' },
  { v:'select',   label:'Dropdown',    icon:List,       desc:'Pick from options' },
]

// Pre-built templates inspired by the screenshot
const TEMPLATES: FieldDef[] = [
  { key:'case_number',      label:'Case Number',       type:'text',     placeholder:'e.g. ITO/123/2024' },
  { key:'filing_date',      label:'Filing Date',       type:'date',     placeholder:'' },
  { key:'next_due_date',    label:'Next Due Date',     type:'date',     placeholder:'' },
  { key:'last_inspection',  label:'Last Inspection Date', type:'date',  placeholder:'' },
  { key:'hearing_dates',    label:'Hearing Dates',     type:'textarea', placeholder:'e.g. 2024-03-15, 2024-04-20' },
  { key:'officer_details',  label:'Officer Details',   type:'textarea', placeholder:'Name, Designation, Contact' },
  { key:'amount',           label:'Amount ($)',        type:'number',   placeholder:'0' },
  { key:'assessment_year',  label:'Assessment Year',   type:'text',     placeholder:'2023-24' },
  { key:'remarks',          label:'Remarks',           type:'textarea', placeholder:'Additional notes…' },
]

export function CustomFieldsSettingsForm({ orgId, initial }: { orgId: string; initial: FieldDef[] }) {
  const [fields,  setFields]  = useState<FieldDef[]>(initial)
  const [saving,  setSaving]  = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType,  setNewType]  = useState<FieldType>('text')

  function addFromTemplate(t: FieldDef) {
    if (fields.find(f => f.key === t.key)) { toast.info('Field already added'); return }
    setFields(p => [...p, t])
  }

  function addCustom() {
    if (!newLabel.trim()) return
    const key = newLabel.trim().toLowerCase().replace(/[^a-z0-9]/g,'_')
    if (fields.find(f => f.key === key)) { toast.info('Field with this name already exists'); return }
    setFields(p => [...p, { key, label: newLabel.trim(), type: newType }])
    setNewLabel('')
  }

  function remove(key: string) { setFields(p => p.filter(f => f.key !== key)) }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/custom-fields', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, custom_task_fields: fields }),
      })
      if (res.ok) toast.success('Custom fields saved ✓')
      else toast.error('Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <div>
      {/* Templates */}
      <div style={{ marginBottom:24 }}>
        <p style={{ fontSize:12,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10 }}>
          Quick add from templates
        </p>
        <div style={{ display:'flex',flexWrap:'wrap',gap:7 }}>
          {TEMPLATES.map(t => (
            <button key={t.key} onClick={()=>addFromTemplate(t)}
              disabled={!!fields.find(f=>f.key===t.key)}
              style={{ padding:'5px 12px',borderRadius:7,border:'1px solid var(--border)',
                background: fields.find(f=>f.key===t.key)?'var(--border-light)':'var(--surface)',
                color: fields.find(f=>f.key===t.key)?'var(--text-muted)':'var(--text-primary)',
                fontSize:12,cursor: fields.find(f=>f.key===t.key)?'default':'pointer',
                fontFamily:'inherit',display:'flex',alignItems:'center',gap:5 }}>
              <Plus style={{ width:10,height:10 }}/>{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Current fields */}
      <div style={{ marginBottom:20 }}>
        <p style={{ fontSize:12,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10 }}>
          Active fields ({fields.length})
        </p>
        {fields.length===0 ? (
          <div style={{ padding:'20px',textAlign:'center',borderRadius:10,border:'1px dashed var(--border)',color:'var(--text-muted)',fontSize:13 }}>
            No custom fields yet — add from templates or create your own below
          </div>
        ) : (
          <div style={{ border:'1px solid var(--border)',borderRadius:12,overflow:'hidden' }}>
            {fields.map((f,i) => {
              const TypeIcon = TYPE_OPTIONS.find(t=>t.v===f.type)?.icon ?? Hash
              return (
                <div key={f.key} style={{ display:'flex',alignItems:'center',gap:10,padding:'11px 14px',
                  borderBottom:i<fields.length-1?'1px solid var(--border-light)':'none',
                  background:'var(--surface)' }}>
                  <GripVertical style={{ width:14,height:14,color:'var(--text-muted)',flexShrink:0 }}/>
                  <div style={{ width:28,height:28,borderRadius:7,background:'var(--surface-subtle)',
                    display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                    <TypeIcon style={{ width:12,height:12,color:'var(--text-muted)' }}/>
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <p style={{ fontSize:13,fontWeight:500,color:'var(--text-primary)',margin:0 }}>{f.label}</p>
                    <p style={{ fontSize:11,color:'var(--text-muted)',margin:0 }}>
                      {TYPE_OPTIONS.find(t=>t.v===f.type)?.label} · key: {f.key}
                    </p>
                  </div>
                  <button onClick={()=>remove(f.key)} style={{ background:'none',border:'none',cursor:'pointer',
                    color:'var(--text-muted)',display:'flex',padding:4,borderRadius:5,transition:'all 0.1s' }}
                    onMouseEnter={e=>{(e.currentTarget as any).style.background='#fef2f2';(e.currentTarget as any).style.color='#dc2626'}}
                    onMouseLeave={e=>{(e.currentTarget as any).style.background='transparent';(e.currentTarget as any).style.color='var(--text-muted)'}}>
                    <X style={{ width:13,height:13 }}/>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add custom field */}
      <div style={{ padding:'14px',borderRadius:10,background:'var(--surface-subtle)',border:'1px solid var(--border)',marginBottom:20 }}>
        <p style={{ fontSize:12,fontWeight:600,color:'var(--text-secondary)',marginBottom:10 }}>Add custom field</p>
        <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
          <input value={newLabel} onChange={e=>setNewLabel(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&addCustom()}
            placeholder="Field label e.g. Case Number"
            style={{ flex:2,minWidth:160,padding:'8px 12px',borderRadius:8,border:'1.5px solid var(--border)',
              outline:'none',fontSize:13,background:'var(--surface)',color:'var(--text-primary)',fontFamily:'inherit' }}
            onFocus={e=>e.target.style.borderColor='var(--brand)'}
            onBlur={e=>e.target.style.borderColor='var(--border)'}/>
          <select value={newType} onChange={e=>setNewType(e.target.value as FieldType)}
            style={{ flex:1,minWidth:120,padding:'8px 12px',borderRadius:8,border:'1.5px solid var(--border)',
              outline:'none',fontSize:13,background:'var(--surface)',color:'var(--text-primary)',fontFamily:'inherit' }}>
            {TYPE_OPTIONS.map(t=><option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
          <button onClick={addCustom} disabled={!newLabel.trim()}
            style={{ padding:'8px 16px',borderRadius:8,border:'none',
              background:newLabel.trim()?'var(--brand)':'var(--border)',color:'#fff',
              fontSize:13,fontWeight:600,cursor:newLabel.trim()?'pointer':'not-allowed',fontFamily:'inherit',
              display:'flex',alignItems:'center',gap:5 }}>
            <Plus style={{ width:13,height:13 }}/> Add
          </button>
        </div>
      </div>

      {/* Field-type reference */}
      <div style={{ padding:'14px 16px',borderRadius:10,background:'rgba(13,148,136,0.06)',
        border:'1px solid rgba(13,148,136,0.18)',marginBottom:20 }}>
        <p style={{ fontSize:11,fontWeight:700,color:'var(--brand)',textTransform:'uppercase',
          letterSpacing:'0.06em',margin:'0 0 10px' }}>Field type guide</p>
        <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
          {[
            { type:'Short text',  example:'Case Number → "ITO/123/2024", PAN → "ABCDE1234F"' },
            { type:'Long text',   example:'Officer Details → "Name, Designation, Room No."' },
            { type:'Date',        example:'Filing Date → date picker; Hearing Date → date picker' },
            { type:'Number',      example:'Amount ($) → "150000"; Tax Rate → "18"' },
            { type:'Dropdown',    example:'Stage → "Draft / Review / Filed"; Quarter → "Q1 / Q2 / Q3 / Q4"' },
          ].map(({ type, example }) => (
            <div key={type} style={{ display:'flex',gap:8,alignItems:'flex-start' }}>
              <span style={{ fontSize:11,fontWeight:600,color:'var(--brand)',
                minWidth:72,flexShrink:0,paddingTop:1 }}>{type}</span>
              <span style={{ fontSize:11,color:'var(--text-muted)',lineHeight:1.5 }}>{example}</span>
            </div>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving}
        style={{ padding:'10px 24px',borderRadius:8,border:'none',background:'var(--brand)',color:'#fff',
          fontSize:14,fontWeight:600,cursor:saving?'not-allowed':'pointer',opacity:saving?0.7:1,fontFamily:'inherit' }}>
        {saving?'Saving…':'Save custom fields'}
      </button>
    </div>
  )
}
