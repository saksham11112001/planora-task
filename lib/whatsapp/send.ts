import { sendWhatsApp } from './client'

/**
 * TEMPLATE REGISTRY
 * Register these in your MSG91 WhatsApp Business account before using.
 * Template variables are positional — VAR1, VAR2, etc.
 *
 * planora_task_assigned:
 *   "Hi {{VAR1}}, {{VAR2}} assigned you a task: *{{VAR3}}*. Due: {{VAR4}}. Open: {{VAR5}}"
 *
 * planora_task_due_soon:
 *   "⏰ Reminder, {{VAR1}}! Your task *{{VAR2}}* is due in {{VAR3}}. Open: {{VAR4}}"
 *
 * planora_approval_needed:
 *   "🔔 {{VAR1}}, *{{VAR2}}* submitted a task for your approval: *{{VAR3}}*. Review: {{VAR4}}"
 *
 * planora_task_approved:
 *   "✅ {{VAR1}}, your task *{{VAR2}}* was approved by {{VAR3}}. Open: {{VAR4}}"
 *
 * planora_task_rejected:
 *   "❌ {{VAR1}}, your task *{{VAR2}}* was rejected by {{VAR3}}. Please revise. Open: {{VAR4}}"
 *
 * planora_task_overdue:
 *   "⚠️ {{VAR1}}, your task *{{VAR2}}* is overdue (was due {{VAR3}}). Open: {{VAR4}}"
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://planora.in'
function taskUrl(taskId: string, projectId?: string | null) {
  return projectId ? `${APP_URL}/projects/${projectId}` : `${APP_URL}/inbox`
}

export async function waTaskAssigned(p: {
  phone: string; assigneeName: string; assignerName: string
  taskTitle: string; dueDate?: string | null
  taskId: string; projectId?: string | null
}) {
  return sendWhatsApp({
    to:            p.phone,
    template_name: 'planora_task_assigned',
    variables: [
      p.assigneeName, p.assignerName, p.taskTitle,
      p.dueDate ?? 'No due date',
      taskUrl(p.taskId, p.projectId),
    ],
  })
}

export async function waTaskDueSoon(p: {
  phone: string; assigneeName: string; taskTitle: string
  hoursLeft: number; taskId: string; projectId?: string | null
}) {
  const timeLabel = p.hoursLeft <= 1
    ? 'less than 1 hour'
    : p.hoursLeft < 24
    ? `${p.hoursLeft} hours`
    : 'today'

  return sendWhatsApp({
    to:            p.phone,
    template_name: 'planora_task_due_soon',
    variables: [p.assigneeName, p.taskTitle, timeLabel, taskUrl(p.taskId, p.projectId)],
  })
}

export async function waApprovalNeeded(p: {
  phone: string; managerName: string; submitterName: string
  taskTitle: string; taskId: string; projectId?: string | null
}) {
  return sendWhatsApp({
    to:            p.phone,
    template_name: 'planora_approval_needed',
    variables: [p.managerName, p.submitterName, p.taskTitle, taskUrl(p.taskId, p.projectId)],
  })
}

export async function waApprovalResult(p: {
  phone: string; assigneeName: string; taskTitle: string
  decision: 'approved' | 'rejected'; reviewerName: string
  taskId: string; projectId?: string | null
}) {
  const template = p.decision === 'approved' ? 'planora_task_approved' : 'planora_task_rejected'
  return sendWhatsApp({
    to: p.phone, template_name: template,
    variables: [p.assigneeName, p.taskTitle, p.reviewerName, taskUrl(p.taskId, p.projectId)],
  })
}

export async function waTaskOverdue(p: {
  phone: string; assigneeName: string; taskTitle: string
  dueDate: string; taskId: string; projectId?: string | null
}) {
  return sendWhatsApp({
    to:            p.phone,
    template_name: 'planora_task_overdue',
    variables: [p.assigneeName, p.taskTitle, p.dueDate, taskUrl(p.taskId, p.projectId)],
  })
}
