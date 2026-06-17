import { redirect } from 'next/navigation'

// Unified partner portal — redirect to the standalone partner dashboard
// which works for both upFloat users and standalone partners.
export default function PartnerPage() {
  redirect('/partners/dashboard')
}
