import { motion } from 'framer-motion'

export function FeatureCard({
  title,
  body,
  tone,
  tag,
}: {
  title: string
  body: string
  tone: 'neutral' | 'red' | 'cyan'
  tag?: string
}) {
  const cls = tone === 'red' ? 'glow-red' : tone === 'cyan' ? 'glow-cyan' : ''
  const accent = tone === 'red' ? '#ff0000' : tone === 'cyan' ? '#00fbff' : 'rgba(255,255,255,0.72)'

  return (
    <motion.div
      className={`glass glass--panel ${cls}`}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      style={{
        padding: 16,
        borderRadius: 16,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background:
            tone === 'red'
              ? 'radial-gradient(520px 220px at 18% 20%, rgba(255,0,0,0.10), transparent 55%)'
              : tone === 'cyan'
                ? 'radial-gradient(520px 220px at 18% 20%, rgba(0,251,255,0.10), transparent 55%)'
                : 'radial-gradient(520px 220px at 18% 20%, rgba(255,255,255,0.06), transparent 55%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: accent,
              boxShadow:
                tone === 'red'
                  ? '0 0 22px rgba(255,0,0,0.20)'
                  : tone === 'cyan'
                    ? '0 0 22px rgba(0,251,255,0.20)'
                    : '0 0 18px rgba(255,255,255,0.10)',
            }}
          />
          <div style={{ color: '#fff', fontSize: 14, letterSpacing: -0.2 }}>{title}</div>
          {tag && (
            <div
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.02)',
                color: 'rgba(255,255,255,0.72)',
              }}
            >
              {tag}
            </div>
          )}
        </div>

        <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.6 }}>
          {body}
        </div>
      </div>
    </motion.div>
  )
}

