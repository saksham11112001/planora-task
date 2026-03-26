'use client'
import { useState } from 'react'
import { X, Plus, Building2 } from 'lucide-react'
import { toast } from '@/store/appStore'

const COLORS = ['#0d9488','#7c3aed','#0891b2','#ea580c','#16a34a','#db2777','#ca8a04','#6366f1']

interface Props {
  onClose: () => void
  onCreated: (client: { id: string; name: string; color: string }) => void
}

export function QuickAddClientModal({ onClose, onCreated }: Props) {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [company, setCompany] = useState('')
  const [color, setColor]     = useState(COLORS[0])
  const [saving, setSaving]   = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email||null, company: company||null, color, status: 'active' }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'Failed'); return }
      toast.success(`"${name}" created ✓`)
      onCreated(d.data)
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:10000,
      display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
      onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div style={{ background:'var(--surface)',borderRadius:16,padding:'24px',
        width:'100%',maxWidth:400,boxShadow:'0 24px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18 }}>
          <div style={{ display:'flex',alignItems:'center',gap:10 }}>
            <div style={{ width:34,height:34,borderRadius:9,background:color+'20',
              display:'flex',alignItems:'center',justifyContent:'center' }}>
              <Building2 style={{ width:15,height:15,color }}/>
            </div>
            <div>
              <h3 style={{ fontSize:14,fontWeight:700,color:'var(--text-primary)',margin:0 }}>Add new client</h3>
              <p style={{ fontSize:11,color:'var(--text-muted)',margin:0 }}>Quick create — edit details later</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:2 }}>
            <X style={{ width:15,height:15 }}/>
          </button>
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
          <div>
            <label style={{ fontSize:11,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em' }}>Name *</label>
            <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()}
              placeholder="e.g. Acme Corp" autoFocus
              style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:'1.5px solid var(--border)',outline:'none',fontSize:13,background:'var(--surface)',color:'var(--text-primary)',fontFamily:'inherit' }}
              onFocus={e=>e.target.style.borderColor='var(--brand)'}
              onBlur={e=>e.target.style.borderColor='var(--border)'}/>
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
            <div>
              <label style={{ fontSize:11,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em' }}>Email</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="contact@client.com"
                style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:'1.5px solid var(--border)',outline:'none',fontSize:12,background:'var(--surface)',color:'var(--text-primary)',fontFamily:'inherit' }}
                onFocus={e=>e.target.style.borderColor='var(--brand)'}
                onBlur={e=>e.target.style.borderColor='var(--border)'}/>
            </div>
            <div>
              <label style={{ fontSize:11,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em' }}>Company</label>
              <input value={company} onChange={e=>setCompany(e.target.value)} placeholder="Company Ltd"
                style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:'1.5px solid var(--border)',outline:'none',fontSize:12,background:'var(--surface)',color:'var(--text-primary)',fontFamily:'inherit' }}
                onFocus={e=>e.target.style.borderColor='var(--brand)'}
                onBlur={e=>e.target.style.borderColor='var(--border)'}/>
            </div>
          </div>
          <div>
            <label style={{ fontSize:11,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em' }}>Colour</label>
            <div style={{ display:'flex',gap:7,flexWrap:'wrap' }}>
              {COLORS.map(c => (
                <button key={c} onClick={()=>setColor(c)} style={{ width:26,height:26,borderRadius:'50%',background:c,border:'none',cursor:'pointer',outline:color===c?`2px solid ${c}`:'2px solid transparent',outlineOffset:2,transition:'all 0.12s',transform:color===c?'scale(1.2)':'scale(1)' }}/>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display:'flex',gap:8,marginTop:18 }}>
          <button onClick={save} disabled={saving||!name.trim()}
            style={{ flex:1,padding:'10px',borderRadius:8,border:'none',background:name.trim()?color:'var(--border)',color:'#fff',fontSize:13,fontWeight:600,cursor:name.trim()?'pointer':'not-allowed',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',gap:6,opacity:saving?0.7:1 }}>
            <Plus style={{ width:13,height:13 }}/>{saving?'Creating…':'Create client'}
          </button>
          <button onClick={onClose} style={{ padding:'10px 14px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text-secondary)',fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
