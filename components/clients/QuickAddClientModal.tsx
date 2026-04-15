'use client'
import { useState } from 'react'
import { X, Plus, Building2, ShieldCheck, Loader2 } from 'lucide-react'
import { toast } from '@/store/appStore'

const COLORS = ['#0d9488','#7c3aed','#0891b2','#ea580c','#16a34a','#db2777','#ca8a04','#6366f1']

interface Props {
  onClose: () => void
  onCreated: (client: { id: string; name: string; color: string }) => void
}

export function QuickAddClientModal({ onClose, onCreated }: Props) {
  const [gstin,      setGstin]      = useState('')
  const [gstLooking, setGstLooking] = useState(false)
  const [gstInfo,    setGstInfo]    = useState<{ pan?: string; state?: string; gst_status?: string | null } | null>(null)

  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [company, setCompany] = useState('')
  const [color,   setColor]   = useState(COLORS[0])
  const [saving,  setSaving]  = useState(false)

  async function lookupGSTIN(raw: string) {
    const g = raw.trim().toUpperCase()
    if (g.length !== 15) return
    setGstLooking(true)
    setGstInfo(null)
    try {
      const res  = await fetch(`/api/gst/lookup?gstin=${encodeURIComponent(g)}`)
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'GST lookup failed'); return }
      const d = json.data
      if (d.name)    setName(d.name)
      if (d.name)    setCompany(d.name)
      setGstInfo({ pan: d.pan, state: d.state, gst_status: d.gst_status })
      if (!json.partial) toast.success('GST data fetched!')
    } catch {
      toast.error('GST lookup failed')
    } finally {
      setGstLooking(false)
    }
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const gstCustomFields = gstin.trim().length === 15 ? {
        gstin:      gstin.trim().toUpperCase(),
        pan:        gstInfo?.pan ?? null,
        gst_status: gstInfo?.gst_status ?? null,
        gst_state:  gstInfo?.state ?? null,
      } : undefined
      const res = await fetch('/api/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), email: email || null, company: company || null, color, status: 'active',
          ...(gstCustomFields ? { custom_fields: gstCustomFields } : {}),
        }),
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
        width:'100%',maxWidth:420,boxShadow:'0 24px 60px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16 }}>
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

        {/* GSTIN auto-fill */}
        <div style={{ background:'linear-gradient(135deg,#f0fdf4,#ecfdf5)',border:'1px solid #bbf7d0',borderRadius:10,padding:'12px 14px',marginBottom:14 }}>
          <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:8 }}>
            <ShieldCheck style={{ width:13,height:13,color:'#0d9488',flexShrink:0 }}/>
            <span style={{ fontSize:11,fontWeight:700,color:'#065f46' }}>Auto-fill via GSTIN</span>
          </div>
          <div style={{ display:'flex',gap:7 }}>
            <input
              value={gstin}
              onChange={e => {
                const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,15)
                setGstin(v)
                setGstInfo(null)
                if (v.length === 15) lookupGSTIN(v)
              }}
              placeholder="e.g. 27AAGCM1234A1Z5"
              maxLength={15}
              style={{ flex:1,padding:'7px 10px',borderRadius:7,border:gstin.length===15?'1.5px solid #0d9488':'1px solid #d1fae5',fontSize:12,fontFamily:'monospace',letterSpacing:'0.06em',outline:'none',background:'#fff',color:'#065f46',fontWeight:600 }}
            />
            <button
              type="button"
              onClick={() => lookupGSTIN(gstin)}
              disabled={gstin.length !== 15 || gstLooking}
              style={{ padding:'7px 12px',borderRadius:7,border:'none',background:gstin.length===15?'#0d9488':'#d1fae5',color:gstin.length===15?'#fff':'#9ca3af',fontSize:11,fontWeight:600,cursor:gstin.length===15?'pointer':'default',display:'flex',alignItems:'center',gap:4,flexShrink:0,fontFamily:'inherit' }}>
              {gstLooking?<><Loader2 style={{ width:11,height:11,animation:'spin 0.7s linear infinite' }}/>…</>:'Fetch'}
            </button>
          </div>
          {gstInfo && (
            <div style={{ display:'flex',flexWrap:'wrap',gap:5,marginTop:8 }}>
              {gstInfo.pan && <span style={{ fontSize:10,padding:'2px 7px',borderRadius:5,background:'#fff',border:'1px solid #d1fae5',color:'#065f46',fontWeight:600,fontFamily:'monospace' }}>{gstInfo.pan}</span>}
              {gstInfo.state && <span style={{ fontSize:10,padding:'2px 7px',borderRadius:5,background:'#fff',border:'1px solid #d1fae5',color:'#065f46',fontWeight:600 }}>📍 {gstInfo.state}</span>}
              {gstInfo.gst_status && (
                <span style={{ fontSize:10,padding:'2px 7px',borderRadius:5,fontWeight:700,
                  background:gstInfo.gst_status.toLowerCase()==='active'?'#f0fdf4':'#fef2f2',
                  color:gstInfo.gst_status.toLowerCase()==='active'?'#16a34a':'#dc2626',
                  border:`1px solid ${gstInfo.gst_status.toLowerCase()==='active'?'#bbf7d0':'#fecaca'}` }}>
                  {gstInfo.gst_status}
                </span>
              )}
            </div>
          )}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        {/* Fields */}
        <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
          <div>
            <label style={{ fontSize:11,fontWeight:600,color:'var(--text-secondary)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.05em' }}>Name *</label>
            <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()}
              placeholder="e.g. Acme Corp"
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
