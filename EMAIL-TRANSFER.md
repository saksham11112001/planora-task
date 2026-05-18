# Planora — Full Account Transfer Guide

**Purpose:** Transfer every service that powers sng-adwisers.com from one Google account (or email) to another professional email.  
**When to use:** You're moving from a personal Gmail to a professional domain email (e.g. `saksham@sngadvisers.com`).  
**Estimated time:** 3–5 hours spread over 2 days (some steps need 24-hour propagation).

---

## Before You Start

1. Create the new professional email account first and confirm it receives mail.
2. Go through this guide **in order** — later steps depend on earlier ones.
3. Keep both email accounts accessible throughout the migration.
4. Do this on a **weekday morning IST** when traffic is lowest.

---

## Step 1 — Supabase (Database + Auth)

Supabase holds all user data, the `issue_reports` table, `content_queue`, compliance tasks, and everything else.

### 1a. Add new email as org owner

1. Log in to [supabase.com](https://supabase.com) with the **old** Google account.
2. Click your org name (top-left) → **Org Settings** → **Members**.
3. Click **Invite member**, enter the new email, select **Owner** role.
4. Accept the invite from the new email's inbox.

### 1b. Transfer ownership

1. In Org Settings → Members, find the old account → change role to **Member**.
2. From the **new** email account, go to Org Settings → Members → set new email to **Owner**.
3. Remove the old email entirely (click the trash icon next to it).

### 1c. Update Auth settings

1. In Supabase Dashboard → **Authentication** → **URL Configuration**:
   - Site URL: `https://sng-adwisers.com` ← confirm this is still correct
   - Redirect URLs: add the new email's Supabase callback if any custom flow uses it.

### 1d. Update Auth Providers

1. Go to **Authentication** → **Providers** → **Google**.
2. Note the existing Client ID and Client Secret — you'll update these in Step 3.

> **Nothing in the database changes** — this is purely an account ownership transfer. No data loss risk.

---

## Step 2 — Google Cloud Console (OAuth Credentials)

The Google login button on sng-adwisers.com uses a Google Cloud project. Transfer it to the new account.

### 2a. Add new account as owner to the Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) with the **old** Google account.
2. Select your project (likely named "Planora" or "SNG Advisers").
3. Left menu → **IAM & Admin** → **IAM**.
4. Click **+ Grant access** → enter the new email → role = **Owner**.
5. Click Save.

### 2b. Verify in new account

1. Log out, log into Cloud Console with the **new** email.
2. You should see the same project in the project list.
3. Confirm you can access **APIs & Services** → **Credentials** and see the OAuth 2.0 Client ID.

### 2c. Update OAuth consent screen (if needed)

1. **APIs & Services** → **OAuth consent screen**.
2. Update the support email and developer contact email to the new address.

### 2d. Remove old owner (after confirming access works)

1. Back in IAM, find the old email → click the pencil icon → remove the Owner role.

> **The Client ID and Client Secret do NOT change** — existing OAuth logins continue to work. No env var update needed for Google.

---

## Step 3 — Microsoft Azure (OAuth for Microsoft login)

### 3a. Add new account as owner

1. Go to [portal.azure.com](https://portal.azure.com) with the **old** Microsoft account.
2. Search for **Azure Active Directory** → **App registrations**.
3. Click on the Planora app.
4. Left menu → **Owners** → **Add owners** → add the new email as owner.

### 3b. Transfer subscription (if you have a paid Azure plan)

1. Azure Portal → **Subscriptions** → select subscription.
2. **Transfer billing ownership** → follow the wizard.
3. This requires the new email to have an Azure account.

### 3c. Update app reply URLs if email changes

1. App registrations → Planora app → **Authentication**.
2. Confirm redirect URIs still point to `https://sng-adwisers.com/auth/callback`.
3. No changes needed if the domain stays the same.

---

## Step 4 — Vercel (Hosting)

sng-adwisers.com is deployed on Vercel.

### 4a. Invite new account to the team

1. Log in to [vercel.com](https://vercel.com) with the **old** account.
2. Top-right → your team name → **Settings** → **Members**.
3. Click **Invite** → new email → role **Owner**.
4. Accept from new email.

### 4b. Transfer billing

1. Team Settings → **Billing** → update the billing email to the new address.
2. Add a payment method under the new account if needed.

### 4c. Make new account the primary owner

1. In Members, set new email to **Owner**.
2. Set old email to **Member**, then remove after confirming full access.

### 4d. Update Environment Variables (critical)

1. In Vercel → your project → **Settings** → **Environment Variables**.
2. Re-enter any secret that you need to rotate (you don't need to change them, but now's a good time to audit):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXTAUTH_SECRET` (if used)
   - `RESEND_API_KEY`
   - `INNGEST_SIGNING_KEY`
   - `INNGEST_EVENT_KEY`
   - `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
   - `ANTHROPIC_API_KEY`
   - All n8n / social API keys

---

## Step 5 — Resend (Transactional Email)

Planora sends emails (complaints notifications, team invites, compliance alerts) via Resend.

### 5a. Add new email to the Resend account

1. Log in to [resend.com](https://resend.com) with the old email.
2. **Account Settings** → **Team** → **Invite**.
3. Enter the new email with **Admin** role.

### 5b. Transfer ownership

1. Accept invite from new email.
2. Old account: Settings → Team → promote new email to **Owner**.
3. Remove old email.

### 5c. Verify domain is still verified

1. Resend → **Domains** → confirm `sng-adwisers.com` or whatever sending domain is still **Verified**.
2. If it shows as unverified, re-add the DNS records (they're in the Resend dashboard → Domains → the domain → DNS records).

> **API keys stay the same** — no env var change needed.

---

## Step 6 — Inngest (Background Jobs)

Inngest handles recurring task spawning, email digests, and notification delivery.

### 6a. Transfer account

Inngest doesn't have a built-in team transfer today. Options:

**Option A (recommended): Recreate credentials**
1. Log into [inngest.com](https://app.inngest.com) with the **new** email (create account if needed).
2. Create a new Inngest app.
3. Get new `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` from the new account.
4. Update these in Vercel environment variables.
5. Redeploy (Vercel → your project → **Deployments** → **Redeploy**).
6. Verify the Inngest dashboard shows functions registered.

**Option B: Contact Inngest support**
1. Email support@inngest.com requesting ownership transfer.
2. Provide old email, new email, and app name.

---

## Step 7 — Cloudflare R2 (File Storage)

R2 holds uploaded attachments, compliance documents, and images.

### 7a. Add new email to Cloudflare account

1. Log into [dash.cloudflare.com](https://dash.cloudflare.com) with the old email.
2. Top-right → **Manage Account** → **Members** → **Invite Member**.
3. Enter new email → role: **Administrator**.

### 7b. Transfer ownership

1. Accept invite from new email.
2. Cloudflare only allows one Super Administrator. To change it:
   - Go to **Manage Account** → **Members**.
   - Promote new email to **Super Administrator**.
   - This will automatically demote the old email.

### 7c. Rotate R2 API tokens (optional but recommended)

1. **R2** → **Manage R2 API Tokens** → create a new token for the new account.
2. Update `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` in Vercel.
3. Delete the old token.

> **Files in the bucket are unaffected** — no data migration needed.

---

## Step 8 — Razorpay (Payments)

Razorpay accounts are KYC-linked to the business entity. This is the most involved step.

### 8a. Check if business entity changes

- If the company/proprietorship stays the same → you may just need to update the email.
- If moving to a different legal entity → full account re-creation required.

### 8b. Update primary email (same entity)

1. Log into [dashboard.razorpay.com](https://dashboard.razorpay.com).
2. **Settings** → **Profile** → **Account Email** → update to new email.
3. Razorpay will send a verification link to both old and new emails.
4. Verify from the new email.

### 8c. Update webhook endpoints (if they reference your email)

1. Razorpay Dashboard → **Settings** → **Webhooks**.
2. Confirm all webhooks still point to `https://sng-adwisers.com/api/webhooks/razorpay`.
3. No changes needed if the domain is the same.

### 8d. Update API keys in Vercel if you rotate them

1. Razorpay Dashboard → **Settings** → **API Keys** → regenerate if needed.
2. Update `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Vercel env vars.

---

## Step 9 — n8n (Automation Flows)

n8n runs the content pipeline and community operations workflows.

### 9a. If self-hosted n8n

No account transfer needed — you own the server. Just:
1. Update any credentials that reference the old email (e.g. Resend sender address in HTTP nodes).
2. Update `FROM_EMAIL` environment variable in n8n if applicable.

### 9b. If using n8n Cloud

1. Log into [n8n.cloud](https://n8n.cloud) → **Settings** → **Profile** → update email.
2. Or: export all workflows → create new account with new email → import workflows.

**To export all workflows:**
1. n8n → left panel → **Workflows** → select all → **Export**.
2. This downloads JSON files — the same format as in `n8n-flows/` in the codebase.

**To import into new account:**
1. New n8n account → **Workflows** → **Import** → upload each JSON file.
2. Re-enter all credentials (Supabase, Claude API, LinkedIn, Instagram, etc.) in the new n8n credentials manager.

---

## Step 10 — Domain & DNS (sng-adwisers.com)

The domain itself doesn't need to change. But confirm who controls the registrar login.

### 10a. Find your domain registrar

1. Go to [who.is](https://who.is) and search `sng-adwisers.com` to see the registrar.
2. Common registrars: GoDaddy, Namecheap, Google Domains (now Squarespace).

### 10b. Update registrar account email

1. Log into the registrar with old credentials.
2. Account Settings → update email to the new professional address.
3. Verify from new email.

### 10c. Verify DNS records are intact

After the transfer, confirm these DNS records exist (the ones Vercel and Resend need):

```
Type   Name                   Value
A      @                      76.76.21.21   (Vercel)
CNAME  www                    cname.vercel-dns.com
TXT    @                      "v=spf1 include:..."  (for Resend/email)
CNAME  resend._domainkey      [your Resend DKIM record]
TXT    _dmarc                 "v=DMARC1; p=none; ..."
```

---

## Step 11 — GitHub Repository (Source Code)

### 11a. Transfer repo to new account

1. Go to the repo on GitHub → **Settings** → scroll to bottom → **Danger Zone** → **Transfer**.
2. Enter repo name to confirm → enter new GitHub username.
3. The new account must have a GitHub account.

### 11b. Update Vercel GitHub integration

After repo transfer, Vercel's GitHub connection may break:
1. Vercel → project → **Settings** → **Git** → **Disconnect** → **Connect** to the same repo under the new account.
2. Redeploy to confirm CI/CD still works.

---

## Step 12 — Admin Email Hardcoded in the App

Search the codebase for hardcoded admin emails and update them:

```bash
grep -r "saksham.gpt2001@gmail.com" --include="*.ts" --include="*.tsx"
```

Files that need updating:
- `app/(app)/complaints/page.tsx` line 5 — `const ADMIN_EMAIL`
- `app/api/admin/complaints/route.ts` line 5
- `app/api/admin/complaints/[id]/route.ts` line 5
- `app/api/report-issue/route.ts` — `to: ['saksham.gpt2001@gmail.com']`
- `n8n-flows/03-community-operations.json` — all `saksham.gpt2001@gmail.com` references

**Better long-term fix:** Move the admin email to an environment variable:
```env
ADMIN_EMAIL=saksham@sngadvisers.com
```
Then read it with `process.env.ADMIN_EMAIL` in the route files.

---

## Post-Transfer Checklist

Run through these after completing all steps:

- [ ] Login with Google works on sng-adwisers.com
- [ ] Login with Microsoft works
- [ ] Email+password login works
- [ ] Password reset email arrives and links to the reset-password page
- [ ] Complaint filed → admin email received at the new address
- [ ] Team invite email sends successfully (Resend working)
- [ ] File upload works (R2 configured)
- [ ] Recurring task spawn works (Inngest working — check Inngest dashboard)
- [ ] Razorpay webhook fires on test payment
- [ ] n8n flows active and running (check execution history)
- [ ] Domain resolves correctly (`https://sng-adwisers.com`)
- [ ] SSL certificate valid (Vercel handles this automatically)

---

## Emergency Rollback

If something breaks after the transfer:
1. Re-add the old email as Owner to Supabase and Vercel immediately.
2. The old email will still have access if you haven't removed it yet (do the removal last).
3. Old API keys and credentials still work until you explicitly rotate them.
4. DNS changes propagate in 0–48 hours — keep the old config backed up.

---

*Last updated: May 2026 · Planora v1.0*
