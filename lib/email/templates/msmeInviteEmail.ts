interface Props {
  senderName: string
  senderOrg:  string
  msmeUrl:    string
}

const ACCENT = '#0d9488'

export function msmeInviteEmailSubject(p: Props): string {
  return `${p.senderName} invited you to try MSME Tracker`
}

export function msmeInviteEmailHtml(p: Props): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MSME Tracker Invite</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

        <tr><td style="background:${ACCENT};padding:28px 36px;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">MSME Tracker</h1>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Udyam & GST Certificate Registry</p>
        </td></tr>

        <tr><td style="padding:32px 36px;">
          <p style="margin:0 0 20px;font-size:15px;color:#1e293b;line-height:1.6;">
            <strong>${p.senderName}</strong> from <strong>${p.senderOrg}</strong> has invited you to use <strong>MSME Tracker</strong> — a compliance tool for collecting, verifying, and maintaining Udyam &amp; GST certificates from your vendors.
          </p>

          <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:18px 20px;margin:0 0 24px;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:0.05em;">Why use MSME Tracker?</p>
            <ul style="margin:0;padding-left:18px;font-size:13px;color:#334155;line-height:1.8;">
              <li>Build a verified MSME vendor registry</li>
              <li>Track Udyam &amp; GST certificate submission status</li>
              <li>Send automated reminders to vendors</li>
              <li>Stay audit-ready under Section 43B(h)</li>
              <li>Export a clean, date-stamped report for your CA</li>
            </ul>
          </div>

          <div style="text-align:center;margin:0 0 28px;">
            <a href="${p.msmeUrl}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:13px 32px;border-radius:8px;letter-spacing:0.01em;">
              Get Started — It's Free →
            </a>
          </div>

          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
            Your first 5 vendors are always free. No credit card required.<br>
            If you did not expect this email, you can safely ignore it.
          </p>
        </td></tr>

        <tr><td style="background:#f8fafc;padding:16px 36px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
            Sent via upFloat · Built for Indian CA firms &amp; businesses
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
