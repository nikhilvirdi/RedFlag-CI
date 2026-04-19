import { useMemo } from 'react'

type Props = {
  leftTitle?: string
  rightTitle?: string
  vulnerableCode: string
  remediatedCode: string
}

function splitLines(code: string): string[] {
  return code.replace(/\r\n/g, '\n').split('\n')
}

function DiffPane({
  title,
  tone,
  lines,
  highlightLines,
}: {
  title: string
  tone: 'red' | 'cyan'
  lines: string[]
  highlightLines: Set<number>
}) {
  const edge = tone === 'red' ? 'rgba(255,0,0,0.18)' : 'rgba(0,251,255,0.18)'
  const wash = tone === 'red' ? 'rgba(255,0,0,0.08)' : 'rgba(0,251,255,0.08)'

  return (
    <div className={`glass glass--panel ${tone === 'red' ? 'glow-red' : 'glow-cyan'}`} style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 12, letterSpacing: 0.75, color: 'rgba(255,255,255,0.72)' }}>{title}</div>
        <div
          style={{
            marginLeft: 'auto',
            width: 8,
            height: 8,
            borderRadius: 2,
            background: tone === 'red' ? '#ff0000' : '#00fbff',
            boxShadow:
              tone === 'red' ? '0 0 18px rgba(255,0,0,0.20)' : '0 0 18px rgba(0,251,255,0.20)',
          }}
        />
      </div>

      <div
        style={{
          marginTop: 10,
          borderRadius: 12,
          border: `1px solid ${edge}`,
          overflow: 'hidden',
        }}
      >
        <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, lineHeight: 1.65 }}>
          {lines.map((l, i) => {
            const hit = highlightLines.has(i)
            return (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '44px 1fr',
                  gap: 10,
                  padding: '2px 10px',
                  background: hit ? wash : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ color: 'rgba(255,255,255,0.30)' }}>{String(i + 1).padStart(2, '0')}</div>
                <div style={{ whiteSpace: 'pre', color: 'rgba(255,255,255,0.92)' }}>{l || ' '}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function SecurityDiffViewer({
  leftTitle = 'Vulnerable',
  rightTitle = 'Remediated',
  vulnerableCode,
  remediatedCode,
}: Props) {
  const left = useMemo(() => splitLines(vulnerableCode), [vulnerableCode])
  const right = useMemo(() => splitLines(remediatedCode), [remediatedCode])

  // Minimal, deterministic highlight: mark lines that differ by index.
  const max = Math.max(left.length, right.length)
  const leftHits = useMemo(() => {
    const s = new Set<number>()
    for (let i = 0; i < max; i++) if ((left[i] ?? '') !== (right[i] ?? '')) s.add(i)
    return s
  }, [left, right, max])

  const rightHits = leftHits

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <DiffPane title={leftTitle} tone="red" lines={left} highlightLines={leftHits} />
      <DiffPane title={rightTitle} tone="cyan" lines={right} highlightLines={rightHits} />
    </div>
  )
}

