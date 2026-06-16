// Force light color-scheme for the vendor-facing public form so hardcoded
// light colors remain visible regardless of the visitor's OS dark-mode setting.
export const viewport = {
  colorScheme: 'light' as const,
}

export default function MsmeFormLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
