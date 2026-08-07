/**
 * Invite someone to an org WITHOUT going through Supabase's built-in SMTP.
 *
 * Why this exists
 * ---------------
 * admin.auth.admin.inviteUserByEmail() sends the invitation through Supabase's
 * own mail service, which is rate limited to a handful of messages per hour.
 * Once that budget is spent the call fails outright with
 * "email rate limit exceeded" and NOTHING happens: no auth user, no membership
 * row, and no email. Invites silently stop working for the rest of the hour —
 * and a bulk member import blows the budget within seconds.
 *
 * admin.auth.admin.generateLink() only MINTS the link; it sends nothing, so it
 * is not rate limited. We deliver the link over Brevo, the transport every
 * other product email already uses.
 *
 * Returns the auth user id so callers can add the membership row themselves.
 */
import { sendTeamInviteEmail } from '@/lib/email/send'

export interface InviteResult {
  /** Auth user id — present whether the account was created or already existed. */
  userId:  string | null
  /** True when the invitation email was delivered. */
  emailed: boolean
  /** Set when the invite could not be completed at all. */
  error:   string | null
}

export async function inviteUserToOrg(
  admin: any,
  opts: {
    email:        string
    orgId:        string
    role:         string
    appUrl:       string
    /** Optional display name to seed on the auth user. */
    name?:        string | null
    /** Shown in the email as "X has added you". */
    inviterName?: string | null
    orgName?:     string | null
    /** Set false to create the account without emailing (bulk flows). */
    sendEmail?:   boolean
  },
): Promise<InviteResult> {
  const email    = opts.email.trim().toLowerCase()
  const metadata: Record<string, unknown> = {
    invited_to_org: opts.orgId,
    invited_role:   opts.role,
    ...(opts.name ? { full_name: opts.name } : {}),
  }
  const redirectTo = `${opts.appUrl}/auth/confirm`

  let actionLink: string | null = null
  let userId:     string | null = null

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'invite', email, options: { data: metadata, redirectTo },
  })

  if (error) {
    // An auth user can exist without a public.users row — someone invited
    // before who never opened the link. 'invite' refuses those, so fall back to
    // a magic link, which signs the existing account in just the same. The
    // metadata must be written separately: only 'invite' accepts it.
    if (!/already|registered|exists/i.test(error.message ?? '')) {
      return { userId: null, emailed: false, error: error.message ?? 'Could not create the invitation' }
    }

    const { data: list } = await admin.auth.admin.listUsers()
    const existing = list?.users?.find((u: any) => u.email?.toLowerCase() === email)
    if (!existing) {
      return { userId: null, emailed: false, error: 'User exists in auth but could not be resolved' }
    }
    userId = existing.id
    await admin.auth.admin.updateUserById(existing.id, {
      user_metadata: { ...(existing.user_metadata ?? {}), ...metadata },
    })

    const { data: magic, error: magicErr } = await admin.auth.admin.generateLink({
      type: 'magiclink', email, options: { redirectTo },
    })
    if (magicErr) {
      // The account is usable — they can still sign in normally — so this is
      // not a hard failure, just an undelivered email.
      return { userId, emailed: false, error: null }
    }
    actionLink = magic?.properties?.action_link ?? null
  } else {
    userId     = data?.user?.id ?? null
    actionLink = data?.properties?.action_link ?? null
  }

  if (opts.sendEmail === false || !actionLink) {
    return { userId, emailed: false, error: null }
  }

  const { error: sendErr } = (await sendTeamInviteEmail({
    to:          email,
    orgName:     opts.orgName ?? 'your workspace',
    inviterName: opts.inviterName ?? null,
    role:        opts.role,
    actionUrl:   actionLink,
  })) ?? {}

  return { userId, emailed: !sendErr, error: null }
}
