import { serve }              from 'inngest/next'
import { inngest }             from '@/lib/inngest/client'
import { onTaskAssigned }      from '@/lib/inngest/functions/onTaskAssigned'
import { onApprovalRequested, onApprovalCompleted } from '@/lib/inngest/functions/onApproval'
import { dailyReminders }      from '@/lib/inngest/functions/dailyReminders'
import { recurringSpawn }      from '@/lib/inngest/functions/recurringSpawn'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    onTaskAssigned,
    onApprovalRequested,
    onApprovalCompleted,
    dailyReminders,
    recurringSpawn,
  ],
  // Signing key required in production; optional in local dev
  signingKey: process.env.INNGEST_SIGNING_KEY,
})
