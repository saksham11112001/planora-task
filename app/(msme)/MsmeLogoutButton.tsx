'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter }    from 'next/navigation'
import { useState }     from 'react'

export default function MsmeLogoutButton() {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login?redirect=/msme')
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'none', border: '1px solid #e2e8f0',
        borderRadius: 8, padding: '6px 12px',
        fontSize: 13, fontWeight: 600, color: '#64748b',
        cursor: loading ? 'default' : 'pointer',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      {loading ? 'Signing out…' : 'Logout'}
    </button>
  )
}
