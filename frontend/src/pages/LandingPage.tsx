import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { DotLogoConstruction } from '../ui/logo/DotLogoConstruction'
import { CodeScanSimulation } from '../ui/landing/CodeScanSimulation'
import { useAuth } from '../state/auth/AuthContext'
import { MarketingNav } from '../ui/landing/MarketingNav'
import { SecurityDiffViewer } from '../ui/dashboard/SecurityDiffViewer'

const credentialVulnerable = [
  'import Stripe from "stripe";',
  '',
  '// CRITICAL: Hardcoded API key in source code',
  'const stripe = new Stripe("sk_live_4eC39HqLyjWD...");',
  '',
  'export async function charge(amount: number) {',
  '  return stripe.charges.create({ amount, currency: "usd" });',
  '}',
].join('\n')

const credentialRemediated = [
  'import Stripe from "stripe";',
  '',
  '// FIX: Load secret from environment variable',
  'const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);',
  '',
  'export async function charge(amount: number) {',
  '  return stripe.charges.create({ amount, currency: "usd" });',
  '}',
].join('\n')

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.2, 0.8, 0.2, 1] } },
}

export function LandingPage() {
  const navigate = useNavigate()
  const { state } = useAuth()
  const goApp = () => navigate(state.status === 'authenticated' ? '/app' : '/login')

  return (
    <div>
      <MarketingNav />

      {/* ─── HERO ─── */}
      <div style={{ padding: '34px 0 38px' }}>
        <div className="container">
          <div
            className="glass glass--panel"
            style={{ padding: 22, position: 'relative', overflow: 'hidden' }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: -1,
                background:
                  'radial-gradient(900px 520px at 18% 10%, rgba(0,251,255,0.10), transparent 60%), radial-gradient(900px 520px at 82% 12%, rgba(255,0,0,0.08), transparent 60%)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 18, alignItems: 'start' }}>
                <div>
                  <DotLogoConstruction width={760} height={168} density="ultra" />

                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    {[
                      { t: 'GitHub-native SAST', tone: 'neutral' as const },
                      { t: 'Auto-remediation', tone: 'cyan' as const },
                      { t: 'Risk Scoring', tone: 'red' as const },
                    ].map((p) => (
                      <div
                        key={p.t}
                        className={p.tone === 'red' ? 'glow-red' : p.tone === 'cyan' ? 'glow-cyan' : ''}
                        style={{
                          fontSize: 12,
                          letterSpacing: 0.8,
                          color: 'rgba(255,255,255,0.72)',
                          padding: '6px 10px',
                          borderRadius: 999,
                          border: '1px solid rgba(255,255,255,0.10)',
                          background:
                            p.tone === 'red'
                              ? 'rgba(255,0,0,0.04)'
                              : p.tone === 'cyan'
                                ? 'rgba(0,251,255,0.04)'
                                : 'rgba(255,255,255,0.02)',
                        }}
                      >
                        {p.t}
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      marginTop: 16,
                      color: '#fff',
                      fontSize: 28,
                      letterSpacing: -0.8,
                      lineHeight: 1.15,
                    }}
                  >
                    Catch AI-generated vulnerabilities before they ship
                  </div>

                  <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 1.65 }}>
                    RedFlag CI scans every pull request for credential exposure, SQL injection, dependency risks,
                    and prompt injection — then posts fixes directly in your PR.
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      onClick={goApp}
                      className="glass glow-cyan"
                      style={{
                        cursor: 'pointer',
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.04)',
                        color: '#fff',
                        border: '1px solid rgba(0,251,255,0.18)',
                      }}
                    >
                      Get Started Free
                    </button>
                    <button
                      onClick={() => {
                        const el = document.getElementById('how-it-works')
                        el?.scrollIntoView({ behavior: 'smooth' })
                      }}
                      className="glass"
                      style={{
                        cursor: 'pointer',
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)',
                        color: 'rgba(255,255,255,0.88)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                    >
                      See How It Works
                    </button>
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <CodeScanSimulation />
                </motion.div>
              </div>
            </div>
          </div>

          {/* Proof Strip */}
          <div style={{ marginTop: 14 }} className="glass glass--panel">
            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {[
                { k: '4 Analyzers', v: 'Credential • SQLi • Dependency • Prompt Injection', tone: 'cyan' as const },
                { k: 'Dual Output', v: 'PR Comments + Web Dashboard', tone: 'neutral' as const },
                { k: 'Risk Scoring', v: 'Severity × Confidence weighted', tone: 'red' as const },
                { k: 'Auto-Fix', v: 'Deterministic remediation for safe patterns', tone: 'cyan' as const },
              ].map((m) => (
                <div
                  key={m.k}
                  className={m.tone === 'red' ? 'glow-red' : m.tone === 'cyan' ? 'glow-cyan' : ''}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.56)', letterSpacing: 0.7 }}>{m.k}</div>
                  <div style={{ marginTop: 8, fontSize: 13, color: '#fff', lineHeight: 1.45 }}>{m.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── PROBLEM STATEMENT ─── */}
      <div style={{ padding: '22px 0' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="glass glass--panel" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, letterSpacing: 0.7, color: 'rgba(255,255,255,0.56)' }}>THE PROBLEM</div>
            <div style={{ marginTop: 10, color: '#fff', fontSize: 18, letterSpacing: -0.35, lineHeight: 1.25 }}>
              AI writes code fast. But fast ≠ secure.
            </div>
            <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.65 }}>
              AI-generated code frequently contains hardcoded credentials, unsafe database queries,
              hallucinated dependency names, and prompt injection vectors. These vulnerabilities slip
              through code review because they look syntactically correct.
            </div>
          </div>

          <div className="glass glass--panel" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, letterSpacing: 0.7, color: 'rgba(255,255,255,0.56)' }}>THE SOLUTION</div>
            <div style={{ marginTop: 10, color: '#fff', fontSize: 18, letterSpacing: -0.35, lineHeight: 1.25 }}>
              RedFlag CI catches what AI misses.
            </div>
            <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.65 }}>
              Pattern-based detection with contextual validation. AST analysis, entropy-based secret
              scanning, registry verification for dependencies, and data-flow tracing for prompt injection.
              All running automatically on every PR.
            </div>
          </div>
        </div>
      </div>

      {/* ─── FEATURES ─── */}
      <div id="features" style={{ padding: '22px 0' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ color: '#fff', fontSize: 18, letterSpacing: -0.35 }}>What RedFlag CI detects</div>
            <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 12, letterSpacing: 0.6 }}>
              4 vulnerability categories from projectDocs.md
            </div>
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}
          >
            {[
              {
                title: 'Credential Exposure Detection',
                body: 'Detects hardcoded API keys, access tokens, private keys, and database credentials using pattern matching and entropy analysis.',
                tag: 'Critical',
                tone: 'red' as const,
              },
              {
                title: 'SQL Injection Prevention',
                body: 'Identifies unsafe query construction patterns including string concatenation and improper handling of user input that may lead to injection attacks.',
                tag: 'High',
                tone: 'red' as const,
              },
              {
                title: 'Dependency Integrity Validation',
                body: 'Validates declared packages against trusted registries. Detects non-existent, typosquatted, or suspicious dependencies in your supply chain.',
                tag: 'Supply Chain',
                tone: 'cyan' as const,
              },
              {
                title: 'Prompt Injection Analysis',
                body: 'Traces user-controlled input flowing into LLM interactions without proper validation or sanitization, preventing manipulation.',
                tag: 'AI-Specific',
                tone: 'cyan' as const,
              },
              {
                title: 'Automated Remediation',
                body: 'For deterministic vulnerabilities, generates corrected code that follows secure coding practices without altering intended functionality.',
                tag: 'Auto-Fix',
                tone: 'cyan' as const,
              },
              {
                title: 'Risk Scoring System',
                body: 'Severity × Confidence weighted scoring with qualitative classification. Critical issues dominate the score; uncertain findings are down-weighted.',
                tag: 'Scoring',
                tone: 'neutral' as const,
              },
            ].map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className={`glass glass--panel ${f.tone === 'red' ? 'glow-red' : f.tone === 'cyan' ? 'glow-cyan' : ''}`}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  transition: 'transform 180ms ease',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0px)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 999,
                      border: '1px solid rgba(255,255,255,0.10)',
                      background:
                        f.tone === 'red'
                          ? 'rgba(255,0,0,0.06)'
                          : f.tone === 'cyan'
                            ? 'rgba(0,251,255,0.06)'
                            : 'rgba(255,255,255,0.04)',
                      color: 'rgba(255,255,255,0.82)',
                      letterSpacing: 0.6,
                    }}
                  >
                    {f.tag}
                  </span>
                </div>
                <div style={{ marginTop: 10, color: '#fff', fontSize: 14, letterSpacing: -0.2, lineHeight: 1.3 }}>
                  {f.title}
                </div>
                <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.55 }}>
                  {f.body}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ─── HOW IT WORKS ─── */}
      <div id="how-it-works" style={{ padding: '22px 0' }}>
        <div className="container">
          <div style={{ color: '#fff', fontSize: 18, letterSpacing: -0.35 }}>How it works</div>
          <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.56)', fontSize: 12 }}>
            Five steps from PR to secure code
          </div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            style={{ marginTop: 14, display: 'grid', gap: 10 }}
          >
            {[
              {
                step: '01',
                title: 'Developer opens a PR',
                desc: 'A pull request triggers RedFlag CI automatically via GitHub webhooks. No manual setup needed.',
              },
              {
                step: '02',
                title: 'Code diff is extracted',
                desc: 'Only modified and new files are analyzed — no full-repo scans. Incremental processing keeps analysis fast.',
              },
              {
                step: '03',
                title: '4 analyzers run in parallel',
                desc: 'Credential exposure, SQL injection, dependency integrity, and prompt injection analyzers execute concurrently.',
              },
              {
                step: '04',
                title: 'Risk is scored',
                desc: 'Each finding gets severity + confidence. Weights are applied and aggregated into a Security Risk Score with qualitative classification.',
              },
              {
                step: '05',
                title: 'Results are delivered',
                desc: 'A structured report is posted as a PR comment with inline code suggestions. Results are also stored for the web dashboard.',
              },
            ].map((s) => (
              <motion.div
                key={s.step}
                variants={fadeUp}
                className="glass glass--panel"
                style={{
                  padding: 16,
                  borderRadius: 16,
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr',
                  gap: 14,
                  alignItems: 'start',
                }}
              >
                <div
                  className="glow-cyan"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    border: '1px solid rgba(0,251,255,0.18)',
                    background: 'rgba(0,251,255,0.06)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 16,
                    fontFamily: 'var(--mono)',
                    color: '#fff',
                    letterSpacing: -0.3,
                  }}
                >
                  {s.step}
                </div>
                <div>
                  <div style={{ color: '#fff', fontSize: 14, letterSpacing: -0.2, lineHeight: 1.3 }}>
                    {s.title}
                  </div>
                  <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.55 }}>
                    {s.desc}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ─── SECURITY DIFF PREVIEW ─── */}
      <div id="diff-preview" style={{ padding: '22px 0' }}>
        <div className="container">
          <div className="glass glass--panel" style={{ padding: 16, borderRadius: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ color: '#fff', fontSize: 16, letterSpacing: -0.3 }}>Security Diff Viewer</div>
              <div style={{ color: 'rgba(255,255,255,0.56)', fontSize: 12 }}>
                Vulnerabilities in red. Fixes in cyan. No ambiguity.
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <SecurityDiffViewer
                leftTitle="Vulnerable"
                rightTitle="Remediated"
                vulnerableCode={credentialVulnerable}
                remediatedCode={credentialRemediated}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── CTA FOOTER ─── */}
      <div style={{ padding: '22px 0 70px' }}>
        <div className="container">
          <div className="glass glass--panel" style={{ padding: 16, borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ color: '#fff', fontSize: 16, letterSpacing: -0.3 }}>
                  Ready to secure your pull requests?
                </div>
                <div style={{ marginTop: 6, color: 'rgba(255,255,255,0.56)', fontSize: 12 }}>
                  Connect your GitHub repos and start scanning in under 2 minutes.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => navigate('/login')}
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
                  Sign in with GitHub
                </button>
                <button
                  onClick={goApp}
                  className="glass glow-cyan"
                  style={{
                    cursor: 'pointer',
                    padding: '8px 12px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(0,251,255,0.18)',
                    color: '#fff',
                    fontSize: 12,
                  }}
                >
                  Open Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
