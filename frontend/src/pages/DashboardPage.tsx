import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth/AuthContext'
import { useDashboardStats } from '../hooks/useDashboardStats'
import { useRepositories } from '../hooks/useRepositories'
import { useRecentScans } from '../hooks/useRecentScans'
import { TopNav } from '../ui/nav/TopNav'
import { GlassStats } from '../ui/dashboard/GlassStats'
import { RiskChart } from '../ui/dashboard/RiskChart'
import { RepoCard } from '../ui/dashboard/RepoCard'
import { RecentActivity } from '../ui/dashboard/RecentActivity'

export function DashboardPage() {
  const { state } = useAuth()
  const navigate = useNavigate()
  const [repoFilter, setRepoFilter] = useState('')

  const statsQ = useDashboardStats()
  const reposQ = useRepositories()

  const repos = reposQ.data ?? []
  const { recent, isLoading: recentLoading } = useRecentScans(reposQ.data)

  const authFailed = (statsQ.error as any)?.status === 401 || (reposQ.error as any)?.status === 401

  const filteredRepos = useMemo(() => {
    if (!repoFilter.trim()) return repos
    const q = repoFilter.toLowerCase()
    return repos.filter(
      (r) => r.fullName.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    )
  }, [repos, repoFilter])

  return (
    <div>
      <TopNav variant="dashboard" />

      <div className="container" style={{ padding: '18px 0 70px' }}>
        {/* Auth failure banner */}
        {authFailed && (
          <div className="glass glow-red" style={{ padding: 14, borderRadius: 16, marginBottom: 14 }}>
            <div style={{ color: '#fff', fontSize: 14, letterSpacing: -0.2 }}>Session expired</div>
            <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.55 }}>
              Your JWT was rejected by the backend. Return to login to re-authenticate.
            </div>
            <div style={{ marginTop: 12 }}>
              <button
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
          {/* Dashboard header */}
          <div className="glass glass--panel" style={{ padding: 14, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ color: '#fff', fontSize: 18, letterSpacing: -0.35 }}>Dashboard</div>
              <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 12, letterSpacing: 0.6 }}>
                Auth: {state.status === 'authenticated' ? 'secure' : 'required'}
              </div>
            </div>
          </div>

          {/* Row 1: Stats */}
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
              </div>
            )}
            {statsQ.data && <GlassStats stats={statsQ.data} />}
          </div>

          {/* Row 2: Risk Distribution Chart */}
          {statsQ.data && <RiskChart stats={statsQ.data} />}

          {/* Row 3: Connected Repositories */}
          <div className="glass glass--panel" style={{ padding: 14, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ color: '#fff', fontSize: 14, letterSpacing: -0.2 }}>Connected repositories</div>
              <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 12 }}>
                {reposQ.isLoading ? 'Loading…' : `${repos.length} total`}
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <input
                  placeholder="Filter repositories…"
                  value={repoFilter}
                  onChange={(e) => setRepoFilter(e.target.value)}
                  className="glass"
                  style={{
                    padding: '8px 12px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    color: '#fff',
                    fontSize: 12,
                    width: 220,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              {reposQ.isLoading && (
                <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>Fetching repositories…</div>
              )}
              {reposQ.isError && (
                <div className="glass glow-red" style={{ padding: 14, borderRadius: 16 }}>
                  <div style={{ color: '#fff', fontSize: 14 }}>Repositories unavailable</div>
                  <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>
                    {String((reposQ.error as any)?.message ?? 'Request failed')}
                  </div>
                </div>
              )}
              {!reposQ.isLoading && !reposQ.isError && filteredRepos.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.55 }}>
                  {repos.length === 0
                    ? 'No repositories are linked to your account yet. Install the RedFlag CI GitHub App on a repository to get started.'
                    : 'No repositories match your filter.'}
                </div>
              )}
              {filteredRepos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                  {filteredRepos.map((r) => (
                    <RepoCard
                      key={r.id}
                      repo={r}
                      onOpen={(id) => navigate(`/app/repos/${id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 4: Recent Activity */}
          <RecentActivity items={recent} isLoading={recentLoading} />
        </div>
      </div>
    </div>
  )
}
