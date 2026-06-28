'use client'
import { useSearchParams } from 'next/navigation'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://upfloat.co'

const ACTION_LABELS: Record<string, string> = {
  complete:   'Mark Complete',
  submit:     'Submit for Approval',
  approve:    'Approve',
  reject:     'Reject',
}

const SUCCESS_MESSAGES: Record<string, { title: string; body: string; icon: string }> = {
  complete: { icon: '✅', title: 'Task marked complete!',          body: 'The task has been completed successfully.' },
  submit:   { icon: '📤', title: 'Submitted for approval!',        body: 'The task is now waiting for your manager\'s review.' },
  approve:  { icon: '✅', title: 'Task approved!',                  body: 'The task has been approved and marked complete. The assignee has been notified.' },
  reject:   { icon: '↩️', title: 'Task returned to assignee.',     body: 'The task has been rejected. You can add a reason by opening it in the app.' },
}

export default function TaskActionResult() {
  const params     = useSearchParams()
  const status     = params.get('status') ?? 'error'
  const action     = params.get('action') ?? ''
  const taskTitle  = params.get('task')   ?? ''

  const isSuccess    = status === 'success'
  const isAlreadyDone = status === 'already_done'
  const isError      = status === 'error'

  const msg = SUCCESS_MESSAGES[action]

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: '24px 16px',
    }}>
      <div style={{
        maxWidth: 480, width: '100%', background: '#fff',
        borderRadius: 16, border: '1px solid #e2e8f0',
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)', padding: '40px 32px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>
          {isSuccess ? (msg?.icon ?? '✅') : isAlreadyDone ? '🔁' : '⚠️'}
        </div>

        <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#0f172a' }}>
          {isSuccess    ? (msg?.title ?? 'Done!')
          : isAlreadyDone ? 'Already done'
          : 'Something went wrong'}
        </h1>

        {taskTitle && (
          <div style={{
            margin: '16px 0', padding: '12px 16px',
            background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8,
            fontSize: 14, color: '#0f172a', fontWeight: 600,
          }}>
            {taskTitle}
          </div>
        )}

        <p style={{ margin: '0 0 28px', fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
          {isSuccess    ? (msg?.body ?? 'Action completed.')
          : isAlreadyDone ? `This task has already been ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'updated'}. No changes were made.`
          : 'The link may have expired or you may not have permission to take this action. Please open the app to continue.'}
        </p>

        <a
          href={APP_URL}
          style={{
            display: 'inline-block', background: '#0d9488', color: '#fff',
            textDecoration: 'none', padding: '12px 28px', borderRadius: 8,
            fontSize: 14, fontWeight: 600,
          }}
        >
          Open upFloat →
        </a>

        {action === 'reject' && isSuccess && (
          <p style={{ marginTop: 20, fontSize: 12, color: '#94a3b8' }}>
            Want to add a rejection reason? Open the task in the app.
          </p>
        )}
      </div>
    </div>
  )
}
