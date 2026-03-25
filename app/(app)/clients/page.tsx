import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import Link              from 'next/link'
import { Plus, Users2 }  from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Clients' }
export const revalidate = 20

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: mb } = await supabase
    .from('org_members').select('org_id, role')
    .eq('user_id', user.id).eq('is_active', true).single()
  if (!mb) redirect('/onboarding')

  const { data: clients } = await supabase
    .from('clients').select('id, name, color, status, email, company, industry')
    .eq('org_id', mb.org_id).order('name')

  const canManage = ['owner', 'admin', 'manager'].includes(mb.role)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-1">{clients?.length ?? 0} clients</p>
        </div>
        {canManage && (
          <Link href="/clients/new" className="btn btn-brand flex items-center gap-2">
            <Plus className="h-4 w-4"/> New client
          </Link>
        )}
      </div>

      {(!clients || clients.length === 0) ? (
        <div className="card text-center py-16">
          <Users2 className="h-12 w-12 text-gray-200 mx-auto mb-3"/>
          <h3 className="font-semibold text-gray-900 mb-1">No clients yet</h3>
          <p className="text-sm text-gray-400 mb-4">Add your first client to link projects to them</p>
          {canManage && <Link href="/clients/new" className="btn btn-brand">Add client</Link>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(c => (
            <Link key={c.id} href={`/clients/${c.id}`}
              className="card-elevated p-5 hover:shadow-md transition-shadow block">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                  style={{ background: c.color }}>
                  {c.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                      c.status === 'active'   ? 'bg-green-100 text-green-700' :
                      c.status === 'prospect' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-500'}`}>
                      {c.status}
                    </span>
                  </div>
                  {c.company  && <p className="text-sm text-gray-500 truncate">{c.company}</p>}
                  {c.industry && <p className="text-xs text-gray-400 mt-0.5">{c.industry}</p>}
                  {c.email    && <p className="text-xs text-gray-400 mt-0.5 truncate">{c.email}</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
