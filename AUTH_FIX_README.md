// AUTH_FIX_README.md - read this first

# Auth fix — login redirect loop

## Root cause (one or more of these)

1. **Wrong middleware cookie handling** — middleware wasn't calling
   `supabase.auth.getUser()` properly, or wasn't writing refreshed cookies
   back to the response. The session expired and every request looked
   unauthenticated.

2. **Wrong Supabase client package** — using `createClient` from
   `@supabase/supabase-js` directly instead of `@supabase/ssr`. The SSR
   package is what reads/writes cookies in Next.js App Router. Without it,
   the server never sees the session.

3. **Missing OAuth callback route** — Google OAuth redirects to
   `/auth/callback?code=xxx` but if that route doesn't exist, the code is
   never exchanged for a session → user gets sent to login again.

4. **getSession() instead of getUser()** — `getSession()` trusts the cookie
   without re-validating. If the token was refreshed, `getSession()` can
   return stale data. Always use `getUser()` in middleware.

5. **Matcher too narrow** — if the middleware `matcher` didn't cover the
   app routes, the session cookie was never refreshed on those navigations.

---

## Files in this patch

| File | What it fixes |
|------|--------------|
| `middleware.ts` | Correct cookie refresh using `createServerClient` from `@supabase/ssr`. Uses `getUser()` not `getSession()`. Broad matcher. |
| `lib/supabase/server.ts` | Server client using `@supabase/ssr` `createServerClient` with proper cookie handlers. |
| `lib/supabase/client.ts` | Browser client using `@supabase/ssr` `createBrowserClient`. |
| `app/(auth)/login/page.tsx` | Login form with `router.push(next) + router.refresh()` after sign-in. Handles `?next=` param. |
| `app/auth/callback/route.ts` | **NEW** — OAuth code exchange. Required for Google login to work. |

---

## Step 1: Verify @supabase/ssr is installed

Run in your terminal:
```
npm list @supabase/ssr
```

If it's not there:
```
npm install @supabase/ssr
```

Your `@supabase/supabase-js` can stay — it's still needed for types and the admin client.

---

## Step 2: Check Supabase dashboard — redirect URLs

In Supabase dashboard → Authentication → URL Configuration:

- **Site URL**: `https://sng-adwisers.com`
- **Redirect URLs** (add all of these):
  ```
  https://sng-adwisers.com/auth/callback
  http://localhost:3000/auth/callback
  ```

If `https://sng-adwisers.com/auth/callback` is NOT in this list, Google
OAuth will fail even with the correct code.

---

## Step 3: Check Google Cloud Console

Google → APIs & Services → Credentials → your OAuth client → Authorised redirect URIs:
```
https://[your-supabase-project-ref].supabase.co/auth/v1/callback
```

For Planora: `https://xjaybcthnneppfdgmtaq.supabase.co/auth/v1/callback`

This must match exactly — no trailing slash.

---

## Step 4: Replace files

Copy all files from this patch into your repo, keeping the same paths.

---

## How to test after deploying

1. Open an incognito window
2. Go to `https://sng-adwisers.com/dashboard`
3. Should redirect to `/login?next=/dashboard`
4. Log in with email/password
5. Should land on `/dashboard` — NOT loop back to `/login`
6. Refresh the page — should stay on `/dashboard`
7. Close browser, reopen — should still be logged in (session persists via cookie)
