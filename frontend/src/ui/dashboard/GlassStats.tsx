import { motion } from 'framer-motion'
import type { DashboardStats } from '../../api/dashboard.types'

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'neutral' | 'red' | 'cyan'
}) {
  const cls = tone === 'red' ? 'glow-red' : tone === 'cyan' ? 'glow-cyan' : ''
  const border =
    tone === 'red'
      ? 'rgba(255,0,0,0.16)'
      : tone === 'cyan'
        ? 'rgba(0,251,255,0.16)'
        : 'rgba(255,255,255,0.10)'

  return (
    <motion.div
      className={`glass glass--panel ${cls}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      style={{
        padding: 14,
        borderRadius: 16,
        borderColor: border,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <motion.div
        aria-hidden
        animate={{ opacity: [0.15, 0.28, 0.15] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          inset: 0,
          background:
            tone === 'red'
              ? 'radial-gradient(420px 140px at 20% 20%, rgba(255,0,0,0.10), transparent 60%)'
              : tone === 'cyan'
                ? 'radial-gradient(420px 140px at 20% 20%, rgba(0,251,255,0.10), transparent 60%)'
                : 'radial-gradient(420px 140px at 20% 20%, rgba(255,255,255,0.06), transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 12, letterSpacing: 0.75, color: 'rgba(255,255,255,0.56)' }}>{label}</div>
        <div style={{ marginTop: 8, fontSize: 26, letterSpacing: -0.6, color: '#fff' }}>{value}</div>
      </div>
    </motion.div>
  )
}

export function GlassStats({ stats }: { stats: DashboardStats }) {
  const critical = stats.scansByRiskLevel.CRITICAL ?? 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      <StatCard label="Total Repositories" value={String(stats.totalRepos)} tone="cyan" />
      <StatCard label="Total Scans" value={String(stats.totalScans)} tone="neutral" />
      <StatCard
        label="Critical Findings"
        value={String(critical)}
        tone={critical > 0 ? 'red' : 'neutral'}
      />
    </div>
  )
}

