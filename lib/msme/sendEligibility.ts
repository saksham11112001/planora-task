/**
 * The single rule that decides whether a vendor may be emailed for a given
 * half-year.
 *
 * WHY THIS EXISTS
 * ---------------
 * Three places asked the same question and answered it differently:
 *
 *   - "Shoot email"            (app/api/msme/vendors/[id]/shoot-email)
 *   - bulk send                (app/api/msme/bulk-shoot)
 *   - the nightly reminder     (lib/inngest/functions/msmeReminders.ts)
 *
 * They already disagreed before half-yearly periods existed: bulk-shoot
 * silently dropped a vendor whose cap was reached, shoot-email returned a 422
 * explaining it, and the cron applied its own cap again. Making all three
 * period-aware by editing each one separately would have multiplied that
 * divergence by two cycles.
 *
 * Everything here is pure, so the rules are testable without a database, and
 * nothing reads a clock.
 *
 * THE TWO COUNTERS
 * ----------------
 * Read lib/msme/declarations.ts first. In short:
 *   lifetimeEmailCount — msme_vendors.email_count. The billing slot ledger.
 *                        Monotonic, never reset.
 *   periodEmailCount   — msme_declarations.email_count. Reminders sent for the
 *                        half-year being chased. Restarts each cycle.
 *
 * The cap applies to the period count. Applying it to the lifetime count is
 * what would make a vendor chased four times in September unreachable in
 * March — i.e. it would break the feature outright.
 */

export type SendSkipReason =
  | 'bounced'            // unsubscribed, or the address hard-bounced
  | 'already_declared'   // they have already answered FOR THIS PERIOD
  | 'max_emails'         // the cap for THIS PERIOD is reached
  | 'slot_limit'         // no vendor slot left in the org's pack

export type SendDecision =
  | { send: true;  consumesSlot: boolean; attemptNo: number }
  | { send: false; reason: SendSkipReason }

/** A declaration's status for the period being chased. 'none' means no
 *  declaration row exists yet, i.e. this cycle has not started for them. */
export type PeriodStatus = 'none' | 'pending' | 'emailed' | 'submitted' | 'not_msme'

export interface SendInput {
  /** msme_vendors.email_bounced — unsubscribed or bounced. */
  emailBounced:       boolean
  /** Status of the declaration for the period being chased. */
  periodStatus:       PeriodStatus
  /** Emails already sent for THIS period. */
  periodEmailCount:   number
  /** Lifetime emails ever sent to this vendor. The slot ledger. */
  lifetimeEmailCount: number
  /** 1 (immediate) + the number of configured follow-up intervals. */
  maxEmails:          number
  /** Vendor slots still available in the org's pack. */
  slotsRemaining:     number
}

/**
 * Order matters.
 *
 * Bounce is first: it is an opt-out, and every send to a dead address chips
 * away at sender reputation, pushing ALL of the firm's vendor mail towards
 * spam. Nothing justifies overriding it.
 *
 * "Already declared" comes before the cap so a vendor who answered on the
 * first email is reported as done rather than as having emails remaining.
 *
 * The slot check is LAST, because it is the only one that depends on
 * org-level budget rather than the vendor, and a vendor who is ineligible
 * anyway must not be counted against that budget.
 */
export function decideSend(o: SendInput): SendDecision {
  if (o.emailBounced) return { send: false, reason: 'bounced' }

  // Scoped to the period: a September submission must not block the March
  // chase. That is the whole point of the period dimension.
  if (o.periodStatus === 'submitted' || o.periodStatus === 'not_msme') {
    return { send: false, reason: 'already_declared' }
  }

  if (o.periodEmailCount >= o.maxEmails) return { send: false, reason: 'max_emails' }

  // A slot is consumed the first time this vendor is EVER emailed. A vendor
  // already paid for in a previous half-year costs nothing to chase again.
  const consumesSlot = o.lifetimeEmailCount === 0
  if (consumesSlot && o.slotsRemaining <= 0) return { send: false, reason: 'slot_limit' }

  return {
    send: true,
    consumesSlot,
    // The attempt number shown in the email ("reminder 2 of 5") is the
    // position within THIS period's sequence, not the vendor's lifetime.
    attemptNo: o.periodEmailCount + 1,
  }
}

/** Why a vendor was skipped, for the bulk send's error list and the 422 the
 *  single send returns. */
export function sendSkipText(reason: SendSkipReason, maxEmails: number): string {
  switch (reason) {
    case 'bounced':          return 'This vendor has unsubscribed or their email bounced — cannot send further emails.'
    case 'already_declared': return 'Vendor has already submitted their details for this period'
    case 'max_emails':       return `Maximum ${maxEmails} emails already sent to this vendor for this period`
    case 'slot_limit':       return 'Email slot limit reached. Upgrade your pack to contact more vendors.'
  }
}

export interface PlanItem<T> {
  vendor:   T
  decision: SendDecision
}

/**
 * Apply decideSend across a batch, drawing down the slot budget as it goes.
 *
 * The budget has to be spent in order rather than pre-sliced: before this,
 * bulk-shoot took the first N never-emailed vendors and dropped the rest, so
 * a batch of 3 new and 40 returning vendors with 2 slots left silently
 * dropped one vendor with no reason attached. Here every vendor gets a
 * decision, and the caller can report exactly why each was skipped.
 */
export function planSends<T>(
  vendors: T[],
  read: (v: T) => Omit<SendInput, 'slotsRemaining'>,
  slotsRemaining: number,
): PlanItem<T>[] {
  let budget = Math.max(0, slotsRemaining)
  return vendors.map(vendor => {
    const decision = decideSend({ ...read(vendor), slotsRemaining: budget })
    if (decision.send && decision.consumesSlot) budget--
    return { vendor, decision }
  })
}
