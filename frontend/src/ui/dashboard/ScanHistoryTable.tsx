import type { Paginated, Repository, ScanResultSummary } from '../../api/dashboard.types'
import { RiskScoreBadge } from './RiskScoreBadge'
import { StatusBadge } from './StatusBadge'
import { Pagination } from '../common/Pagination'

function shortSha(sha: string): string {
  return sha.length > 7 ? sha.slice(0, 7) : sha
}

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

export function ScanHistoryTable({
  repo,
  pageData,
  onRowClick,
  onPageChange,
}: {
  repo: Repository
  pageData: Paginated<ScanResultSummary>
  onRowClick: (scanResultId: string) => void
  onPageChange: (page: number) => void
}) {
  const { data, pagination } = pageData

  return (
    <div className="glass glass--panel" style={{ padding: 14, borderRadius: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ color: '#fff', fontSize: 14, letterSpacing: -0.2 }}>Scan history</div>
        <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 12 }}>
          {pagination.totalCount} scans • page {pagination.page} / {pagination.totalPages}
        </div>
      </div>

      <div style={{ marginTop: 12, overflowX: 'auto', borderRadius: 14, border: '1px solid rgba(255,255,255,0.10)' }}>
        <div style={{ minWidth: 940 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 120px 140px 170px 100px 120px',
              gap: 10,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.02)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.56)',
              fontSize: 12,
              letterSpacing: 0.6,
            }}
          >
            <div>PR</div>
            <div>Commit</div>
            <div>Status</div>
            <div>Risk</div>
            <div>Findings</div>
            <div>Date</div>
          </div>

          {data.map((s) => {
            const prUrl = `${repo.url.replace(/\/$/, '')}/pull/${s.pullRequestId}`
            return (
              <button
                key={s.id}
                onClick={() => onRowClick(s.id)}
                className="glass"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 0,
                  border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 120px 140px 170px 100px 120px',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ color: '#fff', fontSize: 13 }}>
                    <a
                      href={prUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: 'rgba(255,255,255,0.92)' }}
                      title="Open PR on GitHub"
                    >
                      #{s.pullRequestId}
                    </a>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.82)', fontSize: 12 }}>
                    {shortSha(s.commitSha)}
                  </div>
                  <div>
                    <StatusBadge status={s.status} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.82)', fontSize: 12 }}>
                      {s.riskScore?.totalScore?.toFixed?.(1) ?? '—'}
                    </div>
                    {s.riskScore?.classification ? <RiskScoreBadge level={s.riskScore.classification} /> : null}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.82)', fontSize: 12 }}>
                    {s._count.findings}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12 }}>{timeAgo(s.createdAt)}</div>
                </div>
              </button>
            )
          })}

          {data.length === 0 && (
            <div style={{ padding: 14, color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>
              No scans found for this repository.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={onPageChange} />
      </div>
    </div>
  )
}

