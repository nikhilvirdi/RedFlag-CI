export type DotPoint = {
  x: number
  y: number
  color: 'red' | 'white'
  letterIndex: number
}

type BuildOptions = {
  text: string
  fontFamily: string
  fontWeight: number
  fontSize: number
  letterSpacingPx: number
  dotGapPx: number
  threshold: number
}

function isRedLetterChar(ch: string, charIndex: number): boolean {
  // Branding rule: “Red” in RedFlag CI is pure red; the rest is white.
  // This maps the first 3 characters ("R","e","d") to red, everything else to white.
  return charIndex >= 0 && charIndex <= 2 && ch.trim().length > 0
}

function measureCharWidth(ctx: CanvasRenderingContext2D, ch: string, letterSpacingPx: number): number {
  // Include letterSpacing manually.
  const w = ctx.measureText(ch).width
  return w + letterSpacingPx
}

export function buildDotTextPoints(
  canvas: HTMLCanvasElement,
  opts: BuildOptions
): { points: DotPoint[]; width: number; height: number } {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return { points: [], width: 0, height: 0 }

  const {
    text,
    fontFamily,
    fontWeight,
    fontSize,
    letterSpacingPx,
    dotGapPx,
    threshold,
  } = opts

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  const chars = Array.from(text)
  let width = 0
  for (const ch of chars) width += measureCharWidth(ctx, ch, letterSpacingPx)

  // Room for ascenders/descenders.
  const height = Math.ceil(fontSize * 1.35)

  canvas.width = Math.max(2, Math.ceil(width))
  canvas.height = Math.max(2, height)

  // Render crisp text into alpha map.
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#fff'
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.textBaseline = 'alphabetic'

  const baselineY = Math.floor(fontSize * 1.02)
  let x = 0
  const charX: number[] = []
  for (const ch of chars) {
    charX.push(x)
    ctx.fillText(ch, x, baselineY)
    x += measureCharWidth(ctx, ch, letterSpacingPx)
  }

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = img.data

  // Helper: find which character a sampled pixel belongs to (for per-letter origins).
  const charBreaks: Array<{ start: number; end: number }> = []
  for (let i = 0; i < chars.length; i++) {
    const start = charX[i]
    const end = i === chars.length - 1 ? canvas.width : charX[i + 1]
    charBreaks.push({ start, end })
  }

  const points: DotPoint[] = []

  for (let py = 0; py < canvas.height; py += dotGapPx) {
    for (let px = 0; px < canvas.width; px += dotGapPx) {
      const idx = (py * canvas.width + px) * 4 + 3
      const a = data[idx] ?? 0
      if (a < threshold) continue

      let letterIndex = 0
      for (let i = 0; i < charBreaks.length; i++) {
        if (px >= charBreaks[i].start && px < charBreaks[i].end) {
          letterIndex = i
          break
        }
      }

      const ch = chars[letterIndex] ?? ''
      const color = isRedLetterChar(ch, letterIndex) ? 'red' : 'white'

      points.push({ x: px, y: py, color, letterIndex })
    }
  }

  // Tight bounding box.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }

  const pad = dotGapPx
  const w2 = Math.max(2, Math.ceil(maxX - minX + pad * 2))
  const h2 = Math.max(2, Math.ceil(maxY - minY + pad * 2))

  const normalized = points.map((p) => ({
    ...p,
    x: p.x - minX + pad,
    y: p.y - minY + pad,
  }))

  return { points: normalized, width: w2, height: h2 }
}

