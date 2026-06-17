// Force light color-scheme for the vendor-facing public form so hardcoded
// light colors remain visible regardless of the visitor's OS dark-mode setting.
import { ForceLightMode } from '@/components/portal/ForceLightMode'

export const viewport = {
  colorScheme: 'light' as const,
}

export default function MsmeFormLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`:root { color-scheme: light !important; } * { color-scheme: light !important; }`}</style>
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.classList.remove('dark');` }} />
      <ForceLightMode />
      {children}
    </>
  )
}
