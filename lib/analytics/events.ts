/**
 * The funnel, defined in one place.
 *
 * WHY THIS EXISTS
 * ---------------
 * PostHog has been installed for a while and captures three things:
 * $pageview, an identify() in AppShell, and org_created in onboarding. So the
 * question "did this visitor become a customer" is answerable, and almost
 * nothing after it is: whether they added a client, ever created a task, came
 * back a second week, or looked at the upgrade page.
 *
 * That matters now rather than in general. Spending on marketing without this
 * means traffic numbers go up and nobody can say which channel produced a
 * working firm rather than a bounce.
 *
 * NAMES ARE AN INTERFACE
 * ----------------------
 * Renaming an event does not rename the history: PostHog keeps the old name
 * with the old data and starts a new series under the new one, and the funnel
 * silently splits in two. Every name lives here, and a test pins the exact
 * strings so a rename has to be deliberate. 'org_created' in particular is
 * ALREADY LIVE and carries real history — it must never be renamed.
 *
 * CONSENT
 * -------
 * Everything goes through trackEvent(), which no-ops until PostHog is loaded,
 * and PostHog only loads after the cookie banner is accepted. These helpers
 * are therefore safe to call unconditionally. Server-side capture was
 * deliberately not used: it would fire for people who declined the banner,
 * which is the one thing the banner is for.
 *
 * NO PERSONAL DATA IN PROPERTIES
 * ------------------------------
 * Counts, plan tiers, booleans and enums only — never a client's name, a
 * vendor's email, or anything a person could be identified by. Those are the
 * firm's data and their clients' data, and an analytics vendor is not a place
 * to put either.
 */

export const EVENTS = {
  /**
   * A visitor tried to authenticate. Top of the funnel.
   *
   * Named for what it can actually observe. It was 'signup_started' first,
   * until the call site showed that the Google and Microsoft buttons serve
   * sign-in and sign-up alike — the page cannot tell which until Supabase
   * answers. An event called signup_started that fires every time a returning
   * user signs in would have inflated the top of the funnel permanently, and
   * by the time anyone noticed, the name would be carrying history and be
   * expensive to change. The `intent` property carries what IS known.
   */
  AUTH_STARTED: 'auth_started',
  /** An organisation was created. ALREADY LIVE — never rename. */
  ORG_CREATED: 'org_created',
  /** A client was added. The first one is the real activation moment. */
  CLIENT_CREATED: 'client_created',
  /** A task was created, by any route. */
  TASK_CREATED: 'task_created',
  /** Someone invited a colleague — the strongest single retention signal. */
  MEMBER_INVITED: 'member_invited',
  /** CA compliance tasks generated for a client. The CA 'aha' moment. */
  COMPLIANCE_GENERATED: 'compliance_tasks_generated',
  /** MSME vendors imported. The MSME 'aha' moment. */
  MSME_VENDORS_IMPORTED: 'msme_vendors_imported',
  /** MSME declaration requests actually sent. */
  MSME_EMAILS_SENT: 'msme_emails_sent',
  /** Someone looked at upgrading. Intent, not revenue. */
  UPGRADE_VIEWED: 'upgrade_viewed',
  /** Someone started checkout. */
  CHECKOUT_STARTED: 'checkout_started',
} as const

export type EventName = (typeof EVENTS)[keyof typeof EVENTS]

/** How someone authenticated. A closed set, so the funnel can split by it. */
export type AuthMethod = 'google' | 'microsoft' | 'email' | 'magic_link'

/**
 * What the page could tell about why they were authenticating.
 *
 * 'unknown' is the honest answer for the OAuth buttons, which are shown
 * before the user has said whether they have an account. Recording it as
 * unknown keeps it countable and keeps it out of the signup numbers; guessing
 * would put it in one of them and nobody would ever find out it was wrong.
 */
export type AuthIntent = 'signin' | 'signup' | 'unknown'

/*
 * There is deliberately no firstness()/is_first helper here.
 *
 * Activation is about the FIRST client and the FIRST task, but PostHog
 * already computes "the first time this user performed an event" natively in
 * funnels and trends. Sending our own flag would mean every creation form
 * fetching a count it does not otherwise need, and two sources of truth that
 * could disagree — with ours being the one nobody would check.
 */

/**
 * Strip anything that could identify a person before it leaves the browser.
 *
 * A belt-and-braces net, not the primary defence — the call sites are written
 * to pass counts and enums only. It exists because the cost of a mistake here
 * is a client's name sitting in a third-party analytics product, and a lint
 * rule cannot see a value that is only a name at runtime.
 */
const FORBIDDEN_KEYS = /email|phone|gstin|\bpan\b|name|address|token|udyam/i

/**
 * Keys that match the pattern above but are not identifying.
 *
 * org_name is the account holder's OWN business name, and identify() in
 * AppShell already sends it — stripping it here while sending it there would
 * be an inconsistency pretending to be a safeguard. What must never leave is
 * the names of the firm's CLIENTS and their clients' VENDORS: those people
 * never agreed to anything, are not the customer, and have no relationship
 * with an analytics vendor.
 */
const ALLOWED_KEYS = new Set([
  'org_name', 'plan', 'from_plan', 'to_plan', 'method', 'intent',
])

export function safeProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (ALLOWED_KEYS.has(k)) { out[k] = v; continue }
    if (FORBIDDEN_KEYS.test(k)) continue
    // An address in a field called something innocuous. Caught by value,
    // because a key-name rule cannot see what a value turns out to hold.
    if (typeof v === 'string' && v.includes('@')) continue
    out[k] = v
  }
  return out
}
