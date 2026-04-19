import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { DashboardStats } from '../../api/dashboard.types'

/**
 * Animates a number from 0 to `target` over `durationMs`.
 * Uses requestAnimationFrame for smooth 60fps rendering.
 */
function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(0)
  const prevTarget = useRef(0)

  useEffect(() => {
    if (target === prevTarget.current) return
    prevTarget.current = target

    const start = performance.now()
    const from = 0
    let raf: number

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(1, elapsed / durationMs)
      // Ease-out cubic for a satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(from + (target - from) * eased))

      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return value
}

function StatCard({
  label,
  value,
  tone,
  delay = 0,
}: {
  label: string
  value: number
  tone?: 'neutral' | 'red' | 'cyan'
  delay?: number
}) {
  const animatedValue = useCountUp(value)
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
      transition={{ duration: 0.55, delay, ease: [0.2, 0.8, 0.2, 1] as const }}
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
        <div style={{ marginTop: 8, fontSize: 26, letterSpacing: -0.6, color: '#fff', fontFamily: 'var(--mono)' }}>
          {animatedValue}
        </div>
      </div>
    </motion.div>
  )
}

export function GlassStats({ stats }: { stats: DashboardStats }) {
  const critical = stats.scansByRiskLevel.CRITICAL ?? 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      <StatCard label="Repositories" value={stats.totalRepos} tone="cyan" delay={0} />
      <StatCard label="Total scans" value={stats.totalScans} delay={0.05} />
      <StatCard label="Findings" value={stats.totalFindings} tone={stats.totalFindings > 0 ? 'red' : 'neutral'} delay={0.1} />
      <StatCard label="Critical flags" value={critical} tone={critical > 0 ? 'red' : 'cyan'} delay={0.15} />
    </div>
  )
}
