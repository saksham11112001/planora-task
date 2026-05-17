# Future Integration Playbook
> Ready-to-execute steps for Razorpay billing and WhatsApp reminders.  
> Neither feature requires architectural changes — the scaffolding is already in place.  
> Last updated: 2026-05-17

---

## PART A — RAZORPAY BILLING INTEGRATION

### Context
`BillingView.tsx` already has the 4-plan UI with monthly/annual toggle and coupon input.  
`app/api/settings/billing/route.ts` exists but has no payment logic.  
`organisations` table has `plan_tier`, `status`, `trial_ends_at`.  
The goal: clicking "Upgrade" in BillingView creates a Razorpay subscription → webhook updates the org's plan tier in Supabase.

---

### Step 1 — Razorpay Account & Dashboard Setup

1. Sign up at [razorpay.com](https://razorpay.com) → complete KYC (takes 1–3 business days).
2. Go to **Settings → API Keys** → Generate Key ID + Key Secret for **Test mode** first.
3. Go to **Subscriptions → Plans** → Create 6 plans (2 billing cycles × 3 paid tiers):

| Plan Name | Interval | Amount (paise) | Description |
|-----------|----------|---------------|-------------|
| `starter_monthly` | monthly | 2900 × 100 = 290000 | Starter ₹2,900/mo |
| `starter_annual` | yearly | 2300 × 12 × 100 = 2760000 | Starter ₹23,000/yr |
| `pro_monthly` | monthly | 7900 × 100 = 790000 | Pro ₹7,900/mo |
| `pro_annual` | yearly | 6300 × 12 × 100 = 7560000 | Pro ₹63,000/yr |
| `business_monthly` | monthly | 14900 × 100 = 1490000 | Business ₹14,900/mo |
| `business_annual` | yearly | 11900 × 12 × 100 = 14280000 | Business ₹1,19,000/yr |

> ⚠️ Adjust amounts when pricing is finalised. Razorpay amounts are always in paise (₹1 = 100 paise).

4. Note down each Plan ID (format: `plan_XXXXXXXXXX`).
5. Go to **Settings → Webhooks** → Add webhook:
   - URL: `https://sng-adwisers.com/api/webhooks/razorpay`
   - Events to subscribe: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.paused`, `payment.captured`, `payment.failed`
   - Note the **Webhook Secret**.

---

### Step 2 — Environment Variables

Add to Vercel (and `.env.local` for dev):

```env
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX
RAZORPAY_WEBHOOK_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX

# Plan IDs (from Razorpay dashboard)
RAZORPAY_PLAN_STARTER_MONTHLY=plan_XXXXXXXXXX
RAZORPAY_PLAN_STARTER_ANNUAL=plan_XXXXXXXXXX
RAZORPAY_PLAN_PRO_MONTHLY=plan_XXXXXXXXXX
RAZORPAY_PLAN_PRO_ANNUAL=plan_XXXXXXXXXX
RAZORPAY_PLAN_BUSINESS_MONTHLY=plan_XXXXXXXXXX
RAZORPAY_PLAN_BUSINESS_ANNUAL=plan_XXXXXXXXXX

# Switch to live keys when going live:
# RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXXXX
```

---

### Step 3 — Install Razorpay SDK

```bash
npm install razorpay
```

This adds the official Node.js Razorpay SDK (server-side only — never import on client).

---

### Step 4 — Create Billing Helper (`lib/razorpay.ts`)

```typescript
import Razorpay from 'razorpay'

export const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export const PLAN_MAP: Record<string, string> = {
  starter_monthly:  process.env.RAZORPAY_PLAN_STARTER_MONTHLY!,
  starter_annual:   process.env.RAZORPAY_PLAN_STARTER_ANNUAL!,
  pro_monthly:      process.env.RAZORPAY_PLAN_PRO_MONTHLY!,
  pro_annual:       process.env.RAZORPAY_PLAN_PRO_ANNUAL!,
  business_monthly: process.env.RAZORPAY_PLAN_BUSINESS_MONTHLY!,
  business_annual:  process.env.RAZORPAY_PLAN_BUSINESS_ANNUAL!,
}
```

---

### Step 5 — Create Subscription API Route (`app/api/billing/subscribe/route.ts`)

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { razorpay, PLAN_MAP } from '@/lib/razorpay'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { plan, billing_cycle } = await request.json()
  // plan: 'starter' | 'pro' | 'business'
  // billing_cycle: 'monthly' | 'annual'

  const planKey = `${plan}_${billing_cycle}`
  const planId  = PLAN_MAP[planKey]
  if (!planId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const admin = createAdminClient()

  // Get org and member
  const { data: mb } = await admin.from('org_members')
    .select('org_id, role, organisations(name, status)')
    .eq('user_id', user.id).eq('is_active', true).maybeSingle()
  if (!mb || !['owner','admin'].includes(mb.role))
    return NextResponse.json({ error: 'Only owner/admin can manage billing' }, { status: 403 })

  // Get user profile for prefill
  const { data: profile } = await admin.from('users')
    .select('name, email, phone_number').eq('id', user.id).maybeSingle()

  // Create Razorpay subscription
  const subscription = await razorpay.subscriptions.create({
    plan_id:        planId,
    total_count:    billing_cycle === 'annual' ? 12 : 120,  // max cycles
    quantity:       1,
    customer_notify: 1,
    notes: {
      org_id:   mb.org_id,
      user_id:  user.id,
      plan,
      billing_cycle,
    },
  })

  // Store subscription_id on org for webhook correlation
  await admin.from('organisations').update({
    razorpay_subscription_id: subscription.id,
  }).eq('id', mb.org_id)

  return NextResponse.json({
    subscription_id: subscription.id,
    key_id:          process.env.RAZORPAY_KEY_ID,
    prefill: {
      name:    profile?.name ?? '',
      email:   profile?.email ?? user.email ?? '',
      contact: profile?.phone_number ?? '',
    },
    org_name: (mb.organisations as any)?.name ?? '',
  })
}
```

---

### Step 6 — Razorpay Webhook Handler (`app/api/webhooks/razorpay/route.ts`)

```typescript
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const TIER_MAP: Record<string, string> = {
  starter: 'starter',
  pro: 'pro',
  business: 'business',
}

function verifyWebhookSignature(body: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export async function POST(request: Request) {
  const body      = await request.text()
  const signature = request.headers.get('x-razorpay-signature') ?? ''

  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body)
  const admin = createAdminClient()

  // Helper: get org_id from subscription notes
  async function getOrgId(subscriptionId: string): Promise<string | null> {
    const { data } = await admin.from('organisations')
      .select('id').eq('razorpay_subscription_id', subscriptionId).maybeSingle()
    return data?.id ?? null
  }

  switch (event.event) {
    case 'subscription.activated':
    case 'subscription.charged': {
      const sub    = event.payload.subscription.entity
      const notes  = sub.notes ?? {}
      const orgId  = notes.org_id ?? await getOrgId(sub.id)
      const plan   = notes.plan ?? 'starter'
      if (!orgId) break

      const now          = new Date()
      const nextBilledAt = sub.current_end ? new Date(sub.current_end * 1000).toISOString() : null

      await admin.from('organisations').update({
        plan_tier:    TIER_MAP[plan] ?? 'starter',
        status:       'active',
        trial_ends_at: null,
        razorpay_subscription_id: sub.id,
        subscription_ends_at: nextBilledAt,
      }).eq('id', orgId)

      // Log billing event
      await admin.from('billing_events').insert({
        org_id:    orgId,
        event_type: event.event,
        payload:   event.payload,
      })
      break
    }

    case 'subscription.cancelled':
    case 'subscription.paused': {
      const sub   = event.payload.subscription.entity
      const orgId = sub.notes?.org_id ?? await getOrgId(sub.id)
      if (!orgId) break

      await admin.from('organisations').update({
        plan_tier: 'free',
        status:    'cancelled',
      }).eq('id', orgId)

      await admin.from('billing_events').insert({
        org_id:     orgId,
        event_type: event.event,
        payload:    event.payload,
      })
      break
    }

    case 'payment.failed': {
      // Optional: send a payment failure email / in-app notification
      // org is NOT downgraded immediately — Razorpay retries for a grace period
      console.warn('[Razorpay] Payment failed:', event.payload?.payment?.entity?.id)
      break
    }
  }

  return NextResponse.json({ received: true })
}
```

---

### Step 7 — Database Migration for Razorpay Fields

Run in Supabase SQL editor:

```sql
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- Index for webhook lookup
CREATE INDEX IF NOT EXISTS orgs_rzp_sub_idx
  ON organisations (razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;
```

---

### Step 8 — Update BillingView to Launch Razorpay Checkout

In `app/(app)/settings/billing/BillingView.tsx`:

1. Add Razorpay script loader to `useEffect`:
```typescript
useEffect(() => {
  const script = document.createElement('script')
  script.src = 'https://checkout.razorpay.com/v1/checkout.js'
  script.async = true
  document.body.appendChild(script)
  return () => document.body.removeChild(script)
}, [])
```

2. Replace the "Upgrade" button's `onClick` (currently calls a placeholder):
```typescript
async function handleUpgrade(planKey: string) {
  setLoading(planKey)
  try {
    const res  = await fetch('/api/billing/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: planKey, billing_cycle: annual ? 'annual' : 'monthly' }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)

    // Open Razorpay checkout
    const rzp = new (window as any).Razorpay({
      key:             data.key_id,
      subscription_id: data.subscription_id,
      name:            'Planora',
      description:     `${planKey} Plan`,
      prefill:         data.prefill,
      theme:           { color: '#0d9488' },
      handler: async (response: any) => {
        // Payment captured — webhook will update plan_tier asynchronously
        // Show a success toast and refresh after 3s for the plan to reflect
        toast.success('Payment successful! Plan upgrading…')
        setTimeout(() => window.location.reload(), 3000)
      },
    })
    rzp.open()
  } catch (err: any) {
    toast.error(err.message ?? 'Could not initiate payment')
  } finally {
    setLoading(null)
  }
}
```

---

### Step 9 — Add Coupon/Discount Support (Optional)

In Razorpay dashboard → **Coupons** → Create coupon codes.  
In `BillingView`, the coupon input already exists — wire it to:

```typescript
// POST /api/billing/validate-coupon { code }
// Calls razorpay.coupons.fetch(code) → returns discount percentage
// Display "X% off" before checkout; pass coupon_id to subscriptions.create()
```

---

### Step 10 — Testing Checklist

- [ ] Test mode: create a subscription with card `4111 1111 1111 1111`, CVV `123`, any future expiry
- [ ] Verify webhook fires and `organisations.plan_tier` updates in Supabase
- [ ] Verify BillingView refreshes and shows correct plan
- [ ] Simulate `subscription.cancelled` webhook manually via Razorpay dashboard → verify org downgrades to free
- [ ] Test annual plan: verify amount is 12× the monthly rate correctly discounted
- [ ] Switch key from `rzp_test_` → `rzp_live_` in Vercel when going live

---
---

## PART B — WHATSAPP REMINDERS (MSG91)

### Context — What's Already Built

> ✅ `lib/whatsapp/client.ts` — MSG91 API client with retry logic  
> ✅ `lib/whatsapp/send.ts` — 5 helper functions: `waTaskAssigned`, `waTaskDueSoon`, `waApprovalNeeded`, `waApprovalResult`, `waTaskOverdue`  
> ✅ All 5 templates defined with variable placeholders  
> ✅ `dailyReminders.ts` already calls `waTaskDueSoon` and `waTaskOverdue`  
> ✅ `onTaskAssigned.ts` already calls `waTaskAssigned`  
> ✅ `onApproval.ts` already calls `waApprovalNeeded` / `waApprovalResult`  
> ✅ `users.phone_number` is now required at org creation (Sessions 14–17)  
> ✅ `users.whatsapp_opted_in` boolean exists  
> ✅ `notification_preferences` table has `via_whatsapp` per user + event_type  

**What's missing: just configuration + template registration. No code changes needed.**

---

### Step 1 — Get MSG91 WhatsApp Business API Access

1. Sign up at [msg91.com](https://msg91.com) → create an account.
2. Go to **WhatsApp** section → request access (requires a WhatsApp Business Number).
3. **Option A (easier):** Use your own existing WhatsApp Business number.  
   **Option B (cleaner):** Request a dedicated number from MSG91.
4. Connect your Facebook Business Manager account when prompted (Meta requires this for WhatsApp API).
5. Verify your business (Meta KYC) — takes 1–7 business days.
6. Note your **Auth Key** from MSG91 dashboard → Settings → Auth Key.
7. Note your **Sender ID** (the approved WhatsApp Business number in E.164 format).

---

### Step 2 — Register WhatsApp Templates in MSG91

Go to **MSG91 Dashboard → WhatsApp → Templates** → Create New Template for each of the 5 below.  
Templates must be approved by Meta before use (usually 24–48 hours).

**Template 1: `taska_task_assigned`**
```
Category: UTILITY
Language: English

Body:
Hi {{1}}, {{2}} assigned you a task: *{{3}}*. Due: {{4}}.
Open here: {{5}}
```

**Template 2: `taska_task_due_soon`**
```
Category: UTILITY
Language: English

Body:
⏰ Reminder, {{1}}! Your task *{{2}}* is due in {{3}}.
Open here: {{4}}
```

**Template 3: `taska_approval_needed`**
```
Category: UTILITY
Language: English

Body:
🔔 {{1}}, {{2}} submitted a task for your approval: *{{3}}*.
Review here: {{4}}
```

**Template 4: `taska_task_approved`**
```
Category: UTILITY
Language: English

Body:
✅ {{1}}, your task *{{2}}* was approved by {{3}}.
Open here: {{4}}
```

**Template 5: `taska_task_rejected`**  
```
Category: UTILITY
Language: English

Body:
❌ {{1}}, your task *{{2}}* was returned by {{3}}. Please revise.
Open here: {{4}}
```

**Template 6: `taska_task_overdue`** (optional — add proactively)
```
Category: UTILITY
Language: English

Body:
⚠️ {{1}}, your task *{{2}}* is overdue (was due {{3}}).
Open here: {{4}}
```

> ⚠️ Template names in MSG91 must EXACTLY match the strings in `lib/whatsapp/send.ts`.  
> ⚠️ Variable numbering in MSG91 uses `{{1}}`, `{{2}}` etc. — NOT `{{VAR1}}`. Check MSG91 docs for exact format.

---

### Step 3 — Environment Variables

Add to Vercel and `.env.local`:

```env
MSG91_AUTH_KEY=your_msg91_auth_key_here
MSG91_WHATSAPP_SENDER_ID=+91XXXXXXXXXX
```

That's it — `lib/whatsapp/client.ts` already reads these. No code changes.

---

### Step 4 — Verify Phone Number Collection at Onboarding

The phone field is already required at org creation (Sessions 14–17 anti-abuse work).  
**Confirm** in Supabase that `users.phone_number` values are in E.164 format (+91XXXXXXXXXX).  
If any old users have numbers without the country code, run a one-time fix:

```sql
-- Fix: prepend +91 to 10-digit Indian numbers missing country code
UPDATE users
SET phone_number = '+91' || phone_number
WHERE phone_number ~ '^[6-9][0-9]{9}$';  -- 10-digit Indian mobile, no country code
```

---

### Step 5 — Add WhatsApp Opt-In Toggle to Profile / Notifications Settings

`users.whatsapp_opted_in` column exists. Wire a toggle in `app/(app)/settings/notifications/NotifView.tsx`:

```typescript
// Add a toggle row:
// "WhatsApp notifications" — enabled when whatsapp_opted_in = true
// PATCH /api/settings/notifications { whatsapp_opted_in: boolean }
// API updates users.whatsapp_opted_in for the calling user
```

Also expose in `notification_preferences` per event type (already exists in schema).  
The toggle in existing `NotifView` per-event rows for `via_whatsapp` just needs to be made visible.

---

### Step 6 — Add Per-Event WhatsApp Toggle in Notifications Settings

In `notification_preferences`, `via_whatsapp` exists per `(user_id, event_type)`.  
In `NotifView.tsx`, add a second toggle column "WhatsApp" next to the existing "Email" column for these events:
- `task_assigned`
- `task_due_soon`
- `task_approved` (covers approval request + result)
- `task_overdue`

The Inngest handlers already read `prefs.via_whatsapp` before calling `waXxx()` — no backend changes needed.

---

### Step 7 — Test End-to-End

1. Set your own phone number in your profile → enable WhatsApp notifications.
2. Assign a task to yourself.
3. Check Inngest dashboard (inngest.com → your app) → confirm `on-task-assigned` event fired.
4. Check that MSG91 shows the message as "Delivered" in their logs.
5. Test `waTaskDueSoon` by creating a task due in 2 days → wait for 8 AM IST cron or manually trigger via Inngest.
6. Check MSG91 dashboard → **Reports** → verify template delivery rates.

---

### Step 8 — WhatsApp Client Bulk Reminder (Already Live)

`CATasksView.tsx` already has a "WhatsApp Reminder" button in the bulk action bar that opens `wa.me/?text=...` in a new tab. This uses the user's personal WhatsApp (no API key needed) — it's not affected by MSG91 templates. This is already production-ready.

---

### Step 9 — Optional — Two-Way WhatsApp (Future Enhancement)

If users want to respond to WhatsApp reminders (e.g., "Mark task complete" reply):

1. Set up MSG91 incoming message webhook: `POST /api/webhooks/msg91`
2. Parse `{from, text}` — match phone to `users.phone_number`
3. Parse intent from `text` (e.g., "done" → complete task, "snooze" → extend due date)
4. Update task via admin client
5. Send a confirmation WhatsApp reply

This is a significant feature but the infrastructure (phone-to-user mapping) is now in place.

---

## SUMMARY CHECKLIST

### Razorpay (when name + pricing finalised)
- [ ] Razorpay KYC approved
- [ ] 6 subscription plans created in dashboard
- [ ] Webhook registered with correct URL + secret
- [ ] Env vars added to Vercel
- [ ] `npm install razorpay`
- [ ] Create `lib/razorpay.ts`
- [ ] Create `app/api/billing/subscribe/route.ts`
- [ ] Create `app/api/webhooks/razorpay/route.ts`
- [ ] Run DB migration (add `razorpay_subscription_id`, `subscription_ends_at`)
- [ ] Update `BillingView.tsx` with checkout.js + handler
- [ ] Test in test mode end-to-end
- [ ] Switch to live keys

### WhatsApp (ready to go — just needs MSG91 account)
- [ ] MSG91 account + WhatsApp Business API access approved
- [ ] Facebook Business Manager connected
- [ ] 5 (or 6) templates submitted and approved by Meta
- [ ] `MSG91_AUTH_KEY` + `MSG91_WHATSAPP_SENDER_ID` added to Vercel
- [ ] Verify phone numbers in DB are E.164 format (run SQL fix if needed)
- [ ] Add WhatsApp opt-in toggle to Notifications settings UI
- [ ] Test one assignment end-to-end
- [ ] Monitor MSG91 delivery reports

### No code changes needed for WhatsApp — only configuration.
### Razorpay needs ~6 new/modified files.
