export const dynamic = 'force-dynamic'
import { MsmeVendorForm } from './MsmeVendorForm'
import type { Metadata }  from 'next'

export const metadata: Metadata = { title: 'MSME Compliance Form' }

export default async function MsmeFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <MsmeVendorForm token={token} />
}
