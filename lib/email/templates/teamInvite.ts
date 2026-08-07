interface Props {
  orgName:    string
  inviterName?: string | null
  role:       string
  actionUrl:  string
}

const ACCENT = '#0d9488'

const ROLE_LABEL: Record<string, string> = {
  admin:   'Admin',
  manager: 'Manager',
  member:  'Member',
  viewer:  'Viewer',
}

export function teamInviteSubject(p: Props): string {
  return `You've been invited to join ${p.orgName} on upFloat`
}

// Plain-text alternative — HTML-only mail is a spam-filter negative signal.
export function teamInviteText(p: Props): string {
  return [
    `You've been invited to join ${p.orgName} on upFloat.`,
    ``,
    p.inviterName ? `${p.inviterName} has added you as a ${ROLE_LABEL[p.role] ?? p.role}.` : `You've been added as a ${ROLE_LABEL[p.role] ?? p.role}.`,
    ``,
    `Accept your invitation and set a password:`,
    p.actionUrl,
    ``,
    `This link signs you in directly — no password needed the first time.`,
    `It expires in 24 hours. If it has expired, ask ${p.inviterName ?? 'your admin'} to invite you again.`,
    ``,
    `If you weren't expecting this invitation you can safely ignore this email.`,
    ``,
    `— upFloat`,
  ].join('\n')
}

export function teamInviteHtml(p: Props): string {
  const roleLabel = ROLE_LABEL[p.role] ?? p.role
  return `<!DOCTYPE html><html lang="en">
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0">

    <tr><td style="background:#0f172a;padding:26px 34px">
      <div style="color:#fff;font-size:20px;font-weight:800;letter-spacing:0.01em">upFloat</div>
      <div style="color:#94a3b8;font-size:12px;margin-top:4px;letter-spacing:0.04em;text-transform:uppercase">Team invitation</div>
    </td></tr>

    <tr><td style="padding:32px 34px">
      <p style="color:#0f172a;font-size:17px;font-weight:700;margin:0 0 14px;line-height:1.5">
        You've been invited to join ${p.orgName}
      </p>

      <p style="color:#334155;font-size:14px;margin:0 0 22px;line-height:1.7">
        ${p.inviterName ? `<strong>${p.inviterName}</strong> has added you to` : 'You have been added to'}
        <strong>${p.orgName}</strong> on upFloat as a <strong>${roleLabel}</strong>.
        upFloat is where the team tracks its tasks, deadlines and compliance work.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:18px">
        <tr><td align="center" style="background:${ACCENT};border-radius:8px">
          <a href="${p.actionUrl}" style="display:block;padding:15px 0;font-size:15px;font-weight:700;color:#fff;text-decoration:none">
            Accept invitation &amp; set your password
          </a>
        </td></tr>
      </table>

      <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:0 0 22px;text-align:center">
        This link signs you in directly — no password needed the first time.<br/>
        It expires in 24 hours.
      </p>

      <div style="border-top:1px solid #e2e8f0;padding-top:16px">
        <p style="color:#64748b;font-size:12px;line-height:1.7;margin:0">
          Button not working? Copy this link into your browser:<br/>
          <span style="color:${ACCENT};word-break:break-all">${p.actionUrl}</span>
        </p>
      </div>
    </td></tr>

    <tr><td style="padding:18px 34px;background:#f8fafc;border-top:1px solid #e2e8f0">
      <p style="color:#94a3b8;font-size:11px;margin:0;line-height:1.6">
        If you weren't expecting this invitation you can safely ignore this email — nothing will happen until you open the link.
      </p>
    </td></tr>

  </table>
  </td></tr></table>
</body></html>`
}
