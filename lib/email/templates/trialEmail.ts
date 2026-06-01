interface TrialExpiringSoonProps {
  userName: string
  orgName: string
  appUrl: string
  trialEndsAt: string   // ISO date string
  daysLeft: number
}

interface TrialExpiredProps {
  userName: string
  orgName: string
  appUrl: string
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function trialExpiringSoonHtml(p: TrialExpiringSoonProps): string {
  const endDate = fmtDate(p.trialEndsAt)
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden">

        <!-- Header -->
        <tr><td style="background:#0f172a;padding:24px 32px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#0d9488;border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle">
              <span style="color:#fff;font-size:16px;font-weight:700">F</span>
            </td>
            <td style="padding-left:10px;color:#ffffff;font-size:18px;font-weight:700">Floatup</td>
          </tr></table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px">
          <div style="display:inline-block;background:#fff7ed;border:1px solid #fed7aa;border-radius:99px;padding:6px 14px;margin-bottom:20px">
            <span style="color:#ea580c;font-size:12px;font-weight:700;letter-spacing:0.04em">⏳ TRIAL ENDING SOON</span>
          </div>
          <h1 style="margin:0 0 12px;color:#0f172a;font-size:22px;font-weight:800;letter-spacing:-0.4px">
            Your trial ends in ${p.daysLeft} day${p.daysLeft !== 1 ? 's' : ''}
          </h1>
          <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.7">
            Your Pro trial for <strong>${p.orgName}</strong> expires on <strong>${endDate}</strong>.<br>
            After that, your workspace moves to the Free plan.
          </p>

          <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:24px">
            <tr>
              <td width="48%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;vertical-align:top">
                <p style="margin:0 0 10px;color:#15803d;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">✅ Free plan keeps</p>
                <p style="margin:0;color:#374151;font-size:13px;line-height:1.8">
                  Tasks &amp; projects<br>Up to 5 team members<br>Client management<br>Basic reports
                </p>
              </td>
              <td width="4%"></td>
              <td width="48%" style="background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;padding:16px;vertical-align:top">
                <p style="margin:0 0 10px;color:#be123c;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">⚠️ Pro only features</p>
                <p style="margin:0;color:#374151;font-size:13px;line-height:1.8">
                  Unlimited team members<br>CA Compliance module<br>Advanced recurring<br>Priority support
                </p>
              </td>
            </tr>
          </table>

          <a href="${p.appUrl}/settings/billing"
            style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:9px;font-size:14px;font-weight:700">
            Upgrade Now →
          </a>
          <p style="margin:16px 0 0;color:#94a3b8;font-size:13px">
            Questions? Just reply to this email — we're happy to help.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9;background:#f8fafc">
          <p style="color:#94a3b8;font-size:12px;margin:0">Floatup · ${p.orgName}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function trialExpiringSoonSubject(p: Pick<TrialExpiringSoonProps, 'daysLeft'>): string {
  return `⏳ Your Floatup trial ends in ${p.daysLeft} day${p.daysLeft !== 1 ? 's' : ''} — upgrade to keep access`
}

export function trialExpiredHtml(p: TrialExpiredProps): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden">

        <!-- Header -->
        <tr><td style="background:#0f172a;padding:24px 32px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#0d9488;border-radius:8px;width:32px;height:32px;text-align:center;vertical-align:middle">
              <span style="color:#fff;font-size:16px;font-weight:700">F</span>
            </td>
            <td style="padding-left:10px;color:#ffffff;font-size:18px;font-weight:700">Floatup</td>
          </tr></table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 12px;color:#0f172a;font-size:22px;font-weight:800;letter-spacing:-0.4px">
            Your trial has ended
          </h1>
          <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.7">
            Hi ${p.userName.split(' ')[0]}, your Pro trial for <strong>${p.orgName}</strong> has ended.<br>
            Your workspace is now on the <strong>Free plan</strong> — your data is safe and you can still use core features.
          </p>

          <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:20px;margin-bottom:24px">
            <p style="margin:0 0 8px;color:#0f172a;font-size:14px;font-weight:700">Ready to upgrade?</p>
            <p style="margin:0;color:#475569;font-size:13px;line-height:1.6">
              Get back unlimited team members, CA Compliance, advanced recurring tasks, and priority support — instantly.
            </p>
          </div>

          <a href="${p.appUrl}/settings/billing"
            style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:9px;font-size:14px;font-weight:700">
            Upgrade Now →
          </a>
          <p style="margin:16px 0 0;color:#94a3b8;font-size:13px">
            Need help choosing a plan? Reply to this email.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9;background:#f8fafc">
          <p style="color:#94a3b8;font-size:12px;margin:0">Floatup · ${p.orgName}</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function trialExpiredSubject(): string {
  return `Your Floatup trial has ended — upgrade to continue`
}
