'use client'
import { WalkthroughOverlay } from '@/components/walkthrough/WalkthroughOverlay'
import { BookOpen } from 'lucide-react'

interface Props {
  userId:          string
  userCreatedAt:   string
  tourCompletedAt: string | null
}

export function WalkthroughPageClient({ userId, userCreatedAt, tourCompletedAt }: Props) {
  return (
    <div style={{
      minHeight: '100%',
      background: 'linear-gradient(135deg, #f0fdf9 0%, #f8fafc 40%, #f5f3ff 100%)',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── Page header ── */}
      <div style={{
        padding: '24px 32px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'linear-gradient(135deg, #0d9488, #0891b2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(13,148,136,0.3)',
        }}>
          <BookOpen size={18} color="#fff"/>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
            Onboarding Tour
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            Learn how to get the most out of Planora — step by step
          </p>
        </div>
      </div>

      {/* ── Tour card ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '24px 32px 32px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 900,
          borderRadius: 24,
          background: '#fff',
          overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid rgba(0,0,0,0.06)',
        }}>
          <WalkthroughOverlay
            userId={userId}
            userCreatedAt={userCreatedAt}
            tourCompletedAt={tourCompletedAt}
            standalone
          />
        </div>
      </div>

    </div>
  )
}
