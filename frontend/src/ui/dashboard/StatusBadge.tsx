import type { ScanStatus } from '../../api/dashboard.types'

function label(status: ScanStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Pending'
    case 'IN_PROGRESS':
      return 'In progress'
    case 'COMPLETED':
      return 'Completed'
    case 'FAILED':
      return 'Failed'
  }
}

export function StatusBadge({ status }: { status: ScanStatus }) {
  const isProgress = status === 'IN_PROGRESS'
  const isFailed = status === 'FAILED'
  const isPending = status === 'PENDING'

  const border = isFailed
    ? 'rgba(255,0,0,0.18)'
    : isProgress
      ? 'rgba(0,251,255,0.18)'
      : 'rgba(255,255,255,0.12)'

  const bg = isFailed
    ? 'rgba(255,0,0,0.06)'
    : isProgress
      ? 'rgba(0,251,255,0.06)'
      : isPending
        ? 'rgba(255,255,255,0.04)'
        : 'rgba(255,255,255,0.03)'

  return (
    <span
      className={isProgress ? 'glow-cyan' : isFailed ? 'glow-red' : ''}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: bg,
        color: 'rgba(255,255,255,0.88)',
        fontSize: 11,
        letterSpacing: 0.6,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isProgress && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, transparent, rgba(0,251,255,0.10), transparent)',
            animation: 'rfciPulse 1.35s ease-in-out infinite',
          }}
        />
      )}
      <span style={{ position: 'relative' }}>{label(status)}</span>
    </span>
  )
}

