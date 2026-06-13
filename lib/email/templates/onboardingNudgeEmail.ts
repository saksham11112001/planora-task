interface OnboardingNudgeProps {
  userName: string
  orgName: string
  appUrl: string
  hasClient:  boolean
  hasTask:    boolean
  hasTeam:    boolean
  hasCa:      boolean
}

interface ChecklistItem {
  done: boolean
  emoji: string
  label: string
  hint: string
  href: string
  cta: string
}

export function onboardingNudgeSubject(p: { userName: string }): string {
  return `${p.userName}, finish setting up your workspace (2 min)`
}

export function onboardingNudgeHtml(p: OnboardingNudgeProps): string {
  const items: ChecklistItem[] = [
    {
      done:  p.hasClient,
      emoji: '👥',
      label: 'Add your first client',
      hint:  'Link tasks and compliance to clients for easy tracking.',
      href:  `${p.appUrl}/clients/new`,
      cta:   'Add client',
    },
    {
      done:  p.hasTask,
      emoji: '✅',
      label: 'Create your first task',
      hint:  'Assign work, set due dates, and track progress.',
      href:  `${p.appUrl}/inbox`,
      cta:   'Add task',
    },
    {
      done:  p.hasTeam,
      emoji: '🤝',
      label: 'Invite a team member',
      hint:  'Bring your team in — assign, approve, and collaborate.',
      href:  `${p.appUrl}/settings/members`,
      cta:   'Invite team',
    },
    {
      done:  p.hasCa,
      emoji: '📋',
      label: 'Enable CA compliance calendar',
      hint:  '69+ statutory tasks auto-scheduled for your clients.',
      href:  `${p.appUrl}/compliance`,
      cta:   'Set up compliance',
    },
  ]

  const doneCount = items.filter(i => i.done).length
  const pct       = Math.round((doneCount / items.length) * 100)

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden">

        <tr><td style="background:#0f172a;padding:24px 32px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#0d9488;border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle">
              <span style="color:#fff;font-size:16px;font-weight:700">F</span>
            </td>
            <td style="padding-left:10px;color:#ffffff;font-size:18px;font-weight:700">Floatup</td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:32px 32px 8px">
          <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#0f172a">
            Your setup is ${pct}% done, ${p.userName}
          </p>
          <p style="margin:0 0 20px;font-size:14px;color:#64748b;line-height:1.6">
            A few quick steps and <strong>${p.orgName}</strong> will be fully ready. Most firms are up in under 5 minutes.
          </p>

          <!-- Progress bar -->
          <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px">
            <tr>
              <td style="height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden">
                <div style="width:${pct}%;height:8px;background:#0d9488;border-radius:99px"></div>
              </td>
            </tr>
            <tr><td style="padding-top:6px;font-size:11px;color:#94a3b8;font-weight:600">
              ${doneCount} of ${items.length} steps complete
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 32px 28px">
          <table cellpadding="0" cellspacing="0" width="100%">
            ${items.map(item => `
            <tr><td style="padding-bottom:10px">
              <table cellpadding="0" cellspacing="0" width="100%"
                style="background:${item.done ? '#f0fdf4' : '#fafafa'};
                       border:1px solid ${item.done ? '#bbf7d0' : '#e2e8f0'};
                       border-radius:10px">
                <tr><td style="padding:14px 18px">
                  <table cellpadding="0" cellspacing="0" width="100%"><tr>
                    <td style="width:32px;font-size:20px;vertical-align:top">${item.done ? '✅' : item.emoji}</td>
                    <td style="padding-left:12px;vertical-align:top">
                      <p style="margin:0;font-size:14px;font-weight:700;
                        color:${item.done ? '#166534' : '#0f172a'};
                        text-decoration:${item.done ? 'line-through' : 'none'}">
                        ${item.label}
                      </p>
                      ${!item.done ? `<p style="margin:3px 0 0;font-size:12px;color:#64748b">${item.hint}</p>` : ''}
                    </td>
                    ${!item.done ? `
                    <td style="width:90px;text-align:right;vertical-align:middle">
                      <a href="${item.href}"
                        style="display:inline-block;padding:6px 14px;background:#0d9488;color:#fff;
                               font-size:11px;font-weight:700;border-radius:7px;text-decoration:none">
                        ${item.cta}
                      </a>
                    </td>` : ''}
                  </tr></table>
                </td></tr>
              </table>
            </td></tr>`).join('')}
          </table>
        </td></tr>

        <tr><td style="padding:16px 32px 28px;border-top:1px solid #f1f5f9">
          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6">
            You're receiving this because you recently signed up for Floatup.
            <a href="${p.appUrl}/settings/notifications" style="color:#0d9488">Unsubscribe</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
