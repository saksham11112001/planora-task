import type { Metadata } from 'next'
import { AppearanceView } from './AppearanceView'
export const metadata: Metadata = { title: 'Appearance' }
export default function AppearancePage() { return <AppearanceView/> }
