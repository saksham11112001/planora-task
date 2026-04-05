'use client'
import { useState } from 'react'
import { FileCheck, ChevronRight } from 'lucide-react'
import { CAMasterView } from './CAMasterView'
import { CAClientSetupView } from './CAClientSetupView'

interface Props { userRole: string }

export function ComplianceShell({ userRole }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const isAdmin = ['owner', 'admin'].includes(userRole)
  const canSetupClients = ['owner', 'admin', 'manager'].includes(userRole)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* Step header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        padding: '0 24px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {/* Step 1 tab */}
        <button
          onClick={() => isAdmin && setStep(1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 20px 14px 0',
            background: 'none', border: 'none', cursor: isAdmin ? 'pointer' : 'default',
            borderBottom: step === 1 ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: -1,
          }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: step === 1 ? 'var(--brand)' : 'var(--border)',
            color: '#fff', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>1</div>
          <span style={{ fontSize: 13, fontWeight: step === 1 ? 700 : 500, color: step === 1 ? 'var(--brand)' : 'var(--text-secondary)' }}>
            Compliance Master
          </span>
          {!isAdmin && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface-subtle)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
              Admin only
            </span>
          )}
        </button>

        <ChevronRight style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0, margin: '0 4px' }}/>

        {/* Step 2 tab */}
        <button
          onClick={() => canSetupClients && setStep(2)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 20px',
            background: 'none', border: 'none', cursor: canSetupClients ? 'pointer' : 'default',
            borderBottom: step === 2 ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: -1,
          }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: step === 2 ? 'var(--brand)' : 'var(--border)',
            color: '#fff', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>2</div>
          <span style={{ fontSize: 13, fontWeight: step === 2 ? 700 : 500, color: step === 2 ? 'var(--brand)' : 'var(--text-secondary)' }}>
            Client Setup
          </span>
        </button>

        {step === 1 && canSetupClients && (
          <button
            onClick={() => setStep(2)}
            style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8, border: 'none',
              background: 'var(--brand)', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
            Next: Client Setup <ChevronRight style={{ width: 14, height: 14 }}/>
          </button>
        )}
      </div>

      {/* Step content */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {step === 1 && isAdmin && <CAMasterView userRole={userRole} />}
        {step === 1 && !isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12, color: 'var(--text-muted)', fontSize: 14 }}>
            <FileCheck style={{ width: 32, height: 32, opacity: 0.4 }}/>
            <p>Compliance Master setup is restricted to admins.</p>
            <button onClick={() => setStep(2)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--brand)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              Go to Client Setup →
            </button>
          </div>
        )}
        {step === 2 && <CAClientSetupView userRole={userRole} />}
      </div>
    </div>
  )
}
