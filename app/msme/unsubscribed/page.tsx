import { Suspense } from 'react'
import UnsubscribedResult from './UnsubscribedResult'

export const metadata = { title: 'Unsubscribed — upFloat' }

export default function UnsubscribedPage() {
  return (
    <Suspense fallback={<div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',fontFamily:'system-ui' }}>Please wait…</div>}>
      <UnsubscribedResult />
    </Suspense>
  )
}
