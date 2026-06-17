interface WelcomeProps {
  userName: string
  orgName: string
  appUrl: string
  trialDays?: number
}

interface Day2Props {
  userName: string
  orgName: string
  appUrl: string
}

export function welcomeEmailHtml(p: WelcomeProps): string {
  const trial = p.trialDays ?? 14
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden">

        <!-- Header -->
        <tr><td style="background:#0f172a;padding:28px 36px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#0d9488;border-radius:9px;width:36px;height:36px;text-align:center;vertical-align:middle">
              <span style="color:#fff;font-size:18px;font-weight:700">F</span>
            </td>
            <td style="padding-left:12px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px">upFloat</td>
          </tr></table>
        </td></tr>

        <!-- Hero -->
        <tr><td style="padding:36px 36px 0">
          <h1 style="margin:0 0 10px;color:#0f172a;font-size:26px;font-weight:800;letter-spacing:-0.5px">
            You're all set, ${p.userName.split(' ')[0]}! 🎉
          </h1>
          <p style="margin:0;color:#64748b;font-size:15px;line-height:1.6">
            <strong>${p.orgName}</strong> is live on upFloat with a full <strong>${trial}-day Pro trial</strong>.<br>
            Here's what's waiting for you:
          </p>
        </td></tr>

        <!-- Feature highlights -->
        <tr><td style="padding:28px 36px 0">
          <table cellpadding="0" cellspacing="0" width="100%">

            <tr><td style="padding-bottom:14px">
              <table cellpadding="0" cellspacing="0" width="100%" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:0">
                <tr><td style="padding:16px 18px">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:22px;width:36px">✅</td>
                    <td style="padding-left:12px">
                      <p style="margin:0;color:#0f172a;font-size:14px;font-weight:700">Tasks &amp; Projects</p>
                      <p style="margin:3px 0 0;color:#475569;font-size:13px">Assign, prioritise, approve — your whole team in sync.</p>
                    </td>
                  </tr></table>
                </td></tr>
              </table>
            </td></tr>

            <tr><td style="padding-bottom:14px">
              <table cellpadding="0" cellspacing="0" width="100%" style="background:#fef9f0;border:1px solid #fde68a;border-radius:10px">
                <tr><td style="padding:16px 18px">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:22px;width:36px">🔄</td>
                    <td style="padding-left:12px">
                      <p style="margin:0;color:#0f172a;font-size:14px;font-weight:700">Recurring Tasks</p>
                      <p style="margin:3px 0 0;color:#475569;font-size:13px">Set up once. Spawns automatically — daily, weekly, monthly, or custom.</p>
                    </td>
                  </tr></table>
                </td></tr>
              </table>
            </td></tr>

            <tr><td style="padding-bottom:14px">
              <table cellpadding="0" cellspacing="0" width="100%" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px">
                <tr><td style="padding:16px 18px">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:22px;width:36px">👥</td>
                    <td style="padding-left:12px">
                      <p style="margin:0;color:#0f172a;font-size:14px;font-weight:700">Client Management</p>
                      <p style="margin:3px 0 0;color:#475569;font-size:13px">Track work per client, share a portal, and collect documents effortlessly.</p>
                    </td>
                  </tr></table>
                </td></tr>
              </table>
            </td></tr>

            <tr><td style="padding-bottom:0">
              <table cellpadding="0" cellspacing="0" width="100%" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px">
                <tr><td style="padding:16px 18px">
                  <table cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:22px;width:36px">📋</td>
                    <td style="padding-left:12px">
                      <p style="margin:0;color:#0f172a;font-size:14px;font-weight:700">CA Compliance</p>
                      <p style="margin:3px 0 0;color:#475569;font-size:13px">69+ statutory filings auto-scheduled. Built for Indian CA firms.</p>
                    </td>
                  </tr></table>
                </td></tr>
              </table>
            </td></tr>

          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:32px 36px">
          <a href="${p.appUrl}/dashboard"
            style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:9px;font-size:15px;font-weight:700;letter-spacing:-0.2px">
            Go to Dashboard →
          </a>
          <p style="margin:20px 0 0;color:#94a3b8;font-size:13px">
            Your ${trial}-day Pro trial is fully active — no card needed, no limits.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 36px;border-top:1px solid #f1f5f9;background:#f8fafc">
          <p style="color:#94a3b8;font-size:12px;margin:0">
            upFloat · You're receiving this because you just created an account.<br>
            Questions? Reply to this email.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function welcomeEmailSubject(p: Pick<WelcomeProps, 'userName'>): string {
  return `Welcome to upFloat, ${p.userName.split(' ')[0]}! Your workspace is ready 🚀`
}

export function day2EmailHtml(p: Day2Props): string {
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
            <td style="padding-left:10px;color:#ffffff;font-size:18px;font-weight:700">upFloat</td>
          </tr></table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px">
          <p style="color:#64748b;font-size:13px;margin:0 0 6px;text-transform:uppercase;font-weight:600;letter-spacing:0.05em">Quick tip for ${p.userName.split(' ')[0]}</p>
          <h1 style="margin:0 0 16px;color:#0f172a;font-size:22px;font-weight:800;letter-spacing:-0.4px">
            Never set up the same task twice 🔄
          </h1>
          <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.7">
            The thing most teams love about upFloat is <strong>Recurring Tasks</strong>.<br>
            Create a task once — and it re-appears automatically on a schedule you define.
          </p>

          <div style="background:#f0fdfa;border-left:4px solid #0d9488;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px">
            <p style="margin:0;color:#0f172a;font-size:13px;line-height:1.6">
              <strong>Great for:</strong> weekly team reviews, monthly invoicing, quarterly filings, daily standups — anything that repeats.
            </p>
          </div>

          <a href="${p.appUrl}/recurring?new=1"
            style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700">
            Set up a recurring task →
          </a>

          <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6">
            Also worth exploring: <a href="${p.appUrl}/clients" style="color:#0d9488;text-decoration:none;font-weight:600">Client management</a> and the <a href="${p.appUrl}/compliance" style="color:#0d9488;text-decoration:none;font-weight:600">Compliance module</a>.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9;background:#f8fafc">
          <p style="color:#94a3b8;font-size:12px;margin:0">upFloat · ${p.orgName} · Reply to unsubscribe from tips</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function day2EmailSubject(): string {
  return `One tip to get more out of upFloat 🔄`
}
