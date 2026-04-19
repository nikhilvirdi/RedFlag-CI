import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth/AuthContext'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useRepositories } from '../hooks/useRepositories'
import { useRecentScans } from '../hooks/useRecentScans'
import { TopNav } from '../ui/nav/TopNav'
import { GlassStats } from '../ui/dashboard/GlassStats'
import { RepoGrid } from '../ui/dashboard/RepoGrid'
import { RiskChart } from '../ui/dashboard/RiskChart'
import { RecentActivity } from '../ui/dashboard/RecentActivity'

export function DashboardPage() {
  const { state } = useAuth()
  const navigate = useNavigate()
  const [repoQuery, setRepoQuery] = useState('')

  const statsQ = useDashboardStats()
  const reposQ = useRepositories()
  const repos = reposQ.data ?? []
  const { recent, isLoading: recentLoading } = useRecentScans(repos)

  const authFailed = (statsQ.error as any)?.status === 401 || (reposQ.error as any)?.status === 401

  const filteredRepos = useMemo(() => {
    const q = repoQuery.trim().toLowerCase()
    if (!q) return repos
    return repos.filter(
      (r) => r.fullName.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.githubRepoId.includes(q)
    )
  }, [repos, repoQuery])

  return (
    <div>
      <TopNav variant="dashboard" />

      <div className="container" style={{ padding: '18px 0 70px' }}>
        {authFailed && (
          <div className="glass glow-red" style={{ padding: 14, borderRadius: 16, marginBottom: 14 }}>
            <div style={{ color: '#fff', fontSize: 14, letterSpacing: -0.2 }}>Session expired</div>
            <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.55 }}>
              Your JWT was rejected by the backend. Return to login to re-authenticate.
            </div>
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="glass"
                style={{
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,0,0,0.18)',
                  color: '#fff',
                  fontSize: 12,
                }}
              >
                Re-authenticate
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="glass glass--panel" style={{ padding: 14, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ color: '#fff', fontSize: 18, letterSpacing: -0.35 }}>Overview</div>
              <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 12, letterSpacing: 0.6 }}>
                Session: {state.status === 'authenticated' ? 'authenticated' : 'required'}
              </div>
              <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.56)', fontSize: 12 }}>
                API <span style={{ fontFamily: 'var(--mono)' }}>GET /api/dashboard/*</span>
              </div>
            </div>
          </div>

          <div>
            {statsQ.isLoading && (
              <div className="glass glass--panel" style={{ padding: 14, borderRadius: 16 }}>
                <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>Loading stats…</div>
              </div>
            )}
            {statsQ.isError && !statsQ.isLoading && (
              <div className="glass glow-red" style={{ padding: 14, borderRadius: 16 }}>
                <div style={{ color: '#fff', fontSize: 14 }}>Stats unavailable</div>
                <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>
                  {String((statsQ.error as any)?.message ?? 'Request failed')}
                </div>
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => statsQ.refetch()}
                    className="glass"
                    style={{
                      cursor: 'pointer',
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      color: '#fff',
                      fontSize: 12,
                    }}
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
            {statsQ.data && <GlassStats stats={statsQ.data} />}
          </div>

          <div>
            {statsQ.isLoading && (
              <div className="glass glass--panel" style={{ padding: 14, borderRadius: 16 }}>
                <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>Loading risk distribution…</div>
              </div>
            )}
            {statsQ.data && <RiskChart stats={statsQ.data} />}
          </div>

          <div className="glass glass--panel" style={{ padding: 14, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ color: '#fff', fontSize: 14, letterSpacing: -0.2 }}>Connected repositories</div>
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
                {reposQ.isLoading ? '…' : repos.length}
              </span>
              <div style={{ marginLeft: 'auto', minWidth: 220, flex: '1 1 220px' }}>
                <input
                  value={repoQuery}
                  onChange={(e) => setRepoQuery(e.target.value)}
                  placeholder="Filter by name…"
                  className="glass"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.10)',
                    background: 'rgba(255,255,255,0.03)',
                    color: '#fff',
                    outline: 'none',
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              {reposQ.isLoading && (
                <div className="glass glass--panel" style={{ padding: 14, borderRadius: 16 }}>
                  <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>Fetching repositories…</div>
                </div>
              )}
              {reposQ.isError && (
                <div className="glass glow-red" style={{ padding: 14, borderRadius: 16 }}>
                  <div style={{ color: '#fff', fontSize: 14 }}>Repositories unavailable</div>
                  <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>
                    {String((reposQ.error as any)?.message ?? 'Request failed')}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={() => reposQ.refetch()}
                      className="glass"
                      style={{
                        cursor: 'pointer',
                        padding: '8px 12px',
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        color: '#fff',
                        fontSize: 12,
                      }}
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}
              {!reposQ.isLoading && !reposQ.isError && repos.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.55 }}>
                  No repositories connected yet.
                </div>
              )}
              {!reposQ.isLoading && !reposQ.isError && repos.length > 0 && filteredRepos.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.55 }}>
                  No repositories match your filter.
                </div>
              )}
              {filteredRepos.length > 0 && <RepoGrid repos={filteredRepos} />}
            </div>
          </div>

          <RecentActivity items={recent} isLoading={recentLoading || reposQ.isLoading} />
        </div>
      </div>
    </div>
  )
}
