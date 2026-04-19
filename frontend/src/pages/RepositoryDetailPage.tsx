import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TopNav } from '../ui/nav/TopNav'
import { useRepository } from '../hooks/useRepository'
import { useScanResults } from '../hooks/useScanResults'
import { ScanHistoryTable } from '../ui/dashboard/ScanHistoryTable'

export function RepositoryDetailPage() {
  const navigate = useNavigate()
  const { repositoryId } = useParams()
  const [page, setPage] = useState(1)
  const pageSize = 10

  const repoQ = useRepository(repositoryId)
  const scansQ = useScanResults({ repositoryId, page, pageSize })

  const repo = repoQ.data
  const scans = scansQ.data

  const headerMeta = useMemo(() => {
    if (!repo) return null
    return {
      githubUrl: repo.url,
      privateLabel: repo.isPrivate ? 'Private' : 'Public',
      scanCount: repo._count?.scanResults ?? 0,
    }
  }, [repo])

  return (
    <div>
      <TopNav variant="dashboard" />

      <div className="container" style={{ padding: '18px 0 70px' }}>
        <button
          onClick={() => navigate('/app')}
          className="glass"
          style={{
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: 12,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.88)',
            fontSize: 12,
          }}
        >
          ← Back to dashboard
        </button>

        <div style={{ marginTop: 14 }}>
          {repoQ.isLoading && (
            <div className="glass glass--panel" style={{ padding: 14, borderRadius: 16 }}>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>Loading repository…</div>
            </div>
          )}

          {repoQ.isError && (
            <div className="glass glow-red" style={{ padding: 14, borderRadius: 16 }}>
              <div style={{ color: '#fff', fontSize: 14 }}>Repository unavailable</div>
              <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>
                {String((repoQ.error as any)?.message ?? 'Request failed')}
              </div>
            </div>
          )}

          {repo && headerMeta && (
            <div className="glass glass--panel" style={{ padding: 16, borderRadius: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ color: '#fff', fontSize: 18, letterSpacing: -0.35 }}>{repo.fullName}</div>
                <div
                  className={repo.isPrivate ? 'glow-red' : 'glow-cyan'}
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.10)',
                    background: repo.isPrivate ? 'rgba(255,0,0,0.04)' : 'rgba(0,251,255,0.04)',
                    color: 'rgba(255,255,255,0.82)',
                    letterSpacing: 0.6,
                  }}
                >
                  {headerMeta.privateLabel}
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <a
                    href={headerMeta.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="glass"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      color: 'rgba(255,255,255,0.88)',
                      fontSize: 12,
                    }}
                  >
                    Open on GitHub
                  </a>
                  <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 12 }}>
                    Total scans{' '}
                    <span style={{ fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.82)' }}>
                      {headerMeta.scanCount}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.56)', fontSize: 12 }}>
                Repo ID <span style={{ fontFamily: 'var(--mono)' }}>{repo.githubRepoId}</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          {scansQ.isLoading && (
            <div className="glass glass--panel" style={{ padding: 14, borderRadius: 16 }}>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>Loading scans…</div>
            </div>
          )}

          {scansQ.isError && (
            <div className="glass glow-red" style={{ padding: 14, borderRadius: 16 }}>
              <div style={{ color: '#fff', fontSize: 14 }}>Scan history unavailable</div>
              <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>
                {String((scansQ.error as any)?.message ?? 'Request failed')}
              </div>
            </div>
          )}

          {repo && scans && (
            <ScanHistoryTable
              repo={repo}
              pageData={scans}
              onRowClick={(scanId) => navigate(`/app/scans/${scanId}`)}
              onPageChange={(p) => setPage(p)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

