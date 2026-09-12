import { inngest }          from '../client'
import { resend, FROM }     from '@/lib/email/resend'
import { superAdminEmails } from '@/lib/utils/superAdmin'

/**
 * Emails the super admins whenever any Inngest function fails.
 *
 * `inngest/function.failed` is a system event Inngest emits after a run has
 * exhausted its retries. It is delivered on every plan, which is the point:
 * this is alerting we own, in version control, rather than a dashboard toggle
 * whose availability depends on the billing tier.
 *
 * The gap this closes is a real one. The evening digest failed after running
 * for 9m24s and saturating the database, and the only reason anyone found out
 * was that someone opened the Inngest dashboard by hand while investigating a
 * site-wide outage. Nothing pushed that failure anywhere.
 *
 * Never throws. An alerting function that fails would emit another
 * `inngest/function.failed`, which is this function's own trigger.
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Enough stack to recognise the fault, not enough to fill a mailbox. */
const MAX_STACK_CHARS = 1_500

export const onFunctionFailed = inngest.createFunction(
  {
    id:   'alert-on-function-failure',
    name: 'Alert super admins when a background job fails',
    concurrency: { limit: 1 },
  },
  { event: 'inngest/function.failed' },
  async ({ event }) => {
    const to = superAdminEmails()
    if (!to.length) return { skipped: 'no super admins configured' }

    const d          = (event.data ?? {}) as Record<string, any>
    const functionId = String(d.function_id ?? 'unknown')

    // Loop guard. If this function ever fails, Inngest emits the very event
    // that triggers it, and without this the pair would feed each other until
    // something ran out — the daily email quota being the likely casualty.
    if (functionId.includes('alert-on-function-failure')) {
      console.error('[alert] the failure alerter itself failed — not re-alerting')
      return { skipped: 'self-failure' }
    }

    const err     = (d.error ?? {}) as Record<string, any>
    const message = String(err.message ?? err.error ?? 'No error message reported')
    const stack   = String(err.stack ?? '').slice(0, MAX_STACK_CHARS)
    const runId   = String(d.run_id ?? '')
    const when    = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

    const html = `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:640px">
        <h2 style="margin:0 0 4px">Background job failed</h2>
        <p style="margin:0 0 20px;color:#666">${esc(when)} IST</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr>
            <td style="padding:8px 12px;background:#f6f6f6;width:110px"><strong>Function</strong></td>
            <td style="padding:8px 12px;background:#f6f6f6"><code>${esc(functionId)}</code></td>
          </tr>
          <tr>
            <td style="padding:8px 12px"><strong>Error</strong></td>
            <td style="padding:8px 12px;color:#b00">${esc(message)}</td>
          </tr>
          ${runId ? `<tr>
            <td style="padding:8px 12px;background:#f6f6f6"><strong>Run</strong></td>
            <td style="padding:8px 12px;background:#f6f6f6"><code>${esc(runId)}</code></td>
          </tr>` : ''}
        </table>
        ${stack ? `<pre style="margin-top:20px;padding:12px;background:#fafafa;border:1px solid #eee;
          border-radius:6px;font-size:12px;white-space:pre-wrap;word-break:break-word;color:#444"
          >${esc(stack)}</pre>` : ''}
        <p style="margin-top:24px;font-size:13px;color:#666">
          Open the run in the Inngest dashboard for the full timeline and payload.
        </p>
      </div>`

    try {
      const { error } = await resend.emails.send({
        from:    FROM,
        to,
        subject: `⚠️ upFloat job failed: ${functionId}`,
        html,
      })
      // Logged rather than thrown, for the loop-guard reason above. If email
      // itself is the thing that is broken, this is already unreachable and
      // retrying would only consume quota.
      if (error) console.error('[alert] could not send failure alert:', error)
    } catch (e) {
      console.error('[alert] could not send failure alert:', e)
    }

    return { alerted: to.length, functionId }
  }
)
