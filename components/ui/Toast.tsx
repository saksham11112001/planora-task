'use client'
import { useToastStore } from '@/store/appStore'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'

export function ToastContainer() {
  const { toasts, remove } = useToastStore()
  if (!toasts.length) return null

  const cfg = {
    success: { bg: 'rgba(22,163,74,0.1)',    border: 'rgba(22,163,74,0.3)',    color: '#16a34a', icon: CheckCircle },
    error:   { bg: 'rgba(220,38,38,0.1)',    border: 'rgba(220,38,38,0.3)',    color: '#dc2626', icon: XCircle     },
    info:    { bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.3)',   color: '#2563eb', icon: Info         },
    warning: { bg: 'rgba(202,138,4,0.1)',    border: 'rgba(202,138,4,0.3)',    color: '#ca8a04', icon: AlertTriangle},
  }

  return (
    <div style={{ position:'fixed', bottom:20, right:20, zIndex:9999,
      display:'flex', flexDirection:'column', gap:8, pointerEvents:'none' }}>
      {toasts.map(t => {
        const { bg, border, color, icon: Icon } = cfg[t.type as keyof typeof cfg] ?? cfg.info
        return (
          <div key={t.id}
            style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'11px 14px', borderRadius:10,
              background:bg, border:`1px solid ${border}`,
              boxShadow:'0 4px 20px rgba(0,0,0,0.1)',
              minWidth:240, maxWidth:360,
              pointerEvents:'all',
              animation:'toastIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
            <Icon style={{ width:16, height:16, color, flexShrink:0 }}/>
            <span style={{ flex:1, fontSize:13, fontWeight:500, color, lineHeight:1.4 }}>{t.message}</span>
            <button onClick={() => remove(t.id)}
              style={{ background:'none', border:'none', cursor:'pointer', color, opacity:0.6, padding:2,
                display:'flex', alignItems:'center', flexShrink:0 }}>
              <X style={{ width:13, height:13 }}/>
            </button>
          </div>
        )
      })}
      <style dangerouslySetInnerHTML={{ __html: '@keyframes toastIn{from{opacity:0;transform:translateX(16px) scale(0.95)}to{opacity:1;transform:translateX(0) scale(1)}}' }}/>
    </div>
  )
}