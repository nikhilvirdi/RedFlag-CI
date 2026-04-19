import type { RiskLevel } from '../../api/dashboard.types'

function colorFor(level: RiskLevel): { fg: string; bg: string; border: string } {
  switch (level) {
    case 'CRITICAL':
      return { fg: '#ffffff', bg: 'rgba(255,0,0,0.10)', border: 'rgba(255,0,0,0.20)' }
    case 'HIGH':
      return { fg: '#ffffff', bg: 'rgba(255,68,68,0.10)', border: 'rgba(255,68,68,0.22)' }
    case 'MEDIUM':
      return { fg: '#ffffff', bg: 'rgba(255,136,0,0.10)', border: 'rgba(255,136,0,0.22)' }
    case 'LOW':
      return { fg: '#ffffff', bg: 'rgba(255,204,0,0.10)', border: 'rgba(255,204,0,0.22)' }
    case 'CLEAN':
      return { fg: '#ffffff', bg: 'rgba(0,251,255,0.10)', border: 'rgba(0,251,255,0.22)' }
  }
}

export function RiskScoreBadge({ level }: { level: RiskLevel }) {
  const c = colorFor(level)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        borderRadius: 999,
        border: `1px solid ${c.border}`,
        background: c.bg,
        color: c.fg,
        fontSize: 11,
        letterSpacing: 0.7,
      }}
    >
      {level}
    </span>
  )
}

