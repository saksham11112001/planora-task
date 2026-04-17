'use client'
import { useToastStore } from '@/store/appStore'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'

export function ToastContainer() {
  const { toasts, remove } = useToastStore()
  if (!toasts.length) return null

  const cfg = {
    success: { bg: '#f0fdf4', border: '#86efac', color: '#15803d', icon: CheckCircle },
    error:   { bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c', icon: XCircle     },
    info:    { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8', icon: Info         },
    warning: { bg: '#fefce8', border: '#fde047', color: '#a16207', icon: AlertTriangle},
  }

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{ position:'fixed', bottom:20, right:20, zIndex:9999,
        display:'flex', flexDirection:'column', gap:8, pointerEvents:'none' }}>
      {toasts.map(t => {
        const { bg, border, color, icon: Icon } = cfg[t.type as keyof typeof cfg] ?? cfg.info
        return (
          <div key={t.id}
            role="alert"
            aria-live={t.type === 'error' ? 'assertive' : 'polite'}
            style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'11px 14px', borderRadius:10,
              background:bg, border:`1px solid ${border}`,
              boxShadow:'0 4px 20px rgba(0,0,0,0.15)',
              minWidth:240, maxWidth:360,
              pointerEvents:'all',
              animation:'toastIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
            <Icon style={{ width:16, height:16, color, flexShrink:0 }}/>
            <span style={{ flex:1, fontSize:13, fontWeight:500, color, lineHeight:1.4 }}>{t.message}</span>
            <button onClick={() => remove(t.id)}
              aria-label="Dismiss notification"
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