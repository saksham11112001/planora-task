import { Suspense }   from 'react'
import { redirect }  from 'next/navigation'
import TaskActionResult from './TaskActionResult'

export default function TaskActionPage() {
  return (
    <Suspense fallback={<div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',fontFamily:'system-ui' }}>Processing…</div>}>
      <TaskActionResult/>
    </Suspense>
  )
}
