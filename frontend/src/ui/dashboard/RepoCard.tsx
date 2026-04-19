import type { Repository } from '../../api/dashboard.types'

type Props = {
  repo: Repository
  onOpen: (repositoryId: string) => void
}

export function RepoCard({ repo, onOpen }: Props) {
  const scanCount = repo._count?.scanResults ?? 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(repo.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(repo.id)
        }
      }}
      className="glass glass--panel card-hover"
      style={{
        padding: 14,
        borderRadius: 16,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ color: '#fff', fontSize: 14, letterSpacing: -0.2 }}>{repo.fullName}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {repo.isPrivate && (
            <span
              className="glow-red"
              style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: 999,
                border: '1px solid rgba(255,0,0,0.18)',
                background: 'rgba(255,0,0,0.04)',
                color: 'rgba(255,255,255,0.88)',
              }}
            >
              Private
            </span>
          )}
          <span
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.82)',
            }}
          >
            {scanCount} scans
          </span>
        </div>
      </div>

      <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.56)', fontSize: 12, lineHeight: 1.55 }}>
        Last updated{' '}
        <span style={{ fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.72)' }}>
          {new Date(repo.updatedAt).toLocaleString()}
        </span>
      </div>

      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.56)' }}>Open scan history →</span>
        <a
          href={repo.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.72)',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          GitHub
        </a>
      </div>
    </div>
  )
}
