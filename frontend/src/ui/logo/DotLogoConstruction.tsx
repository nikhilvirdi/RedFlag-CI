import { useEffect, useMemo, useRef } from 'react'
import { buildDotTextPoints, type DotPoint } from './dotTextPoints'

type Dot = DotPoint & {
  ox: number
  oy: number
  startMs: number
}

type Props = {
  text?: string
  width?: number
  height?: number
  density?: 'high' | 'ultra'
  autoplay?: boolean
  onDone?: () => void
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function rand(seed: number): number {
  // Tiny deterministic RNG for stable re-renders without looking repetitive.
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

export function DotLogoConstruction({
  text = 'RedFlag CI',
  width = 760,
  height = 160,
  density = 'ultra',
  autoplay = true,
  onDone,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const scratchRef = useRef<HTMLCanvasElement | null>(null)
  const animRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)
  const doneRef = useRef(false)

  const config = useMemo(() => {
    const dotGapPx = density === 'ultra' ? 5 : 7
    const fontSize = density === 'ultra' ? 88 : 80
    return {
      dotGapPx,
      fontSize,
      fontWeight: 700,
      letterSpacingPx: 2,
      threshold: 24,
      dotRadius: density === 'ultra' ? 1.2 : 1.35,
      travelMs: 980,
      baseStaggerMs: density === 'ultra' ? 2.2 : 3.2,
      letterExtraMs: 70,
    } as const
  }, [density])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const c = canvas
    const scratch = scratchRef.current ?? document.createElement('canvas')
    scratchRef.current = scratch

    const { points, width: w, height: h } = buildDotTextPoints(scratch, {
      text,
      fontFamily: 'Outfit, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
      fontWeight: config.fontWeight,
      fontSize: config.fontSize,
      letterSpacingPx: config.letterSpacingPx,
      dotGapPx: config.dotGapPx,
      threshold: config.threshold,
    })

    // Scale to requested viewport while keeping dot-grid crisp.
    const scale = Math.min(width / w, height / h)
    const drawW = Math.floor(w * scale)
    const drawH = Math.floor(h * scale)
    c.width = drawW
    c.height = drawH

    const ctx = c.getContext('2d')
    if (!ctx) return
    const g = ctx
    g.clearRect(0, 0, c.width, c.height)

    const letterCount = Math.max(1, Math.max(...points.map((p) => p.letterIndex)) + 1)

    // Each letter gets its own random origin point (distinct spatial locus).
    const letterOrigins = new Array(letterCount).fill(0).map((_, i) => {
      const rx = rand(97.13 + i * 11.7)
      const ry = rand(53.81 + i * 19.3)
      const pad = 0.22
      return {
        x: (rx * (1 + pad * 2) - pad) * c.width,
        y: (ry * (1 + pad * 2) - pad) * c.height,
      }
    })

    const dots: Dot[] = points.map((p, idx) => {
      const o = letterOrigins[p.letterIndex] ?? { x: -c.width * 0.2, y: c.height * 1.2 }
      const startMs =
        idx * config.baseStaggerMs + p.letterIndex * config.letterExtraMs + rand(10.2 + idx * 0.07) * 70
      return { ...p, ox: o.x, oy: o.y, startMs }
    })

    const palette = {
      red: '#ff0000',
      white: '#ffffff',
    } as const

    const dotRadius = config.dotRadius * Math.max(1, scale)

    function draw(now: number) {
      if (!startRef.current) startRef.current = now
      const tMs = now - startRef.current

      g.clearRect(0, 0, c.width, c.height)
      g.globalCompositeOperation = 'source-over'

      let completeCount = 0

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i]
        if (tMs < d.startMs) continue

        const local = Math.min(1, (tMs - d.startMs) / config.travelMs)
        const e = easeOutCubic(local)

        const tx = d.x * scale
        const ty = d.y * scale
        const x = d.ox + (tx - d.ox) * e
        const y = d.oy + (ty - d.oy) * e

        if (local >= 1) completeCount++

        g.fillStyle = palette[d.color]
        g.beginPath()
        g.arc(x, y, dotRadius, 0, Math.PI * 2)
        g.fill()
      }

      const allDone = completeCount >= dots.length * 0.985 && tMs > 600
      if (allDone && !doneRef.current) {
        doneRef.current = true
        onDone?.()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    if (autoplay) {
      doneRef.current = false
      startRef.current = 0
      animRef.current = requestAnimationFrame(draw)
    } else {
      // Render final immediately
      g.clearRect(0, 0, c.width, c.height)
      for (const p of points) {
        g.fillStyle = palette[p.color]
        g.beginPath()
        g.arc(p.x * scale, p.y * scale, dotRadius, 0, Math.PI * 2)
        g.fill()
      }
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [text, width, height, config, autoplay, onDone])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={text}
      style={{
        width,
        height,
        display: 'block',
        filter: 'drop-shadow(0 20px 42px rgba(0,0,0,0.65))',
      }}
    />
  )
}

