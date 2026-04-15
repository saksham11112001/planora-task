interface MemberProps {
  memberName: string; memberEmail: string; role: string
  invitedBy: string; orgName: string; appUrl: string; recipientName: string
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', admin: 'Admin', manager: 'Manager', member: 'Member', viewer: 'Viewer'
}

export function memberInvitedHtml(p: MemberProps): string {
  const roleLabel = ROLE_LABELS[p.role] ?? p.role
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
        <tr><td style="background:#0f172a;padding:24px 32px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#0d9488;border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle">
              <span style="color:#fff;font-size:16px;font-weight:700">P</span>
            </td>
            <td style="padding-left:10px;color:#ffffff;font-size:18px;font-weight:700">Taska</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700">New team member joined</h1>
          <p style="color:#64748b;font-size:14px;margin:0 0 24px">${p.invitedBy} added a new member to <strong>${p.orgName}</strong></p>
          <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:20px;margin-bottom:24px">
            <table cellpadding="0" cellspacing="0" width="100%"><tr>
              <td style="width:40px;height:40px;border-radius:50%;background:#0d9488;text-align:center;vertical-align:middle;color:#fff;font-size:16px;font-weight:700">${p.memberName.charAt(0).toUpperCase()}</td>
              <td style="padding-left:12px">
                <p style="color:#0f172a;font-size:15px;font-weight:600;margin:0">${p.memberName}</p>
                <p style="color:#64748b;font-size:13px;margin:2px 0 0">${p.memberEmail}</p>
              </td>
              <td align="right"><span style="background:#0d9488;color:#fff;font-size:11px;font-weight:600;padding:3px 10px;border-radius:99px">${roleLabel}</span></td>
            </tr></table>
          </div>
          <a href="${p.appUrl}/team" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">View team →</a>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9">
          <p style="color:#94a3b8;font-size:12px;margin:0">Taska · Manage notification preferences in Settings</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
