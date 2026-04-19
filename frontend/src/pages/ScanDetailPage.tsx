import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TopNav } from '../ui/nav/TopNav'
import { useScanDetail } from '../hooks/useScanDetail'
import { RiskScoreBadge } from '../ui/dashboard/RiskScoreBadge'
import { StatusBadge } from '../ui/dashboard/StatusBadge'
import { FindingCard } from '../ui/dashboard/FindingCard'
import type { Finding, RiskLevel } from '../api/dashboard.types'

function riskRingColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL':
      return '#ff0000'
    case 'HIGH':
      return '#ff4444'
    case 'MEDIUM':
      return '#ff8800'
    case 'LOW':
      return '#ffcc00'
    case 'CLEAN':
      return '#00fbff'
  }
}

function sortFindings(findings: Finding[]): Finding[] {
  const rank: Record<RiskLevel, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, CLEAN: 4 }
  const confRank: Record<Finding['confidence'], number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  return [...findings].sort((a, b) => {
    const s = rank[a.severity] - rank[b.severity]
    if (s !== 0) return s
    return confRank[a.confidence] - confRank[b.confidence]
  })
}

export function ScanDetailPage() {
  const navigate = useNavigate()
  const { scanResultId } = useParams()

  const scanQ = useScanDetail(scanResultId)
  const scan = scanQ.data

  const findings = useMemo(() => (scan?.findings ? sortFindings(scan.findings) : []), [scan?.findings])

  const score = scan?.riskScore?.totalScore ?? null
  const level = scan?.riskScore?.classification ?? null
  const ring = level ? riskRingColor(level) : 'rgba(255,255,255,0.28)'
  const pct = score != null ? Math.max(0, Math.min(100, score)) : 0

  return (
    <div>
      <TopNav variant="dashboard" />

      <div className="container" style={{ padding: '18px 0 70px' }}>
        <button
          onClick={() => navigate(-1)}
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
          ← Back
        </button>

        <div style={{ marginTop: 14 }}>
          {scanQ.isLoading && (
            <div className="glass glass--panel" style={{ padding: 14, borderRadius: 16 }}>
              <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>Loading scan report…</div>
            </div>
          )}

          {scanQ.isError && (
            <div className="glass glow-red" style={{ padding: 14, borderRadius: 16 }}>
              <div style={{ color: '#fff', fontSize: 14 }}>Scan report unavailable</div>
              <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>
                {String((scanQ.error as any)?.message ?? 'Request failed')}
              </div>
            </div>
          )}

          {scan && (
            <>
              {/* Header Bar */}
              <div className="glass glass--panel" style={{ padding: 16, borderRadius: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <a
                    href={scan.repository.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#fff', fontSize: 16, letterSpacing: -0.35 }}
                  >
                    {scan.repository.fullName}
                  </a>

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 12 }}>
                      PR{' '}
                      <span style={{ fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.82)' }}>
                        #{scan.pullRequestId}
                      </span>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 12 }}>
                      Commit{' '}
                      <span style={{ fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.82)' }}>
                        {scan.commitSha.slice(0, 7)}
                      </span>
                    </div>
                    <StatusBadge status={scan.status} />
                    {level ? <RiskScoreBadge level={level} /> : null}
                  </div>
                </div>
              </div>

              {/* Risk Summary */}
              <div style={{ marginTop: 14 }} className="glass glass--panel">
                <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, alignItems: 'center' }}>
                  <div style={{ display: 'grid', placeItems: 'center' }}>
                    <div
                      style={{
                        width: 132,
                        height: 132,
                        borderRadius: 999,
                        border: '1px solid rgba(255,255,255,0.10)',
                        background: 'rgba(255,255,255,0.02)',
                        position: 'relative',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                      aria-label="Risk score gauge"
                    >
                      <svg width="132" height="132" style={{ position: 'absolute', inset: 0 }}>
                        <circle cx="66" cy="66" r="54" stroke="rgba(255,255,255,0.10)" strokeWidth="10" fill="none" />
                        <circle
                          cx="66"
                          cy="66"
                          r="54"
                          stroke={ring}
                          strokeWidth="10"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={`${(pct / 100) * 339} 339`}
                          transform="rotate(-90 66 66)"
                        />
                      </svg>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#fff', fontSize: 28, letterSpacing: -0.6 }}>
                          {score != null ? score.toFixed(1) : '—'}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 12, letterSpacing: 0.6 }}>
                          / 100
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ color: '#fff', fontSize: 16, letterSpacing: -0.3 }}>Risk summary</div>
                    <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.6 }}>
                      Classification{' '}
                      {level ? (
                        <span style={{ marginLeft: 8 }}>
                          <RiskScoreBadge level={level} />
                        </span>
                      ) : (
                        <span style={{ marginLeft: 8, fontFamily: 'var(--mono)' }}>—</span>
                      )}
                    </div>

                    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      <div style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.56)', letterSpacing: 0.6 }}>Findings</div>
                        <div style={{ marginTop: 6, fontSize: 18, fontFamily: 'var(--mono)', color: '#fff' }}>{findings.length}</div>
                      </div>
                      <div style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.56)', letterSpacing: 0.6 }}>Auto-fixable</div>
                        <div style={{ marginTop: 6, fontSize: 18, fontFamily: 'var(--mono)', color: '#fff' }}>
                          {findings.filter(f => f.remediation?.type === 'AUTOMATIC').length}
                        </div>
                      </div>
                      <div style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.56)', letterSpacing: 0.6 }}>Scanned</div>
                        <div style={{ marginTop: 6, fontSize: 13, fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.82)' }}>
                          {new Date(scan.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {scan.riskScore?.contributionData && (
                      <pre
                        className="glass"
                        style={{
                          marginTop: 10,
                          padding: 12,
                          borderRadius: 14,
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.10)',
                          color: 'rgba(255,255,255,0.82)',
                          fontFamily: 'var(--mono)',
                          fontSize: 12,
                          lineHeight: 1.55,
                          overflowX: 'auto',
                        }}
                      >
                        {JSON.stringify(scan.riskScore.contributionData, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>

              {/* Findings */}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ color: '#fff', fontSize: 14, letterSpacing: -0.2 }}>Findings</div>
                  <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 12 }}>
                    {findings.length} issues
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                  {findings.map((f) => (
                    <FindingCard key={f.id} finding={f} />
                  ))}
                  {findings.length === 0 && (
                    <div className="glass glow-cyan" style={{ padding: 14, borderRadius: 16 }}>
                      <div style={{ color: '#fff', fontSize: 14 }}>No findings</div>
                      <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>
                        This scan did not report any vulnerabilities.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

