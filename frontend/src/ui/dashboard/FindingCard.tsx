import type { Finding } from '../../api/dashboard.types'
import { RiskScoreBadge } from './RiskScoreBadge'
import { SecurityDiffViewer } from './SecurityDiffViewer'

function confidenceBadge(conf: Finding['confidence']) {
  const tone = conf === 'HIGH' ? 'rgba(0,251,255,0.10)' : conf === 'MEDIUM' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)'
  const border = conf === 'HIGH' ? 'rgba(0,251,255,0.18)' : 'rgba(255,255,255,0.10)'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: tone,
        color: 'rgba(255,255,255,0.88)',
        fontSize: 11,
        letterSpacing: 0.6,
      }}
    >
      {conf} conf.
    </span>
  )
}

function CodeBlock({ tone, code }: { tone: 'red' | 'cyan'; code: string }) {
  const border = tone === 'red' ? 'rgba(255,0,0,0.18)' : 'rgba(0,251,255,0.18)'
  const bg = tone === 'red' ? 'rgba(255,0,0,0.08)' : 'rgba(0,251,255,0.08)'
  return (
    <pre
      style={{
        margin: 0,
        padding: 12,
        borderRadius: 14,
        border: `1px solid ${border}`,
        background: bg,
        color: '#fff',
        fontFamily: 'var(--mono)',
        fontSize: 12.5,
        lineHeight: 1.6,
        overflowX: 'auto',
        whiteSpace: 'pre',
      }}
    >
      {code}
    </pre>
  )
}

export function FindingCard({ finding }: { finding: Finding }) {
  const canDiff =
    finding.remediation?.type === 'AUTOMATIC' && Boolean(finding.codeSnippet) && Boolean(finding.remediation.correctedCode)

  return (
    <div className={`glass glass--panel ${finding.severity === 'CRITICAL' ? 'glow-red' : ''}`} style={{ padding: 14, borderRadius: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <RiskScoreBadge level={finding.severity} />
        <div style={{ color: '#fff', fontSize: 14, letterSpacing: -0.2 }}>{finding.category}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {confidenceBadge(finding.confidence)}
          {finding.remediation?.type && (
            <span
              className={finding.remediation.type === 'AUTOMATIC' ? 'glow-cyan' : ''}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.10)',
                background:
                  finding.remediation.type === 'AUTOMATIC' ? 'rgba(0,251,255,0.06)' : 'rgba(255,255,255,0.03)',
                color: 'rgba(255,255,255,0.88)',
                fontSize: 11,
                letterSpacing: 0.6,
              }}
            >
              {finding.remediation.type === 'AUTOMATIC' ? 'Auto-fix' : 'Guided fix'}
            </span>
          )}
        </div>
      </div>

      <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.6 }}>
        {finding.description}
      </div>

      <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 12 }}>
          📄 <span style={{ fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.82)' }}>{finding.file}</span>
          {finding.lineNumber ? (
            <>
              {' '}
              • Line <span style={{ fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.82)' }}>{finding.lineNumber}</span>
            </>
          ) : null}
        </div>
      </div>

      {finding.codeSnippet && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, letterSpacing: 0.7, color: 'rgba(255,255,255,0.56)', marginBottom: 8 }}>
            Vulnerable code
          </div>
          <CodeBlock tone="red" code={finding.codeSnippet} />
        </div>
      )}

      {finding.remediation && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, letterSpacing: 0.7, color: 'rgba(255,255,255,0.56)', marginBottom: 8 }}>
            Remediation
          </div>

          {finding.remediation.type === 'AUTOMATIC' && finding.remediation.correctedCode ? (
            <CodeBlock tone="cyan" code={finding.remediation.correctedCode} />
          ) : finding.remediation.recommendation ? (
            <div
              className="glass glow-cyan"
              style={{
                padding: 12,
                borderRadius: 14,
                border: '1px solid rgba(0,251,255,0.18)',
                background: 'rgba(0,251,255,0.06)',
                color: 'rgba(255,255,255,0.88)',
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {finding.remediation.recommendation}
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>No remediation details available.</div>
          )}
        </div>
      )}

      {canDiff && (
        <div style={{ marginTop: 12 }}>
          <SecurityDiffViewer
            leftTitle="Vulnerable"
            rightTitle="Remediated"
            vulnerableCode={finding.codeSnippet!}
            remediatedCode={finding.remediation!.correctedCode!}
          />
        </div>
      )}
    </div>
  )
}

