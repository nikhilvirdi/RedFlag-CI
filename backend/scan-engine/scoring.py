"""
Risk Scoring Engine
───────────────────

Aggregates individual vulnerability findings into a unified risk score (0–100).

💡 How the math works:
──────────────────────
The scoring system uses a weighted aggregation model:

  Raw Score = Σ (severity_weight × confidence_multiplier)  for each finding

Then we normalize: Final Score = min(Raw Score, 100)

Example:
  Finding 1: critical severity, high confidence    → 25 × 1.0 = 25.0
  Finding 2: high severity, medium confidence      → 15 × 0.7 = 10.5
  Finding 3: low severity, low confidence          → 3 × 0.4  = 1.2
                                                    ──────────────
  Raw score = 36.7 → Normalized = 36 → Classification: MEDIUM

This ensures:
  - A single critical finding ALONE scores 25 — immediately concerning
  - 4 critical findings max out at 100 — the system screams red
  - Multiple low/medium findings accumulate honestly without false alarm
  - Low-confidence findings are dampened but not ignored entirely

💡 Why not just count findings?
───────────────────────────────
Because 10 low-severity findings are NOT the same as 1 critical finding.
"You left a console.log" × 10 is less dangerous than "You hardcoded your
database password" × 1. The weighting system captures this distinction.
"""

from typing import List, Tuple
from models import ScanFinding


# ─────────────────────────────────────────────────────────────────────────────
# WEIGHT TABLES
#
# These values are tuned so that realistic scenarios produce intuitive scores:
#   - 1 critical alone     → 25  (medium, concerning)
#   - 3 critical findings  → 75  (high, blocks merge)
#   - 1 high + 2 medium    → 31  (medium, review needed)
#   - Only low findings    → stays below 30 (low, informational)
# ─────────────────────────────────────────────────────────────────────────────

SEVERITY_WEIGHTS = {
    'critical': 25,     # A single critical finding = 25 raw points
    'high':     15,     # A single high finding = 15 raw points
    'medium':    8,     # A single medium finding = 8 raw points
    'low':       3,     # A single low finding = 3 raw points
}

CONFIDENCE_MULTIPLIERS = {
    'high':   1.0,      # Full weight — we're sure this is real
    'medium': 0.7,      # 70% weight — probably real, needs human review
    'low':    0.4,      # 40% weight — could be a false positive
}

# Score never exceeds 100
MAX_RAW_SCORE = 100

# Classification thresholds — checked top-down, first match wins
CLASSIFICATION_THRESHOLDS = [
    (80, 'critical'),   # 80–100: Critical risk — immediate action required
    (60, 'high'),       # 60–79:  High risk — should block merge
    (30, 'medium'),     # 30–59:  Medium risk — review recommended
    (1,  'low'),        # 1–29:   Low risk — informational
    (0,  'clean'),      # 0:      No issues found
]


def calculate_risk_score(findings: List[ScanFinding]) -> Tuple[int, str, str]:
    """
    Calculate the final risk score from a list of findings.

    Returns:
        A tuple of (score, classification, summary):
        - score: 0–100 integer, where higher = more dangerous
        - classification: 'critical' | 'high' | 'medium' | 'low' | 'clean'
        - summary: Human-readable one-line summary for the PR comment

    💡 Why return a tuple instead of a dict?
    Tuples enforce a fixed structure and are more memory-efficient.
    We destructure them at the call site:
        score, classification, summary = calculate_risk_score(findings)
    """
    if not findings:
        return (0, 'clean', 'No security issues detected.')

    # ── Step 1: Calculate raw weighted score ─────────────────────────────
    raw_score = 0.0
    severity_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}

    for finding in findings:
        weight = SEVERITY_WEIGHTS.get(finding.severity, 0)
        multiplier = CONFIDENCE_MULTIPLIERS.get(finding.confidence, 0.4)
        raw_score += weight * multiplier
        severity_counts[finding.severity] = severity_counts.get(finding.severity, 0) + 1

    # ── Step 2: Normalize to 0–100 ───────────────────────────────────────
    # min() caps at 100 so the score remains interpretable.
    # int() truncates (floors) — we don't round up to avoid inflating scores.
    normalized_score = min(int(raw_score), MAX_RAW_SCORE)

    # ── Step 3: Classify based on thresholds ─────────────────────────────
    classification = 'clean'
    for threshold, label in CLASSIFICATION_THRESHOLDS:
        if normalized_score >= threshold:
            classification = label
            break

    # ── Step 4: Generate human-readable summary ──────────────────────────
    parts = []
    for sev in ('critical', 'high', 'medium', 'low'):
        count = severity_counts[sev]
        if count > 0:
            parts.append(f"{count} {sev}")

    issue_summary = ', '.join(parts)
    summary = f"{len(findings)} issue(s) found ({issue_summary}). Risk: {classification.upper()}."

    return (normalized_score, classification, summary)
