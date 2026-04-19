import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'

type Phase = 'scan' | 'flagged' | 'fixing' | 'fixed'

const vulnerable = [
  'import express from "express";',
  '',
  'const app = express();',
  '',
  'app.get("/search", async (req, res) => {',
  '  const q = req.query.q as string;',
  '  const sql = `SELECT * FROM users WHERE name = "${q}"`; // unsafe',
  '  const rows = await db.query(sql);',
  '  res.json({ rows });',
  '});',
  '',
  'app.listen(4000);',
]

const fixed = [
  'import express from "express";',
  '',
  'const app = express();',
  '',
  'app.get("/search", async (req, res) => {',
  '  const q = req.query.q as string;',
  '  const sql = "SELECT * FROM users WHERE name = ?";',
  '  const rows = await db.query(sql, [q]);',
  '  res.json({ rows });',
  '});',
  '',
  'app.listen(4000);',
]

export function CodeScanSimulation() {
  const [phase, setPhase] = useState<Phase>('scan')
  const [scanY, setScanY] = useState(0)
  const rafRef = useRef<number | null>(null)

  const vulnLine = 6
  const lines = useMemo(() => (phase === 'fixed' ? fixed : vulnerable), [phase])

  useEffect(() => {
    let start = 0
    let lastMs = 0

    function tick(now: number) {
      if (!start) start = now
      const t = now - start
      const speed = 0.032
      const y = (t * speed) % 1
      setScanY(y)

      if (phase === 'scan') {
        const target = (vulnLine + 1) / Math.max(1, vulnerable.length)
        if (y > target && now - lastMs > 320) {
          lastMs = now
          setPhase('flagged')
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'flagged') return
    const t = window.setTimeout(() => setPhase('fixing'), 900)
    return () => window.clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'fixing') return
    const t = window.setTimeout(() => setPhase('fixed'), 850)
    return () => window.clearTimeout(t)
  }, [phase])

  const progressPx = scanY * 100

  return (
    <div
      className="glass glass--panel"
      style={{
        padding: 14,
        borderRadius: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: 0.6,
            color: 'rgba(255,255,255,0.72)',
          }}
        >
          ANALYZER • sandbox/runtime.ts
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            className={phase === 'fixed' ? 'glow-cyan' : phase === 'flagged' ? 'glow-red' : ''}
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.72)',
              fontSize: 12,
            }}
          >
            {phase === 'scan' && 'Scanning'}
            {phase === 'flagged' && 'Vulnerability flagged'}
            {phase === 'fixing' && 'AI Fix in progress'}
            {phase === 'fixed' && 'Remediated'}
          </div>
          <button
            disabled={phase !== 'flagged'}
            onClick={() => setPhase('fixing')}
            className="glass"
            style={{
              cursor: phase === 'flagged' ? 'pointer' : 'default',
              opacity: phase === 'flagged' ? 1 : 0.5,
              padding: '6px 10px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(0,251,255,0.16)',
              color: '#fff',
              fontSize: 12,
            }}
          >
            AI Fix
          </button>
        </div>
      </div>

      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 12.5,
          lineHeight: 1.6,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,251,255,0.00), rgba(0,251,255,0.00))',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${progressPx}%`,
            height: 1,
            background: 'rgba(0,251,255,0.65)',
            boxShadow: '0 0 24px rgba(0,251,255,0.25)',
            transform: 'translateY(-1px)',
          }}
        />

        {lines.map((line, i) => {
          const isVuln = i === vulnLine && phase !== 'fixed'
          const isFixedLine = i === vulnLine && phase === 'fixed'
          const isFixedLine2 = i === vulnLine + 1 && phase === 'fixed'

          const bg =
            isVuln
              ? 'rgba(255,0,0,0.10)'
              : isFixedLine || isFixedLine2
                ? 'rgba(0,251,255,0.10)'
                : 'transparent'

          const border =
            isVuln
              ? '1px solid rgba(255,0,0,0.18)'
              : isFixedLine || isFixedLine2
                ? '1px solid rgba(0,251,255,0.18)'
                : '1px solid transparent'

          return (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr 16px',
                gap: 10,
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: 10,
                background: bg,
                border,
              }}
            >
              <div style={{ color: 'rgba(255,255,255,0.32)' }}>{String(i + 1).padStart(2, '0')}</div>
              <div style={{ color: 'rgba(255,255,255,0.92)', whiteSpace: 'pre' }}>
                {line || ' '}
              </div>
              <div style={{ width: 16, display: 'flex', justifyContent: 'center' }}>
                <AnimatePresence initial={false}>
                  {isVuln && phase !== 'scan' && (
                    <motion.div
                      key="flag"
                      initial={{ opacity: 0, x: 6, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 8 }}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: '#ff0000',
                        boxShadow: '0 0 20px rgba(255,0,0,0.25)',
                      }}
                      aria-label="Flagged vulnerability"
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          )
        })}

        <AnimatePresence>
          {phase === 'fixing' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(520px 240px at 68% 40%, rgba(0,251,255,0.12), transparent 60%)',
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

