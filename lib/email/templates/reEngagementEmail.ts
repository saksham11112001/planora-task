interface ReEngagementProps {
  userName: string
  orgName: string
  appUrl: string
  daysSince: number
  overdueCount: number
  pendingCount: number
}

export function reEngagementSubject(p: { userName: string; overdueCount: number }): string {
  if (p.overdueCount > 0) return `${p.userName}, you have ${p.overdueCount} overdue task${p.overdueCount > 1 ? 's' : ''} waiting`
  return `${p.userName}, your workspace is waiting for you`
}

export function reEngagementHtml(p: ReEngagementProps): string {
  const urgencyMsg = p.overdueCount > 0
    ? `<strong>${p.overdueCount} task${p.overdueCount > 1 ? 's are' : ' is'} overdue</strong> and ${p.pendingCount > 0 ? `${p.pendingCount} pending approval` : 'your team may be waiting on you'}.`
    : p.pendingCount > 0
    ? `<strong>${p.pendingCount} task${p.pendingCount > 1 ? 's are' : ' is'} waiting for your approval.</strong>`
    : `Your team has been active — check what's new.`

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
            <td style="padding-left:10px;color:#ffffff;font-size:18px;font-weight:700">upFloat</td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:36px 32px 28px">
          <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0f172a">
            Welcome back, ${p.userName} 👋
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6">
            It's been ${p.daysSince} day${p.daysSince > 1 ? 's' : ''} since you last visited <strong>${p.orgName}</strong>.
            ${urgencyMsg}
          </p>

          ${(p.overdueCount > 0 || p.pendingCount > 0) ? `
          <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px">
            ${p.overdueCount > 0 ? `
            <tr><td style="padding-bottom:10px">
              <table cellpadding="0" cellspacing="0" width="100%" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:0">
                <tr><td style="padding:14px 18px">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:20px;width:32px">🔴</td>
                    <td style="padding-left:10px">
                      <p style="margin:0;color:#991b1b;font-size:14px;font-weight:700">${p.overdueCount} Overdue Task${p.overdueCount > 1 ? 's' : ''}</p>
                      <p style="margin:3px 0 0;color:#b91c1c;font-size:12px">Need immediate attention</p>
                    </td>
                  </tr></table>
                </td></tr>
              </table>
            </td></tr>` : ''}
            ${p.pendingCount > 0 ? `
            <tr><td>
              <table cellpadding="0" cellspacing="0" width="100%" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:0">
                <tr><td style="padding:14px 18px">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:20px;width:32px">⏳</td>
                    <td style="padding-left:10px">
                      <p style="margin:0;color:#92400e;font-size:14px;font-weight:700">${p.pendingCount} Pending Approval${p.pendingCount > 1 ? 's' : ''}</p>
                      <p style="margin:3px 0 0;color:#b45309;font-size:12px">Your team is waiting</p>
                    </td>
                  </tr></table>
                </td></tr>
              </table>
            </td></tr>` : ''}
          </table>` : ''}

          <table cellpadding="0" cellspacing="0">
            <tr><td style="background:#0d9488;border-radius:9px;padding:13px 28px">
              <a href="${p.appUrl}/dashboard" style="color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">
                Go to my workspace →
              </a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:16px 32px 28px;border-top:1px solid #f1f5f9">
          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6">
            You're receiving this because you have an account at upFloat.
            <a href="${p.appUrl}/settings/notifications" style="color:#0d9488">Manage notifications</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
