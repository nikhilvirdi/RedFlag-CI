import { useNavigate } from 'react-router-dom'
import type { RecentScanRow } from '../../hooks/useRecentScans'
import { RiskScoreBadge } from './RiskScoreBadge'

function timeAgo(iso: string): string {
  const d = new Date(iso)
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const day = Math.floor(h / 24)
  if (day > 0) return `${day}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return `${s}s ago`
}

export function RecentActivity({
  items,
  isLoading,
}: {
  items: RecentScanRow[]
  isLoading: boolean
}) {
  const navigate = useNavigate()

  return (
    <div className="glass glass--panel" style={{ padding: 14, borderRadius: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ color: '#fff', fontSize: 14, letterSpacing: -0.2 }}>Recent activity</div>
        <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 12 }}>Latest scans across your repositories</div>
      </div>

      {isLoading && (
        <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>Loading recent scans…</div>
      )}

      {!isLoading && items.length === 0 && (
        <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.55 }}>
          No recent scans yet. Open a pull request or trigger a scan to see activity here.
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {items.map((row) => (
            <button
              key={`${row.repositoryId}-${row.id}`}
              type="button"
              onClick={() => navigate(`/app/scans/${row.id}`)}
              className="glass"
              style={{
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#fff' }}>{row.repositoryFullName}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>
                  PR #{row.pullRequestId}
                </span>
                {row.riskScore?.classification ? <RiskScoreBadge level={row.riskScore.classification} /> : null}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.56)' }}>
                  {timeAgo(row.createdAt)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
