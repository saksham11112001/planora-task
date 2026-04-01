'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from '@/store/appStore'

export function DeleteAccountButton({ userId, orgId, isOwner }: { userId: string; orgId: string; isOwner: boolean }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [input,   setInput]   = useState('')
  const [deleting, setDeleting] = useState(false)

  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
          borderRadius: 8, border: '1px solid #fecaca', background: 'var(--surface)',
          color: '#b91c1c', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as any).style.background = '#fef2f2' }}
        onMouseLeave={e => { (e.currentTarget as any).style.background = '#fff' }}>
        <Trash2 style={{ width: 14, height: 14 }}/> Delete account
      </button>
    )
  }

  return (
    <div style={{ width: '100%', marginTop: 12, padding: '14px', borderRadius: 10,
      background: 'var(--surface)', border: '1px solid #fecaca' }}>
      <p style={{ fontSize: 13, color: '#b91c1c', marginBottom: 10, fontWeight: 500 }}>
        {isOwner
          ? 'This will delete your account AND the entire organisation including all tasks, projects, clients, and team data.'
          : 'This will remove you from the organisation and delete your personal account data.'}
        {' '}Type <strong>DELETE</strong> to confirm.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          placeholder="Type DELETE to confirm"
          style={{ flex: 1, padding: '8px 12px', borderRadius: 8,
            border: '1.5px solid #fecaca', outline: 'none',
            fontSize: 13, background: 'var(--surface)', color: '#b91c1c',
            fontFamily: 'inherit' }}/>
        <button
          disabled={input !== 'DELETE' || deleting}
          onClick={async () => {
            if (input !== 'DELETE') return
            setDeleting(true)
            try {
              const res = await fetch('/api/account/delete', { method: 'DELETE' })
              if (res.ok) { toast.success('Account deleted'); router.push('/login') }
              else { const d = await res.json(); toast.error(d.error ?? 'Failed'); setDeleting(false) }
            } catch { toast.error('Failed'); setDeleting(false) }
          }}
          style={{ padding: '8px 16px', borderRadius: 8,
            background: input === 'DELETE' ? '#dc2626' : '#fecaca',
            color: '#fff', border: 'none', fontSize: 13, fontWeight: 600,
            cursor: input === 'DELETE' ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', flexShrink: 0 }}>
          {deleting ? 'Deleting…' : 'Confirm delete'}
        </button>
        <button onClick={() => { setConfirm(false); setInput('') }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
