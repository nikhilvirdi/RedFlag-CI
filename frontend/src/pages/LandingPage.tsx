import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { DotLogoConstruction } from '../ui/logo/DotLogoConstruction'
import { CodeScanSimulation } from '../ui/landing/CodeScanSimulation'
import { useAuth } from '../state/auth/AuthContext'
import { MarketingNav } from '../ui/landing/MarketingNav'
import { FeatureCard } from '../ui/landing/FeatureCard'
import { SecurityDiffViewer } from '../ui/dashboard/SecurityDiffViewer'
import { env } from '../lib/env'

const diffVulnerable = 'const API_KEY = "sk-live-abc123def456"'
const diffRemediated = 'const API_KEY = process.env.API_KEY'

export function LandingPage() {
  const navigate = useNavigate()
  const { state } = useAuth()

  const scrollToDemo = () => {
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div>
      <MarketingNav />

      {/* Section A — Hero (min viewport height) */}
      <section style={{ minHeight: 'min(100svh, 920px)', padding: '28px 0 24px' }}>
        <div className="container">
          <div
            className="glass glass--panel"
            style={{
              padding: 22,
              position: 'relative',
              overflow: 'hidden',
              minHeight: 'min(78svh, 760px)',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: -1,
                background:
                  'radial-gradient(900px 520px at 18% 10%, rgba(0,251,255,0.08), transparent 60%), radial-gradient(900px 520px at 82% 12%, rgba(255,0,0,0.06), transparent 60%)',
                pointerEvents: 'none',
              }}
            />

            <div style={{ position: 'relative', height: '100%' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: 22,
                  alignItems: 'start',
                }}
              >
                <div>
                  <DotLogoConstruction width={760} height={168} density="ultra" />

                  <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {['GitHub-native SAST', 'Auto-remediation', 'Risk Scoring'].map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: 12,
                          letterSpacing: 0.75,
                          color: 'rgba(255,255,255,0.72)',
                          padding: '6px 10px',
                          borderRadius: 999,
                          border: '1px solid rgba(255,255,255,0.10)',
                          background: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <h1
                    style={{
                      margin: '18px 0 0',
                      color: '#fff',
                      fontSize: 'clamp(26px, 3.2vw, 40px)',
                      letterSpacing: -0.9,
                      lineHeight: 1.12,
                      fontWeight: 600,
                    }}
                  >
                    Catch AI-generated vulnerabilities before they ship
                  </h1>

                  <p style={{ margin: '12px 0 0', color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 1.65 }}>
                    RedFlag CI automatically scans every pull request for credential exposure, SQL injection, dependency
                    risks, and prompt injection — then posts fixes directly in your PR.
                  </p>

                  <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="glass glow-cyan"
                      style={{
                        cursor: 'pointer',
                        padding: '12px 16px',
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.04)',
                        color: '#fff',
                        border: '1px solid rgba(0,251,255,0.18)',
                        fontSize: 14,
                      }}
                    >
                      Get Started Free
                    </button>
                    <button
                      type="button"
                      onClick={scrollToDemo}
                      className="glass"
                      style={{
                        cursor: 'pointer',
                        padding: '12px 16px',
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)',
                        color: 'rgba(255,255,255,0.88)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        fontSize: 14,
                      }}
                    >
                      See How It Works
                    </button>
                  </div>
                </div>

                <motion.div
                  id="demo"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <CodeScanSimulation />
                </motion.div>
              </div>
            </div>
          </div>

          {/* Section B — Proof strip */}
          <div style={{ marginTop: 14 }} className="glass glass--panel">
            <div
              style={{
                padding: 14,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 14,
              }}
            >
              {[
                {
                  k: '4 Analyzers',
                  v: 'Credential, SQL Injection, Dependency, Prompt Injection',
                },
                { k: 'Dual Output', v: 'PR Comments + Web Dashboard' },
                { k: 'Risk Scoring', v: 'Severity × Confidence weighted scoring' },
                { k: 'Auto-Fix', v: 'Deterministic remediation for safe patterns' },
              ].map((m) => (
                <div
                  key={m.k}
                  className="glass"
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.56)', letterSpacing: 0.7 }}>{m.k}</div>
                  <div style={{ marginTop: 8, fontSize: 13, color: '#fff', letterSpacing: -0.2, lineHeight: 1.45 }}>
                    {m.v}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section C — Problem statement */}
      <section id="problem" style={{ padding: '22px 0' }}>
        <div
          className="container"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}
        >
          <div className="glass glass--panel" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, letterSpacing: 0.7, color: 'rgba(255,255,255,0.56)' }}>THE PROBLEM</div>
            <div style={{ marginTop: 10, color: '#fff', fontSize: 18, letterSpacing: -0.35, lineHeight: 1.25 }}>
              AI writes code fast. But fast ≠ secure.
            </div>
            <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 1.65 }}>
              AI-generated changes often include hardcoded credentials, unsafe queries, suspicious dependencies, and prompt
              injection vectors. Traditional review cannot keep pace with the volume and subtlety of these issues.
            </div>
          </div>
          <div className="glass glass--panel" style={{ padding: 18 }}>
            <div style={{ fontSize: 12, letterSpacing: 0.7, color: 'rgba(255,255,255,0.56)' }}>THE SOLUTION</div>
            <div style={{ marginTop: 10, color: '#fff', fontSize: 18, letterSpacing: -0.35, lineHeight: 1.25 }}>
              RedFlag CI catches what AI misses.
            </div>
            <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 1.65 }}>
              AST-aware checks, pattern matching, contextual validation, and structured remediation — delivered as PR
              feedback and persisted for a security dashboard you can trust.
            </div>
          </div>
        </div>
      </section>

      {/* Section D — Feature cards */}
      <section id="features" style={{ padding: '18px 0 8px' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ color: '#fff', fontSize: 18, letterSpacing: -0.35 }}>What RedFlag CI analyzes</div>
            <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 12, letterSpacing: 0.6 }}>
              Real capabilities from the RedFlag CI engine
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            <FeatureCard
              title="Credential Exposure Detection"
              body="Detects hardcoded API keys, access tokens, private keys, and database credentials using pattern matching and entropy analysis."
              tone="red"
              tag="Critical"
            />
            <FeatureCard
              title="SQL Injection Prevention"
              body="Identifies unsafe query construction patterns including string concatenation and improper user input handling."
              tone="red"
              tag="High"
            />
            <FeatureCard
              title="Dependency Integrity Validation"
              body="Validates declared packages against trusted registries. Detects non-existent, typosquatted, or suspicious dependencies."
              tone="cyan"
              tag="Supply Chain"
            />
            <FeatureCard
              title="Prompt Injection Analysis"
              body="Traces user-controlled input flowing into LLM interactions without proper validation or sanitization."
              tone="cyan"
              tag="AI-Specific"
            />
            <FeatureCard
              title="Automated Remediation"
              body="For deterministic vulnerabilities, generates corrected code that follows secure coding practices without altering intended functionality."
              tone="cyan"
              tag="Auto-Fix"
            />
            <FeatureCard
              title="Risk Scoring System"
              body="Severity × Confidence weighted scoring with qualitative classification. Critical issues dominate the score; uncertain findings are down-weighted."
              tone="neutral"
              tag="Scoring"
            />
          </div>
        </div>
      </section>

      {/* Section E — How it works */}
      <section id="workflow" style={{ padding: '22px 0 34px' }}>
        <div className="container">
          <div style={{ color: '#fff', fontSize: 18, letterSpacing: -0.35, marginBottom: 14 }}>How it works</div>
          <div className="glass glass--panel" style={{ padding: 16 }}>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                {
                  step: '1',
                  title: 'Developer opens a PR',
                  body: 'A pull request triggers RedFlag CI automatically via GitHub webhooks.',
                },
                {
                  step: '2',
                  title: 'Code diff is extracted',
                  body: 'Only modified and new files are analyzed — no full-repo scans.',
                },
                {
                  step: '3',
                  title: '4 analyzers run in parallel',
                  body: 'Credential, SQL injection, dependency, and prompt injection analyzers execute concurrently.',
                },
                {
                  step: '4',
                  title: 'Risk is scored',
                  body: 'Each finding gets severity + confidence. An aggregate Security Risk Score is computed.',
                },
                {
                  step: '5',
                  title: 'Results are delivered',
                  body: 'A structured report is posted as a PR comment. Results are also stored for the dashboard.',
                },
              ].map((s) => (
                <div
                  key={s.step}
                  className="glass"
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.02)',
                    display: 'grid',
                    gridTemplateColumns: '44px 1fr',
                    gap: 12,
                    alignItems: 'start',
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.10)',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#fff',
                      fontFamily: 'var(--mono)',
                      fontSize: 14,
                    }}
                  >
                    {s.step}
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontSize: 15, letterSpacing: -0.2 }}>{s.title}</div>
                    <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.6 }}>
                      {s.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section F — Diff preview */}
      <section id="diff" style={{ padding: '0 0 34px' }}>
        <div className="container">
          <div className="glass glass--panel" style={{ padding: 16 }}>
            <div style={{ color: '#fff', fontSize: 16, letterSpacing: -0.3 }}>Security diff viewer</div>
            <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.56)', fontSize: 12 }}>
              Vulnerabilities in red. Fixes in cyan. No ambiguity.
            </div>
            <div style={{ marginTop: 12 }}>
              <SecurityDiffViewer vulnerableCode={diffVulnerable} remediatedCode={diffRemediated} />
            </div>
          </div>
        </div>
      </section>

      {/* Section G — CTA footer */}
      <section id="cta" style={{ padding: '0 0 70px' }}>
        <div className="container">
          <div className="glass glass--panel" style={{ padding: 18 }}>
            <div style={{ color: '#fff', fontSize: 18, letterSpacing: -0.35 }}>Ready to secure your PRs?</div>
            <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 1.6 }}>
              Connect GitHub, run your first scans, and review findings in the dashboard.
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="glass glow-cyan"
                style={{
                  cursor: 'pointer',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  border: '1px solid rgba(0,251,255,0.18)',
                  fontSize: 13,
                }}
              >
                Sign in with GitHub
              </button>
              <a
                href={env.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="glass"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.88)',
                  fontSize: 13,
                }}
              >
                View documentation
              </a>
              <button
                type="button"
                onClick={() => navigate(state.status === 'authenticated' ? '/app' : '/login')}
                className="glass"
                style={{
                  cursor: 'pointer',
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.88)',
                  fontSize: 13,
                }}
              >
                Open dashboard
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
