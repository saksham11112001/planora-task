export type OrgRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
export type PlanTier = 'free' | 'starter' | 'pro' | 'business'
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'completed' | 'cancelled'
export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent'
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled'
export type ClientStatus = 'active' | 'inactive' | 'prospect'
export type Frequency = 'daily' | 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly' | 'annual'

export interface User {
  id: string; name: string; email: string; avatar_url: string | null
}

export interface Org {
  id: string; name: string; slug: string
  plan_tier: PlanTier; logo_color: string; industry?: string | null
}

export interface Workspace {
  id: string; org_id: string; name: string; color: string; is_default: boolean
}

export interface ClientGroup {
  id: string; org_id: string; name: string; color: string
  notes?: string | null; created_at: string; updated_at: string
}

export interface Client {
  id: string; org_id: string; name: string; email?: string | null
  color: string; status: ClientStatus; company?: string | null
  group_id?: string | null
}

export interface Project {
  id: string; org_id: string; name: string; description?: string | null
  color: string; status: ProjectStatus; due_date?: string | null
  client_id?: string | null; is_archived: boolean; budget?: number | null
  hours_budget?: number | null
  client?: { id: string; name: string; color: string } | null
}

export interface Task {
  id: string; org_id: string; parent_task_id?: string | null; project_id?: string | null; client_id?: string | null
  title: string; description?: string | null; status: TaskStatus; priority: TaskPriority
  assignee_id?: string | null; due_date?: string | null; completed_at?: string | null
  estimated_hours?: number | null; is_recurring: boolean; frequency?: Frequency | null
  next_occurrence_date?: string | null; approval_required: boolean
  approval_status?: 'pending' | 'approved' | 'rejected' | null
  is_archived: boolean; created_at: string; updated_at?: string
  approver_id?: string | null; approver?: { id: string; name: string } | null
  assignee?: { id: string; name: string } | null
  project?: { id: string; name: string; color: string } | null
  client?: { id: string; name: string; color: string } | null
  is_billable?: boolean; billable_amount?: number | null
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled'

export interface Invoice {
  id: string; org_id: string; client_id?: string | null; group_id?: string | null
  invoice_number: string; title: string
  issue_date: string; due_date?: string | null
  status: InvoiceStatus; notes?: string | null
  gstin?: string | null; gst_rate: number; discount_amount: number
  subtotal: number; gst_amount: number; total: number
  created_by?: string | null; created_at: string; updated_at: string
  client?: { id: string; name: string; color: string } | null
  items?: InvoiceItem[]
}

export interface InvoiceItem {
  id: string; invoice_id: string; org_id: string
  task_id?: string | null; description: string
  quantity: number; unit_price: number; amount: number
  created_at: string
  task?: { id: string; title: string } | null
}

export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: '#64748b', bg: '#f8fafc' },
  sent:      { label: 'Sent',      color: '#0d9488', bg: '#f0fdfa' },
  paid:      { label: 'Paid',      color: '#16a34a', bg: '#f0fdf4' },
  cancelled: { label: 'Cancelled', color: '#94a3b8', bg: '#f8fafc' },
}

export interface TaskComment {
  id: string; task_id: string; content: string; created_at: string
  author: { id: string; name: string } | null
}

export interface TimeLog {
  id: string; task_id?: string | null; project_id?: string | null
  user_id: string; hours: number; logged_date: string
  description?: string | null; is_billable: boolean
  task?: { id: string; title: string } | null
  project?: { id: string; name: string; color: string } | null
  user?: { id: string; name: string } | null
}

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; dot: string }> = {
  none:   { label: 'None',   color: '#94a3b8', bg: '#f8fafc', dot: '#94a3b8' },
  low:    { label: 'Low',    color: '#16a34a', bg: '#f0fdf4', dot: '#16a34a' },
  medium: { label: 'Medium', color: '#ca8a04', bg: '#fffbeb', dot: '#ca8a04' },
  high:   { label: 'High',   color: '#ea580c', bg: '#fff7ed', dot: '#ea580c' },
  urgent: { label: 'Urgent', color: '#dc2626', bg: '#fef2f2', dot: '#dc2626' },
}

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; dot: string }> = {
  todo:        { label: 'To do',      color: '#64748b', bg: '#f8fafc', dot: '#94a3b8' },
  in_progress: { label: 'In progress',color: '#0d9488', bg: '#f0fdfa', dot: '#0d9488' },
  in_review:   { label: 'In review',  color: '#7c3aed', bg: '#f5f3ff', dot: '#7c3aed' },
  completed:   { label: 'Completed',  color: '#16a34a', bg: '#f0fdf4', dot: '#16a34a' },
  cancelled:   { label: 'Cancelled',  color: '#94a3b8', bg: '#f8fafc', dot: '#94a3b8' },
}

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',    color: '#0d9488', bg: '#f0fdfa' },
  on_hold:   { label: 'On hold',   color: '#ca8a04', bg: '#fffbeb' },
  completed: { label: 'Completed', color: '#16a34a', bg: '#f0fdf4' },
  cancelled: { label: 'Cancelled', color: '#94a3b8', bg: '#f8fafc' },
}
