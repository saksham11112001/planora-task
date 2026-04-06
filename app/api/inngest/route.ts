import { serve }              from 'inngest/next'
import { inngest }             from '@/lib/inngest/client'
import { onTaskAssigned }      from '@/lib/inngest/functions/onTaskAssigned'
import { onApprovalRequested, onApprovalCompleted } from '@/lib/inngest/functions/onApproval'
import { onTaskCommented }     from '@/lib/inngest/functions/onComment'
import { onProjectUpdated }    from '@/lib/inngest/functions/onProjectUpdated'
import { onMemberInvited }     from '@/lib/inngest/functions/onMemberInvited'
import { dailyReminders }      from '@/lib/inngest/functions/dailyReminders'
import { recurringSpawn }      from '@/lib/inngest/functions/recurringSpawn'
import { caComplianceSpawn }   from '@/lib/inngest/functions/caComplianceSpawn'
import { trialExpiry }         from '@/lib/inngest/functions/trialExpiry'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    onTaskAssigned,
    onApprovalRequested,
    onApprovalCompleted,
    onTaskCommented,
    onProjectUpdated,
    onMemberInvited,
    dailyReminders,
    recurringSpawn,
    caComplianceSpawn,
    trialExpiry,
  ],
})
