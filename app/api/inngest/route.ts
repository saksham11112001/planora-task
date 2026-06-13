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
import { digestMorning, digestEvening } from '@/lib/inngest/functions/digestNotifications'
import { clientDocReminders }           from '@/lib/inngest/functions/clientDocReminders'
import { onUserWelcome }               from '@/lib/inngest/functions/onUserWelcome'
import { monthlyDocReminders }         from '@/lib/inngest/functions/monthlyDocReminders'
import { reEngagement }                from '@/lib/inngest/functions/reEngagement'
import { onboardingNudge }             from '@/lib/inngest/functions/onboardingNudge'
import { upgradePush }                 from '@/lib/inngest/functions/upgradePush'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    onUserWelcome,
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
    digestMorning,
    digestEvening,
    clientDocReminders,
    monthlyDocReminders,
    reEngagement,
    onboardingNudge,
    upgradePush,
  ],
})
