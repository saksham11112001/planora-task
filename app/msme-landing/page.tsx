import type { Metadata }          from 'next'
import { MsmeLandingClient }      from './MsmeLandingClient'

export const metadata: Metadata = {
  title: 'MSME Tracker — Automate Section 43B(h) Compliance | upFloat',
  description: 'Struggling to track MSME vendor payments and collect Udyam declarations? upFloat automates the entire process — reminders, forms, deadlines, and export. Start free.',
}

export default function MsmeLandingPage() {
  return <MsmeLandingClient />
}
