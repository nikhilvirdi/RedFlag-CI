from typing import List, Tuple
from models import ScanFinding


SEVERITY_WEIGHTS = {
    'critical': 25,
    'high':     15,
    'medium':    8,
    'low':       3,
}

CONFIDENCE_MULTIPLIERS = {
    'high':   1.0,
    'medium': 0.7,
    'low':    0.4,
}

MAX_RAW_SCORE = 100

CLASSIFICATION_THRESHOLDS = [
    (80, 'critical'),
    (60, 'high'),
    (30, 'medium'),
    (1,  'low'),
    (0,  'clean'),
]


def calculate_risk_score(findings: List[ScanFinding]) -> Tuple[int, str, str]:
    if not findings:
        return (0, 'clean', 'No security issues detected.')

    raw_score = 0.0
    severity_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0}

    for finding in findings:
        weight = SEVERITY_WEIGHTS.get(finding.severity, 0)
        multiplier = CONFIDENCE_MULTIPLIERS.get(finding.confidence, 0.4)
        raw_score += weight * multiplier
        severity_counts[finding.severity] = severity_counts.get(finding.severity, 0) + 1

    normalized_score = min(int(raw_score), MAX_RAW_SCORE)

    classification = 'clean'
    for threshold, label in CLASSIFICATION_THRESHOLDS:
        if normalized_score >= threshold:
            classification = label
            break

    parts = []
    for sev in ('critical', 'high', 'medium', 'low'):
        count = severity_counts[sev]
        if count > 0:
            parts.append(f"{count} {sev}")

    issue_summary = ', '.join(parts)
    summary = f"{len(findings)} issue(s) found ({issue_summary}). Risk: {classification.upper()}."

    return (normalized_score, classification, summary)
