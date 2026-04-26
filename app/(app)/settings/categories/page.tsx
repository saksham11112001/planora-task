export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getOrgMembership } from '@/lib/supabase/cached'
import { redirect }     from 'next/navigation'
import { CategoriesForm } from './CategoriesForm'
import type { Metadata }  from 'next'
export const metadata: Metadata = { title: 'Client categories' }

export default async function CategoriesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const mb = await getOrgMembership(user.id)
  if (!mb || !['owner','admin'].includes(mb.role)) redirect('/settings')

  const supabase = await createClient()
  const { data: settings } = await supabase.from('org_settings').select('client_categories').eq('org_id', mb.org_id).maybeSingle()
  const categories: string[] = (settings?.client_categories as string[]) ?? ['Retainer','Project-based','One-time','Enterprise','SMB','Startup']
  return (
    <div className="page-container" style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Client categories</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        Define the category options that appear when creating or editing clients.
      </p>
      <CategoriesForm orgId={mb.org_id} initial={categories}/>
    </div>
  )
}
