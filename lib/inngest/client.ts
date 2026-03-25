import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'planora',
  name: 'Planora',
})

export type PlanoraEvents = {
  'task/assigned': {
    data: {
      task_id: string; task_title: string
      assignee_id: string; assignee_email: string; assignee_phone?: string | null
      assigner_name: string; org_id: string; org_name: string
      due_date?: string | null; project_name?: string | null
    }
  }
  'task/due-soon': {
    data: {
      task_id: string; task_title: string
      assignee_id: string; assignee_email: string; assignee_phone?: string | null
      due_date: string; org_name: string; project_name?: string | null
    }
  }
  'task/approval-requested': {
    data: {
      task_id: string; task_title: string; submitter_name: string
      manager_email: string; manager_phone?: string | null; org_name: string
    }
  }
  'task/approval-completed': {
    data: {
      task_id: string; task_title: string; decision: 'approved' | 'rejected'
      assignee_id: string; assignee_email: string; assignee_phone?: string | null
      reviewer_name: string; org_name: string
    }
  }
  'task/commented': {
    data: {
      task_id: string; task_title: string; commenter_name: string
      assignee_email: string; assignee_phone?: string | null; org_name: string
    }
  }
  'reminders/daily-check': { data: { triggered_at: string } }
  'recurring/daily-spawn':  { data: { triggered_at: string } }
}
