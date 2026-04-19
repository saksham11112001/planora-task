import { Inngest, EventSchemas } from 'inngest'

export const inngest = new Inngest({
  id:          'taska',
  name:        'Taska',
  eventKey:    process.env.INNGEST_EVENT_KEY,
  signingKey:  process.env.INNGEST_SIGNING_KEY,
})

export type TaskaEvents = {
  'task/assigned': {
    data: {
      task_id: string; task_title: string
      assignee_id: string; assignee_email: string; assignee_name?: string | null; assignee_phone?: string | null
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
  'client/document-uploaded': {
    data: {
      org_id:        string
      client_id:     string
      upload_id:     string
      doc_type_name: string
      period_key:    string
      task_ids:      string[]
    }
  }
}
