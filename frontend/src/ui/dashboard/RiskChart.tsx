import { motion } from 'framer-motion'
import type { DashboardStats, RiskLevel } from '../../api/dashboard.types'

const ORDER: RiskLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'CLEAN']

const COLORS: Record<RiskLevel, string> = {
  CRITICAL: '#ff0000',
  HIGH: '#ff4444',
  MEDIUM: '#ff8800',
  LOW: '#ffcc00',
  CLEAN: '#00fbff',
}

export function RiskChart({ stats }: { stats: DashboardStats }) {
  const rows = ORDER.map((level) => ({
    level,
    count: stats.scansByRiskLevel[level] ?? 0,
    color: COLORS[level],
  }))
  const max = Math.max(1, ...rows.map((r) => r.count))
  const total = rows.reduce((sum, r) => sum + r.count, 0)

  return (
    <div className="glass glass--panel" style={{ padding: 16, borderRadius: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ color: '#fff', fontSize: 14, letterSpacing: -0.2 }}>Risk distribution</div>
        <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 12 }}>
          {total} scans classified
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        {rows.map((r, i) => {
          const pct = (r.count / max) * 100
          return (
            <div key={r.level}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, letterSpacing: 0.6, color: 'rgba(255,255,255,0.72)' }}>{r.level}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'rgba(255,255,255,0.82)' }}>
                  {r.count}
                </span>
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.75, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] as const }}
                  style={{
                    height: '100%',
                    borderRadius: 999,
                    background: r.color,
                    boxShadow: `0 0 18px ${r.color}40`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
