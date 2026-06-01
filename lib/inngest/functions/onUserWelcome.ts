import { inngest }         from '../client'
import { sendWelcomeEmail, sendDay2Email } from '@/lib/email/send'

export const onUserWelcome = inngest.createFunction(
  { id: 'on-user-welcome', name: 'On User Welcome — welcome + day-2 emails' },
  { event: 'user/welcome' },
  async ({ event, step }) => {
    const { userEmail, userName, orgName, trialDays } = event.data

    // Step 1: Send welcome email immediately
    await step.run('send-welcome-email', async () => {
      await sendWelcomeEmail({ to: userEmail, userName, orgName, trialDays })
    })

    // Step 2: Wait 2 days before the follow-up
    await step.sleep('wait-2-days', '2 days')

    // Step 3: Send day-2 tips email
    await step.run('send-day2-email', async () => {
      await sendDay2Email({ to: userEmail, userName, orgName })
    })

    return { sent: ['welcome', 'day-2'], to: userEmail }
  }
)
