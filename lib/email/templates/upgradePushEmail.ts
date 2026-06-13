type PlanTier = 'free' | 'starter' | 'pro'

interface UpgradePushProps {
  userName: string
  orgName:  string
  appUrl:   string
  currentPlan: PlanTier
  limitHit: 'tasks' | 'members' | 'clients' | 'storage' | 'ai'
}

const NEXT_PLAN: Record<PlanTier, string> = {
  free:    'Starter',
  starter: 'Pro',
  pro:     'Business',
}

const LIMIT_COPY: Record<string, { title: string; body: string; emoji: string }> = {
  tasks:   { emoji: '📋', title: 'Task limit reached',    body: 'You\'ve hit the maximum number of active tasks on your current plan.' },
  members: { emoji: '👥', title: 'Member limit reached',  body: 'You\'ve invited the maximum number of team members on your current plan.' },
  clients: { emoji: '🏢', title: 'Client limit reached',  body: 'You\'ve reached the maximum number of clients on your current plan.' },
  storage: { emoji: '📁', title: 'Storage limit reached', body: 'Your workspace has used all available file storage.' },
  ai:      { emoji: '✨', title: 'AI usage limit reached', body: 'You\'ve used all AI credits for this billing period.' },
}

const UPGRADE_BENEFITS: Record<PlanTier, string[]> = {
  free:    ['Unlimited tasks', 'Up to 10 team members', 'Client portal', 'Recurring tasks', 'CA compliance calendar'],
  starter: ['Unlimited members', 'Advanced reports', 'Custom fields', 'Priority support', 'AI task suggestions'],
  pro:     ['White-label portal', 'API access', 'Dedicated onboarding', 'SLA support'],
}

export function upgradePushSubject(p: { orgName: string; limitHit: string }): string {
  const copy = LIMIT_COPY[p.limitHit]
  return copy ? `${copy.title} — upgrade ${p.orgName} to continue` : `Upgrade ${p.orgName} to unlock more`
}

export function upgradePushHtml(p: UpgradePushProps): string {
  const copy     = LIMIT_COPY[p.limitHit] ?? LIMIT_COPY.tasks
  const nextPlan = NEXT_PLAN[p.currentPlan] ?? 'Pro'
  const benefits = UPGRADE_BENEFITS[p.currentPlan] ?? []

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

        <!-- Limit alert banner -->
        <tr><td style="background:#fef3c7;padding:16px 32px;border-bottom:1px solid #fde68a">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:24px;width:36px">${copy.emoji}</td>
            <td style="padding-left:12px">
              <p style="margin:0;font-size:15px;font-weight:700;color:#92400e">${copy.title}</p>
              <p style="margin:3px 0 0;font-size:13px;color:#b45309">${copy.body}</p>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:32px 32px 24px">
          <p style="margin:0 0 6px;font-size:20px;font-weight:800;color:#0f172a">
            Unlock more with ${nextPlan}
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.6">
            Hi ${p.userName}, <strong>${p.orgName}</strong> is growing — upgrade now and keep going without interruption.
          </p>

          <table cellpadding="0" cellspacing="0" width="100%" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;margin-bottom:28px">
            <tr><td style="padding:20px 22px">
              <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:0.05em">
                What you unlock on ${nextPlan}
              </p>
              ${benefits.map(b => `
              <table cellpadding="0" cellspacing="0" style="margin-bottom:8px"><tr>
                <td style="color:#0d9488;font-size:14px;width:20px">✓</td>
                <td style="padding-left:8px;font-size:14px;color:#0f172a;font-weight:500">${b}</td>
              </tr></table>`).join('')}
            </td></tr>
          </table>

          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:10px">
                <a href="${p.appUrl}/settings/billing"
                  style="display:inline-block;padding:13px 28px;background:#0d9488;color:#fff;
                         font-size:14px;font-weight:700;border-radius:9px;text-decoration:none;
                         box-shadow:0 4px 14px rgba(13,148,136,0.4)">
                  Upgrade to ${nextPlan} →
                </a>
              </td>
              <td>
                <a href="${p.appUrl}/settings/billing"
                  style="display:inline-block;padding:13px 22px;border:1px solid #cbd5e1;
                         color:#475569;font-size:13px;font-weight:500;border-radius:9px;text-decoration:none">
                  See all plans
                </a>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:16px 32px 28px;border-top:1px solid #f1f5f9">
          <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6">
            Questions? Reply to this email — we reply within 24 hours.
            <a href="${p.appUrl}/settings/notifications" style="color:#0d9488">Manage notifications</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
