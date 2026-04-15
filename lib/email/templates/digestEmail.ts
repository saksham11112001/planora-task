const EVENT_LABELS: Record<string, string> = {
  task_assigned:        '📋 Task Assigned',
  approval_requested:   '🔔 Approval Needed',
  approval_completed:   '✅ Approval Result',
  task_commented:       '💬 New Comment',
  project_updated:      '📁 Project Update',
  member_invited:       '👋 New Team Member',
  due_soon:             '⏰ Due Soon',
  escalation:           '🚨 Overdue Alert',
}

interface DigestItem {
  eventType: string
  subject:   string
  createdAt: string
}

export function digestEmailHtml(p: {
  recipientName: string
  orgName:       string
  slot:          'morning' | 'evening'
  items:         DigestItem[]
  appUrl:        string
}): string {
  const slotLabel = p.slot === 'morning' ? 'Morning (8 AM IST)' : 'Evening (6 PM IST)'

  // Group items by event type
  const groups: Record<string, DigestItem[]> = {}
  for (const item of p.items) {
    if (!groups[item.eventType]) groups[item.eventType] = []
    groups[item.eventType].push(item)
  }

  const groupHtml = Object.entries(groups).map(([type, items]) => `
    <div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0;">
        ${EVENT_LABELS[type] ?? type.replace(/_/g,' ')}
        <span style="font-weight:400;margin-left:6px;color:#94a3b8;">(${items.length})</span>
      </div>
      ${items.map(item => `
        <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9;">
          <span style="color:#0d9488;font-size:12px;flex-shrink:0;margin-top:1px;">•</span>
          <span style="font-size:13px;color:#0f172a;line-height:1.4;">${item.subject}</span>
        </div>
      `).join('')}
    </div>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#0d9488;padding:24px 32px;">
      <div style="font-size:20px;font-weight:700;color:#fff;">Taska</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:2px;">Notification Digest · ${slotLabel}</div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="font-size:15px;color:#0f172a;margin:0 0 6px;">Hi ${p.recipientName},</p>
      <p style="font-size:13px;color:#475569;margin:0 0 24px;">
        Here's your notification summary for <strong>${p.orgName}</strong>.
        You have <strong>${p.items.length} update${p.items.length === 1 ? '' : 's'}</strong> since the last digest.
      </p>

      ${groupHtml}

      <div style="margin-top:24px;text-align:center;">
        <a href="${p.appUrl}/dashboard"
          style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 24px;border-radius:8px;">
          Open Taska →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="font-size:11px;color:#94a3b8;margin:0;text-align:center;">
        You're on <strong>Digest mode</strong> — receiving 2 summaries per day instead of individual emails.
        Change this in <a href="${p.appUrl}/settings/notification-frequency" style="color:#0d9488;text-decoration:none;">Settings → Notification frequency</a>.
      </p>
    </div>
  </div>
</body>
</html>`
}
