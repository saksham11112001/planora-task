import type { Metadata } from 'next'
import { CompliancePage } from './CompliancePage'

export const metadata: Metadata = { title: 'CA Compliance' }

export default function Page() {
  return <CompliancePage />
}
